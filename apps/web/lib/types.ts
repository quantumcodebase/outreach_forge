export type Account = {
  id: string;
  label: string;
  status: string;
  daily_cap: number;
  timezone: string;
  last_synced_at: string | null;
  smtp_user: string;
  imap_user: string;
  imap_host: string;
  imap_port: number;
  smtp_host: string;
  smtp_port: number;
  sending_window_start?: string;
  sending_window_end?: string;
};

export type AccountsResponse = { accounts: Account[] };

export type AccountTestResponse = {
  imap: { ok: boolean; error: string | null };
  smtp: { ok: boolean; error: string | null };
};

export type InboxThread = {
  threadId: string;
  messageId: string;
  from: string;
  subject: string;
  preview: string;
  account: string;
  received_at: string | null;
  unread: boolean;
  label: string | null;
};

export type InboxResponse = { threads: InboxThread[] };

export type ThreadMessage = {
  id: string;
  account_id: string;
  direction: 'sent' | 'received';
  message_id_header: string | null;
  in_reply_to: string | null;
  references_header: string | null;
  thread_id: string | null;
  subject: string | null;
  body_preview: string | null;
  sent_at: string | null;
  received_at: string | null;
};

export type ThreadMessagesResponse = { messages: ThreadMessage[] };
