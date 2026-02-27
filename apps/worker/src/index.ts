import PgBoss from 'pg-boss';
import { prisma } from '@cockpit/db';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

const boss = new PgBoss({ connectionString });

async function main() {
  await prisma.$connect();
  await boss.start();
  console.log('[worker] pg-boss connected');

  await boss.createQueue('heartbeat');

  await boss.work('heartbeat', async () => {
    console.log(`[worker] heartbeat ${new Date().toISOString()}`);
  });

  setInterval(async () => {
    await boss.send('heartbeat', { ts: Date.now() });
  }, 60_000);

  await boss.send('heartbeat', { ts: Date.now(), startup: true });
}

main().catch(async (error) => {
  console.error('[worker] failed', error);
  await boss.stop().catch(() => undefined);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  await boss.stop();
  await prisma.$disconnect();
  process.exit(0);
});
