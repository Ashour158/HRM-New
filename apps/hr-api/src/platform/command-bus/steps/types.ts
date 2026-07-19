import { AggregateRoot } from '@hcm/shared-kernel';
import type { RuntimePolicyArea } from '../../../domains/hcm-setup/hcm-setup.types.js';

export interface CommandPolicyDecisionEvidence {
  serviceArea: string;
  policyRevisionId?: string;
  engineName: string;
  engineVersion: string;
  scopeMatch: Record<string, unknown>;
  decision: 'ALLOWED' | 'DENIED';
  reason: string;
  commandName: string;
  aggregateType: string;
  subjectWorkerId?: string;
  sourceRecordId?: string;
  evaluatedPolicyRevisionIds?: string[];
  conflictingPolicyRevisionIds?: string[];
}

/** Minimal aggregate shell used by AggregateLoadStep for FSM checks. */
export class LoadedAggregate extends AggregateRoot {}

export type AggregateLoaderConfig = {
  table: string;
  stateColumn: 'status' | 'state';
  versionColumn: 'aggregate_version';
};

export type AggregateStateRow = {
  id: string;
  aggregate_version?: number | string | bigint | null;
  status?: string | null;
  state?: string | null;
};

export type GovernedCommandPolicyRule = {
  area: RuntimePolicyArea;
  aggregateTypes: string[];
  commandPatterns: RegExp[];
};
