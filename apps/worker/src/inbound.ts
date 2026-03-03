import { prisma } from '@cockpit/db';

export function classifyInbound(from: string, subject: string, body: string): 'bounce_hard' | 'bounce_soft' | 'reply' {
  const s = `${from} ${subject} ${body}`.toLowerCase();
  if (s.includes('mailer-daemon') || s.includes('delivery status notification') || s.includes('undelivered') || s.includes('5.1.1') || s.includes('user unknown')) return 'bounce_hard';
  if (s.includes('mailbox full') || s.includes('temporary failure') || s.includes('4.')) return 'bounce_soft';
  return 'reply';
}

export function extractRecipientEmail(body: string): string | null {
  const m = body.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m ? m[0].toLowerCase() : null;
}

export async function processInboundClassification(params: {
  threadId: string | null;
  messageId: string;
  from: string;
  subject: string;
  preview: string;
  inReplyTo?: string | null;
  references?: string | null;
}) {
  const existingSent = await prisma.messages.findFirst({
    where: {
      direction: 'sent',
      OR: [{ message_id_header: params.inReplyTo || '' }, { thread_id: params.threadId || '' }]
    },
    include: { enrollment: true }
  });
  if (!existingSent?.enrollment) return;

  const classification = classifyInbound(params.from, params.subject, params.preview);
  if (classification === 'reply') {
    await prisma.enrollments.update({ where: { id: existingSent.enrollment.id }, data: { status: 'replied' } });
    await prisma.events.create({
      data: {
        type: 'reply',
        lead_id: existingSent.enrollment.lead_id,
        campaign_id: existingSent.enrollment.campaign_id,
        enrollment_id: existingSent.enrollment.id,
        metadata: { thread_id: params.threadId, message_id_header: params.messageId } as any
      }
    });
    return;
  }

  await prisma.enrollments.update({ where: { id: existingSent.enrollment.id }, data: { status: 'bounced' } });
  const recipient = extractRecipientEmail(params.preview);
  if (recipient) {
    await prisma.suppression_list.create({ data: { email: recipient, reason: 'bounce_hard', source_campaign_id: existingSent.enrollment.campaign_id } }).catch(() => undefined);
  }

  await prisma.events.create({
    data: {
      type: classification,
      lead_id: existingSent.enrollment.lead_id,
      campaign_id: existingSent.enrollment.campaign_id,
      enrollment_id: existingSent.enrollment.id,
      metadata: { thread_id: params.threadId, message_id_header: params.messageId, recipient } as any
    }
  });
}
