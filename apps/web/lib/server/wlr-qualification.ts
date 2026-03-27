import { prisma } from '@cockpit/db';

function scoreText(text: string, words: string[]) {
  const t = text.toLowerCase();
  return words.some((w) => t.includes(w));
}

export function deriveQualification(input: {
  why: string;
  company?: string | null;
  offerName?: string;
}) {
  const why = input.why || '';
  const painScore = scoreText(why, ['manual', 'backlog', 'slow', 'bottleneck', 'intake', 'follow-up', 'triage', 'overload']) ? 2 : 1;
  const workflowScore = scoreText(why, ['workflow', 'process', 'handoff', 'routing', 'questionnaire', 'audit', 'compliance']) ? 2 : 1;
  const buyingScore = scoreText(why, ['hiring', 'expanding', 'growth', 'scale', 'automation', 'ai']) ? 2 : 1;
  const buildabilityScore = scoreText(why, ['intake', 'follow-up', 'knowledge', 'search', 'response', 'document']) ? 2 : 1;
  const stakeholderScore = scoreText(why, ['owner', 'operator', 'ops', 'manager', 'director', 'compliance']) ? 2 : 1;
  const total = painScore + workflowScore + buyingScore + buildabilityScore + stakeholderScore;
  const status = total >= 10 ? 'pursue' : total >= 7 ? 'nurture' : 'skip';

  return {
    pain_signal: scoreText(why, ['intake', 'follow-up', 'triage']) ? 'intake/follow-up leakage' : 'manual process pain',
    change_signal: scoreText(why, ['hiring', 'growth', 'scale']) ? 'growth/expansion signal' : 'process improvement signal',
    buildability_fit: scoreText(why, ['knowledge', 'search']) ? 'internal search / answering' : 'intake/workflow automation',
    stakeholder_label: scoreText(why, ['compliance']) ? 'compliance lead' : 'owner/operator',
    proposed_wedge: scoreText(why, ['questionnaire', 'audit'])
      ? 'centralize and speed questionnaire/audit response workflow'
      : 'automate intake and follow-up handoff',
    pain_score: painScore,
    workflow_score: workflowScore,
    buying_motion_score: buyingScore,
    buildability_score: buildabilityScore,
    stakeholder_score: stakeholderScore,
    total_score: total,
    qualification_status: status,
    rationale_notes: `Derived from WLR signal text: ${why.slice(0, 240)}`,
  };
}

export async function upsertLeadQualification(args: {
  leadId: string;
  projectId: string;
  recipeId?: string | null;
  why?: string | null;
  offerType?: string | null;
}) {
  if (args.offerType !== 'custom') return null;
  const derived = deriveQualification({ why: String(args.why || '') });
  return prisma.lead_qualification.upsert({
    where: { lead_id: args.leadId },
    create: {
      lead_id: args.leadId,
      project_id: args.projectId,
      recipe_id: args.recipeId || null,
      signal_scope: 'custom_lane',
      ...derived,
    },
    update: {
      recipe_id: args.recipeId || null,
      ...derived,
    }
  });
}
