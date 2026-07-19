import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import type { HrActor } from '@hcm/command-contracts';
import { RecruitingController } from './recruiting.controller.js';
import type { CommandBus } from '../../../platform/command-bus/command-bus.js';
import type { JobRequisitionRepository } from '../repositories/job-requisition.repository.js';
import type { CandidateRepository } from '../repositories/candidate.repository.js';
import type { InterviewPlanRepository } from '../repositories/interview-plan.repository.js';
import type { OfferRepository } from '../repositories/offer.repository.js';
import type { RequisitionAdverseImpactAnalysisRepository } from '../repositories/requisition-adverse-impact-analysis.repository.js';

const tenantId = '00000000-0000-0000-0000-000000000001';
const actorId = '00000000-0000-0000-0000-000000000010';
const requisitionId = '00000000-0000-0000-0000-000000000020';
const candidateId = '00000000-0000-0000-0000-000000000030';
const offerId = '00000000-0000-0000-0000-000000000040';
const interviewPlanId = '00000000-0000-0000-0000-000000000050';
const analysisId = '00000000-0000-0000-0000-000000000060';

function actor(roles: string[] = ['RECRUITER']): HrActor {
  return {
    actorType: 'USER',
    actorId: new Uuid(actorId),
    roles,
    permissions: ['RECRUITING_READ', 'RECRUITING_CREATE'],
    email: 'recruiter@example.com',
    mfaAuthenticated: true,
  };
}

function request(roles: string[] = ['RECRUITER']): Request {
  return {
    tenantId,
    actor: actor(roles),
    headers: {},
  } as unknown as Request;
}

function makeController() {
  const commandBus = { execute: vi.fn(async () => ({ success: true })) } as unknown as CommandBus;
  const requisitionRepo = {
    findById: vi.fn(),
    findByIdForTenant: vi.fn(),
    findByDepartment: vi.fn(),
    findByDepartmentForTenant: vi.fn(),
    findByPosition: vi.fn(),
    findByPositionForTenant: vi.fn(),
    findOpen: vi.fn(),
  } as unknown as JobRequisitionRepository;
  const candidateRepo = {
    findById: vi.fn(),
    findByIdForTenant: vi.fn(),
    findByRequisition: vi.fn(),
    findByRequisitionForTenant: vi.fn(),
    findByStatus: vi.fn(),
    findByStatusForTenant: vi.fn(),
  } as unknown as CandidateRepository;
  const interviewPlanRepo = {
    findById: vi.fn(),
    findByIdForTenant: vi.fn(),
  } as unknown as InterviewPlanRepository;
  const offerRepo = {
    findById: vi.fn(),
    findByIdForTenant: vi.fn(),
    findByCandidate: vi.fn(),
    findByCandidateForTenant: vi.fn(),
    findByRequisition: vi.fn(),
    findByRequisitionForTenant: vi.fn(),
    findPending: vi.fn(),
    findPendingForTenant: vi.fn(),
  } as unknown as OfferRepository;
  const adverseImpactAnalysisRepo = {
    findById: vi.fn(),
    findByIdForTenant: vi.fn(),
    findByRequisition: vi.fn(),
    findByRequisitionForTenant: vi.fn(),
  } as unknown as RequisitionAdverseImpactAnalysisRepository;

  const controller = new RecruitingController(
    commandBus,
    requisitionRepo,
    candidateRepo,
    interviewPlanRepo,
    offerRepo,
    adverseImpactAnalysisRepo,
  );

  return {
    controller,
    commandBus,
    requisitionRepo,
    candidateRepo,
    interviewPlanRepo,
    offerRepo,
    adverseImpactAnalysisRepo,
  };
}

describe('RecruitingController — cross-tenant IDOR regression (C-1 / C-2)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('looks up an offer scoped to the authenticated tenant, never via the unscoped findById', async () => {
    const { controller, offerRepo } = makeController();
    (offerRepo.findByIdForTenant as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: new Uuid(offerId),
      candidateId: new Uuid(candidateId),
      requisitionId: new Uuid(requisitionId),
      proposedSalary: 150_000,
      currency: 'USD',
      status: 'SENT',
      aggregateVersion: 2,
    });

    await expect(controller.getOffer(offerId, request())).resolves.toEqual(
      expect.objectContaining({ id: offerId, status: 'SENT' }),
    );

    expect(offerRepo.findByIdForTenant).toHaveBeenCalledWith(new Uuid(offerId), new Uuid(tenantId));
    expect(offerRepo.findById).not.toHaveBeenCalled();
  });

  it('does not leak another tenant\'s offer — a cross-tenant id yields not-found, not the record', async () => {
    const { controller, offerRepo } = makeController();
    // The repository enforces the tenant filter in SQL; a cross-tenant id
    // simply yields no row rather than the other tenant's offer (including
    // its proposed salary/currency).
    (offerRepo.findByIdForTenant as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await expect(controller.getOffer(offerId, request())).rejects.toThrow('Offer not found');

    expect(offerRepo.findByIdForTenant).toHaveBeenCalledWith(new Uuid(offerId), new Uuid(tenantId));
  });

  it('looks up a candidate scoped to the authenticated tenant, never via the unscoped findById', async () => {
    const { controller, candidateRepo } = makeController();
    (candidateRepo.findByIdForTenant as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: new Uuid(candidateId),
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      status: 'SCREENING',
      requisitionId: new Uuid(requisitionId),
      aggregateVersion: 1,
    });

    await expect(controller.getCandidate(candidateId, request())).resolves.toEqual(
      expect.objectContaining({ id: candidateId, email: 'ada@example.com' }),
    );

    expect(candidateRepo.findByIdForTenant).toHaveBeenCalledWith(new Uuid(candidateId), new Uuid(tenantId));
    expect(candidateRepo.findById).not.toHaveBeenCalled();
  });

  it('does not leak another tenant\'s candidate (including EEO self-ID data) — cross-tenant id yields not-found', async () => {
    const { controller, candidateRepo } = makeController();
    (candidateRepo.findByIdForTenant as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await expect(controller.getCandidate(candidateId, request())).rejects.toThrow('Candidate not found');

    expect(candidateRepo.findByIdForTenant).toHaveBeenCalledWith(new Uuid(candidateId), new Uuid(tenantId));
  });

  it('looks up a job requisition scoped to the authenticated tenant', async () => {
    const { controller, requisitionRepo } = makeController();
    (requisitionRepo.findByIdForTenant as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: new Uuid(requisitionId),
      requisitionNumber: 'REQ-001',
      title: 'Senior Engineer',
      status: 'OPEN',
      positionId: new Uuid('00000000-0000-0000-0000-000000000099'),
      departmentId: undefined,
      aggregateVersion: 1,
    });

    await expect(controller.getRequisition(requisitionId, request())).resolves.toEqual(
      expect.objectContaining({ id: requisitionId }),
    );

    expect(requisitionRepo.findByIdForTenant).toHaveBeenCalledWith(new Uuid(requisitionId), new Uuid(tenantId));
    expect(requisitionRepo.findById).not.toHaveBeenCalled();
  });

  it('does not leak another tenant\'s job requisition', async () => {
    const { controller, requisitionRepo } = makeController();
    (requisitionRepo.findByIdForTenant as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await expect(controller.getRequisition(requisitionId, request())).rejects.toThrow('Requisition not found');
  });

  it('rejectCandidate pre-fetches the candidate scoped to tenant before building the command', async () => {
    const { controller, candidateRepo, commandBus } = makeController();
    (candidateRepo.findByIdForTenant as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: new Uuid(candidateId),
      status: 'SCREENING',
    });

    await controller.rejectCandidate(candidateId, { reason: 'Not a fit' }, request());

    expect(candidateRepo.findByIdForTenant).toHaveBeenCalledWith(new Uuid(candidateId), new Uuid(tenantId));
    expect(candidateRepo.findById).not.toHaveBeenCalled();
    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({ commandName: 'RejectCandidate' }));
  });

  it('rejectCandidate rejects a cross-tenant candidate id before ever dispatching a command', async () => {
    const { controller, candidateRepo, commandBus } = makeController();
    (candidateRepo.findByIdForTenant as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await expect(
      controller.rejectCandidate(candidateId, { reason: 'Not a fit' }, request()),
    ).rejects.toThrow('Candidate not found');

    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('withdrawOffer pre-fetches the offer scoped to tenant before building the command', async () => {
    const { controller, offerRepo, commandBus } = makeController();
    (offerRepo.findByIdForTenant as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: new Uuid(offerId),
      status: 'SENT',
    });

    await controller.withdrawOffer(offerId, { reason: 'Position cancelled' }, request());

    expect(offerRepo.findByIdForTenant).toHaveBeenCalledWith(new Uuid(offerId), new Uuid(tenantId));
    expect(offerRepo.findById).not.toHaveBeenCalled();
    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({ commandName: 'WithdrawOffer' }));
  });

  it('startInterview/completeInterview/cancelInterview all resolve the interview plan scoped to tenant', async () => {
    const { controller, interviewPlanRepo, commandBus } = makeController();
    (interviewPlanRepo.findByIdForTenant as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: new Uuid(interviewPlanId),
      status: 'SCHEDULED',
    });

    await controller.startInterview(interviewPlanId, request());
    await controller.completeInterview(interviewPlanId, request());
    await controller.cancelInterview(interviewPlanId, request());

    expect(interviewPlanRepo.findByIdForTenant).toHaveBeenCalledTimes(3);
    expect(interviewPlanRepo.findByIdForTenant).toHaveBeenCalledWith(new Uuid(interviewPlanId), new Uuid(tenantId));
    expect(interviewPlanRepo.findById).not.toHaveBeenCalled();
    expect(commandBus.execute).toHaveBeenCalledTimes(3);
  });

  it('a cross-tenant interview plan id is rejected before any command is dispatched', async () => {
    const { controller, interviewPlanRepo, commandBus } = makeController();
    (interviewPlanRepo.findByIdForTenant as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await expect(controller.startInterview(interviewPlanId, request())).rejects.toThrow('Interview plan not found');
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  describe('adverse-impact analyses', () => {
    it('looks up an adverse-impact analysis scoped to the authenticated tenant', async () => {
      const { controller, adverseImpactAnalysisRepo } = makeController();
      (adverseImpactAnalysisRepo.findByIdForTenant as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: new Uuid(analysisId),
        requisitionId: new Uuid(requisitionId),
        dimension: 'GENDER_IDENTITY',
        decisionCode: 'NO_ADVERSE_IMPACT',
        flaggedStageCount: 0,
        smallCellThreshold: 5,
        stageResults: {},
        status: 'ANALYZED',
        aggregateVersion: 1,
      });

      await expect(
        controller.getRequisitionAdverseImpactAnalysis(analysisId, request(['HR_ADMIN'])),
      ).resolves.toEqual(expect.objectContaining({ id: analysisId }));

      expect(adverseImpactAnalysisRepo.findByIdForTenant).toHaveBeenCalledWith(new Uuid(analysisId), new Uuid(tenantId));
      expect(adverseImpactAnalysisRepo.findById).not.toHaveBeenCalled();
    });

    it('does not leak another tenant\'s adverse-impact analysis (EEOC-protected-class data)', async () => {
      const { controller, adverseImpactAnalysisRepo } = makeController();
      (adverseImpactAnalysisRepo.findByIdForTenant as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      await expect(
        controller.getRequisitionAdverseImpactAnalysis(analysisId, request(['HR_ADMIN'])),
      ).rejects.toThrow('Adverse impact analysis not found');
    });

    it('lists adverse-impact analyses scoped to the authenticated tenant', async () => {
      const { controller, adverseImpactAnalysisRepo } = makeController();
      (adverseImpactAnalysisRepo.findByRequisitionForTenant as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await controller.listRequisitionAdverseImpactAnalyses(requisitionId, request(['HR_ADMIN']));

      expect(adverseImpactAnalysisRepo.findByRequisitionForTenant).toHaveBeenCalledWith(
        new Uuid(requisitionId),
        new Uuid(tenantId),
      );
      expect(adverseImpactAnalysisRepo.findByRequisition).not.toHaveBeenCalled();
    });

    it('rejects reads of adverse-impact analyses from actors without a DEI/compliance/HR-admin role', async () => {
      const { controller } = makeController();

      await expect(
        controller.getRequisitionAdverseImpactAnalysis(analysisId, request(['RECRUITER'])),
      ).rejects.toThrow(/DEI\/people-analytics, compliance, or HR administrators/);
    });

    it('analyze-adverse-impact rejects actors without a DEI/compliance/HR-admin role before dispatch (C-2)', async () => {
      const { controller, commandBus } = makeController();

      await expect(
        controller.analyzeRequisitionAdverseImpact(
          requisitionId,
          { analysisId, dimension: 'GENDER_IDENTITY' },
          request(['RECRUITER']),
        ),
      ).rejects.toThrow(/DEI\/people-analytics, compliance, or HR administrators/);

      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('analyze-adverse-impact dispatches with an aggregateId scoping the command to the requisition (C-2)', async () => {
      const { controller, commandBus } = makeController();

      await controller.analyzeRequisitionAdverseImpact(
        requisitionId,
        { analysisId, dimension: 'GENDER_IDENTITY' },
        request(['HR_ADMIN']),
      );

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          commandName: 'AnalyzeRequisitionAdverseImpact',
          aggregateId: new Uuid(requisitionId),
          tenantId: new Uuid(tenantId),
        }),
      );
    });
  });
});
