import { generateUUID } from '@/lib/utils';
import type { DomainRecord, DomainEntityConfig } from './domain-workspace';

type CommandMapping = DomainEntityConfig['commandMappings'][number];

function idValue(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && 'value' in value) {
    const maybeValue = (value as { value?: unknown }).value;
    return typeof maybeValue === 'string' ? maybeValue : '';
  }
  return String(value);
}

function recordId(record: DomainRecord): string {
  return idValue(record.id);
}

function todayOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export const commonNoBodyCommands: CommandMapping[] = [
  { tokens: ['publish'], command: 'publish' },
  { tokens: ['archive'], command: 'archive' },
  { tokens: ['retire'], command: 'retire' },
  { tokens: ['activate'], command: 'activate' },
  { tokens: ['start'], command: 'start' },
  { tokens: ['complete'], command: 'complete' },
  { tokens: ['close'], command: 'close' },
  { tokens: ['cancel'], command: 'cancel' },
  { tokens: ['expire'], command: 'expire' },
  { tokens: ['revoke'], command: 'revoke' },
  { tokens: ['review'], command: 'review' },
  { tokens: ['resolve'], command: 'resolve' },
  { tokens: ['reject'], command: 'reject' },
  { tokens: ['suspend'], command: 'suspend' },
  { tokens: ['trigger'], command: 'trigger' },
  { tokens: ['investigate'], command: 'investigate' },
  { tokens: ['rearm'], command: 'rearm' },
];

export const commandPayloads = {
  completeAssignment: () => ({ score: 100 }),
  renewCertification: () => ({ newExpiryDate: todayOffset(365) }),
  validateSkill: (_record: DomainRecord, actorId: string) => ({ validatedBy: actorId }),
  approveByActor: (_record: DomainRecord, actorId: string) => ({ approvedBy: actorId }),
  scheduleReferral: () => ({ scheduledDate: todayOffset(1) }),
  completeModelRun: (record: DomainRecord) => ({ hrAiModelRunId: recordId(record), outputDataSnapshot: { result: 'completed' } }),
  failModelRun: (record: DomainRecord) => ({ hrAiModelRunId: recordId(record), reason: 'Marked from governance workspace' }),
  completeBiasTest: (record: DomainRecord) => ({ hrAiBiasTestId: recordId(record), passed: true, metrics: { adverseImpactRatio: 0.92 } }),
  failBiasTest: (record: DomainRecord) => ({ hrAiBiasTestId: recordId(record), reason: 'Marked from governance workspace' }),
  resolveKillSwitch: (record: DomainRecord) => ({ hrAiKillSwitchId: recordId(record), resolution: 'Resolved through governance review' }),
  generatedUseCaseId: () => generateUUID(),
};
