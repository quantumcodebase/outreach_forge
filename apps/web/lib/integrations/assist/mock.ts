import type { AssistAdapter } from './types';

export const mockAssistAdapter: AssistAdapter = {
  async generateReplyDraft(input) {
    return {
      ok: true,
      mode: 'mock',
      draft_subject: `Re: Thread ${input.threadId.slice(0, 8)}`,
      draft_body: `Thanks for your note.\n\nI can share a short overview and next steps if helpful.\n\nBest,\nTeam`,
      rationale: ['Acknowledge quickly', 'Offer concrete next step', 'Keep under 4 lines']
    };
  },
  async analyzeThread(input) {
    return {
      ok: true,
      mode: 'mock',
      sentiment: 'neutral',
      intent: 'unknown',
      summary: `Thread ${input.threadId.slice(0, 8)} has mixed intent signals and no explicit CTA.`,
      recommended_action: 'follow_up_later'
    };
  },
  async analyzeLead(input) {
    return {
      ok: true,
      mode: 'mock',
      summary: `Lead ${input.leadId.slice(0, 8)} appears viable for low-pressure outreach.`,
      talking_points: ['Reference recent trigger event', 'Offer concise value proposition', 'Ask one clear question'],
      risk_flags: ['No recent engagement recorded']
    };
  },
  async diagnoseCampaign(input) {
    return {
      ok: true,
      mode: 'mock',
      summary: `Campaign ${input.campaignId.slice(0, 8)} likely needs tighter targeting and stronger first-line hook.`,
      actions: ['Review first step subject clarity', 'Reduce body length in step 1', 'Check suppression growth weekly']
    };
  }
};
