export type AssistMode = 'mock' | 'external';

export type ReplyDraftInput = { threadId: string; context?: string };
export type ThreadAnalysisInput = { threadId: string };
export type LeadBriefInput = { leadId: string };
export type CampaignDiagnosticsInput = { campaignId: string };

export type ReplyDraftOutput = {
  ok: true;
  mode: AssistMode;
  draft_subject: string;
  draft_body: string;
  rationale: string[];
};

export type ThreadAnalysisOutput = {
  ok: true;
  mode: AssistMode;
  sentiment: 'positive' | 'neutral' | 'negative';
  intent: 'interested' | 'not_now' | 'unsubscribe' | 'unknown';
  summary: string;
  recommended_action: 'reply' | 'pause' | 'archive' | 'follow_up_later';
};

export type LeadBriefOutput = {
  ok: true;
  mode: AssistMode;
  summary: string;
  talking_points: string[];
  risk_flags: string[];
};

export type CampaignDiagnosticsOutput = {
  ok: true;
  mode: AssistMode;
  summary: string;
  actions: string[];
};

export interface AssistAdapter {
  generateReplyDraft(input: ReplyDraftInput): Promise<ReplyDraftOutput>;
  analyzeThread(input: ThreadAnalysisInput): Promise<ThreadAnalysisOutput>;
  analyzeLead(input: LeadBriefInput): Promise<LeadBriefOutput>;
  diagnoseCampaign(input: CampaignDiagnosticsInput): Promise<CampaignDiagnosticsOutput>;
}
