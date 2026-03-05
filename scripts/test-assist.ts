import { getAssistAdapter } from '../apps/web/lib/integrations/assist';

async function main() {
  process.env.ASSIST_MODE = 'mock';
  const assist = getAssistAdapter();

  const reply = await assist.generateReplyDraft({ threadId: 'thread-1234' });
  const analysis = await assist.analyzeThread({ threadId: 'thread-1234' });
  const brief = await assist.analyzeLead({ leadId: 'lead-1234' });
  const diag = await assist.diagnoseCampaign({ campaignId: 'camp-1234' });

  const pass = reply.mode === 'mock' && analysis.mode === 'mock' && brief.mode === 'mock' && diag.mode === 'mock';
  if (!pass) {
    console.log('FAIL assist mode mismatch');
    process.exit(1);
  }

  console.log(`PASS reply_subject=${reply.draft_subject} intent=${analysis.intent} actions=${diag.actions.length}`);
}

main().catch((e) => {
  console.log(`FAIL error=${e.message}`);
  process.exit(1);
});
