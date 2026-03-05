const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  const marker = `wlr-demo-${Date.now()}`;
  const leads = [
    { email: `${marker}-anna@example.com`, first_name: 'Anna', company: 'Northwind', title: 'Ops Lead', city: 'Miami', score: 88 },
    { email: `${marker}-ben@example.com`, first_name: 'Ben', company: 'Acme', title: 'Founder', city: 'Austin', score: 81 },
    { email: `${marker}-cara@example.com`, first_name: 'Cara', company: 'Globex', title: 'Marketing Manager', city: 'NYC', score: 76 }
  ];

  for (const lead of leads) {
    await prisma.leads.upsert({
      where: { email: lead.email },
      update: {
        first_name: lead.first_name,
        company: lead.company,
        title: lead.title,
        city: lead.city,
        status: 'active',
        tags: ['source:wlr', `wlr:search:${marker}`],
        custom_fields: {
          wlr: {
            search_id: marker,
            run_id: `${marker}-run-1`,
            score: lead.score,
            snippets: ['Demo import from seed:wlr-demo'],
            source_url: 'https://example.com/wlr-demo'
          }
        }
      },
      create: {
        email: lead.email,
        first_name: lead.first_name,
        company: lead.company,
        title: lead.title,
        city: lead.city,
        status: 'active',
        tags: ['source:wlr', `wlr:search:${marker}`],
        custom_fields: {
          wlr: {
            search_id: marker,
            run_id: `${marker}-run-1`,
            score: lead.score,
            snippets: ['Demo import from seed:wlr-demo'],
            source_url: 'https://example.com/wlr-demo'
          }
        }
      }
    });
  }

  console.log(`PASS seeded=${leads.length} search_id=${marker}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(`FAIL ${e.message}`);
  process.exit(1);
});
