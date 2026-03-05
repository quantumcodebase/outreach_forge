import type {
  LeadSourceAdapter,
  ValidationResult,
  WarmLeadRadarLead,
  WarmLeadRadarPayload
} from './types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function sanitizeTag(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9:_-]/g, '-').slice(0, 60);
}

export const warmLeadRadarAdapter: LeadSourceAdapter<WarmLeadRadarPayload, WarmLeadRadarLead> = {
  sourceName() {
    return 'wlr';
  },

  validatePayload(payload: unknown): ValidationResult {
    if (!payload || typeof payload !== 'object') return { ok: false, error: 'payload must be an object' };
    const input = payload as Record<string, unknown>;
    if (!input.search_id || typeof input.search_id !== 'string') return { ok: false, error: 'search_id required' };
    if (!Array.isArray(input.leads)) return { ok: false, error: 'leads must be an array' };
    for (const lead of input.leads as Record<string, unknown>[]) {
      const email = String(lead.email || '').toLowerCase();
      if (!EMAIL_RE.test(email)) return { ok: false, error: `invalid lead email: ${lead.email}` };
    }
    return { ok: true };
  },

  normalizeLead(record, payload) {
    const email = String(record.email || '').toLowerCase().trim();
    const tags = ['source:wlr', `wlr:search:${sanitizeTag(payload.search_id)}`];
    if (payload.run_id) tags.push(`wlr:run:${sanitizeTag(payload.run_id)}`);

    return {
      email,
      first_name: record.first_name?.trim() || null,
      last_name: record.last_name?.trim() || null,
      company: record.company?.trim() || null,
      title: record.title?.trim() || null,
      city: record.city?.trim() || null,
      tags,
      custom_fields: {
        wlr: this.buildSourceMetadata(record, payload)
      }
    };
  },

  buildSourceMetadata(record, payload) {
    return {
      search_id: payload.search_id,
      run_id: payload.run_id || null,
      search_term: payload.search_term || null,
      score: record.score ?? null,
      snippets: Array.isArray(record.snippets) ? record.snippets.slice(0, 5) : [],
      source_url: record.source_url || null,
      imported_at: new Date().toISOString()
    };
  }
};
