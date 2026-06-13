import type { HrEventEnvelope } from '@hcm/event-schemas';

export interface NotificationTemplateRender {
  templateKey: string;
  templateVersion: number;
  title: string;
  body: string;
  emailSubject: string;
  emailBodyText: string;
}

type TemplateRule = {
  matches: RegExp;
  key: string;
  title: string;
  body: (event: HrEventEnvelope<unknown>) => string;
};

const TEMPLATE_VERSION = 1;

const rules: TemplateRule[] = [
  {
    matches: /(Leave|Absence).*Submitted/i,
    key: 'leave.request.submitted',
    title: 'Leave request submitted',
    body: () => 'A leave request is waiting for review.',
  },
  {
    matches: /(Leave|Absence).*Approved/i,
    key: 'leave.request.approved',
    title: 'Leave request approved',
    body: () => 'The leave request has been approved and related attendance/payroll records can now use it.',
  },
  {
    matches: /(Leave|Absence).*Rejected/i,
    key: 'leave.request.rejected',
    title: 'Leave request rejected',
    body: () => 'The leave request was rejected. Review the request history for the reason.',
  },
  {
    matches: /Attendance.*(CheckIn|CheckedIn|PunchIn)/i,
    key: 'attendance.check_in.recorded',
    title: 'Check-in recorded',
    body: () => 'Attendance check-in was recorded with the available time and location evidence.',
  },
  {
    matches: /Attendance.*(CheckOut|CheckedOut|PunchOut)/i,
    key: 'attendance.check_out.recorded',
    title: 'Check-out recorded',
    body: () => 'Attendance check-out was recorded and the day ledger can be refreshed.',
  },
  {
    matches: /Attendance.*(Correction|Exception)/i,
    key: 'attendance.exception.updated',
    title: 'Attendance exception updated',
    body: () => 'An attendance exception or correction changed state and may affect payroll inputs.',
  },
  {
    matches: /Payroll.*(Close|Closed)/i,
    key: 'payroll.cycle.closed',
    title: 'Payroll cycle closed',
    body: () => 'Payroll has been closed for the cycle and payslip/payment outputs are ready for review.',
  },
  {
    matches: /Payslip/i,
    key: 'payroll.payslip.published',
    title: 'Payslip published',
    body: () => 'A payslip is available for review.',
  },
  {
    matches: /Benefits.*(Enrollment|LifeEvent).*Rejected/i,
    key: 'benefits.request.rejected',
    title: 'Benefits request rejected',
    body: () => 'A benefits enrollment or life-event request was rejected.',
  },
  {
    matches: /Benefits.*(Enrollment|LifeEvent)/i,
    key: 'benefits.request.updated',
    title: 'Benefits request updated',
    body: () => 'A benefits enrollment or life-event request changed state.',
  },
  {
    matches: /Performance.*360|Feedback360/i,
    key: 'performance.360.updated',
    title: '360 feedback updated',
    body: () => 'A performance feedback action changed state with privacy controls applied.',
  },
  {
    matches: /Policy.*Applied/i,
    key: 'policy.revision.applied',
    title: 'Policy applied',
    body: () => 'A policy revision was applied and affected services should now use the new rules.',
  },
  {
    matches: /Import.*(Completed|Committed)/i,
    key: 'import.job.completed',
    title: 'Import completed',
    body: () => 'A data import finished and row-level results are available.',
  },
];

export function buildNotificationTemplate(event: HrEventEnvelope<unknown>): NotificationTemplateRender {
  const rule = rules.find((candidate) => candidate.matches.test(event.eventName));
  const title = rule?.title ?? titleCase(humanizeEventName(event.eventName));
  const body = rule?.body(event) ?? `${title} was recorded.`;
  const templateKey = rule?.key ?? `event.${event.eventName.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}`;
  const reference = uuidValue(event.aggregateId);
  const correlationId = uuidValue(event.metadata.correlationId);

  return {
    templateKey,
    templateVersion: TEMPLATE_VERSION,
    title,
    body,
    emailSubject: titleCase(title),
    emailBodyText: `${body}\n\nReference: ${reference}\nCorrelation: ${correlationId}`,
  };
}

export function humanizeEventName(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCase(value: string): string {
  return value
    .split(' ')
    .map((word) => word ? `${word[0]?.toUpperCase() ?? ''}${word.slice(1)}` : word)
    .join(' ');
}

function uuidValue(value: unknown): string {
  if (typeof value === 'string') return value;
  const uuidLike = value as { value?: unknown } | undefined;
  return typeof uuidLike?.value === 'string' ? uuidLike.value : '';
}
