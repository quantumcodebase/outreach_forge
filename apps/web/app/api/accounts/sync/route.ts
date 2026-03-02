import { NextResponse } from 'next/server';
import PgBoss from 'pg-boss';

export async function POST(req: Request) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return NextResponse.json({ ok: false, error: 'DATABASE_URL is required' }, { status: 500 });
  }

  const boss = new PgBoss({ connectionString });

  try {
    const body = await req.json().catch(() => ({}));
    await boss.start();
    await boss.createQueue('imap-sync');
    await boss.send('imap-sync', { source: 'ui-sync-now', ts: Date.now(), accountId: body.accountId || null });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[api/accounts/sync][POST] failed', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ ok: false, error: 'Failed to queue sync job' }, { status: 500 });
  } finally {
    await boss.stop().catch(() => undefined);
  }
}
