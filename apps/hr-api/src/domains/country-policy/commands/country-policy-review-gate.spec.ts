import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Uuid, ValidationError } from '@hcm/shared-kernel';
import type { HrActor, HrCommandEnvelope } from '@hcm/command-contracts';
import { CountryPolicyPack } from '../aggregates/country-policy-pack.aggregate.js';
import type { CountryPolicyPackRepository } from '../repositories/country-policy-pack.repository.js';
import type { CountryPolicyValidationRunRepository } from '../repositories/country-policy-validation-run.repository.js';
import type { CountryPolicyImpactSimulationRepository } from '../repositories/country-policy-impact-simulation.repository.js';
import type { HcmSetupService } from '../../hcm-setup/hcm-setup.service.js';

import { UploadCountryPolicyPackHandler } from './upload-country-policy-pack.handler.js';
import { ValidateCountryPolicyPackHandler } from './validate-country-policy-pack.handler.js';
import { SimulateCountryPolicyPackImpactHandler } from './simulate-country-policy-pack-impact.handler.js';
import { SubmitCountryPolicyPackForLegalReviewHandler } from './submit-country-policy-pack-for-legal-review.handler.js';
import { SubmitCountryPolicyPackForPayrollTaxReviewHandler } from './submit-country-policy-pack-for-payroll-tax-review.handler.js';
import { SubmitCountryPolicyPackForGlobalHRReviewHandler } from './submit-country-policy-pack-for-global-hr-review.handler.js';
import { SubmitCountryPolicyPackForBenefitsReviewHandler } from './submit-country-policy-pack-for-benefits-review.handler.js';
import { SubmitCountryPolicyPackForAbsenceReviewHandler } from './submit-country-policy-pack-for-absence-review.handler.js';
import { SubmitCountryPolicyPackForComplianceReviewHandler } from './submit-country-policy-pack-for-compliance-review.handler.js';
import { SubmitCountryPolicyPackForApprovalHandler } from './submit-country-policy-pack-for-approval.handler.js';
import { ApproveCountryPolicyPackHandler } from './approve-country-policy-pack.handler.js';
import { RejectCountryPolicyPackHandler } from './reject-country-policy-pack.handler.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const uploaderId = new Uuid('00000000-0000-0000-0000-000000000010');
const approverId = new Uuid('00000000-0000-0000-0000-000000000020');
const packId = new Uuid('00000000-0000-0000-0000-000000000300');

const ALL_REVIEW_TYPES = ['LEGAL', 'PAYROLL_TAX', 'GLOBAL_HR', 'BENEFITS', 'ABSENCE', 'COMPLIANCE'];

function actor(): HrActor {
  return {
    actorType: 'USER',
    actorId: uploaderId,
    roles: ['COUNTRY_POLICY_ADMIN'],
    permissions: ['COUNTRY_POLICY_WRITE'],
    email: 'country.policy@example.com',
    mfaAuthenticated: true,
  };
}

function envelope<T>(commandName: string, payload: T): HrCommandEnvelope<T> {
  return {
    commandId: Uuid.generate(),
    commandName,
    commandSchemaVersion: 1,
    tenantId,
    actor: actor(),
    aggregateType: 'CountryPolicyPack',
    aggregateId: packId,
    idempotencyKey: `${commandName}-${Date.now()}-${Math.random()}`,
    correlationId: Uuid.generate(),
    reason: 'spec',
    payload,
    metadata: { requestHash: 'test-hash', clientType: 'HR_ADMIN' },
  };
}

/** Builds an in-memory fake repo backed by a single mutable pack reference. */
function fakePackRepo(initial: CountryPolicyPack) {
  let current = initial;
  return {
    findById: vi.fn(async () => current),
    save: vi.fn(async (pack: CountryPolicyPack) => {
      current = pack;
    }),
    get current() {
      return current;
    },
  };
}

function buildPack(overrides: Partial<ConstructorParameters<typeof CountryPolicyPack>[0]> = {}): CountryPolicyPack {
  return new CountryPolicyPack({
    id: packId,
    tenantId,
    countryCode: 'EG',
    countryPackVersion: '2026.1',
    effectiveFrom: new Date('2026-01-01'),
    status: 'IMPACT_SIMULATED',
    sections: { PAYROLL: { content: { taxRate: 0.1 } } },
    requiredApprovals: ALL_REVIEW_TYPES,
    completedReviews: [],
    sourceEvidence: { evidenceType: 'STATUTE', reference: 'EG-LAW-2026-01' },
    uploadedBy: uploaderId,
    aggregateVersion: 5,
    ...overrides,
  });
}

describe('Country policy review-gate command handlers', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe.each([
    ['SubmitForLegalReview', SubmitCountryPolicyPackForLegalReviewHandler, 'LEGAL_REVIEW_PENDING', 'LEGAL'],
    ['SubmitForPayrollTaxReview', SubmitCountryPolicyPackForPayrollTaxReviewHandler, 'PAYROLL_TAX_REVIEW_PENDING', 'PAYROLL_TAX'],
    ['SubmitForGlobalHRReview', SubmitCountryPolicyPackForGlobalHRReviewHandler, 'GLOBAL_HR_REVIEW_PENDING', 'GLOBAL_HR'],
    ['SubmitForBenefitsReview', SubmitCountryPolicyPackForBenefitsReviewHandler, 'BENEFITS_REVIEW_PENDING', 'BENEFITS'],
    ['SubmitForAbsenceReview', SubmitCountryPolicyPackForAbsenceReviewHandler, 'ABSENCE_REVIEW_PENDING', 'ABSENCE'],
    ['SubmitForComplianceReview', SubmitCountryPolicyPackForComplianceReviewHandler, 'COMPLIANCE_REVIEW_PENDING', 'COMPLIANCE'],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ] as [string, any, string, string][])('%s', (commandName, HandlerClass, expectedState, reviewType) => {
    it(`transitions to ${expectedState} and records ${reviewType} in completedReviews`, async () => {
      const pack = buildPack({ status: 'IMPACT_SIMULATED', completedReviews: [] });
      const repo = fakePackRepo(pack);
      const handler = new HandlerClass(repo as unknown as CountryPolicyPackRepository);

      const result = await handler.handle(envelope(commandName, { packId: packId.value }));

      expect(result.success).toBe(true);
      expect(result.newState).toBe(expectedState);
      expect((result.data as { completedReviews: string[] }).completedReviews).toContain(reviewType);
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: expectedState, completedReviews: [reviewType] }),
      );
    });

    it('is idempotent: submitting the same review twice does not duplicate the entry', async () => {
      const pack = buildPack({ status: 'IMPACT_SIMULATED', completedReviews: [reviewType] });
      const repo = fakePackRepo(pack);
      const handler = new HandlerClass(repo as unknown as CountryPolicyPackRepository);

      await handler.handle(envelope(commandName, { packId: packId.value }));

      expect(repo.current.completedReviews.filter((r) => r === reviewType)).toHaveLength(1);
    });
  });

  describe('SubmitForApproval', () => {
    it('succeeds once every required review has been completed', async () => {
      const pack = buildPack({ status: 'COMPLIANCE_REVIEW_PENDING', completedReviews: [...ALL_REVIEW_TYPES] });
      const repo = fakePackRepo(pack);
      const handler = new SubmitCountryPolicyPackForApprovalHandler(repo as unknown as CountryPolicyPackRepository);

      const result = await handler.handle(envelope('SubmitForApproval', { packId: packId.value }));

      expect(result.success).toBe(true);
      expect(result.newState).toBe('APPROVAL_PENDING');
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'APPROVAL_PENDING' }));
    });

    it('rejects the transition and lists every missing review when reviews are incomplete', async () => {
      const pack = buildPack({
        status: 'PAYROLL_TAX_REVIEW_PENDING',
        completedReviews: ['LEGAL', 'PAYROLL_TAX'],
      });
      const repo = fakePackRepo(pack);
      const handler = new SubmitCountryPolicyPackForApprovalHandler(repo as unknown as CountryPolicyPackRepository);

      await expect(handler.handle(envelope('SubmitForApproval', { packId: packId.value }))).rejects.toThrow(
        ValidationError,
      );
      await expect(handler.handle(envelope('SubmitForApproval', { packId: packId.value }))).rejects.toThrow(
        /GLOBAL_HR, BENEFITS, ABSENCE, COMPLIANCE/,
      );
      // The aggregate must not have been persisted in a half-transitioned state.
      expect(repo.save).not.toHaveBeenCalled();
      expect(repo.current.status).toBe('PAYROLL_TAX_REVIEW_PENDING');
    });

    it('rejects when no reviews have been submitted at all', async () => {
      const pack = buildPack({ status: 'IMPACT_SIMULATED', completedReviews: [] });
      const repo = fakePackRepo(pack);
      const handler = new SubmitCountryPolicyPackForApprovalHandler(repo as unknown as CountryPolicyPackRepository);

      await expect(handler.handle(envelope('SubmitForApproval', { packId: packId.value }))).rejects.toThrow(
        /LEGAL, PAYROLL_TAX, GLOBAL_HR, BENEFITS, ABSENCE, COMPLIANCE/,
      );
    });
  });

  describe('ApproveCountryPolicyPack (SoD guard)', () => {
    it('rejects approval when the approver is the uploader', async () => {
      const pack = buildPack({ status: 'APPROVAL_PENDING', completedReviews: [...ALL_REVIEW_TYPES], uploadedBy: uploaderId });
      const repo = fakePackRepo(pack);
      const handler = new ApproveCountryPolicyPackHandler(repo as unknown as CountryPolicyPackRepository);

      await expect(
        handler.handle(envelope('ApproveCountryPolicyPack', { packId: packId.value, approvedBy: uploaderId.value })),
      ).rejects.toThrow(/Segregation of duties/);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('approves when the approver differs from the uploader', async () => {
      const pack = buildPack({ status: 'APPROVAL_PENDING', completedReviews: [...ALL_REVIEW_TYPES], uploadedBy: uploaderId });
      const repo = fakePackRepo(pack);
      const handler = new ApproveCountryPolicyPackHandler(repo as unknown as CountryPolicyPackRepository);

      const result = await handler.handle(
        envelope('ApproveCountryPolicyPack', { packId: packId.value, approvedBy: approverId.value }),
      );

      expect(result.success).toBe(true);
      expect(result.newState).toBe('APPROVED');
      expect(result.eventsEmitted).toContain('CountryPolicyPackApproved');
    });
  });

  describe('RejectCountryPolicyPack', () => {
    it('rejects the pack and captures rejectedBy and reason', async () => {
      const pack = buildPack({ status: 'APPROVAL_PENDING', completedReviews: [...ALL_REVIEW_TYPES] });
      const repo = fakePackRepo(pack);
      const handler = new RejectCountryPolicyPackHandler(repo as unknown as CountryPolicyPackRepository);

      const result = await handler.handle(
        envelope('RejectCountryPolicyPack', {
          packId: packId.value,
          rejectedBy: approverId.value,
          reason: 'Missing statutory evidence for TAX section',
        }),
      );

      expect(result.success).toBe(true);
      expect(result.newState).toBe('REJECTED');
      expect((result.data as { rejectedBy: string }).rejectedBy).toBe(approverId.value);
      expect((result.data as { rejectionReason: string }).rejectionReason).toBe(
        'Missing statutory evidence for TAX section',
      );
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'REJECTED',
          rejectionReason: 'Missing statutory evidence for TAX section',
        }),
      );
      expect(repo.current.rejectedBy?.value).toBe(approverId.value);
    });

    it('rejects the command when no reason is provided', async () => {
      const pack = buildPack({ status: 'APPROVAL_PENDING', completedReviews: [...ALL_REVIEW_TYPES] });
      const repo = fakePackRepo(pack);
      const handler = new RejectCountryPolicyPackHandler(repo as unknown as CountryPolicyPackRepository);

      await expect(
        handler.handle(
          envelope('RejectCountryPolicyPack', { packId: packId.value, rejectedBy: approverId.value, reason: '' }),
        ),
      ).rejects.toThrow();
    });

    it('cannot reject a pack that is not in APPROVAL_PENDING', async () => {
      const pack = buildPack({ status: 'IMPACT_SIMULATED', completedReviews: [] });
      const repo = fakePackRepo(pack);
      const handler = new RejectCountryPolicyPackHandler(repo as unknown as CountryPolicyPackRepository);

      await expect(
        handler.handle(
          envelope('RejectCountryPolicyPack', {
            packId: packId.value,
            rejectedBy: approverId.value,
            reason: 'too early',
          }),
        ),
      ).rejects.toThrow(/Cannot reject from state/);
    });
  });

  describe('Full lifecycle: upload -> validate -> simulate -> reviews -> submit-for-approval -> approve', () => {
    /**
     * NOTE: `parse()` (UPLOADED -> PARSING) and `requireSimulation()`
     * (VALIDATED -> IMPACT_SIMULATION_REQUIRED) are real aggregate methods
     * declared in the FSM, but — like the review-gate steps this change
     * fixes — they have no command handler wired up anywhere in the module
     * (pre-existing gap, out of scope for this change). To drive the pack
     * through the full real lifecycle this test calls those two transitions
     * directly on the aggregate (not mocked out), then exercises every other
     * step through its real, registered command handler.
     */
    it('drives a pack through the entire real lifecycle and reaches APPROVED', async () => {
      const uploadRepo = fakePackRepo(undefined as unknown as CountryPolicyPack);
      // UploadCountryPolicyPackHandler constructs the aggregate itself; only `save` is used.
      const uploadHandler = new UploadCountryPolicyPackHandler(
        { findById: vi.fn(), save: uploadRepo.save } as unknown as CountryPolicyPackRepository,
      );
      await uploadHandler.handle(
        envelope('UploadCountryPolicyPack', {
          packId: packId.value,
          countryCode: 'EG',
          version: '2026.1',
          effectiveFrom: new Date('2026-01-01'),
          sections: { PAYROLL: { content: { taxRate: 0.1 } } },
          uploadedBy: uploaderId.value,
        }),
      );
      const uploaded = uploadRepo.save.mock.calls[0][0] as CountryPolicyPack;
      expect(uploaded.status).toBe('UPLOADED');

      // Pre-existing gap: no ParseCountryPolicyPack handler exists yet.
      uploaded.parse(Uuid.generate());
      expect(uploaded.status).toBe('PARSING');

      const validateRepo = fakePackRepo(uploaded);
      const hcmSetupService = { getSetup: vi.fn(async () => ({})) } as unknown as HcmSetupService;
      const validationRunRepo = { save: vi.fn() } as unknown as CountryPolicyValidationRunRepository;
      const validateHandler = new ValidateCountryPolicyPackHandler(
        validateRepo as unknown as CountryPolicyPackRepository,
        validationRunRepo,
        hcmSetupService,
      );
      const validateResult = await validateHandler.handle(
        envelope('ValidateCountryPolicyPack', {
          packId: packId.value,
          validationRunId: Uuid.generate().value,
          validationType: 'STRUCTURAL',
        }),
      );
      expect(validateResult.success).toBe(true);
      expect(validateResult.newState).toBe('VALIDATED');
      const validated = validateRepo.current;

      // Pre-existing gap: no RequireImpactSimulation handler exists yet.
      validated.requireSimulation(Uuid.generate());
      expect(validated.status).toBe('IMPACT_SIMULATION_REQUIRED');

      const simulateRepo = fakePackRepo(validated);
      const impactSimRepo = { save: vi.fn() } as unknown as CountryPolicyImpactSimulationRepository;
      const simulateHandler = new SimulateCountryPolicyPackImpactHandler(
        simulateRepo as unknown as CountryPolicyPackRepository,
        impactSimRepo,
      );
      const simulateResult = await simulateHandler.handle(
        envelope('SimulateCountryPolicyPackImpact', {
          packId: packId.value,
          simulationRunId: Uuid.generate().value,
          simulationScope: 'FULL',
        }),
      );
      expect(simulateResult.success).toBe(true);
      expect(simulateResult.newState).toBe('IMPACT_SIMULATED');
      let pack = simulateRepo.current;
      expect(pack.requiredApprovals).toEqual([]); // upload didn't set any; set them now for the gate to matter.
      pack.requiredApprovals = [...ALL_REVIEW_TYPES];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const reviewSteps: Array<{ HandlerClass: any; commandName: string; expectedState: string; reviewType: string }> = [
        { HandlerClass: SubmitCountryPolicyPackForLegalReviewHandler, commandName: 'SubmitForLegalReview', expectedState: 'LEGAL_REVIEW_PENDING', reviewType: 'LEGAL' },
        { HandlerClass: SubmitCountryPolicyPackForPayrollTaxReviewHandler, commandName: 'SubmitForPayrollTaxReview', expectedState: 'PAYROLL_TAX_REVIEW_PENDING', reviewType: 'PAYROLL_TAX' },
        { HandlerClass: SubmitCountryPolicyPackForGlobalHRReviewHandler, commandName: 'SubmitForGlobalHRReview', expectedState: 'GLOBAL_HR_REVIEW_PENDING', reviewType: 'GLOBAL_HR' },
        { HandlerClass: SubmitCountryPolicyPackForBenefitsReviewHandler, commandName: 'SubmitForBenefitsReview', expectedState: 'BENEFITS_REVIEW_PENDING', reviewType: 'BENEFITS' },
        { HandlerClass: SubmitCountryPolicyPackForAbsenceReviewHandler, commandName: 'SubmitForAbsenceReview', expectedState: 'ABSENCE_REVIEW_PENDING', reviewType: 'ABSENCE' },
        { HandlerClass: SubmitCountryPolicyPackForComplianceReviewHandler, commandName: 'SubmitForComplianceReview', expectedState: 'COMPLIANCE_REVIEW_PENDING', reviewType: 'COMPLIANCE' },
      ];

      for (const step of reviewSteps) {
        const repo = fakePackRepo(pack);
        const handler = new step.HandlerClass(repo as unknown as CountryPolicyPackRepository);
        const result = await handler.handle(envelope(step.commandName, { packId: packId.value }));
        expect(result.success).toBe(true);
        expect(result.newState).toBe(step.expectedState);
        pack = repo.current;
        expect(pack.completedReviews).toContain(step.reviewType);
      }

      expect(pack.completedReviews.sort()).toEqual([...ALL_REVIEW_TYPES].sort());

      const submitForApprovalRepo = fakePackRepo(pack);
      const submitForApprovalHandler = new SubmitCountryPolicyPackForApprovalHandler(
        submitForApprovalRepo as unknown as CountryPolicyPackRepository,
      );
      const submitForApprovalResult = await submitForApprovalHandler.handle(
        envelope('SubmitForApproval', { packId: packId.value }),
      );
      expect(submitForApprovalResult.success).toBe(true);
      expect(submitForApprovalResult.newState).toBe('APPROVAL_PENDING');
      pack = submitForApprovalRepo.current;

      const approveRepo = fakePackRepo(pack);
      const approveHandler = new ApproveCountryPolicyPackHandler(approveRepo as unknown as CountryPolicyPackRepository);
      const approveResult = await approveHandler.handle(
        envelope('ApproveCountryPolicyPack', { packId: packId.value, approvedBy: approverId.value }),
      );

      expect(approveResult.success).toBe(true);
      expect(approveResult.newState).toBe('APPROVED');
      expect(approveResult.eventsEmitted).toContain('CountryPolicyPackApproved');
      expect(approveRepo.current.status).toBe('APPROVED');
    });

    it('cannot reach APPROVAL_PENDING if the gate is bypassed (submit-for-approval called with reviews skipped)', async () => {
      const pack = buildPack({ status: 'IMPACT_SIMULATED', completedReviews: [], requiredApprovals: [...ALL_REVIEW_TYPES] });
      const repo = fakePackRepo(pack);
      const handler = new SubmitCountryPolicyPackForApprovalHandler(repo as unknown as CountryPolicyPackRepository);

      // IMPACT_SIMULATED is a structurally-valid "from" state for SubmitForApproval,
      // so without the completeness check this would previously have succeeded
      // despite zero reviews having been performed.
      await expect(handler.handle(envelope('SubmitForApproval', { packId: packId.value }))).rejects.toThrow(
        ValidationError,
      );
      expect(repo.current.status).toBe('IMPACT_SIMULATED');
    });
  });
});
