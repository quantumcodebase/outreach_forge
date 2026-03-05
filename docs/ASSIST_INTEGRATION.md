# Assist Integration (Mission Control / ClawController)

## Modes

- `ASSIST_MODE=mock` (default): deterministic local outputs, no external dependencies
- `ASSIST_MODE=external`: forwards requests to configured controller URL

## Env vars

- `ASSIST_MODE=mock|external` (default `mock`)
- `MISSION_CONTROL_URL=`
- `MISSION_CONTROL_API_KEY=`
- `CLAWCONTROLLER_URL=`
- `CLAWCONTROLLER_API_KEY=`

Default-safe behavior: mock mode makes no external calls and returns deterministic JSON.

## API routes

All routes are API-key protected (`x-api-key`).

- `POST /api/v1/assist/reply-draft`
  - input: `{ "threadId": "..." }`
- `POST /api/v1/assist/thread-analysis`
  - input: `{ "threadId": "..." }`
- `POST /api/v1/assist/lead-brief`
  - input: `{ "leadId": "..." }`
- `POST /api/v1/assist/campaign-diagnostics`
  - input: `{ "campaignId": "..." }`

## Output persistence

Assist outputs are persisted in `events.metadata` as:

- `kind: "assist_output"`
- `assist_type: "reply_draft" | "thread_analysis" | "lead_brief" | "campaign_diagnostics"`
- `output_summary: { mode, summary, intent, sentiment, recommended_action, *_count }`

No schema changes required.

## Controller event proof hooks

Controller dispatch helper:

- `CONTROLLER_EVENTS_ENABLED=false` (default)
- `CONTROLLER_EVENT_TARGET=mission_control|clawcontroller|none`

When disabled/unconfigured, system stores proof payload as `events.metadata.kind="controller_event_mock"`.

## API examples (masked key)

```bash
curl -sS -X POST http://localhost:3000/api/v1/assist/thread-analysis \
  -H 'content-type: application/json' \
  -H 'x-api-key: ***REDACTED***' \
  -d '{"threadId":"thread_123"}'

curl -sS -X POST http://localhost:3000/api/v1/assist/reply-draft \
  -H 'content-type: application/json' \
  -H 'x-api-key: ***REDACTED***' \
  -d '{"threadId":"thread_123"}'
```

## UI usage (mock mode)

- Inbox thread: **Analyze thread** / **Generate reply draft**.
- Leads: **Lead brief**.
- Campaigns: **Diagnose**.
- Use **Copy output** to export results.
- Never auto-send from assist routes.

## Contract expectation for external mode

The external service should accept POSTs to:

- `/assist/reply-draft`
- `/assist/thread-analysis`
- `/assist/lead-brief`
- `/assist/campaign-diagnostics`

and return structured JSON matching the route response shape.
