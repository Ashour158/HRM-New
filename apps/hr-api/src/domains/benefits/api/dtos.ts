import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

/* ------------------------------------------------------------------ */
/*  BenefitsProgram DTOs                                               */
/* ------------------------------------------------------------------ */

export class CreateBenefitsProgramDto {
  static zodSchema = z.object({
    programId: z.string().uuid(),
    programName: z.string().min(1),
    programType: z.string().min(1),
    carrierId: z.string().uuid().optional(),
    effectiveFrom: z.coerce.date().optional(),
    effectiveUntil: z.coerce.date().optional(),
  });

  @ApiProperty() programId!: string;
  @ApiProperty() programName!: string;
  @ApiProperty() programType!: string;
  @ApiPropertyOptional() carrierId?: string;
  @ApiPropertyOptional() effectiveFrom?: Date;
  @ApiPropertyOptional() effectiveUntil?: Date;
}

/* ------------------------------------------------------------------ */
/*  BenefitsEnrollment DTOs                                            */
/* ------------------------------------------------------------------ */

export class DependentEntryDto {
  @ApiProperty() dependentId!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty() relationship!: string;
  @ApiProperty() dateOfBirth!: Date;
}

export class CreateBenefitsEnrollmentDto {
  static zodSchema = z.object({
    enrollmentId: z.string().uuid(),
    workerId: z.string().uuid(),
    programId: z.string().uuid(),
    coverageLevel: z.string().min(1),
    dependents: z.array(z.object({
      dependentId: z.string().uuid(),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      relationship: z.string().min(1),
      dateOfBirth: z.coerce.date(),
    })),
    effectiveDate: z.coerce.date(),
  });

  @ApiProperty() enrollmentId!: string;
  @ApiProperty() workerId!: string;
  @ApiProperty() programId!: string;
  @ApiProperty() coverageLevel!: string;
  @ApiProperty({ type: () => [DependentEntryDto] }) dependents!: DependentEntryDto[];
  @ApiProperty() effectiveDate!: Date;
}

/* ------------------------------------------------------------------ */
/*  BenefitsLifeEvent DTOs                                             */
/* ------------------------------------------------------------------ */

export class CreateBenefitsLifeEventDto {
  static zodSchema = z.object({
    lifeEventId: z.string().uuid(),
    workerId: z.string().uuid(),
    eventType: z.string().min(1),
    eventDate: z.coerce.date(),
    description: z.string().optional(),
  });

  @ApiProperty() lifeEventId!: string;
  @ApiProperty() workerId!: string;
  @ApiProperty() eventType!: string;
  @ApiProperty() eventDate!: Date;
  @ApiPropertyOptional() description?: string;
}

/* ------------------------------------------------------------------ */
/*  SpendingAccount DTOs                                               */
/* ------------------------------------------------------------------ */

export class CreateSpendingAccountDto {
  static zodSchema = z.object({
    accountId: z.string().uuid(),
    workerId: z.string().uuid(),
    accountType: z.string().min(1),
    annualElection: z.number().nonnegative(),
    currency: z.string().length(3),
  });

  @ApiProperty() accountId!: string;
  @ApiProperty() workerId!: string;
  @ApiProperty() accountType!: string;
  @ApiProperty() annualElection!: number;
  @ApiProperty() currency!: string;
}

/* ------------------------------------------------------------------ */
/*  CarrierReconciliationRun DTOs                                      */
/* ------------------------------------------------------------------ */

export class CreateCarrierReconciliationRunDto {
  static zodSchema = z.object({
    runId: z.string().uuid(),
    carrierId: z.string().uuid(),
    periodStart: z.coerce.date(),
    periodEnd: z.coerce.date(),
    totalPremium: z.number().nonnegative(),
    totalCollected: z.number().nonnegative(),
    varianceAmount: z.number(),
    currency: z.string().length(3),
  });

  @ApiProperty() runId!: string;
  @ApiProperty() carrierId!: string;
  @ApiProperty() periodStart!: Date;
  @ApiProperty() periodEnd!: Date;
  @ApiProperty() totalPremium!: number;
  @ApiProperty() totalCollected!: number;
  @ApiProperty() varianceAmount!: number;
  @ApiProperty() currency!: string;
}
