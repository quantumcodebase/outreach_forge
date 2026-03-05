# Build Stability Notes

## Incident
- Time: ~2026-03-04 22:25 AST
- Symptom: `npm run build` exited with code 1 from `apps/web`.
- Available captured system summary:
  - `npm error Lifecycle script 'build' failed with error`
  - `npm error code 1`
  - `npm error path /Users/clawd/.openclaw/workspace/cold-email-cockpit/apps/web`

## Root cause bucket
**A) Deterministic code/build error**

During verification, the same build class failed with concrete webpack errors in `apps/web`:
- `Module not found: Can't resolve '../../../../../../lib/api-key'`
- `Module not found: Can't resolve '../../../../../../lib/integrations/assist'`
- `Module not found: Can't resolve '../../../../../../lib/server/assist-events'`

Root cause: incorrect relative import depth in `apps/web/app/api/v1/assist/*/route.ts`.

## Fix applied (minimal)
Adjusted imports in 4 files under `apps/web/app/api/v1/assist/` from:
- `../../../../../../lib/...`
to:
- `../../../../../lib/...`

No schema changes, no refactor.

## Repro
From repo root:
```bash
npm run build
```

Before fix: fails in assist routes with module resolution errors.
After fix: build passes.

## Recommended stable commands
```bash
npm run build
npm run build
```
