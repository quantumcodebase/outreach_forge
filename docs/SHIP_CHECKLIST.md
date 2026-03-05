# Ship Checklist

## Baseline safety defaults

- `OUTBOUND_MODE` default: `dry_run`
- Live campaign sending requires **both**:
  - `LIVE_SEND_ENABLED=true`
  - valid `UNSUBSCRIBE_SIGNING_SECRET` (not dev default)
- Never log plaintext mailbox passwords.

---

## Required env vars

Minimum for local/dev:

- `DATABASE_URL`
- `ENCRYPTION_KEY` (base64, 32-byte decoded)

For unsubscribe/live safety:

- `UNSUBSCRIBE_SIGNING_SECRET`
- `OUTBOUND_MODE` (keep `dry_run` unless explicitly switching)
- `LIVE_SEND_ENABLED` (must be `true` to allow live campaign sends)

For WLR + Assist + Controller integrations:

- `ASSIST_MODE` (`mock` default, `external` optional)
- `MISSION_CONTROL_URL` (optional)
- `MISSION_CONTROL_API_KEY` (optional)
- `CLAWCONTROLLER_URL` (optional)
- `CLAWCONTROLLER_API_KEY` (optional)
- `CONTROLLER_EVENTS_ENABLED` (`false` default)
- `CONTROLLER_EVENT_TARGET` (`none` default)

IONOS defaults:

- IMAP host: `imap.ionos.com`
- IMAP port: `993` (SSL)
- SMTP host: `smtp.ionos.com`
- SMTP port: `587` (STARTTLS)
- Username: full mailbox email address
- Password: mailbox password (not IONOS account login)

---

## Mode A (host-run)

```bash
npm run dev:web
npm run dev:worker
```

Health:

```bash
curl -sS http://localhost:4100/api/health
```

WLR import contract docs: `docs/WLR_INTEGRATION.md`
Assist integration docs: `docs/ASSIST_INTEGRATION.md`
Controller hooks docs: `docs/CONTROLLER_HOOKS.md`

---

## Mode B (docker-compose baseline)

```bash
ENCRYPTION_KEY='<base64-32-byte-key>' docker compose up --build -d
docker compose ps -a
docker compose logs -n 120 web | tail -n 80
docker compose logs -n 120 worker | tail -n 80
curl --retry 30 --retry-delay 1 --retry-connrefused -sS http://localhost:3000/api/health
```

---

## Full regression suite

```bash
npm run lint
npm run typecheck
npm run build
npm run build
npm run test:smoke
npm run test:timezone
npm run test:compliance
npm run test:wlr-import
npm run test:assist
npm run test:controller-events
```

WLR demo seed:

```bash
npm run seed:wlr-demo
```

---

## IONOS mailbox validation flow (Phase 1)

1. Open `/accounts`
2. Edit account -> **Use IONOS defaults**
3. Set `imap_user` + `smtp_user` to full mailbox email
4. Fix credentials -> enter mailbox password
5. Test connection (expect IMAP OK + SMTP OK)
6. Activate account
7. Sync now
8. Verify `/inbox` has at least one thread
9. Open a thread and send a reply from cockpit
10. Verify reply persisted as `direction=sent` on same `thread_id`

If sync fails DNS/auth, account will be marked `error` with safe stage metadata.

---

## Enabling live safely (explicit)

1. Keep defaults in `dry_run` during validation.
2. Set secure unsubscribe secret.
3. Set `LIVE_SEND_ENABLED=true`.
4. Switch `OUTBOUND_MODE=live` only when ready.
5. Run smoke + compliance checks again before rollout.
