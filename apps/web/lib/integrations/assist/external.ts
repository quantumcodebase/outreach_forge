import type {
  AssistAdapter,
  CampaignDiagnosticsInput,
  LeadBriefInput,
  ReplyDraftInput,
  ThreadAnalysisInput
} from './types';

async function postJson<TReq extends object, TRes>(path: string, payload: TReq): Promise<TRes> {
  const base = process.env.MISSION_CONTROL_URL || process.env.CLAWCONTROLLER_URL;
  const apiKey = process.env.MISSION_CONTROL_API_KEY || process.env.CLAWCONTROLLER_API_KEY;
  if (!base) throw new Error('external assist URL not configured');

  const res = await fetch(`${base.replace(/\/$/, '')}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {})
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) throw new Error(`assist external ${res.status}`);
  return (await res.json()) as TRes;
}

export const externalAssistAdapter: AssistAdapter = {
  generateReplyDraft(input: ReplyDraftInput) {
    return postJson('/assist/reply-draft', input);
  },
  analyzeThread(input: ThreadAnalysisInput) {
    return postJson('/assist/thread-analysis', input);
  },
  analyzeLead(input: LeadBriefInput) {
    return postJson('/assist/lead-brief', input);
  },
  diagnoseCampaign(input: CampaignDiagnosticsInput) {
    return postJson('/assist/campaign-diagnostics', input);
  }
};
