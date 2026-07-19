import { z } from 'zod';
import { Injectable, PipeTransform, BadRequestException } from '@nestjs/common';

export const CreateContingentWorkerAssignmentDto = z.object({
  workerId: z.string().uuid(),
  vendorId: z.string().uuid(),
  projectId: z.string().uuid(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  rate: z.number().min(0),
  currency: z.string().min(1),
});

export type CreateContingentWorkerAssignmentDto = z.infer<typeof CreateContingentWorkerAssignmentDto>;

export const CreateSowEngagementDto = z.object({
  sowNumber: z.string().min(1),
  vendorId: z.string().uuid(),
  projectName: z.string().min(1),
  totalValue: z.number().min(0),
  currency: z.string().min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  milestones: z.array(z.string()).optional(),
});

export type CreateSowEngagementDto = z.infer<typeof CreateSowEngagementDto>;

export const CreateContractorRateCardDto = z.object({
  vendorId: z.string().uuid(),
  jobTitle: z.string().min(1),
  rate: z.number().min(0),
  currency: z.string().min(1),
  effectiveFrom: z.coerce.date(),
  effectiveUntil: z.coerce.date().optional(),
});

export type CreateContractorRateCardDto = z.infer<typeof CreateContractorRateCardDto>;

/**
 * Structured IRS common-law-test factor inputs. riskScore/riskFactors are
 * never accepted directly from the caller — they are always computed
 * server-side from these evidence-based factors by the misclassification
 * scoring engine (see contingent-workforce/services/misclassification-scoring.ts).
 */
export const MisclassificationFactorInputsDto = z.object({
  instructionsControl: z.boolean(),
  trainingProvided: z.boolean(),
  workScheduleSetByCompany: z.boolean(),
  worksExclusivelyForCompany: z.boolean(),
  toolsProvidedByCompany: z.boolean(),
  expensesReimbursed: z.boolean(),
  paidFixedRegularWage: z.boolean(),
  opportunityForProfitOrLoss: z.boolean(),
  significantInvestment: z.boolean(),
  writtenContractIndicatesEmployee: z.boolean(),
  employeeBenefitsProvided: z.boolean(),
  relationshipIsIndefinite: z.boolean(),
  servicesKeyToBusiness: z.boolean(),
});

export type MisclassificationFactorInputsDto = z.infer<typeof MisclassificationFactorInputsDto>;

export const CreateMisclassificationAssessmentDto = z.object({
  workerId: z.string().uuid(),
  assessmentDate: z.coerce.date(),
  factorInputs: MisclassificationFactorInputsDto,
});

export type CreateMisclassificationAssessmentDto = z.infer<typeof CreateMisclassificationAssessmentDto>;

export const RecalculateMisclassificationScoreDto = z.object({
  factorInputs: MisclassificationFactorInputsDto,
});

export type RecalculateMisclassificationScoreDto = z.infer<typeof RecalculateMisclassificationScoreDto>;

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: z.ZodTypeAny) {}
  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) throw new BadRequestException(result.error.format());
    return result.data;
  }
}
