import type { RulePack } from './rule-pack.js';

/**
 * Context used to resolve the most specific rule pack.
 *
 * Resolution hierarchy (most specific wins):
 * 1. countryCode + regionCode + legalEntityId + payGroup
 * 2. countryCode + regionCode + legalEntityId
 * 3. countryCode + regionCode
 * 4. countryCode
 * 5. Platform default
 */
export interface ResolutionContext {
  readonly countryCode: string;
  readonly regionCode?: string;
  readonly legalEntityId?: string;
  readonly payGroup?: string;
  readonly effectiveDate: Date;
}

/**
 * Abstract repository for loading {@link RulePack}s.
 *
 * Concrete implementations may read from a SQL store, document DB,
 * or external configuration service.
 */
export interface RulePackRepository {
  /** Fetch all packs for a given engine that match the resolution context. */
  findByEngineAndContext(
    engineName: string,
    ctx: ResolutionContext,
  ): Promise<RulePack[]>;

  /** Fetch a pack by its unique key and version. */
  findByKey(ruleSetKey: string, version: string): Promise<RulePack | undefined>;

  /** Fetch all ACTIVE packs scoped to a country. */
  findActiveByCountry(countryCode: string): Promise<RulePack[]>;
}

/**
 * Loads and resolves {@link RulePack}s using the most-specific-wins hierarchy.
 *
 * The loader is deterministic: given the same context it always returns
 * the same pack (or set of packs) because effective dates are evaluated
 * at query time and packs are immutable once ACTIVE.
 */
export class RulePackLoader {
  constructor(private readonly repository: RulePackRepository) {}

  /**
   * Load the single most-specific ACTIVE pack for an engine.
   *
   * Returns `undefined` when no applicable pack exists.
   */
  async loadActivePack(
    engineName: string,
    context: ResolutionContext,
  ): Promise<RulePack | undefined> {
    const packs = await this.resolvePacks(engineName, context);
    return packs[0];
  }

  /**
   * Load a specific pack by key and version.
   *
   * Useful for auditing, rollback, or testing.
   */
  async loadPackByKey(
    ruleSetKey: string,
    version: string,
  ): Promise<RulePack | undefined> {
    return this.repository.findByKey(ruleSetKey, version);
  }

  /**
   * Resolve all packs for an engine ordered from most specific to least specific.
   *
   * The caller can use the first item for standard evaluation or iterate
   * over the list for fallback / cascade logic.
   */
  async resolvePacks(
    engineName: string,
    context: ResolutionContext,
  ): Promise<RulePack[]> {
    const candidates = await this.repository.findByEngineAndContext(
      engineName,
      context,
    );

    const effective = candidates.filter(
      (p) =>
        p.status === 'ACTIVE' &&
        p.effectiveFrom <= context.effectiveDate &&
        (p.effectiveUntil == null || p.effectiveUntil >= context.effectiveDate),
    );

    effective.sort((a, b) => {
      const scoreA = this.specificityScore(a);
      const scoreB = this.specificityScore(b);
      if (scoreB !== scoreA) return scoreB - scoreA;
      // Tie-break: later effectiveFrom wins (most recent)
      return b.effectiveFrom.getTime() - a.effectiveFrom.getTime();
    });

    return effective;
  }

  /**
   * List every ACTIVE pack scoped to a country.
   */
  async listActivePacksForCountry(countryCode: string): Promise<RulePack[]> {
    return this.repository.findActiveByCountry(countryCode);
  }

  /**
   * Compute a specificity score for a pack.
   *
   * Higher score = more specific.
   */
  private specificityScore(pack: RulePack): number {
    let score = 0;
    if (pack.countryCode) score += 1;
    if (pack.regionCode) score += 10;
    if (pack.legalEntityScope && pack.legalEntityScope.length > 0) score += 100;
    if (pack.payGroupScope && pack.payGroupScope.length > 0) score += 1000;
    return score;
  }
}
