import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

/* ------------------------------------------------------------------ */
/*  CompensationPlan DTOs                                              */
/* ------------------------------------------------------------------ */

export class CreateCompensationPlanDto {
  static zodSchema = z.object({
    planId: z.string().uuid(),
    name: z.string().min(1),
    planType: z.string().min(1),
    currency: z.string().length(3),
    effectiveFrom: z.coerce.date().optional(),
    effectiveUntil: z.coerce.date().optional(),
  });

  @ApiProperty() planId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() planType!: string;
  @ApiProperty() currency!: string;
  @ApiPropertyOptional() effectiveFrom?: Date;
  @ApiPropertyOptional() effectiveUntil?: Date;
}

/* ------------------------------------------------------------------ */
/*  CompensationBand DTOs                                              */
/* ------------------------------------------------------------------ */

export class CreateCompensationBandDto {
  static zodSchema = z.object({
    bandId: z.string().uuid(),
    bandCode: z.string().min(1),
    jobLevel: z.string().min(1),
    jobFamily: z.string().min(1),
    minSalary: z.number().nonnegative(),
    midSalary: z.number().nonnegative(),
    maxSalary: z.number().nonnegative(),
    currency: z.string().length(3),
  });

  @ApiProperty() bandId!: string;
  @ApiProperty() bandCode!: string;
  @ApiProperty() jobLevel!: string;
  @ApiProperty() jobFamily!: string;
  @ApiProperty() minSalary!: number;
  @ApiProperty() midSalary!: number;
  @ApiProperty() maxSalary!: number;
  @ApiProperty() currency!: string;
}

export class ReviseCompensationBandDto {
  static zodSchema = z.object({
    minSalary: z.number().nonnegative(),
    midSalary: z.number().nonnegative(),
    maxSalary: z.number().nonnegative(),
  });

  @ApiProperty() minSalary!: number;
  @ApiProperty() midSalary!: number;
  @ApiProperty() maxSalary!: number;
}

/* ------------------------------------------------------------------ */
/*  CompensationChange DTOs                                            */
/* ------------------------------------------------------------------ */

export class CreateCompensationChangeDto {
  static zodSchema = z.object({
    changeId: z.string().uuid(),
    workerId: z.string().uuid(),
    changeType: z.string().min(1),
    oldAmount: z.number().nonnegative().optional(),
    newAmount: z.number().nonnegative(),
    currency: z.string().length(3),
    effectiveDate: z.coerce.date(),
  });

  @ApiProperty() changeId!: string;
  @ApiProperty() workerId!: string;
  @ApiProperty() changeType!: string;
  @ApiPropertyOptional() oldAmount?: number;
  @ApiProperty() newAmount!: number;
  @ApiProperty() currency!: string;
  @ApiProperty() effectiveDate!: Date;
}

export class ApproveCompensationChangeDto {
  static zodSchema = z.object({
    approvedBy: z.string().uuid(),
  });

  @ApiProperty() approvedBy!: string;
}

/* ------------------------------------------------------------------ */
/*  BonusCycle DTOs                                                    */
/* ------------------------------------------------------------------ */

export class CreateBonusCycleDto {
  static zodSchema = z.object({
    cycleId: z.string().uuid(),
    cycleName: z.string().min(1),
    cycleYear: z.number().int().positive(),
    eligibilityDate: z.coerce.date(),
    paymentDate: z.coerce.date(),
    totalPoolAmount: z.number().nonnegative(),
    currency: z.string().length(3),
  });

  @ApiProperty() cycleId!: string;
  @ApiProperty() cycleName!: string;
  @ApiProperty() cycleYear!: number;
  @ApiProperty() eligibilityDate!: Date;
  @ApiProperty() paymentDate!: Date;
  @ApiProperty() totalPoolAmount!: number;
  @ApiProperty() currency!: string;
}

/* ------------------------------------------------------------------ */
/*  EquityGrant DTOs                                                   */
/* ------------------------------------------------------------------ */

export class VestingScheduleEntryDto {
  @ApiProperty() date!: Date;
  @ApiProperty() percentage!: number;
  @ApiProperty() units!: number;
}

export class CreateEquityGrantDto {
  static zodSchema = z.object({
    grantId: z.string().uuid(),
    workerId: z.string().uuid(),
    grantType: z.string().min(1),
    grantDate: z.coerce.date(),
    vestingSchedule: z.array(z.object({ date: z.coerce.date(), percentage: z.number().nonnegative(), units: z.number().nonnegative() })),
    totalUnits: z.number().nonnegative(),
    strikePrice: z.number().nonnegative().optional(),
  });

  @ApiProperty() grantId!: string;
  @ApiProperty() workerId!: string;
  @ApiProperty() grantType!: string;
  @ApiProperty() grantDate!: Date;
  @ApiProperty({ type: () => [VestingScheduleEntryDto] }) vestingSchedule!: VestingScheduleEntryDto[];
  @ApiProperty() totalUnits!: number;
  @ApiPropertyOptional() strikePrice?: number;
}

export class RecordVestingEquityGrantDto {
  static zodSchema = z.object({
    units: z.number().nonnegative(),
  });

  @ApiProperty() units!: number;
}

export class ExerciseEquityGrantDto {
  static zodSchema = z.object({
    units: z.number().nonnegative(),
  });

  @ApiProperty() units!: number;
}

/* ------------------------------------------------------------------ */
/*  VariableCompPlan DTOs                                              */
/* ------------------------------------------------------------------ */

export class CreateVariableCompPlanDto {
  static zodSchema = z.object({
    planId: z.string().uuid(),
    name: z.string().min(1),
    planType: z.string().min(1),
    targetPercentage: z.number().nonnegative(),
    maxPercentage: z.number().nonnegative(),
    currency: z.string().length(3),
  });

  @ApiProperty() planId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() planType!: string;
  @ApiProperty() targetPercentage!: number;
  @ApiProperty() maxPercentage!: number;
  @ApiProperty() currency!: string;
}

/* ------------------------------------------------------------------ */
/*  PayScale DTOs                                                      */
/* ------------------------------------------------------------------ */

export class PayScaleStepDto {
  @ApiProperty() stepNumber!: number;
  @ApiProperty() amount!: number;
}

export class CreatePayScaleDto {
  static zodSchema = z.object({
    scaleId: z.string().uuid(),
    scaleCode: z.string().min(1),
    grade: z.string().min(1),
    steps: z.array(z.object({ stepNumber: z.number().int().positive(), amount: z.number().nonnegative() })),
    currency: z.string().length(3),
  });

  @ApiProperty() scaleId!: string;
  @ApiProperty() scaleCode!: string;
  @ApiProperty() grade!: string;
  @ApiProperty({ type: () => [PayScaleStepDto] }) steps!: PayScaleStepDto[];
  @ApiProperty() currency!: string;
}

export class RevisePayScaleDto {
  static zodSchema = z.object({
    steps: z.array(z.object({ stepNumber: z.number().int().positive(), amount: z.number().nonnegative() })),
  });

  @ApiProperty({ type: () => [PayScaleStepDto] }) steps!: PayScaleStepDto[];
}

/* ------------------------------------------------------------------ */
/*  TotalCompensationStatement DTOs                                    */
/* ------------------------------------------------------------------ */

export class CreateTotalCompensationStatementDto {
  static zodSchema = z.object({
    statementId: z.string().uuid(),
    workerId: z.string().uuid(),
    statementYear: z.number().int().positive(),
    baseSalary: z.number().nonnegative(),
    bonusAmount: z.number().nonnegative(),
    equityValue: z.number().nonnegative(),
    benefitsValue: z.number().nonnegative(),
    totalComp: z.number().nonnegative(),
    currency: z.string().length(3),
  });

  @ApiProperty() statementId!: string;
  @ApiProperty() workerId!: string;
  @ApiProperty() statementYear!: number;
  @ApiProperty() baseSalary!: number;
  @ApiProperty() bonusAmount!: number;
  @ApiProperty() equityValue!: number;
  @ApiProperty() benefitsValue!: number;
  @ApiProperty() totalComp!: number;
  @ApiProperty() currency!: string;
}
