#!/usr/bin/env node

const { Client } = require('pg');

const BASE64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function maskUser(value = '') {
  const [name, domain] = String(value).split('@');
  if (!domain) return `${name.slice(0, 1)}***`;
  return `${name.slice(0, 1)}***@${domain}`;
}

function inspectEncrypted(value) {
  const encrypted = value == null ? '' : String(value);
  const encryptedLen = encrypted.length;

  if (!encrypted) {
    return { bad: true, encryptedLen, decodedLen: 0, reason: 'empty' };
  }

  if (!BASE64_RE.test(encrypted)) {
    return { bad: true, encryptedLen, decodedLen: 0, reason: 'not_base64' };
  }

  let decodedLen = 0;
  try {
    decodedLen = Buffer.from(encrypted, 'base64').length;
  } catch {
    return { bad: true, encryptedLen, decodedLen: 0, reason: 'decode_failed' };
  }

  if (decodedLen < 28) {
    return { bad: true, encryptedLen, decodedLen, reason: 'too_short_for_aes256gcm' };
  }

  return { bad: false, encryptedLen, decodedLen, reason: 'ok' };
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const dryRun = !apply || args.includes('--dry-run');

  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/cold_email_cockpit';
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const res = await client.query(`
      select id, label, imap_user, smtp_user, status, encrypted_pass
      from email_accounts
      order by created_at desc
    `);

    const rows = res.rows;
    const bad = rows
      .map((r) => {
        const info = inspectEncrypted(r.encrypted_pass);
        return {
          account_id: r.id,
          label: r.label,
          status: r.status,
          masked_imap_user: maskUser(r.imap_user),
          masked_smtp_user: maskUser(r.smtp_user),
          encrypted_len: info.encryptedLen,
          decoded_len: info.decodedLen,
          reason: info.reason,
          bad: info.bad
        };
      })
      .filter((r) => r.bad);

    console.log(`[cleanup] mode=${dryRun ? 'dry-run' : 'apply'}`);
    console.log(`[cleanup] total_accounts=${rows.length}`);
    console.log(`[cleanup] bad_accounts=${bad.length}`);

    for (const row of bad) {
      console.log(
        `[cleanup] account_id=${row.account_id} label="${row.label}" imap=${row.masked_imap_user} encrypted_len=${row.encrypted_len} decoded_len=${row.decoded_len} reason=${row.reason} status=${row.status}`
      );
    }

    if (dryRun) return;

    let updated = 0;
    let eventsInserted = 0;

    for (const row of bad) {
      await client.query(`update email_accounts set status='error' where id=$1`, [row.account_id]);
      updated += 1;

      const existing = await client.query(
        `
          select id
          from events
          where type='open'
            and metadata->>'stage'='decrypt_cleanup'
            and metadata->>'account_id'=$1
          order by created_at desc
          limit 1
        `,
        [row.account_id]
      );

      if (existing.rowCount === 0) {
        await client.query(
          `
            insert into events (id, type, metadata, created_at)
            values (gen_random_uuid(), 'open', $1::jsonb, now())
          `,
          [
            JSON.stringify({
              stage: 'decrypt_cleanup',
              reason: 'invalid_encrypted_pass',
              account_id: row.account_id,
              label: row.label,
              masked_imap_user: row.masked_imap_user,
              encrypted_len: row.encrypted_len,
              decoded_len: row.decoded_len
            })
          ]
        );
        eventsInserted += 1;
      }
    }

    console.log(`[cleanup] updated_accounts=${updated}`);
    console.log(`[cleanup] events_inserted=${eventsInserted}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('[cleanup] failed', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
