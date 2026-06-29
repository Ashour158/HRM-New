export type HrReportReadiness = 'Live' | 'Attention' | 'No Data';

export type HrReportGroup = {
  code: string;
  title: string;
  category: string;
  services?: string[];
  serviceUsageLinks?: string[];
  analyticsOutputs?: string[];
  template?: {
    module: string;
    columns: string[];
    exportArtifact: string;
  };
  brain?: {
    engine: string;
    nervousSystem: string;
  };
  activity: number;
  commands: number;
  events: number;
  notifications: number;
  workflowTransitions: number;
  queueBacklog: number;
  issues: number;
  readiness: HrReportReadiness;
  lastActivityAt?: string;
  chartData: Array<{ label: string; value: number }>;
};

export type HrReportsDashboard = {
  generatedAt: string;
  totals: {
    reportGroups: number;
    activeReportGroups: number;
    totalActivity: number;
    queueBacklog: number;
    issues: number;
  };
  reports: HrReportGroup[];
  activityByReport: Array<{ label: string; activity: number; issues: number }>;
};

export type ReportingTab = 'overview' | 'analytics' | 'builder' | 'relationships' | 'library' | 'activity';

export function readinessTone(readiness: HrReportReadiness) {
  if (readiness === 'Attention') return 'border-warning/35 bg-warning/10 text-warning-foreground';
  if (readiness === 'Live') return 'border-success/25 bg-success/15 text-success-foreground';
  return 'border-border bg-white text-muted-foreground';
}
