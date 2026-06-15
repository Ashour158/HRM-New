export type MeInboxSectionKey = 'approvals' | 'tasks' | 'reminders' | 'notifications' | 'insights';
export type MeInboxSeverity = 'INFO' | 'DUE' | 'OVERDUE' | 'AT_RISK';

export interface MeInboxAction {
  label: string;
  commandPath: string;
  body?: Record<string, unknown>;
}

export interface MeInboxItem {
  id: string;
  title: string;
  subtitle?: string;
  severity: MeInboxSeverity;
  dueAt?: string;
  deepLink: string;
  actions?: MeInboxAction[];
}

export interface MeInboxSection {
  key: MeInboxSectionKey;
  title: string;
  count: number;
  items: MeInboxItem[];
}

export interface MeInbox {
  generatedAt: string;
  sections: MeInboxSection[];
}
