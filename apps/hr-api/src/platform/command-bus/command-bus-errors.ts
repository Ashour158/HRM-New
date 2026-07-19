import type { CommandPipelineStep } from '@hcm/command-contracts';
import type { HrCommandEnvelope, CommandError } from '@hcm/command-contracts';

/**
 * Builds the canonical `CommandError` shape every pipeline step throws on a
 * gate failure. Kept as a free function (rather than a `CommandBus` method) so
 * every step module can construct identical error envelopes without a
 * back-reference to the orchestrator.
 */
export function makeError(
  command: HrCommandEnvelope<unknown>,
  step: CommandPipelineStep,
  errorCode: string,
  errorMessage: string,
  retryable: boolean,
  errorDetails?: CommandError['errorDetails'],
): CommandError {
  return {
    success: false,
    errorCode,
    errorMessage,
    errorDetails,
    commandId: command.commandId,
    correlationId: command.correlationId,
    stepFailed: step,
    retryable,
  };
}

export function isCommandError(err: unknown): err is CommandError {
  return typeof err === 'object' && err !== null && 'success' in err && err.success === false;
}
