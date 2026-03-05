import type PgBoss from 'pg-boss';
import { prisma } from '@cockpit/db';

export type ControllerPayload = {
  event_type: string;
  event_id: string;
  created_at: string;
  lead_email: string | null;
  lead_id: string | null;
  campaign_id: string | null;
  enrollment_id: string | null;
  thread_id: string | null;
  mode: string;
};

export function controllerEventsEnabled() {
  return (process.env.CONTROLLER_EVENTS_ENABLED || 'false').toLowerCase() === 'true';
}

export async function enqueueControllerEvent(boss: PgBoss, payload: ControllerPayload) {
  const target = (process.env.CONTROLLER_EVENT_TARGET || 'none').toLowerCase();
  if (!controllerEventsEnabled() || target === 'none') {
    await prisma.events.create({
      data: {
        type: 'open',
        lead_id: payload.lead_id,
        campaign_id: payload.campaign_id,
        enrollment_id: payload.enrollment_id,
        metadata: { kind: 'controller_event_mock', payload, target } as any
      }
    });
    return { ok: true, mode: 'mock' as const };
  }

  await boss.send('controller-event-dispatch', { payload }, { retryLimit: 5, retryDelay: 30, retryBackoff: true });
  return { ok: true, mode: 'queued' as const };
}
