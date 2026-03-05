export type LeadUpsertInput = {
  email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  title: string | null;
  city: string | null;
  tags: string[];
  custom_fields: Record<string, unknown>;
};

export type WarmLeadRadarLead = {
  email: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  title?: string;
  city?: string;
  score?: number;
  snippets?: string[];
  source_url?: string;
};

export type WarmLeadRadarPayload = {
  search_id: string;
  run_id?: string;
  search_term?: string;
  leads: WarmLeadRadarLead[];
};

export type ValidationResult = { ok: true } | { ok: false; error: string };

export interface LeadSourceAdapter<TPayload = unknown, TRecord = unknown> {
  sourceName(): string;
  validatePayload(payload: unknown): ValidationResult;
  normalizeLead(record: TRecord, payload: TPayload): LeadUpsertInput;
  buildSourceMetadata(record: TRecord, payload: TPayload): Record<string, unknown>;
}
