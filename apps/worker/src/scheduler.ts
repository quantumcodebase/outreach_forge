import { prisma } from '@cockpit/db';

const OUTBOUND_MODE = (process.env.OUTBOUND_MODE || 'dry_run').toLowerCase();

function jitterMs(minMinutes = 1, maxMinutes = 10) {
  const min = minMinutes * 60 * 1000;
  const max = maxMinutes * 60 * 1000;
  return min + Math.floor(Math.random() * (max - min + 1));
}

function hhmmssFromDate(d: Date) {
  return d.toISOString().slice(11, 19);
}

function buildWindowDate(base: Date, hhmmss: string) {
  const [h, m, s] = hhmmss.split(':').map(Number);
  const out = new Date(base);
  out.setUTCHours(h || 0, m || 0, s || 0, 0);
  return out;
}

export function computeNextSendAt(now: Date, delayDays: number, windowStart: Date, windowEnd: Date) {
  const base = new Date(now.getTime() + Math.max(0, delayDays) * 24 * 60 * 60 * 1000);
  const start = buildWindowDate(base, hhmmssFromDate(windowStart));
  const end = buildWindowDate(base, hhmmssFromDate(windowEnd));

  let scheduled: Date;
  if (base < start) scheduled = start;
  else if (base > end) scheduled = buildWindowDate(new Date(base.getTime() + 24 * 60 * 60 * 1000), hhmmssFromDate(windowStart));
  else scheduled = new Date(base);

  return new Date(scheduled.getTime() + jitterMs());
}

export async function runCampaignSend(enrollmentId: string, stepId: string) {
  const enrollment = await prisma.enrollments.findUnique({
    where: { id: enrollmentId },
    include: {
      lead: true,
      campaign: { include: { from_account: true, steps: true } }
    }
  });
  if (!enrollment || enrollment.status !== 'active') return;

  const step = enrollment.campaign.steps.find((s) => s.id === stepId);
  if (!step) return;

  const suppressed = await prisma.suppression_list.findFirst({ where: { email: enrollment.lead.email } });
  if (suppressed) {
    await prisma.enrollments.update({ where: { id: enrollment.id }, data: { status: 'paused' } });
    await prisma.events.create({
      data: {
        type: 'unsubscribe',
        lead_id: enrollment.lead_id,
        campaign_id: enrollment.campaign_id,
        enrollment_id: enrollment.id,
        metadata: { prevented: true, reason: 'suppression_list', email: enrollment.lead.email } as any
      }
    });
    return;
  }

  if (OUTBOUND_MODE === 'live') {
    throw new Error('Live outbound is disabled until unsubscribe + suppression enforcement is fully audited. Use OUTBOUND_MODE=dry_run.');
  }

  const subject = step.subject_template;
  const bodyPreview = step.body_template.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
  const messageId = `<dry-${Date.now()}-${enrollment.id}@cockpit.local>`;

  await prisma.messages.create({
    data: {
      enrollment_id: enrollment.id,
      step_id: step.id,
      account_id: enrollment.campaign.from_account_id,
      direction: 'sent',
      message_id_header: messageId,
      thread_id: enrollment.thread_id || messageId,
      subject,
      body_preview: bodyPreview,
      sent_at: new Date()
    }
  });

  await prisma.events.create({
    data: {
      type: 'sent',
      lead_id: enrollment.lead_id,
      campaign_id: enrollment.campaign_id,
      enrollment_id: enrollment.id,
      metadata: {
        mode: 'dry_run',
        would_send: true,
        enrollment_id: enrollment.id,
        campaign_id: enrollment.campaign_id,
        lead_email: enrollment.lead.email
      } as any
    }
  });

  const nextStepNum = enrollment.current_step + 1;
  const nextStep = enrollment.campaign.steps.find((s) => s.step_number === nextStepNum);

  await prisma.enrollments.update({
    where: { id: enrollment.id },
    data: {
      thread_id: enrollment.thread_id || messageId,
      current_step: nextStepNum,
      last_sent_at: new Date(),
      next_send_at: nextStep
        ? computeNextSendAt(new Date(), nextStep.delay_days || 0, enrollment.campaign.sending_window_start, enrollment.campaign.sending_window_end)
        : null,
      status: nextStep ? 'active' : 'finished'
    }
  });
}

export async function runSchedulerTick(send: (enrollmentId: string, stepId: string) => Promise<void>) {
  const due = await prisma.enrollments.findMany({
    where: { status: 'active', next_send_at: { lte: new Date() } },
    include: {
      lead: true,
      campaign: { include: { steps: true, from_account: true } }
    },
    orderBy: { next_send_at: 'asc' },
    take: 100
  });

  for (const enr of due) {
    const leadSuppressed = await prisma.suppression_list.findFirst({ where: { email: enr.lead.email } });
    if (leadSuppressed) {
      await prisma.enrollments.update({ where: { id: enr.id }, data: { status: 'paused' } });
      await prisma.events.create({
        data: {
          type: 'unsubscribe',
          lead_id: enr.lead_id,
          campaign_id: enr.campaign_id,
          enrollment_id: enr.id,
          metadata: { prevented: true, reason: 'suppression_list', email: enr.lead.email } as any
        }
      });
      continue;
    }

    const step = enr.campaign.steps.find((s) => s.step_number === enr.current_step);
    if (!step) {
      await prisma.enrollments.update({ where: { id: enr.id }, data: { status: 'finished' } });
      continue;
    }

    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const accountCapCount = await prisma.events.count({
      where: {
        type: 'sent',
        campaign: { from_account_id: enr.campaign.from_account_id },
        created_at: { gte: dayStart }
      }
    });

    if (accountCapCount >= enr.campaign.from_account.daily_cap || accountCapCount >= enr.campaign.daily_cap) continue;

    await send(enr.id, step.id);
  }
}
