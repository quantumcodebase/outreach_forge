# Morning Proof Run — IONOS (No Secrets)

## Goal
Prove mailbox connection, sync, inbox visibility, and reply loop from the UI.

## Preconditions
- App stack running (`docker compose up -d`)
- `OUTBOUND_MODE=dry_run` unless intentionally validating live send safeguards
- You have valid IONOS mailbox credentials available locally (do not paste into logs/docs)

## UI steps

1. Open `/accounts`
2. Edit target account
3. Click **Use IONOS defaults**
4. Set users as full mailbox address (`imap_user`, `smtp_user`)
5. Use **Fix credentials** and enter mailbox password
6. Click **Test connection** (expect IMAP OK + SMTP OK)
7. Set status to **active**
8. Click **Sync now**
9. Open `/inbox` and confirm at least one thread appears
10. Open a thread and send a reply from cockpit
11. Confirm sent message appears in same thread

## What to screenshot

- Accounts page showing successful test + active status (no credentials visible)
- Inbox thread list with synced messages
- Thread view with sent reply confirmation
- Optional: health endpoint response in terminal

## Optional safe DB checks

```sql
-- recent received/sent messages in the last hour
select direction, thread_id, subject, received_at, sent_at
from messages
where coalesce(received_at, sent_at) > now() - interval '1 hour'
order by coalesce(received_at, sent_at) desc
limit 20;

-- recent unsubscribe/reply/open events
select type, created_at, metadata
from events
where created_at > now() - interval '1 hour'
order by created_at desc
limit 20;
```

## Redaction rules
- Never screenshot or paste plaintext passwords/API keys.
- If sharing logs, redact `x-api-key`, auth headers, and credential fields.
