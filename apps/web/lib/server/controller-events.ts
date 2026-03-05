import { prisma } from '@cockpit/db';

type ControllerTarget = 'mission_control' | 'clawcontroller' | 'none';

function getConfig() {
  return {
    enabled: (process.env.CONTROLLER_EVENTS_ENABLED || 'false').toLowerCase() === 'true',
    target: ((process.env.CONTROLLER_EVENT_TARGET || 'none').toLowerCase() as ControllerTarget)
  };
}

export function buildControllerPayload(input: {
  event_type: string;
  event_id: string;
  lead_email?: string | null;
  lead_id?: string | null;
  campaign_id?: string | null;
  enrollment_id?: string | null;
  thread_id?: string | null;
  mode?: string;
}) {
  return {
    event_type: input.event_type,
    event_id: input.event_id,
    created_at: new Date().toISOString(),
    lead_email: input.lead_email || null,
    lead_id: input.lead_id || null,
    campaign_id: input.campaign_id || null,
    enrollment_id: input.enrollment_id || null,
    thread_id: input.thread_id || null,
    mode: input.mode || (process.env.OUTBOUND_MODE || 'dry_run')
  };
}

export async function dispatchControllerEvent(payload: ReturnType<typeof buildControllerPayload>) {
  const cfg = getConfig();
  if (!cfg.enabled || cfg.target === 'none') {
    await prisma.events.create({
      data: {
        type: 'open',
        lead_id: payload.lead_id,
        campaign_id: payload.campaign_id,
        enrollment_id: payload.enrollment_id,
        metadata: {
          kind: 'controller_event_mock',
          dispatch_enabled: cfg.enabled,
          target: cfg.target,
          payload
        } as any
      }
    });
    return { ok: true, mode: 'proof' as const };
  }

  const targetUrl = cfg.target === 'mission_control' ? process.env.MISSION_CONTROL_URL : process.env.CLAWCONTROLLER_URL;
  const apiKey = cfg.target === 'mission_control' ? process.env.MISSION_CONTROL_API_KEY : process.env.CLAWCONTROLLER_API_KEY;
  if (!targetUrl) return { ok: false, error: 'controller target url missing' };

  const res = await fetch(`${targetUrl.replace(/\/$/, '')}/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) },
    body: JSON.stringify(payload)
  });

  return { ok: res.ok, status: res.status };
}
