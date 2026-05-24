import type { Uuid } from '@hcm/shared-kernel';
import type { DecisionRecord } from './decision-record.js';
import type { EngineContext } from './engine-definition.js';

/**
 * Opaque identifier returned by asynchronous engine invocations.
 */
export type EngineJobId = Uuid;

/**
 * Primary interface for invoking policy engines.
 *
 * Implementations route SYNC calls directly, enqueue ASYNC calls,
 * and coordinate SAGA flows across multiple engines.
 */
export interface EngineInvoker {
  /**
   * Invoke an engine synchronously.
   *
   * The engine must complete within its declared `maxDurationMs`.
   *
   * @typeParam TInput   - Type of the structured input payload.
   * @typeParam TDecision - Narrowed decision type (defaults to {@link DecisionRecord}).
   */
  invokeSync<TInput, TDecision extends DecisionRecord>(
    engineName: string,
    input: TInput,
    context: EngineContext,
  ): Promise<TDecision>;

  /**
   * Invoke an engine asynchronously.
   *
   * Returns immediately with a job id. The caller can poll
   * or subscribe to events to retrieve the final decision.
   */
  invokeAsync<TInput>(
    engineName: string,
    input: TInput,
    context: EngineContext,
  ): Promise<EngineJobId>;

  /** Retrieve a previously produced decision by id. */
  getDecision(decisionId: Uuid): Promise<DecisionRecord | undefined>;

  /** Retrieve every decision that shares a correlation id. */
  getDecisionsForCorrelation(correlationId: Uuid): Promise<DecisionRecord[]>;
}
