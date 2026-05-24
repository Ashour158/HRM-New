import type { Uuid } from '@hcm/shared-kernel';

/**
 * Invocation patterns supported by policy engines.
 *
 * - SYNC:        Real-time, target <50–500 ms.
 * - ASYNC:       Event-driven, queued execution.
 * - SAGA:        Long-running, orchestrated transaction.
 */
export type InvocationPattern = 'SYNC' | 'ASYNC' | 'SAGA';

/**
 * Declarative metadata that describes a policy engine.
 *
 * Engine definitions are data-driven and versioned. No hardcoded
 * country-specific values belong in application code.
 */
export interface PolicyEngineDefinition {
  /** Canonical engine name (kebab-case). */
  readonly engineName: string;

  /** Semantic version of the engine implementation. */
  readonly engineVersion: string;

  /** Human-readable description of the engine's responsibility. */
  readonly description: string;

  /** List of canonical input type names this engine accepts. */
  readonly inputTypes: string[];

  /** Decision codes this engine is allowed to emit. */
  readonly outputDecisionCodes: string[];

  /** Rule pack keys this engine consumes. */
  readonly associatedRulePacks: string[];

  /** Database table names this engine reads or writes. */
  readonly associatedTables: string[];

  /** Runtime invocation pattern. */
  readonly invocationPattern: InvocationPattern;

  /** SLA ceiling in milliseconds (zero for unbounded). */
  readonly maxDurationMs: number;

  /** Whether the engine requires an active country policy pack to evaluate. */
  readonly requiresCountryPolicyPack: boolean;

  /** Whether the engine's decisions must be routed to a human reviewer. */
  readonly requiresHumanReview: boolean;

  /** Whether every invocation must generate an audit trail entry. */
  readonly auditRequired: boolean;
}

/**
 * Context passed to every engine invocation.
 */
export interface EngineContext {
  /** Tenant scoping the request. */
  readonly tenantId: Uuid;

  /** Actor that triggered the engine, if known. */
  readonly actorId?: Uuid;

  /** Correlation id for grouping related decisions. */
  readonly correlationId: Uuid;

  /** The calculation / effective date. */
  readonly effectiveDate: Date;

  /** Optional country code for jurisdiction-specific resolution. */
  readonly countryCode?: string;

  /** Optional region code. */
  readonly regionCode?: string;

  /** Optional legal entity id. */
  readonly legalEntityId?: string;

  /** Optional pay group. */
  readonly payGroup?: string;

  /** Optional worker id when the decision concerns a specific person. */
  readonly workerId?: Uuid;
}

/**
 * Generic contract that every concrete policy engine must satisfy.
 *
 * @typeParam TInput  - The structured input payload.
 * @typeParam TOutput - The engine's output (by default a {@link DecisionRecord}).
 */
export interface PolicyEngine<TInput = unknown, TOutput = unknown> {
  /** The declarative definition for this engine. */
  readonly definition: PolicyEngineDefinition;

  /** Execute the engine against the given input and context. */
  execute(input: TInput, context: EngineContext): Promise<TOutput>;
}

/**
 * In-memory registry of all declared {@link PolicyEngineDefinition}s.
 *
 * The registry is the single source of truth for engine metadata
 * and is used by the invoker to route requests and enforce SLAs.
 */
export class EngineRegistry {
  private readonly engines = new Map<string, PolicyEngineDefinition>();

  /**
   * Register a new engine definition.
   *
   * @throws If an engine with the same name is already registered.
   */
  register(engine: PolicyEngineDefinition): void {
    if (this.engines.has(engine.engineName)) {
      throw new Error(`Engine "${engine.engineName}" is already registered.`);
    }
    this.engines.set(engine.engineName, engine);
  }

  /** Retrieve a definition by engine name. */
  get(engineName: string): PolicyEngineDefinition | undefined {
    return this.engines.get(engineName);
  }

  /** Retrieve all registered definitions. */
  getAll(): PolicyEngineDefinition[] {
    return Array.from(this.engines.values());
  }

  /** Filter definitions by invocation pattern. */
  getByInvocationPattern(pattern: InvocationPattern): PolicyEngineDefinition[] {
    return this.getAll().filter((e) => e.invocationPattern === pattern);
  }
}
