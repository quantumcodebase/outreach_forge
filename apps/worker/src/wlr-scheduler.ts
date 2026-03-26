import { prisma } from '@cockpit/db';

const TZ = process.env.WLR_SCHED_TZ || 'America/Puerto_Rico';
const WINDOW_START_HOUR = Number(process.env.WLR_SCHED_START_HOUR || 1);
const WINDOW_END_HOUR = Number(process.env.WLR_SCHED_END_HOUR || 5);

function utcDateFromTzParts(parts: { year: number; month: number; day: number; hour: number; minute: number; second: number }) {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second));
}

function localParts(date: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
  const p = Object.fromEntries(fmt.formatToParts(date).filter((x) => x.type !== 'literal').map((x) => [x.type, x.value]));
  return {
    year: Number(p.year), month: Number(p.month), day: Number(p.day),
    hour: Number(p.hour), minute: Number(p.minute), second: Number(p.second),
    weekday: String(p.weekday || 'Mon')
  };
}

function inWindow(now: Date, tz: string) {
  const p = localParts(now, tz);
  return p.hour >= WINDOW_START_HOUR && p.hour < WINDOW_END_HOUR;
}

function isWeekday(now: Date, tz: string) {
  const w = localParts(now, tz).weekday.toLowerCase();
  return !w.startsWith('sat') && !w.startsWith('sun');
}

function sameLocalDay(a: Date, b: Date, tz: string) {
  const pa = localParts(a, tz);
  const pb = localParts(b, tz);
  return pa.year === pb.year && pa.month === pb.month && pa.day === pb.day;
}

function nextWindow(now: Date, tz: string, weekdaysOnly: boolean) {
  for (let i = 0; i < 8; i++) {
    const d = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
    const lp = localParts(d, tz);
    const candidate = utcDateFromTzParts({ ...lp, hour: WINDOW_START_HOUR, minute: 0, second: 0 });
    if (weekdaysOnly && !isWeekday(candidate, tz)) continue;
    if (candidate > now) return candidate;
  }
  return new Date(now.getTime() + 24 * 60 * 60 * 1000);
}

type WlrRunResp = { runs?: any[] };
type WlrLeadsResp = { leads?: any[] };

async function runRecipe(recipe: any) {
  const settings = (recipe.settings_json || {}) as Record<string, unknown>;
  const runnerUrl = (process.env.WLR_RUNNER_URL || 'http://127.0.0.1:3123').replace(/\/$/, '');
  const webUrl = (process.env.WLR_WEB_URL || 'http://127.0.0.1:3005').replace(/\/$/, '');

  const runPayload = {
    project_id: recipe.project_id,
    use_recommended_hunts: true,
    target_mode: String(settings.target_mode || 'underserved'),
    run_preset: String(settings.run_preset || 'fast'),
    include_contact_form_only: Boolean(settings.include_contact_form_only ?? true),
    min_email_confidence: recipe.confidence_threshold,
    campaign_id: String(settings.campaign_id || `${recipe.project_id}-${recipe.id.slice(0, 8)}`)
  };

  const runRes = await fetch(`${runnerUrl}/run`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(runPayload)
  });
  const runJson = await runRes.json() as any;
  if (!runRes.ok) throw new Error(runJson?.detail || runJson?.error || `run failed ${runRes.status}`);

  const runsRes = await fetch(`${webUrl}/api/runs?project=${encodeURIComponent(recipe.project_id)}&limit=100`);
  const runsJson = await runsRes.json() as WlrRunResp;
  if (!runsRes.ok) throw new Error(`sync failed ${runsRes.status}`);
  const runs = runsJson.runs || [];

  const latestSyncedRun = await prisma.wlr_runs.findFirst({
    where: { project_id: recipe.project_id },
    orderBy: [{ started_at: 'desc' }, { last_synced_at: 'desc' }],
    select: { started_at: true, run_id: true }
  });
  const watermark = latestSyncedRun?.started_at ?? null;
  const runsToSync = runs.filter((r: any) => !watermark || !r.started_at || new Date(r.started_at) > watermark);

  let leads: any[] = [];
  if (!watermark) {
    const leadsRes = await fetch(`${webUrl}/api/leads?project=${encodeURIComponent(recipe.project_id)}&mode=all&all_history=1&limit=5000`);
    const leadsJson = await leadsRes.json() as WlrLeadsResp;
    leads = leadsJson.leads || [];
  } else {
    for (const run of runsToSync.slice(0, 20)) {
      const res = await fetch(`${webUrl}/api/leads?project=${encodeURIComponent(recipe.project_id)}&mode=all&run=${encodeURIComponent(run.run_id)}&limit=5000`);
      const json = await res.json() as WlrLeadsResp;
      leads.push(...(json.leads || []));
    }
  }

  let created = 0; let updated = 0; let skipped = 0;
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
  for (const run of runs) {
    await prisma.wlr_runs.upsert({
      where: { run_id: run.run_id },
      create: {
        run_id: run.run_id,
        project_id: run.project_id || recipe.project_id,
        status: run.status || null,
        started_at: run.started_at ? new Date(run.started_at) : null,
        ended_at: run.ended_at ? new Date(run.ended_at) : null,
        discovered: run.discovered ?? null,
        enriched: run.enriched ?? null,
        deduped: run.deduped ?? null,
        error: run.error || null,
        notes: run.notes || null,
        raw: run as any
      },
      update: {
        status: run.status || null,
        started_at: run.started_at ? new Date(run.started_at) : null,
        ended_at: run.ended_at ? new Date(run.ended_at) : null,
        discovered: run.discovered ?? null,
        enriched: run.enriched ?? null,
        deduped: run.deduped ?? null,
        error: run.error || null,
        notes: run.notes || null,
        raw: run as any,
        last_synced_at: new Date()
      }
    });
  }

  for (const row of leads) {
    const email = String(row.email_best || '').trim().toLowerCase();
    if (!emailRe.test(email) || Number(row.email_confidence || 0) < recipe.confidence_threshold) {
      skipped += 1;
      continue;
    }
    const existing = await prisma.leads.findUnique({ where: { email } });
    if (!existing) {
      await prisma.leads.create({
        data: {
          email,
          first_name: row.name || null,
          company: row.domain || null,
          city: row.city || null,
          tags: ['source:wlr', `wlr:project:${recipe.project_id}`],
          custom_fields: { wlr: { recipe_id: recipe.id, run_id: row.last_run_id || null, score: row.lead_score ?? null } } as any,
          status: 'active'
        }
      });
      created += 1;
    } else {
      await prisma.leads.update({ where: { id: existing.id }, data: { tags: Array.from(new Set([...(existing.tags || []), 'source:wlr', `wlr:project:${recipe.project_id}`])) } });
      updated += 1;
    }
  }

  await prisma.wlr_sync_state.upsert({
    where: { project_id_recipe_id: { project_id: recipe.project_id, recipe_id: recipe.id } },
    create: {
      project_id: recipe.project_id,
      recipe_id: recipe.id,
      last_synced_run_id: latestSyncedRun?.run_id || null,
      last_synced_at: new Date(),
      last_created_count: created,
      last_updated_count: updated,
      last_skipped_count: skipped,
    },
    update: {
      last_synced_run_id: latestSyncedRun?.run_id || null,
      last_synced_at: new Date(),
      last_created_count: created,
      last_updated_count: updated,
      last_skipped_count: skipped,
    }
  });

  await prisma.wlr_search_recipes.update({
    where: { id: recipe.id },
    data: {
      last_run_at: new Date(),
      last_sync_at: new Date(),
      last_run_origin: 'scheduled',
      last_scheduled_run_at: new Date(),
      last_success_at: new Date(),
      last_failure_at: null,
      last_failure_message: null,
      next_run_at: nextWindow(new Date(), TZ, recipe.cadence_type === 'weekdays')
    }
  });
}

export async function runWlrSchedulerTick() {
  const now = new Date();
  const recipes = await prisma.wlr_search_recipes.findMany({ where: { enabled: true }, orderBy: [{ next_run_at: 'asc' }, { updated_at: 'asc' }] });

  let failures = 0;
  const launchedProjects = new Set<string>();
  for (const recipe of recipes) {
    if (recipe.cadence_type === 'manual' || recipe.cadence_type === 'paused') {
      await prisma.wlr_search_recipes.update({ where: { id: recipe.id }, data: { next_run_at: null } });
      continue;
    }

    if (!inWindow(now, TZ)) {
      await prisma.wlr_search_recipes.update({ where: { id: recipe.id }, data: { next_run_at: nextWindow(now, TZ, recipe.cadence_type === 'weekdays') } });
      continue;
    }

    if (recipe.cadence_type === 'weekdays' && !isWeekday(now, TZ)) {
      await prisma.wlr_search_recipes.update({ where: { id: recipe.id }, data: { next_run_at: nextWindow(now, TZ, true) } });
      continue;
    }

    if (recipe.last_scheduled_run_at && sameLocalDay(recipe.last_scheduled_run_at, now, TZ)) {
      await prisma.wlr_search_recipes.update({ where: { id: recipe.id }, data: { next_run_at: nextWindow(now, TZ, recipe.cadence_type === 'weekdays') } });
      continue;
    }

    if (launchedProjects.has(recipe.project_id)) {
      await prisma.wlr_search_recipes.update({ where: { id: recipe.id }, data: { next_run_at: new Date(now.getTime() + 10 * 60 * 1000) } });
      continue;
    }

    try {
      await runRecipe(recipe);
      launchedProjects.add(recipe.project_id);
    } catch (error) {
      failures += 1;
      const message = error instanceof Error ? error.message : String(error);
      await prisma.wlr_search_recipes.update({
        where: { id: recipe.id },
        data: {
          last_failure_at: new Date(),
          last_failure_message: message.slice(0, 400),
          next_run_at: nextWindow(now, TZ, recipe.cadence_type === 'weekdays')
        }
      });
    }
  }

  await prisma.wlr_scheduler_state.upsert({
    where: { project_id: 'intakevault' },
    create: {
      project_id: 'intakevault',
      last_tick_at: new Date(),
      last_tick_ok: failures === 0,
      last_error: failures ? `${failures} recipe(s) failed` : null,
    },
    update: {
      last_tick_at: new Date(),
      last_tick_ok: failures === 0,
      last_error: failures ? `${failures} recipe(s) failed` : null,
    }
  });
}
