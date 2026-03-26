import { prisma } from '@cockpit/db';

type RecipeSeed = {
  name: string;
  offer_name: string;
  offer_type: 'core' | 'custom' | 'experimental';
  icp_label: string;
  workflow_label: string;
  geography_label: string;
  cadence_type: 'manual' | 'nightly' | 'weekdays' | 'paused';
  enabled: boolean;
  confidence_threshold: number;
  lead_cap: number;
  settings_json: Record<string, unknown>;
};

export const DEFAULT_PROJECT_ID = 'intakevault';

const seeds: RecipeSeed[] = [
  { name: 'SourceLedger — Exam / Regulatory Response — Insurance', offer_name: 'SourceLedger', offer_type: 'core', icp_label: 'Insurance operators', workflow_label: 'Exam/regulatory response', geography_label: 'US regional', cadence_type: 'weekdays', enabled: true, confidence_threshold: 65, lead_cap: 200, settings_json: { target_mode: 'high_intent', run_preset: 'fast', include_contact_form_only: false } },
  { name: 'SourceLedger — DDQ / Questionnaire Response — Regulated B2B', offer_name: 'SourceLedger', offer_type: 'core', icp_label: 'Regulated B2B teams', workflow_label: 'DDQ/questionnaire response', geography_label: 'US + Canada', cadence_type: 'weekdays', enabled: true, confidence_threshold: 65, lead_cap: 200, settings_json: { target_mode: 'high_intent', run_preset: 'fast', include_contact_form_only: false } },
  { name: 'SourceLedger — Audit / Evidence Workflow — Compliance Teams', offer_name: 'SourceLedger', offer_type: 'core', icp_label: 'Compliance teams', workflow_label: 'Audit/evidence workflow', geography_label: 'US regional', cadence_type: 'nightly', enabled: true, confidence_threshold: 65, lead_cap: 200, settings_json: { target_mode: 'high_intent', run_preset: 'overnight', include_contact_form_only: false } },
  { name: 'AI Receptionist — Emergency Inbound — Home Services', offer_name: 'AI Receptionist', offer_type: 'core', icp_label: 'Home service SMBs', workflow_label: 'Emergency inbound response', geography_label: 'PR + US South', cadence_type: 'nightly', enabled: true, confidence_threshold: 60, lead_cap: 250, settings_json: { target_mode: 'underserved', run_preset: 'overnight', include_contact_form_only: true } },
  { name: 'AI Receptionist — Front Desk Coverage — Clinics', offer_name: 'AI Receptionist', offer_type: 'core', icp_label: 'Clinic operators', workflow_label: 'Front desk overflow', geography_label: 'US metro', cadence_type: 'weekdays', enabled: true, confidence_threshold: 60, lead_cap: 220, settings_json: { target_mode: 'underserved', run_preset: 'fast', include_contact_form_only: true } },
  { name: 'Custom AI Ops — Intake / Follow-Up Automation — Service SMBs', offer_name: 'Custom AI Ops', offer_type: 'custom', icp_label: 'Service SMB owners', workflow_label: 'Intake + follow-up automation', geography_label: 'US + Puerto Rico', cadence_type: 'manual', enabled: false, confidence_threshold: 60, lead_cap: 150, settings_json: { target_mode: 'underserved', run_preset: 'fast', include_contact_form_only: true } },
  { name: 'Custom AI Ops — Internal Workflow Automation — SMB Operations', offer_name: 'Custom AI Ops', offer_type: 'custom', icp_label: 'SMB operations leaders', workflow_label: 'Internal workflow automation', geography_label: 'US regional', cadence_type: 'manual', enabled: false, confidence_threshold: 60, lead_cap: 150, settings_json: { target_mode: 'high_intent', run_preset: 'fast', include_contact_form_only: false } },
  { name: 'Custom AI Knowledge Workflow — Internal Search / Answering — Mid-market Teams', offer_name: 'Custom AI Knowledge Workflow', offer_type: 'custom', icp_label: 'Mid-market ops teams', workflow_label: 'Internal search + answering', geography_label: 'US national', cadence_type: 'manual', enabled: false, confidence_threshold: 62, lead_cap: 120, settings_json: { target_mode: 'high_intent', run_preset: 'fast', include_contact_form_only: false } },
  { name: 'Experimental — General AI Intent Signals — Regional SMBs', offer_name: 'Experimental AI', offer_type: 'experimental', icp_label: 'Regional SMBs', workflow_label: 'General AI intent watchlist', geography_label: 'US regional', cadence_type: 'paused', enabled: false, confidence_threshold: 70, lead_cap: 100, settings_json: { target_mode: 'high_intent', run_preset: 'fast', include_contact_form_only: false } },
];

export async function ensureRecipeSeeds(projectId = DEFAULT_PROJECT_ID) {
  for (const seed of seeds) {
    await prisma.wlr_search_recipes.upsert({
      where: { project_id_name: { project_id: projectId, name: seed.name } },
      create: { project_id: projectId, ...seed, settings_json: seed.settings_json as any },
      update: {
        offer_name: seed.offer_name,
        offer_type: seed.offer_type,
        icp_label: seed.icp_label,
        workflow_label: seed.workflow_label,
        geography_label: seed.geography_label,
        confidence_threshold: seed.confidence_threshold,
        lead_cap: seed.lead_cap,
        settings_json: seed.settings_json as any
      }
    });
  }
}

export async function getRecipes(projectId = DEFAULT_PROJECT_ID) {
  await ensureRecipeSeeds(projectId);
  return prisma.wlr_search_recipes.findMany({ where: { project_id: projectId }, orderBy: [{ offer_type: 'asc' }, { name: 'asc' }] });
}
