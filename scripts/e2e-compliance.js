const { PrismaClient } = require('@prisma/client');

async function main() {
  process.env.OUTBOUND_MODE = 'dry_run';
  process.env.LIVE_SEND_ENABLED = 'false';
  process.env.UNSUBSCRIBE_SIGNING_SECRET = process.env.UNSUBSCRIBE_SIGNING_SECRET || 'test-secret-123456';
  const prisma = new PrismaClient();
  const { runCampaignSend, runSchedulerTick } = require('../apps/worker/dist/scheduler.js');
  const { processInboundClassification } = require('../apps/worker/dist/inbound.js');

  const marker = `e2e-${Date.now()}`;
  const email = `${marker}@example.com`;

  const account = await prisma.email_accounts.create({ data: {
    label: `E2E ${marker}`,
    imap_host: 'imap.example.com', imap_port: 993, imap_user: `imap-${email}`,
    smtp_host: 'smtp.example.com', smtp_port: 587, smtp_user: `smtp-${email}`,
    encrypted_pass: 'redacted', daily_cap: 50,
    sending_window_start: new Date('1970-01-01T08:00:00.000Z'),
    sending_window_end: new Date('1970-01-01T17:00:00.000Z'), timezone: 'America/Puerto_Rico', status: 'active'
  }});

  const lead = await prisma.leads.create({ data: { email, tags: [], custom_fields: {}, status: 'active' } });
  const campaign = await prisma.campaigns.create({ data: {
    name: `E2E Campaign ${marker}`, from_account_id: account.id, daily_cap: 50,
    sending_window_start: new Date('1970-01-01T08:00:00.000Z'), sending_window_end: new Date('1970-01-01T17:00:00.000Z'),
    timezone: 'America/Puerto_Rico', status: 'active'
  }});

  const step1 = await prisma.steps.create({ data: { campaign_id: campaign.id, step_number: 1, subject_template: 'Hello', body_template: 'Body', delay_days: 0 } });
  await prisma.steps.create({ data: { campaign_id: campaign.id, step_number: 2, subject_template: 'Follow', body_template: 'Body2', delay_days: 1 } });

  const enr = await prisma.enrollments.create({ data: { lead_id: lead.id, campaign_id: campaign.id, current_step: 1, status: 'active', next_send_at: new Date(Date.now() - 1000) } });

  await runSchedulerTick(async (enrollmentId, stepId) => runCampaignSend(enrollmentId, stepId));

  const sentMsg = await prisma.messages.findFirst({ where: { enrollment_id: enr.id, direction: 'sent' }, orderBy: { sent_at: 'desc' } });
  if (!sentMsg || !sentMsg.body_preview.includes('/u/')) throw new Error('Missing unsubscribe link in message preview');

  const unsubMod = await import('../apps/web/lib/server/unsubscribe-core.ts');
  const { buildUnsubToken, applyUnsubscribe } = unsubMod.default || unsubMod;
  const token = buildUnsubToken({
    leadId: lead.id,
    campaignId: campaign.id,
    enrollmentId: enr.id,
    email,
    issued_at: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365
  });

  const unsubRes = await applyUnsubscribe({ token, prisma });
  if (!unsubRes.ok) throw new Error(`Unsubscribe apply failed`);

  const suppressed = await prisma.suppression_list.findFirst({ where: { email } });
  if (!suppressed) throw new Error('Suppression not written after unsubscribe');

  const enrAfterUnsub = await prisma.enrollments.findUnique({ where: { id: enr.id } });
  if (enrAfterUnsub.status !== 'unsubscribed') throw new Error('Enrollment not unsubscribed');

  const beforeCount = await prisma.events.count({ where: { enrollment_id: enr.id, type: 'sent' } });
  await runSchedulerTick(async (enrollmentId, stepId) => runCampaignSend(enrollmentId, stepId));
  const afterCount = await prisma.events.count({ where: { enrollment_id: enr.id, type: 'sent' } });
  if (afterCount !== beforeCount) throw new Error('Suppressed enrollment sent again');

  const lead2 = await prisma.leads.create({ data: { email: `${marker}-reply@example.com`, tags: [], custom_fields: {}, status: 'active' } });
  const replyThread = `thread-reply-${marker}`;
  const enr2 = await prisma.enrollments.create({ data: { lead_id: lead2.id, campaign_id: campaign.id, current_step: 1, status: 'active', thread_id: replyThread } });
  const replySentId = `<m1-${marker}@test>`;
  await prisma.messages.create({ data: { enrollment_id: enr2.id, account_id: account.id, direction: 'sent', message_id_header: replySentId, thread_id: replyThread, sent_at: new Date() } });
  await processInboundClassification({ threadId: replyThread, messageId: `<r1-${marker}@test>`, from: 'human@example.com', subject: 'Re: hi', preview: 'thanks', inReplyTo: replySentId });
  const enr2u = await prisma.enrollments.findUnique({ where: { id: enr2.id } });
  if (enr2u.status !== 'replied') throw new Error('Reply did not stop enrollment');

  const lead3 = await prisma.leads.create({ data: { email: `${marker}-bounce@example.com`, tags: [], custom_fields: {}, status: 'active' } });
  const bounceThread = `thread-bounce-${marker}`;
  const enr3 = await prisma.enrollments.create({ data: { lead_id: lead3.id, campaign_id: campaign.id, current_step: 1, status: 'active', thread_id: bounceThread } });
  const bounceSentId = `<m2-${marker}@test>`;
  await prisma.messages.create({ data: { enrollment_id: enr3.id, account_id: account.id, direction: 'sent', message_id_header: bounceSentId, thread_id: bounceThread, sent_at: new Date() } });
  await processInboundClassification({ threadId: bounceThread, messageId: `<b1-${marker}@test>`, from: 'MAILER-DAEMON', subject: 'Undelivered', preview: `Delivery failed for ${lead3.email}`, inReplyTo: bounceSentId });
  const enr3u = await prisma.enrollments.findUnique({ where: { id: enr3.id } });
  if (enr3u.status !== 'bounced') throw new Error('Bounce did not stop enrollment');
  const sup3 = await prisma.suppression_list.findFirst({ where: { email: lead3.email } });
  if (!sup3) throw new Error('Bounce suppression missing');

  console.log('PASS compliance e2e');
  await prisma.$disconnect();
}

main().catch((e) => { console.error('FAIL compliance e2e', e.message); process.exit(1); });
