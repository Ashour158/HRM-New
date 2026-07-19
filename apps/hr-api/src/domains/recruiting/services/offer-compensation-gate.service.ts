import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Uuid } from '@hcm/shared-kernel';
import { evaluateOfferCompensation, type OfferCompensationResult } from '@hcm/policy-engines';
import { JobRequisitionRepository } from '../repositories/job-requisition.repository.js';
import { PositionRepository } from '../../position-control/repositories/position.repository.js';
import { CompensationBandRepository } from '../../compensation/repositories/compensation-band.repository.js';

/**
 * Resolves the compensation band for a job requisition's position and runs
 * the `offer-compensation` policy engine (`@hcm/policy-engines`) against a
 * proposed offer amount.
 *
 * Shared by CreateOfferHandler (initial gate) and ApproveOfferHandler
 * (re-verification gate, in case band data changed between creation and
 * approval) so both call sites resolve the band and evaluate the engine the
 * same way.
 *
 * Band linkage: the data model has no stored requisition→band (or
 * position→band) foreign key. CompensationBand is keyed by
 * (jobFamily, jobLevel), and Position already carries both fields, so the
 * band is resolved live via JobRequisition.positionId → Position.jobFamily/
 * jobLevel → CompensationBandRepository lookup, rather than adding a new
 * stored reference.
 *
 * Statutory-minimum-wage checking is intentionally NOT performed: this
 * codebase has no minimum-wage reference dataset (checked hcm-setup and
 * country-policy domains) to source it from, so `statutoryMinimum` is left
 * undefined on the engine input and only band-range/pay-equity validation is
 * in effect. Pay-equity comparison is likewise omitted pending a comparable-
 * offers/employees data source; the engine gracefully treats an absent
 * `payEquity` input as "not applicable" rather than a violation.
 */
@Injectable()
export class OfferCompensationGateService {
  constructor(
    private readonly requisitionRepo: JobRequisitionRepository,
    private readonly positionRepo: PositionRepository,
    private readonly compensationBandRepo: CompensationBandRepository,
  ) {}

  async evaluate(requisitionId: Uuid, proposedSalary: number, currency: string): Promise<OfferCompensationResult> {
    const requisition = await this.requisitionRepo.findById(requisitionId);
    if (!requisition) {
      throw new NotFoundException('Job requisition not found for offer');
    }

    const position = await this.positionRepo.findById(requisition.positionId);
    if (!position) {
      throw new NotFoundException('Position not found for job requisition');
    }

    if (!position.jobFamily || !position.jobLevel) {
      throw new BadRequestException(
        'Position must have jobFamily and jobLevel configured before an offer can be validated against a compensation band',
      );
    }

    const band = await this.compensationBandRepo.findActiveByFamilyAndLevel(position.jobFamily, position.jobLevel);
    if (!band) {
      throw new BadRequestException(
        `No active compensation band found for job family "${position.jobFamily}" level "${position.jobLevel}"; cannot validate offer compensation`,
      );
    }

    return evaluateOfferCompensation({
      proposedSalary,
      currency,
      band: {
        minSalary: band.minSalary,
        midSalary: band.midSalary,
        maxSalary: band.maxSalary,
        currency: band.currency,
      },
    });
  }
}
