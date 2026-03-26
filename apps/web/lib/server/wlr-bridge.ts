import { prisma } from '@cockpit/db';

type WlrLeadRow = {
  lead_id?: string;
  last_run_id?: string;
  name?: string;
  domain?: string;
  city?: string;
  category?: string;
  lead_score?: number;
  why_this_lead?: string;
  email_best?: string;
  email_confidence?: number;
  email_source_url?: string;
};

type WlrRunRow = {
  run_id: string;
  project_id?: string;
  status?: string;
  started_at?: string;
  ended_at?: string;
  discovered?: number;
  enriched?: number;
  deduped?: number;
  error?: string;
  notes?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function normalizeEmail(email?: string | null) {
  const value = String(email || '').trim().toLowerCase();
  return EMAIL_RE.test(value) ? value : null;
}

function baseUrl(env: string, fallback: string) {
  return (process.env[env] || fallback).replace(/\/$/, '');
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`WLR fetch failed ${res.status} ${url}`);
  return (await res.json()) as T;
}

export async function syncWlrProject(projectId: string) {
  const wlrWebUrl = baseUrl('WLR_WEB_URL', 'http://127.0.0.1:3005');
  const runsRes = await fetchJson<{ runs: WlrRunRow[] }>(`${wlrWebUrl}/api/runs?project=${encodeURIComponent(projectId)}&limit=50`);
  const leadsRes = await fetchJson<{ leads: WlrLeadRow[] }>(
    `${wlrWebUrl}/api/leads?project=${encodeURIComponent(projectId)}&mode=all&all_history=1&limit=5000`
  );

  let created = 0;
  let updated = 0;
  let skippedNoEmail = 0;

  for (const run of runsRes.runs || []) {
    await prisma.wlr_runs.upsert({
      where: { run_id: run.run_id },
      create: {
        run_id: run.run_id,
        project_id: run.project_id || projectId,
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
        project_id: run.project_id || projectId,
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

  for (const row of leadsRes.leads || []) {
    const email = normalizeEmail(row.email_best);
    if (!email) {
      skippedNoEmail += 1;
      continue;
    }

    const existing = await prisma.leads.findUnique({ where: { email } });
    const wlrMeta = {
      project_id: projectId,
      lead_id: row.lead_id || null,
      run_id: row.last_run_id || null,
      score: row.lead_score ?? null,
      why_this_lead: row.why_this_lead || null,
      email_confidence: row.email_confidence ?? null,
      email_source_url: row.email_source_url || null,
      synced_at: new Date().toISOString()
    };

    if (!existing) {
      await prisma.leads.create({
        data: {
          email,
          first_name: row.name || null,
          company: row.domain || null,
          city: row.city || null,
          tags: ['source:wlr', `wlr:project:${projectId}`],
          custom_fields: { wlr: wlrMeta } as any,
          status: 'active'
        }
      });
      created += 1;
      continue;
    }

    const tags = Array.from(new Set([...(existing.tags || []), 'source:wlr', `wlr:project:${projectId}`, row.last_run_id ? `wlr:run:${row.last_run_id}` : ''].filter(Boolean)));
    const existingCustom = (existing.custom_fields || {}) as Record<string, unknown>;
    const existingWlr = (existingCustom.wlr || {}) as Record<string, unknown>;

    await prisma.leads.update({
      where: { id: existing.id },
      data: {
        first_name: existing.first_name || row.name || null,
        company: existing.company || row.domain || null,
        city: existing.city || row.city || null,
        tags,
        custom_fields: {
          ...existingCustom,
          wlr: {
            ...existingWlr,
            ...wlrMeta
          }
        } as any
      }
    });
    updated += 1;
  }

  return {
    projectId,
    runsSynced: (runsRes.runs || []).length,
    leadsReceived: (leadsRes.leads || []).length,
    created,
    updated,
    skippedNoEmail
  };
}

export async function triggerWlrRun(payload: Record<string, unknown>) {
  const runnerUrl = baseUrl('WLR_RUNNER_URL', 'http://127.0.0.1:3123');
  const res = await fetch(`${runnerUrl}/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.detail || json?.error || `runner error ${res.status}`);
  return json;
}

export async function getWlrRun(runId: string) {
  const runnerUrl = baseUrl('WLR_RUNNER_URL', 'http://127.0.0.1:3123');
  const res = await fetch(`${runnerUrl}/runs/${encodeURIComponent(runId)}`, { cache: 'no-store' });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.detail || json?.error || `runner error ${res.status}`);
  return json;
}
