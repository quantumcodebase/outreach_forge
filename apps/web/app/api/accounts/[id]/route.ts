import { NextResponse } from 'next/server';
import { prisma } from '@cockpit/db';

type Body = {
  label?: string;
  imap_host?: string;
  imap_port?: number;
  imap_user?: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  timezone?: string;
  daily_cap?: number;
  sending_window_start?: string;
  sending_window_end?: string;
  allow_placeholder_hosts?: boolean;
};

function isPlaceholderHost(host: string) {
  const h = host.toLowerCase();
  return h.includes('example.com') || h.includes('placeholder') || h === 'imap.example.com' || h === 'smtp.example.com';
}

function parsePort(value: unknown) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 65535) return null;
  return n;
}

function parseWindow(value: unknown) {
  const text = String(value || '').trim();
  if (!/^\d{2}:\d{2}:\d{2}$/.test(text)) return null;
  return new Date(`1970-01-01T${text}.000Z`);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as Body;

    const existing = await prisma.email_accounts.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ ok: false, error: 'account not found' }, { status: 404 });

    const patch: Record<string, unknown> = {};
    const changedFields: string[] = [];

    const setIfChanged = (key: keyof Body, next: unknown) => {
      if (next === undefined) return;
      const prev = (existing as any)[key];
      if (String(prev) !== String(next)) {
        patch[key] = next;
        changedFields.push(key);
      }
    };

    if (body.label !== undefined) {
      const label = String(body.label).trim();
      if (!label) return NextResponse.json({ ok: false, error: 'label is required' }, { status: 400 });
      setIfChanged('label', label);
    }

    if (body.imap_host !== undefined) {
      const host = String(body.imap_host).trim();
      if (!host) return NextResponse.json({ ok: false, error: 'imap_host is required' }, { status: 400 });
      if (isPlaceholderHost(host) && !body.allow_placeholder_hosts) {
        return NextResponse.json({ ok: false, error: 'imap_host looks like placeholder; pass allow_placeholder_hosts=true to confirm' }, { status: 400 });
      }
      setIfChanged('imap_host', host);
    }

    if (body.smtp_host !== undefined) {
      const host = String(body.smtp_host).trim();
      if (!host) return NextResponse.json({ ok: false, error: 'smtp_host is required' }, { status: 400 });
      if (isPlaceholderHost(host) && !body.allow_placeholder_hosts) {
        return NextResponse.json({ ok: false, error: 'smtp_host looks like placeholder; pass allow_placeholder_hosts=true to confirm' }, { status: 400 });
      }
      setIfChanged('smtp_host', host);
    }

    if (body.imap_user !== undefined) {
      const v = String(body.imap_user).trim();
      if (!v) return NextResponse.json({ ok: false, error: 'imap_user is required' }, { status: 400 });
      setIfChanged('imap_user', v);
    }

    if (body.smtp_user !== undefined) {
      const v = String(body.smtp_user).trim();
      if (!v) return NextResponse.json({ ok: false, error: 'smtp_user is required' }, { status: 400 });
      setIfChanged('smtp_user', v);
    }

    if (body.timezone !== undefined) {
      const v = String(body.timezone).trim();
      if (!v) return NextResponse.json({ ok: false, error: 'timezone is required' }, { status: 400 });
      setIfChanged('timezone', v);
    }

    if (body.imap_port !== undefined) {
      const p = parsePort(body.imap_port);
      if (!p) return NextResponse.json({ ok: false, error: 'invalid imap_port' }, { status: 400 });
      setIfChanged('imap_port', p);
    }

    if (body.smtp_port !== undefined) {
      const p = parsePort(body.smtp_port);
      if (!p) return NextResponse.json({ ok: false, error: 'invalid smtp_port' }, { status: 400 });
      setIfChanged('smtp_port', p);
    }

    if (body.daily_cap !== undefined) {
      const cap = Number(body.daily_cap);
      if (!Number.isInteger(cap) || cap < 1 || cap > 10000) return NextResponse.json({ ok: false, error: 'invalid daily_cap' }, { status: 400 });
      setIfChanged('daily_cap', cap);
    }

    if (body.sending_window_start !== undefined) {
      const d = parseWindow(body.sending_window_start);
      if (!d) return NextResponse.json({ ok: false, error: 'invalid sending_window_start' }, { status: 400 });
      if (existing.sending_window_start.toISOString() !== d.toISOString()) {
        patch.sending_window_start = d;
        changedFields.push('sending_window_start');
      }
    }

    if (body.sending_window_end !== undefined) {
      const d = parseWindow(body.sending_window_end);
      if (!d) return NextResponse.json({ ok: false, error: 'invalid sending_window_end' }, { status: 400 });
      if (existing.sending_window_end.toISOString() !== d.toISOString()) {
        patch.sending_window_end = d;
        changedFields.push('sending_window_end');
      }
    }

    if (changedFields.length === 0) return NextResponse.json({ ok: true, changedFields: [] });

    patch.status = 'paused';

    await prisma.email_accounts.update({ where: { id }, data: patch as any });
    await prisma.events.create({
      data: {
        type: 'open',
        metadata: {
          stage: 'account_settings_update',
          account_id: id,
          label: existing.label,
          changedFields,
          to_status: 'paused'
        } as any
      }
    });

    return NextResponse.json({ ok: true, changedFields });
  } catch (error) {
    console.error('[api/accounts/:id][PATCH] failed', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ ok: false, error: 'failed to update account' }, { status: 500 });
  }
}
