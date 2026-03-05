# Release Notes — Integrations Bundle

## Features included

1. Warm Lead Radar (WLR)
- API-key protected import endpoint: `POST /api/v1/integrations/wlr/import`
- Lead-source adapter layer for WLR payload normalization/validation
- Upsert by email with `source:wlr` tagging + `custom_fields.wlr` metadata merge
- Leads UI: source filter (All/WLR), WLR metadata summary, multi-select, bulk enroll
- Demo seed script: `npm run seed:wlr-demo`
- Integration test: `npm run test:wlr-import`

2. Assist tooling (Mission Control / ClawController ready)
- Assist adapter abstraction with `mock` and `external` backends
- API-key protected `/api/v1/assist/*` endpoints:
  - reply-draft
  - thread-analysis
  - lead-brief
  - campaign-diagnostics
- UI surfaces in Inbox, Leads, Campaigns + Copy output action
- Assist output persistence in `events.metadata` as safe summaries
- Integration test: `npm run test:assist`

3. Controller event hooks
- Controller payload builder + dispatch helper (proof mode by default)
- Hook points: reply, unsubscribe, interested label
- Disabled/default proof behavior writes `controller_event_mock` markers
- Integration test: `npm run test:controller-events`

4. Build hardening
- API route imports hardened to `@/lib/*` alias (no deep relative imports)
- `apps/web/tsconfig.json` now includes `baseUrl` + `paths` for alias stability

## Non-breaking changes

- No schema changes.
- Default outbound mode remains safe (`dry_run`).
- External controller/assist integration remains opt-in via env vars.

## Env vars added/used

- `ASSIST_MODE=mock|external` (default: `mock`)
- `MISSION_CONTROL_URL`
- `MISSION_CONTROL_API_KEY`
- `CLAWCONTROLLER_URL`
- `CLAWCONTROLLER_API_KEY`
- `CONTROLLER_EVENTS_ENABLED=false|true` (default: `false`)
- `CONTROLLER_EVENT_TARGET=mission_control|clawcontroller|none` (default: `none`)

## Remaining blocker

- Real IONOS mailbox credentials are still required to complete live mailbox proof (sync + real reply) in a production-like run.

## Next steps

1. Run proof checklist in `docs/PROOF_RUN_IONOS.md`
2. Validate WLR real payload import in dry-run mode
3. Keep assist in `mock` until external controller endpoint SLA is confirmed
4. Enable controller events only after endpoint auth + retries are verified
