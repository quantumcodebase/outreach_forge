import { NextResponse } from 'next/server';
import { prisma } from '@cockpit/db';
import { decrypt } from '@cockpit/shared/src/crypto';
import { makeSmtpTransport } from '../../../../lib/mail';


function parseFromAddress(preview?: string | null) {
  if (!preview) return null;
  const m = preview.match(/^\[from:\s([^\]]+)\]/i);
  if (!m) return null;
  const candidate = m[1].trim();
  return candidate.includes('@') ? candidate : null;
}


export async function POST(req: Request) {
  const { parentMessageId, html, text } = await req.json();
  const parent = await prisma.messages.findUnique({ where: { id: parentMessageId }, include: { account: true } });
  if (!parent) return NextResponse.json({ ok: false, error: 'Parent message not found' }, { status: 404 });

  const pass = decrypt(parent.account.encrypted_pass);
  const transport = makeSmtpTransport({
    imap_host: parent.account.imap_host,
    imap_port: parent.account.imap_port,
    imap_user: parent.account.imap_user,
    smtp_host: parent.account.smtp_host,
    smtp_port: parent.account.smtp_port,
    smtp_user: parent.account.smtp_user,
    password: pass
  });

  const refs = [parent.references_header, parent.message_id_header].filter(Boolean).join(' ').trim();
  const subject = parent.subject?.toLowerCase().startsWith('re:') ? parent.subject : `Re: ${parent.subject ?? ''}`.trim();
  const replyTo = parseFromAddress(parent.body_preview);

  if (!replyTo) {
    return NextResponse.json({ ok: false, error: 'Cannot determine recipient from synced message preview' }, { status: 400 });
  }

  const result = await transport.sendMail({
    from: parent.account.smtp_user,
    to: replyTo,
    subject,
    text: text || String(html || '').replace(/<[^>]+>/g, ' '),
    html,
    inReplyTo: parent.message_id_header || undefined,
    references: refs || undefined
  });

  const sentPreview = (text || String(html || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim().slice(0, 300);

  const created = await prisma.messages.create({
    data: {
      account_id: parent.account_id,
      direction: 'sent',
      message_id_header: result.messageId,
      in_reply_to: parent.message_id_header,
      references_header: refs || null,
      thread_id: parent.thread_id,
      subject,
      body_preview: sentPreview,
      sent_at: new Date()
    }
  });

  return NextResponse.json({ ok: true, id: created.id, messageId: result.messageId });
}
