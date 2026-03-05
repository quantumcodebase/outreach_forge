import { prisma } from '@cockpit/db';
import { importWlrPayload } from '../apps/web/lib/server/wlr-import';

async function main() {
  const marker = `test-wlr-${Date.now()}`;
  const payload = {
    search_id: marker,
    run_id: `${marker}-run`,
    leads: [
      { email: `${marker}-one@example.com`, first_name: 'One', company: 'Acme', score: 90, snippets: ['snippet A'] },
      { email: `${marker}-two@example.com`, first_name: 'Two', company: 'Beta', score: 77, snippets: ['snippet B'] }
    ]
  };

  const result1 = await importWlrPayload(payload);
  const result2 = await importWlrPayload(payload);

  const imported = await prisma.leads.findMany({ where: { email: { contains: marker } } });
  const allTagged = imported.every((l) => (l.tags as string[]).includes('source:wlr'));

  const pass = result1.created === 2 && result1.updated === 0 && result2.updated === 2 && imported.length === 2 && allTagged;
  if (!pass) {
    console.log(`FAIL created=${result1.created} updated2=${result2.updated} imported=${imported.length} tagged=${allTagged}`);
    process.exit(1);
  }

  console.log(`PASS received=${result1.received} created=${result1.created} updated_second=${result2.updated}`);
}

main().catch((e) => {
  console.log(`FAIL error=${e.message}`);
  process.exit(1);
});
