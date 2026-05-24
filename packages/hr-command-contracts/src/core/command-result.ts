import type { Uuid } from '@hcm/shared-kernel';

/**
 * Successful result of executing a command.
 *
 * @template TData - The shape of the data returned by the command handler.
 */
export interface CommandResult<TData> {
  success: true;
  data: TData;
  commandId: Uuid;
  correlationId: Uuid;
  aggregateId: Uuid;
  newState: string;
  newVersion: number;
  allowedNextActions: string[];
  fieldAccessDecisions: Record<string, 'VISIBLE' | 'MASKED' | 'HIDDEN' | 'DENIED'>;
  eventsEmitted: string[];
  auditRecordId: Uuid;
}

/**
 * Error result when a command fails at any step of the pipeline.
 */
export interface CommandError {
  success: false;
  errorCode: string;
  errorMessage: string;
  errorDetails?: Record<string, unknown>;
  commandId: Uuid;
  correlationId: Uuid;
  stepFailed: number;
  retryable: boolean;
}

/**
 * Union type representing either a successful command result or an error.
 *
 * @template TData - The shape of the data returned on success.
 */
export type CommandOutcome<TData> = CommandResult<TData> | CommandError;
