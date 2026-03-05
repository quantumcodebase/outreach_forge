import { prisma } from '@cockpit/db';
import { warmLeadRadarAdapter, type WarmLeadRadarPayload } from '../integrations/lead-sources';

type ImportResult = {
  received: number;
  created: number;
  updated: number;
  skipped: number;
};

function mergeTags(existing: string[], incoming: string[]) {
  return Array.from(new Set([...(existing || []), ...(incoming || [])]));
}

export async function importWlrPayload(payload: WarmLeadRadarPayload): Promise<ImportResult> {
  const result: ImportResult = { received: payload.leads.length, created: 0, updated: 0, skipped: 0 };

  for (const record of payload.leads) {
    const normalized = warmLeadRadarAdapter.normalizeLead(record, payload);
    if (!normalized.email) {
      result.skipped += 1;
      continue;
    }

    const existing = await prisma.leads.findUnique({ where: { email: normalized.email } });
    if (!existing) {
      await prisma.leads.create({
        data: {
          email: normalized.email,
          first_name: normalized.first_name,
          last_name: normalized.last_name,
          company: normalized.company,
          title: normalized.title,
          city: normalized.city,
          tags: normalized.tags,
          custom_fields: normalized.custom_fields as any,
          status: 'active'
        }
      });
      result.created += 1;
      continue;
    }

    const existingFields = (existing.custom_fields || {}) as Record<string, unknown>;
    const mergedCustom = {
      ...existingFields,
      ...normalized.custom_fields,
      wlr: {
        ...(typeof existingFields.wlr === 'object' && existingFields.wlr ? (existingFields.wlr as Record<string, unknown>) : {}),
        ...((normalized.custom_fields.wlr || {}) as Record<string, unknown>)
      }
    };

    await prisma.leads.update({
      where: { id: existing.id },
      data: {
        first_name: normalized.first_name || existing.first_name,
        last_name: normalized.last_name || existing.last_name,
        company: normalized.company || existing.company,
        title: normalized.title || existing.title,
        city: normalized.city || existing.city,
        tags: mergeTags(existing.tags as string[], normalized.tags),
        custom_fields: mergedCustom as any
      }
    });
    result.updated += 1;
  }

  return result;
}
