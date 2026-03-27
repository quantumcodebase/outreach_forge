import { prisma } from '@cockpit/db';
import { deriveQualification } from '../../web/lib/server/wlr-qualification';

const TZ = process.env.WLR_SCHED_TZ || 'America/Puerto_Rico';
const WINDOW_START_HOUR = Number(process.env.WLR_SCHED_START_HOUR || 1);
const WINDOW_END_HOUR = Number(process.env.WLR_SCHED_END_HOUR || 5);

type WlrRun = { run_id: string; status?: string; started_at?: string; ended_at?: string; error?: string | null };
type WlrRunsResp = { runs?: WlrRun[] };
type WlrLeadsResp = { leads?: any[] };

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
    weekday: String(p.weekday || 'Mon').toLowerCase()
  };
}

function toUtcFromLocal(parts: { year: number; month: number; day: number; hour: number; minute: number; second: number }) {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second));
}

function inWindow(now: Date) {
  const p = localParts(now, TZ);
  return p.hour >= WINDOW_START_HOUR && p.hour < WINDOW_END_HOUR;
}

function isWeekday(now: Date) {
  const w = localParts(now, TZ).weekday;
  return !w.startsWith('sat') && !w.startsWith('sun');
}

function sameLocalDay(a: Date, b: Date) {
  const pa = localParts(a, TZ);
  const pb = localParts(b, TZ);
  return pa.year === pb.year && pa.month === pb.month && pa.day === pb.day;
}

function nextWindow(now: Date, weekdaysOnly: boolean) {
  for (let i = 0; i < 8; i++) {
    const d = new Date(now.getTime() + i * 86400000);
    const lp = localParts(d, TZ);
    const cand = toUtcFromLocal({ ...lp, hour: WINDOW_START_HOUR, minute: 0, second: 0 });
    if (weekdaysOnly && !isWeekday(cand)) continue;
    if (cand > now) return cand;
  }
  return new Date(now.getTime() + 86400000);
}

function isTerminal(status?: string | null) {
  const s = String(status || '').toLowerCase();
  return ['succeeded', 'succeeded_with_warnings', 'failed', 'cancelled', 'error'].includes(s);
}

function isSuccess(status?: string | null) {
  const s = String(status || '').toLowerCase();
  return s === 'succeeded' || s === 'succeeded_with_warnings';
}

async function fetchRuns(projectId: string) {
  const webUrl = (process.env.WLR_WEB_URL || 'http://127.0.0.1:3005').replace(/\/$/, '');
  const res = await fetch(`${webUrl}/api/runs?project=${encodeURIComponent(projectId)}&limit=120`);
  if (!res.ok) throw new Error(`runs fetch ${res.status}`);
  const json = await res.json() as WlrRunsResp;
  return json.runs || [];
}

async function launchScheduledRun(recipe: any) {
  const settings = (recipe.settings_json || {}) as Record<string, unknown>;
  const runnerUrl = (process.env.WLR_RUNNER_URL || 'http://127.0.0.1:3123').replace(/\/$/, '');
  const runPayload = {
    project_id: recipe.project_id,
    use_recommended_hunts: true,
    target_mode: String(settings.target_mode || 'underserved'),
    run_preset: String(settings.run_preset || 'fast'),
    include_contact_form_only: Boolean(settings.include_contact_form_only ?? true),
    min_email_confidence: recipe.confidence_threshold,
    campaign_id: String(settings.campaign_id || `${recipe.project_id}-${recipe.id.slice(0, 8)}`)
  };
  const res = await fetch(`${runnerUrl}/run`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(runPayload) });
  const json = await res.json() as any;
  if (!res.ok) throw new Error(json?.detail || json?.error || `run launch failed ${res.status}`);

  await prisma.wlr_search_recipes.update({
    where: { id: recipe.id },
    data: {
      lifecycle_status: 'running_scheduled',
      pending_run_id: String(json.run_id),
      pending_run_started_at: new Date(),
      last_run_origin: 'scheduled',
      last_scheduled_run_at: new Date(),
      next_run_at: nextWindow(new Date(), recipe.cadence_type === 'weekdays')
    }
  });
}

async function syncCompletedRun(recipe: any, runId: string) {
  const webUrl = (process.env.WLR_WEB_URL || 'http://127.0.0.1:3005').replace(/\/$/, '');
  const leadsRes = await fetch(`${webUrl}/api/leads?project=${encodeURIComponent(recipe.project_id)}&mode=all&run=${encodeURIComponent(runId)}&limit=5000`);
  const leadsJson = await leadsRes.json() as WlrLeadsResp;
  const leads = leadsJson.leads || [];

  let created = 0; let updated = 0; let skipped = 0;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

  for (const row of leads) {
    const email = String(row.email_best || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email) || Number(row.email_confidence || 0) < recipe.confidence_threshold) { skipped += 1; continue; }

    const existing = await prisma.leads.findUnique({ where: { email } });
    const wlrMeta = {
      project_id: recipe.project_id,
      recipe_id: recipe.id,
      run_id: runId,
      score: row.lead_score ?? null,
      why_this_lead: row.why_this_lead || null,
      email_confidence: row.email_confidence ?? null,
      synced_at: new Date().toISOString()
    };

    if (!existing) {
      const lead = await prisma.leads.create({
        data: {
          email,
          first_name: row.name || null,
          company: row.domain || null,
          city: row.city || null,
          tags: ['source:wlr', `wlr:project:${recipe.project_id}`, `wlr:run:${runId}`],
          custom_fields: { wlr: wlrMeta } as any,
          status: 'active'
        }
      });
      if (recipe.offer_type === 'custom') {
        const derived = deriveQualification({ why: String(row.why_this_lead || ''), company: row.domain || null, offerName: recipe.offer_name });
        await prisma.lead_qualification.upsert({
          where: { lead_id: lead.id },
          create: {
            lead_id: lead.id,
            project_id: recipe.project_id,
            recipe_id: recipe.id,
            signal_scope: 'custom_lane',
            ...derived,
          },
          update: {
            recipe_id: recipe.id,
            ...derived,
          }
        });
      }
      created += 1;
    } else {
      const custom = (existing.custom_fields || {}) as Record<string, any>;
      await prisma.leads.update({
        where: { id: existing.id },
        data: {
          tags: Array.from(new Set([...(existing.tags || []), 'source:wlr', `wlr:project:${recipe.project_id}`, `wlr:run:${runId}`])),
          custom_fields: { ...custom, wlr: { ...(custom.wlr || {}), ...wlrMeta } } as any
        }
      });
      if (recipe.offer_type === 'custom') {
        const derived = deriveQualification({ why: String(row.why_this_lead || ''), company: row.domain || null, offerName: recipe.offer_name });
        await prisma.lead_qualification.upsert({
          where: { lead_id: existing.id },
          create: {
            lead_id: existing.id,
            project_id: recipe.project_id,
            recipe_id: recipe.id,
            signal_scope: 'custom_lane',
            ...derived,
          },
          update: {
            recipe_id: recipe.id,
            ...derived,
          }
        });
      }
      updated += 1;
    }
  }

  await prisma.wlr_sync_state.upsert({
    where: { project_id_recipe_id: { project_id: recipe.project_id, recipe_id: recipe.id } },
    create: {
      project_id: recipe.project_id,
      recipe_id: recipe.id,
      last_synced_run_id: runId,
      last_synced_at: new Date(),
      last_created_count: created,
      last_updated_count: updated,
      last_skipped_count: skipped,
    },
    update: {
      last_synced_run_id: runId,
      last_synced_at: new Date(),
      last_created_count: created,
      last_updated_count: updated,
      last_skipped_count: skipped,
    }
  });

  const syncedAt = new Date();
  const wasScheduled = recipe.last_run_origin === 'scheduled';
  const shouldScheduleNext = recipe.enabled && recipe.cadence_type !== 'manual' && recipe.cadence_type !== 'paused';

  await prisma.wlr_search_recipes.update({
    where: { id: recipe.id },
    data: {
      lifecycle_status: wasScheduled ? 'synced_scheduled' : 'synced_manual',
      last_synced_source_run_id: runId,
      pending_run_id: null,
      pending_run_started_at: null,
      last_sync_at: syncedAt,
      last_success_at: syncedAt,
      last_failure_at: null,
      last_failure_message: null,
      next_run_at: shouldScheduleNext ? nextWindow(syncedAt, recipe.cadence_type === 'weekdays') : null
    }
  });
}

async function processPending(recipe: any) {
  if (!recipe.pending_run_id) return;
  const runs = await fetchRuns(recipe.project_id);
  const run = runs.find((r) => r.run_id === recipe.pending_run_id);
  if (!run) return;

  await prisma.wlr_runs.upsert({
    where: { run_id: run.run_id },
    create: {
      run_id: run.run_id,
      project_id: recipe.project_id,
      status: run.status || null,
      started_at: run.started_at ? new Date(run.started_at) : null,
      ended_at: run.ended_at ? new Date(run.ended_at) : null,
      raw: run as any
    },
    update: {
      status: run.status || null,
      started_at: run.started_at ? new Date(run.started_at) : null,
      ended_at: run.ended_at ? new Date(run.ended_at) : null,
      raw: run as any,
      last_synced_at: new Date()
    }
  });

  if (!isTerminal(run.status)) {
    await prisma.wlr_search_recipes.update({ where: { id: recipe.id }, data: { lifecycle_status: 'awaiting_completion' } });
    return;
  }

  if (!isSuccess(run.status)) {
    await prisma.wlr_search_recipes.update({
      where: { id: recipe.id },
      data: {
        lifecycle_status: 'run_failed',
        pending_run_id: null,
        pending_run_started_at: null,
        last_failure_at: new Date(),
        last_failure_message: String(run.error || `run ended with ${run.status}`).slice(0, 400),
        next_run_at: nextWindow(new Date(), recipe.cadence_type === 'weekdays')
      }
    });
    return;
  }

  if (recipe.last_synced_source_run_id === run.run_id) {
    await prisma.wlr_search_recipes.update({ where: { id: recipe.id }, data: { lifecycle_status: 'already_synced', pending_run_id: null, pending_run_started_at: null } });
    return;
  }

  await prisma.wlr_search_recipes.update({ where: { id: recipe.id }, data: { lifecycle_status: 'awaiting_sync' } });
  await syncCompletedRun(recipe, run.run_id);
}

export async function runWlrSchedulerTick() {
  const now = new Date();
  const recipes = await prisma.wlr_search_recipes.findMany({
    where: {
      OR: [
        { enabled: true },
        { pending_run_id: { not: null } }
      ]
    },
    orderBy: [{ next_run_at: 'asc' }, { updated_at: 'asc' }]
  });

  let failures = 0;
  const launchedProjects = new Set<string>();

  for (const recipe of recipes) {
    try {
      if (recipe.pending_run_id) {
        await processPending(recipe);
        continue;
      }

      if (recipe.cadence_type === 'manual' || recipe.cadence_type === 'paused') {
        await prisma.wlr_search_recipes.update({ where: { id: recipe.id }, data: { next_run_at: null, lifecycle_status: 'not_scheduled' } });
        continue;
      }

      if (!inWindow(now)) {
        await prisma.wlr_search_recipes.update({ where: { id: recipe.id }, data: { next_run_at: nextWindow(now, recipe.cadence_type === 'weekdays'), lifecycle_status: 'waiting_window' } });
        continue;
      }

      if (recipe.cadence_type === 'weekdays' && !isWeekday(now)) {
        await prisma.wlr_search_recipes.update({ where: { id: recipe.id }, data: { next_run_at: nextWindow(now, true), lifecycle_status: 'waiting_weekday' } });
        continue;
      }

      if (recipe.last_scheduled_run_at && sameLocalDay(recipe.last_scheduled_run_at, now)) {
        await prisma.wlr_search_recipes.update({ where: { id: recipe.id }, data: { next_run_at: nextWindow(now, recipe.cadence_type === 'weekdays'), lifecycle_status: 'already_ran_window' } });
        continue;
      }

      if (launchedProjects.has(recipe.project_id)) {
        await prisma.wlr_search_recipes.update({ where: { id: recipe.id }, data: { next_run_at: new Date(now.getTime() + 10 * 60 * 1000), lifecycle_status: 'staggered' } });
        continue;
      }

      await launchScheduledRun(recipe);
      launchedProjects.add(recipe.project_id);
    } catch (error) {
      failures += 1;
      const msg = error instanceof Error ? error.message : String(error);
      await prisma.wlr_search_recipes.update({
        where: { id: recipe.id },
        data: {
          lifecycle_status: 'scheduler_failed',
          last_failure_at: new Date(),
          last_failure_message: msg.slice(0, 400),
          next_run_at: nextWindow(now, recipe.cadence_type === 'weekdays')
        }
      });
    }
  }

  await prisma.wlr_scheduler_state.upsert({
    where: { project_id: 'intakevault' },
    create: { project_id: 'intakevault', last_tick_at: new Date(), last_tick_ok: failures === 0, last_error: failures ? `${failures} recipe(s) failed` : null },
    update: { last_tick_at: new Date(), last_tick_ok: failures === 0, last_error: failures ? `${failures} recipe(s) failed` : null }
  });
}
