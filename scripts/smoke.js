const { PrismaClient } = require('@prisma/client');

async function main() {
  process.env.OUTBOUND_MODE = 'dry_run';
  const prisma = new PrismaClient();

  const { runSchedulerTick, runCampaignSend } = require('../apps/worker/dist/scheduler.js');

  const marker = `smoke-${Date.now()}`;
  const email = `${marker}@example.com`;

  const account = await prisma.email_accounts.create({
    data: {
      label: `Smoke ${marker}`,
      imap_host: 'imap.example.com',
      imap_port: 993,
      imap_user: `imap-${email}`,
      smtp_host: 'smtp.example.com',
      smtp_port: 587,
      smtp_user: `smtp-${email}`,
      encrypted_pass: 'redacted',
      daily_cap: 50,
      sending_window_start: new Date('1970-01-01T08:00:00.000Z'),
      sending_window_end: new Date('1970-01-01T17:00:00.000Z'),
      timezone: 'America/Puerto_Rico',
      status: 'active'
    }
  });

  const lead = await prisma.leads.create({
    data: { email, first_name: 'Smoke', tags: [], custom_fields: {}, status: 'active' }
  });

  const campaign = await prisma.campaigns.create({
    data: {
      name: `Smoke Campaign ${marker}`,
      from_account_id: account.id,
      daily_cap: 50,
      sending_window_start: new Date('1970-01-01T08:00:00.000Z'),
      sending_window_end: new Date('1970-01-01T17:00:00.000Z'),
      timezone: 'America/Puerto_Rico',
      status: 'active'
    }
  });

  const step1 = await prisma.steps.create({
    data: { campaign_id: campaign.id, step_number: 1, subject_template: 'S1', body_template: 'B1', delay_days: 0 }
  });
  await prisma.steps.create({
    data: { campaign_id: campaign.id, step_number: 2, subject_template: 'S2', body_template: 'B2', delay_days: 1 }
  });

  const enrollment = await prisma.enrollments.create({
    data: { lead_id: lead.id, campaign_id: campaign.id, current_step: 1, status: 'active', next_send_at: new Date(Date.now() - 1000) }
  });

  await runSchedulerTick(async (enrollmentId, stepId) => {
    await runCampaignSend(enrollmentId, stepId);
  });

  const sentEvents = await prisma.events.count({
    where: { enrollment_id: enrollment.id, type: 'sent' }
  });

  const dryRunEvent = await prisma.events.findFirst({
    where: { enrollment_id: enrollment.id, type: 'sent' }
  });

  const updated = await prisma.enrollments.findUnique({ where: { id: enrollment.id } });

  const pass = sentEvents > 0 && dryRunEvent?.metadata?.mode === 'dry_run' && updated && (updated.current_step >= 2 || !!updated.next_send_at);

  if (pass) {
    console.log(`PASS sent_events=${sentEvents} current_step=${updated.current_step} next_send_at=${updated.next_send_at ? 1 : 0}`);
  } else {
    console.log(`FAIL sent_events=${sentEvents} mode=${dryRunEvent?.metadata?.mode || 'none'} current_step=${updated?.current_step || 'na'}`);
    process.exitCode = 1;
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.log(`FAIL error=${e.message}`);
  process.exit(1);
});
