import { externalAssistAdapter } from './external';
import { mockAssistAdapter } from './mock';

export * from './types';

export function getAssistAdapter() {
  const mode = (process.env.ASSIST_MODE || 'mock').toLowerCase();
  return mode === 'external' ? externalAssistAdapter : mockAssistAdapter;
}
