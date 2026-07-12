import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ParseCountryPolicyPackHandler } from './parse-country-policy-pack.handler.js';
import { RequireCountryPolicyPackImpactSimulationHandler } from './require-country-policy-pack-impact-simulation.handler.js';
import { SubmitCountryPolicyPackForLegalReviewHandler } from './submit-country-policy-pack-for-legal-review.handler.js';
import { SubmitCountryPolicyPackForApprovalHandler } from './submit-country-policy-pack-for-approval.handler.js';
import { ScheduleCountryPolicyPackPublicationHandler } from './schedule-country-policy-pack-publication.handler.js';
import { SupersedeCountryPolicyPackHandler } from './supersede-country-policy-pack.handler.js';
import { RollbackCountryPolicyPackHandler } from './rollback-country-policy-pack.handler.js';
import { RetireCountryPolicyPackHandler } from './retire-country-policy-pack.handler.js';
import { RejectCountryPolicyPackHandler } from './reject-country-policy-pack.handler.js';
import { QuarantineCountryPolicyPackHandler } from './quarantine-country-policy-pack.handler.js';
import type { CountryPolicyPackRepository } from '../repositories/country-policy-pack.repository.js';
import { CountryPolicyPack, type CountryPolicyPackStatus } from '../aggregates/country-policy-pack.aggregate.js';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';

describe('CountryPolicyPack lifecycle handlers (HCM-P0-19)', () => {
  const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
  const packId = new Uuid('550e8400-e29b-41d4-a716-446655440001');

  const repo = {
    findById: vi.fn(),
    save: vi.fn(),
  } as unknown as CountryPolicyPackRepository;

  function packAtState(status: CountryPolicyPackStatus): CountryPolicyPack {
    return new CountryPolicyPack({
      id: packId,
      tenantId,
      countryCode: 'EG',
      countryPackVersion: '2026.1',
      effectiveFrom: new Date('2026-01-01'),
      status,
    });
  }

  function command(commandName: string, payload: Record<string, unknown> = {}): HrCommandEnvelope<unknown> {
    return {
      commandId: Uuid.generate(),
      commandName,
      commandSchemaVersion: 1,
      tenantId,
      actor: {
        actorType: 'USER',
        actorId: Uuid.generate(),
        roles: ['COUNTRY_POLICY_ADMIN'],
        permissions: ['COUNTRY_POLICY_WRITE'],
        mfaAuthenticated: true,
      },
      aggregateType: 'CountryPolicyPack',
      aggregateId: packId,
      idempotencyKey: 'test-key',
      correlationId: Uuid.generate(),
      reason: 'test',
      payload: { packId: packId.value, ...payload },
      metadata: { requestHash: 'hash', clientType: 'HR_ADMIN' },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('drives the whole chain from PARSING through APPROVAL_PENDING without a break (the literal HCM-P0-19 defect)', async () => {
    vi.mocked(repo.findById).mockResolvedValue(packAtState('UPLOADED'));
    const parsed = await new ParseCountryPolicyPackHandler(repo).handle(command('ParseCountryPolicyPack'));
    expect(parsed.newState).toBe('PARSING');

    vi.mocked(repo.findById).mockResolvedValue(packAtState('VALIDATED'));
    const simRequired = await new RequireCountryPolicyPackImpactSimulationHandler(repo).handle(
      command('RequireCountryPolicyPackImpactSimulation'),
    );
    expect(simRequired.newState).toBe('IMPACT_SIMULATION_REQUIRED');

    vi.mocked(repo.findById).mockResolvedValue(packAtState('IMPACT_SIMULATED'));
    const legalReview = await new SubmitCountryPolicyPackForLegalReviewHandler(repo).handle(
      command('SubmitForLegalReview'),
    );
    expect(legalReview.newState).toBe('LEGAL_REVIEW_PENDING');

    vi.mocked(repo.findById).mockResolvedValue(packAtState('LEGAL_REVIEW_PENDING'));
    const submitted = await new SubmitCountryPolicyPackForApprovalHandler(repo).handle(
      command('SubmitCountryPolicyPackForApproval'),
    );
    expect(submitted.newState).toBe('APPROVAL_PENDING');
    expect(vi.mocked(repo.save)).toHaveBeenCalledTimes(4);
  });

  it('drives APPROVED through PUBLISHED, SUPERSEDED, ROLLED_BACK, RETIRED', async () => {
    vi.mocked(repo.findById).mockResolvedValue(packAtState('APPROVED'));
    const scheduled = await new ScheduleCountryPolicyPackPublicationHandler(repo).handle(
      command('ScheduleCountryPolicyPackPublication'),
    );
    expect(scheduled.newState).toBe('SCHEDULED_FOR_PUBLICATION');

    vi.mocked(repo.findById).mockResolvedValue(packAtState('PUBLISHED'));
    const superseded = await new SupersedeCountryPolicyPackHandler(repo).handle(
      command('SupersedeCountryPolicyPack', { supersededBy: Uuid.generate().value }),
    );
    expect(superseded.newState).toBe('SUPERSEDED');

    vi.mocked(repo.findById).mockResolvedValue(packAtState('SUPERSEDED'));
    const rolledBack = await new RollbackCountryPolicyPackHandler(repo).handle(
      command('RollbackCountryPolicyPack', { rollbackReason: 'Statutory correction' }),
    );
    expect(rolledBack.newState).toBe('ROLLED_BACK');

    vi.mocked(repo.findById).mockResolvedValue(packAtState('ROLLED_BACK'));
    const retired = await new RetireCountryPolicyPackHandler(repo).handle(command('RetireCountryPolicyPack'));
    expect(retired.newState).toBe('RETIRED');
  });

  it('rejects from APPROVAL_PENDING and quarantines from any non-terminal state', async () => {
    vi.mocked(repo.findById).mockResolvedValue(packAtState('APPROVAL_PENDING'));
    const rejected = await new RejectCountryPolicyPackHandler(repo).handle(command('RejectCountryPolicyPack'));
    expect(rejected.newState).toBe('REJECTED');

    vi.mocked(repo.findById).mockResolvedValue(packAtState('LEGAL_REVIEW_PENDING'));
    const quarantined = await new QuarantineCountryPolicyPackHandler(repo).handle(
      command('QuarantineCountryPolicyPack'),
    );
    expect(quarantined.newState).toBe('QUARANTINED');
  });

  it('rejects parsing a pack that is not in UPLOADED state', async () => {
    vi.mocked(repo.findById).mockResolvedValue(packAtState('DRAFT'));
    await expect(new ParseCountryPolicyPackHandler(repo).handle(command('ParseCountryPolicyPack'))).rejects.toThrow(
      'Cannot parse from state DRAFT',
    );
  });
});
