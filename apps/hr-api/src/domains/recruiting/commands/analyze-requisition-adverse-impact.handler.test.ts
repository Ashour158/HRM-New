import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { Candidate } from '../aggregates/candidate.aggregate.js';
import {
  groupCounts,
  eeoGroupValue,
  AnalyzeRequisitionAdverseImpactHandler,
} from './analyze-requisition-adverse-impact.handler.js';
import type { JobRequisitionRepository } from '../repositories/job-requisition.repository.js';
import type { CandidateRepository } from '../repositories/candidate.repository.js';
import type { InterviewPlanRepository } from '../repositories/interview-plan.repository.js';
import type { OfferRepository } from '../repositories/offer.repository.js';
import type { RequisitionAdverseImpactAnalysisRepository } from '../repositories/requisition-adverse-impact-analysis.repository.js';
import type { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import type { RecruitingEventsPublisher } from '../events/recruiting-events.publisher.js';

const tenantId = new Uuid('00000000-0000-4000-8000-000000000001');
const otherTenantId = new Uuid('00000000-0000-4000-8000-000000000999');
const requisitionId = new Uuid('00000000-0000-4000-8000-000000000002');
const analysisId = new Uuid('00000000-0000-4000-8000-000000000003');

function candidateWithSelfId(genderIdentity?: string, declined = false): Candidate {
  const candidate = Candidate.create(
    { id: Uuid.generate(), tenantId, firstName: 'A', lastName: 'B', email: `${Uuid.generate().value}@example.com`, requisitionId },
    Uuid.generate(),
  );
  if (genderIdentity || declined) {
    candidate.recordEeoSelfIdentification({ genderIdentity, declinedToSelfIdentify: declined }, Uuid.generate());
  }
  return candidate;
}

describe('eeoGroupValue', () => {
  it('returns undefined when no self-identification was ever recorded', () => {
    const candidate = candidateWithSelfId();
    expect(eeoGroupValue(candidate, 'GENDER_IDENTITY')).toBeUndefined();
  });

  it('returns undefined when the candidate declined to self-identify', () => {
    const candidate = candidateWithSelfId('FEMALE', true);
    expect(eeoGroupValue(candidate, 'GENDER_IDENTITY')).toBeUndefined();
  });

  it('returns the self-identified value for the requested dimension', () => {
    const candidate = candidateWithSelfId('FEMALE');
    expect(eeoGroupValue(candidate, 'GENDER_IDENTITY')).toBe('FEMALE');
  });
});

describe('groupCounts', () => {
  it('excludes candidates with no voluntary self-ID from every group (never bucketed as "unknown")', () => {
    const candidates = [
      candidateWithSelfId('FEMALE'),
      candidateWithSelfId('MALE'),
      candidateWithSelfId(), // no self-ID provided at all
    ];

    const counts = groupCounts(candidates, new Set(), 'GENDER_IDENTITY');

    expect(counts).toHaveLength(2);
    expect(counts.map((c) => c.group).sort()).toEqual(['FEMALE', 'MALE']);
  });

  it('computes considered/advanced counts per group correctly', () => {
    const female1 = candidateWithSelfId('FEMALE');
    const female2 = candidateWithSelfId('FEMALE');
    const male1 = candidateWithSelfId('MALE');

    const advanced = new Set([female1.id.value, male1.id.value]);
    const counts = groupCounts([female1, female2, male1], advanced, 'GENDER_IDENTITY');

    const female = counts.find((c) => c.group === 'FEMALE');
    const male = counts.find((c) => c.group === 'MALE');
    expect(female).toEqual({ group: 'FEMALE', consideredCount: 2, advancedCount: 1 });
    expect(male).toEqual({ group: 'MALE', consideredCount: 1, advancedCount: 1 });
  });
});

describe('AnalyzeRequisitionAdverseImpactHandler — cross-tenant IDOR regression (C-2)', () => {
  const requisitionRepo = {
    findById: vi.fn(),
    findByIdForTenant: vi.fn(),
  } as unknown as JobRequisitionRepository;
  const candidateRepo = {
    findByRequisition: vi.fn(),
    findByRequisitionForTenant: vi.fn(),
  } as unknown as CandidateRepository;
  const interviewPlanRepo = {
    findByRequisition: vi.fn(),
    findByRequisitionForTenant: vi.fn(),
  } as unknown as InterviewPlanRepository;
  const offerRepo = {
    findByRequisition: vi.fn(),
    findByRequisitionForTenant: vi.fn(),
  } as unknown as OfferRepository;
  const analysisRepo = {
    save: vi.fn(),
  } as unknown as RequisitionAdverseImpactAnalysisRepository;
  const fsm = {
    getAllowedActionsFromState: vi.fn(() => []),
  } as unknown as FsmFramework;
  const eventPublisher = {
    publishUncommitted: vi.fn(),
  } as unknown as RecruitingEventsPublisher;

  const handler = new AnalyzeRequisitionAdverseImpactHandler(
    requisitionRepo,
    candidateRepo,
    interviewPlanRepo,
    offerRepo,
    analysisRepo,
    fsm,
    eventPublisher,
  );

  function command(): HrCommandEnvelope<unknown> {
    return {
      commandId: Uuid.generate(),
      commandName: 'AnalyzeRequisitionAdverseImpact',
      commandSchemaVersion: 1,
      tenantId,
      actor: {
        actorType: 'USER',
        actorId: Uuid.generate(),
        roles: ['HR_ADMIN'],
        permissions: ['*'],
        mfaAuthenticated: true,
      },
      aggregateType: 'RequisitionAdverseImpactAnalysis',
      aggregateId: requisitionId,
      idempotencyKey: 'test-key',
      correlationId: Uuid.generate(),
      reason: 'test',
      payload: { analysisId: analysisId.value, requisitionId: requisitionId.value, dimension: 'GENDER_IDENTITY' },
      metadata: { requestHash: 'hash', clientType: 'HR_ADMIN' },
    } as unknown as HrCommandEnvelope<unknown>;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves the requisition and its candidates/interviews/offers scoped to the command tenant', async () => {
    vi.mocked(requisitionRepo.findByIdForTenant).mockResolvedValue({ id: requisitionId } as never);
    vi.mocked(candidateRepo.findByRequisitionForTenant).mockResolvedValue([]);
    vi.mocked(interviewPlanRepo.findByRequisitionForTenant).mockResolvedValue([]);
    vi.mocked(offerRepo.findByRequisitionForTenant).mockResolvedValue([]);

    const result = await handler.handle(command());

    expect(result.success).toBe(true);
    expect(requisitionRepo.findByIdForTenant).toHaveBeenCalledWith(requisitionId, tenantId);
    expect(candidateRepo.findByRequisitionForTenant).toHaveBeenCalledWith(requisitionId, tenantId);
    expect(interviewPlanRepo.findByRequisitionForTenant).toHaveBeenCalledWith(requisitionId, tenantId);
    expect(offerRepo.findByRequisitionForTenant).toHaveBeenCalledWith(requisitionId, tenantId);
    // The unscoped, tenant-blind lookups must never be used by this handler.
    expect(requisitionRepo.findById).not.toHaveBeenCalled();
    expect(candidateRepo.findByRequisition).not.toHaveBeenCalled();
    expect(interviewPlanRepo.findByRequisition).not.toHaveBeenCalled();
    expect(offerRepo.findByRequisition).not.toHaveBeenCalled();
  });

  it('rejects a cross-tenant requisitionId as not-found instead of analyzing (and persisting) another tenant\'s EEO funnel data', async () => {
    // The repository enforces the tenant filter in SQL; a requisitionId that
    // belongs to a different tenant than command.tenantId simply yields no
    // row rather than the other tenant's requisition.
    vi.mocked(requisitionRepo.findByIdForTenant).mockResolvedValue(undefined);

    await expect(handler.handle(command())).rejects.toThrow('Job requisition not found');

    // Must fail closed before ever reading (or persisting an analysis of)
    // another tenant's candidate/interview/offer data.
    expect(candidateRepo.findByRequisitionForTenant).not.toHaveBeenCalled();
    expect(interviewPlanRepo.findByRequisitionForTenant).not.toHaveBeenCalled();
    expect(offerRepo.findByRequisitionForTenant).not.toHaveBeenCalled();
    expect(analysisRepo.save).not.toHaveBeenCalled();
    expect(eventPublisher.publishUncommitted).not.toHaveBeenCalled();
  });

  it('scopes the tenant-filtered lookups to whatever tenant the command actually carries', async () => {
    vi.mocked(requisitionRepo.findByIdForTenant).mockResolvedValue({ id: requisitionId } as never);
    vi.mocked(candidateRepo.findByRequisitionForTenant).mockResolvedValue([]);
    vi.mocked(interviewPlanRepo.findByRequisitionForTenant).mockResolvedValue([]);
    vi.mocked(offerRepo.findByRequisitionForTenant).mockResolvedValue([]);

    const otherTenantCommand = { ...command(), tenantId: otherTenantId };
    await handler.handle(otherTenantCommand);

    expect(requisitionRepo.findByIdForTenant).toHaveBeenCalledWith(requisitionId, otherTenantId);
    expect(requisitionRepo.findByIdForTenant).not.toHaveBeenCalledWith(requisitionId, tenantId);
  });
});
