# Controller Hooks (Mission Control / ClawController)

## Safety defaults

- `CONTROLLER_EVENTS_ENABLED=false` (default)
- `CONTROLLER_EVENT_TARGET=none` (default)
- With defaults, no external dispatch occurs.
- Proof mode writes an internal event marker: `events.metadata.kind="controller_event_mock"`.

## Env vars

- `CONTROLLER_EVENTS_ENABLED=false|true`
- `CONTROLLER_EVENT_TARGET=mission_control|clawcontroller|none`
- `MISSION_CONTROL_URL=`
- `MISSION_CONTROL_API_KEY=`
- `CLAWCONTROLLER_URL=`
- `CLAWCONTROLLER_API_KEY=`

## Hook points

Current hooks emit controller payloads on:
- outbound reply
- unsubscribe
- label set to `Interested`
- manual campaign diagnostics run (recorded via assist output)

## Safe payload shape

```json
{
  "event_type": "reply_event",
  "event_id": "evt_123",
  "created_at": "2026-03-05T23:00:00.000Z",
  "lead_email": "lead@example.com",
  "lead_id": "lead_123",
  "campaign_id": "camp_123",
  "enrollment_id": "enr_123",
  "thread_id": "thread_123",
  "mode": "dry_run"
}
```

No plaintext mailbox passwords or full message bodies are included.

## Enabling later

1. Set `CONTROLLER_EVENTS_ENABLED=true`
2. Set `CONTROLLER_EVENT_TARGET=mission_control` (or `clawcontroller`)
3. Set target URL + API key
4. Keep `OUTBOUND_MODE=dry_run` during validation
5. Trigger a known hook and verify controller receives payload
