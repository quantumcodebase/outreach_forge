# Warm Lead Radar Integration

## Endpoint

`POST /api/v1/integrations/wlr/import`

## Env + safety defaults

- `OUTBOUND_MODE` remains `dry_run` by default.
- WLR import only writes/updates leads; it does not send mail.

## Auth

- Header: `x-api-key: <API_KEY>`
- Uses same API key guard as other `/api/v1` routes.

## Request payload

```json
{
  "search_id": "wlr-search-123",
  "run_id": "run-1",
  "search_term": "b2b saas founders miami",
  "leads": [
    {
      "email": "lead@example.com",
      "first_name": "Alex",
      "last_name": "Rivera",
      "company": "Northwind",
      "title": "Founder",
      "city": "Miami",
      "score": 87,
      "snippets": ["Raised seed last quarter"],
      "source_url": "https://example.com/source"
    }
  ]
}
```

## Response

```json
{
  "ok": true,
  "source": "wlr",
  "received": 1,
  "created": 1,
  "updated": 0,
  "skipped": 0
}
```

## Curl example (masked key)

```bash
curl -sS -X POST http://localhost:3000/api/v1/integrations/wlr/import \
  -H 'content-type: application/json' \
  -H 'x-api-key: ***REDACTED***' \
  -d '{
    "search_id":"wlr-search-123",
    "run_id":"run-1",
    "leads":[{"email":"lead@example.com","score":87,"snippets":["Raised seed"],"source_url":"https://example.com/source"}]
  }'
```

## Tagging + metadata behavior

- Adds tag: `source:wlr`
- Adds tag: `wlr:search:<search_id>`
- Optional run tag: `wlr:run:<run_id>`
- Stores WLR details in `leads.custom_fields.wlr`:
  - `search_id`
  - `run_id`
  - `score`
  - `snippets`
  - `source_url`
  - `imported_at`

No schema changes required.

## UI workflow

1. Open `/leads`
2. Filter source = `WLR only`
3. Multi-select leads
4. Choose campaign
5. Click **Enroll selected**

## Local demo

```bash
npm run seed:wlr-demo
```
