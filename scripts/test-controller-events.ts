import { prisma } from '@cockpit/db';
import { buildControllerPayload, dispatchControllerEvent } from '../apps/web/lib/server/controller-events';

async function main() {
  process.env.CONTROLLER_EVENTS_ENABLED = 'false';
  process.env.CONTROLLER_EVENT_TARGET = 'none';

  const before = await prisma.events.count({ where: { type: 'open' } });
  const payload = buildControllerPayload({ event_type: 'reply_event', event_id: `evt-${Date.now()}`, lead_email: 'safe@example.com' });
  const out = await dispatchControllerEvent(payload);
  const after = await prisma.events.count({ where: { type: 'open' } });

  if (!out.ok || after <= before) {
    console.log(`FAIL dispatched=${out.ok} before=${before} after=${after}`);
    process.exit(1);
  }

  console.log(`PASS mode=${out.mode || 'dispatch'} proof_events_delta=${after - before}`);
}

main().catch((e) => {
  console.log(`FAIL error=${e.message}`);
  process.exit(1);
});
