import { prisma } from '@cockpit/db';

export async function persistAssistOutput(input: {
  assist_type: 'reply_draft' | 'thread_analysis' | 'lead_brief' | 'campaign_diagnostics';
  thread_id?: string | null;
  lead_id?: string | null;
  campaign_id?: string | null;
  enrollment_id?: string | null;
  output: Record<string, unknown>;
}) {
  const summary = {
    mode: input.output.mode,
    summary: input.output.summary,
    intent: input.output.intent,
    sentiment: input.output.sentiment,
    recommended_action: input.output.recommended_action,
    actions_count: Array.isArray(input.output.actions) ? input.output.actions.length : undefined,
    talking_points_count: Array.isArray(input.output.talking_points) ? input.output.talking_points.length : undefined,
    rationale_count: Array.isArray(input.output.rationale) ? input.output.rationale.length : undefined
  };

  await prisma.events.create({
    data: {
      type: 'open',
      lead_id: input.lead_id || null,
      campaign_id: input.campaign_id || null,
      enrollment_id: input.enrollment_id || null,
      metadata: {
        kind: 'assist_output',
        assist_type: input.assist_type,
        thread_id: input.thread_id || null,
        output_summary: summary,
        created_by: 'api_v1_assist'
      } as any
    }
  });
}
