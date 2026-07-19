import { describe, expect, it, vi, beforeEach } from 'vitest';
import { OfferCompensationGateService } from './offer-compensation-gate.service.js';
import type { JobRequisitionRepository } from '../repositories/job-requisition.repository.js';
import type { PositionRepository } from '../../position-control/repositories/position.repository.js';
import type { CompensationBandRepository } from '../../compensation/repositories/compensation-band.repository.js';
import { JobRequisition } from '../aggregates/job-requisition.aggregate.js';
import { Position } from '../../position-control/aggregates/position.aggregate.js';
import { CompensationBand } from '../../compensation/aggregates/compensation-band.aggregate.js';
import { Uuid } from '@hcm/shared-kernel';

describe('OfferCompensationGateService', () => {
  const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
  const requisitionId = new Uuid('00000000-0000-0000-0000-000000000002');
  const positionId = new Uuid('00000000-0000-0000-0000-000000000003');
  const correlationId = Uuid.generate();

  const requisitionRepo = {
    findById: vi.fn(),
  } as unknown as JobRequisitionRepository;

  const positionRepo = {
    findById: vi.fn(),
  } as unknown as PositionRepository;

  const compensationBandRepo = {
    findActiveByFamilyAndLevel: vi.fn(),
  } as unknown as CompensationBandRepository;

  const gate = new OfferCompensationGateService(requisitionRepo, positionRepo, compensationBandRepo);

  function requisition(): JobRequisition {
    return JobRequisition.create(
      {
        id: requisitionId,
        tenantId,
        requisitionNumber: 'REQ-001',
        positionId,
        title: 'Senior Engineer',
      },
      correlationId,
    );
  }

  function position(): Position {
    return Position.restore({
      id: positionId,
      tenantId,
      positionCode: 'POS-001',
      title: 'Senior Engineer',
      jobFamily: 'ENGINEERING',
      jobLevel: 'L4',
      employmentType: 'FULL_TIME',
      status: 'VACANT',
    });
  }

  function positionWithoutJobData(): Position {
    return Position.restore({
      id: positionId,
      tenantId,
      positionCode: 'POS-001',
      title: 'Senior Engineer',
      employmentType: 'FULL_TIME',
      status: 'VACANT',
    });
  }

  function band(): CompensationBand {
    return CompensationBand.create({
      id: Uuid.generate(),
      tenantId,
      bandCode: 'ENG-L4',
      jobLevel: 'L4',
      jobFamily: 'ENGINEERING',
      minSalary: 80_000,
      midSalary: 100_000,
      maxSalary: 120_000,
      currency: 'USD',
      correlationId,
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requisitionRepo.findById).mockResolvedValue(requisition());
    vi.mocked(positionRepo.findById).mockResolvedValue(position());
    vi.mocked(compensationBandRepo.findActiveByFamilyAndLevel).mockResolvedValue(band());
  });

  it('APPROVED for an in-band offer', async () => {
    const result = await gate.evaluate(requisitionId, 100_000, 'USD');
    expect(result.decisionCode).toBe('APPROVED');
    expect(result.violations).toHaveLength(0);
  });

  it('CONDITIONAL for an out-of-band offer (requires approval, not a hard block)', async () => {
    const result = await gate.evaluate(requisitionId, 150_000, 'USD');
    expect(result.decisionCode).toBe('CONDITIONAL');
    expect(result.violations.map((v) => v.code)).toContain('ABOVE_BAND_MAXIMUM');
  });

  it('REJECTED for a currency mismatch against the band', async () => {
    const result = await gate.evaluate(requisitionId, 100_000, 'EUR');
    expect(result.decisionCode).toBe('REJECTED');
    expect(result.violations.map((v) => v.code)).toContain('CURRENCY_MISMATCH');
  });

  it('resolves the band via requisition.positionId -> position.jobFamily/jobLevel', async () => {
    await gate.evaluate(requisitionId, 100_000, 'USD');
    expect(positionRepo.findById).toHaveBeenCalledWith(positionId);
    expect(compensationBandRepo.findActiveByFamilyAndLevel).toHaveBeenCalledWith('ENGINEERING', 'L4');
  });

  it('throws when the requisition cannot be found', async () => {
    vi.mocked(requisitionRepo.findById).mockResolvedValue(undefined);
    await expect(gate.evaluate(requisitionId, 100_000, 'USD')).rejects.toThrow('Job requisition not found');
  });

  it('throws when the position cannot be found', async () => {
    vi.mocked(positionRepo.findById).mockResolvedValue(undefined);
    await expect(gate.evaluate(requisitionId, 100_000, 'USD')).rejects.toThrow('Position not found');
  });

  it('fails closed when the position has no jobFamily/jobLevel configured', async () => {
    vi.mocked(positionRepo.findById).mockResolvedValue(positionWithoutJobData());
    await expect(gate.evaluate(requisitionId, 100_000, 'USD')).rejects.toThrow(
      'Position must have jobFamily and jobLevel configured',
    );
  });

  it('fails closed when no active compensation band is configured for the family/level', async () => {
    vi.mocked(compensationBandRepo.findActiveByFamilyAndLevel).mockResolvedValue(undefined);
    await expect(gate.evaluate(requisitionId, 100_000, 'USD')).rejects.toThrow(
      'No active compensation band found for job family "ENGINEERING" level "L4"',
    );
  });
});
