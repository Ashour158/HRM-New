import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

export const CreateAbsenceRequestDtoSchema = z.object({
  workerId: z.string().uuid(),
  absenceType: z.string().min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  reason: z.string().optional(),
});

export class CreateAbsenceRequestDto {
  @ApiProperty() workerId!: string;
  @ApiProperty() absenceType!: string;
  @ApiProperty() startDate!: Date;
  @ApiProperty() endDate!: Date;
  @ApiPropertyOptional() reason?: string;
}

export const OpenLeaveCaseDtoSchema = z.object({
  workerId: z.string().uuid(),
  leaveType: z.string().min(1),
  startDate: z.coerce.date(),
  expectedReturnDate: z.coerce.date().optional(),
});

export class OpenLeaveCaseDto {
  @ApiProperty() workerId!: string;
  @ApiProperty() leaveType!: string;
  @ApiProperty() startDate!: Date;
  @ApiPropertyOptional() expectedReturnDate?: Date;
}

export const CreateAbsenceAccrualBalanceDtoSchema = z.object({
  workerId: z.string().uuid(),
  leaveType: z.string().min(1),
  balanceHours: z.number(),
  accruedHours: z.number(),
  usedHours: z.number(),
  carriedOverHours: z.number(),
  effectiveDate: z.coerce.date(),
});

export class CreateAbsenceAccrualBalanceDto {
  @ApiProperty() workerId!: string;
  @ApiProperty() leaveType!: string;
  @ApiProperty() balanceHours!: number;
  @ApiProperty() accruedHours!: number;
  @ApiProperty() usedHours!: number;
  @ApiProperty() carriedOverHours!: number;
  @ApiProperty() effectiveDate!: Date;
}

export const StartLeaveEntitlementCalculationDtoSchema = z.object({
  workerId: z.string().uuid(),
  leaveType: z.string().min(1),
  calculatedEntitlement: z.number(),
  usedEntitlement: z.number(),
  remainingEntitlement: z.number(),
  calculationDate: z.coerce.date(),
});

export class StartLeaveEntitlementCalculationDto {
  @ApiProperty() workerId!: string;
  @ApiProperty() leaveType!: string;
  @ApiProperty() calculatedEntitlement!: number;
  @ApiProperty() usedEntitlement!: number;
  @ApiProperty() remainingEntitlement!: number;
  @ApiProperty() calculationDate!: Date;
}

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: z.ZodTypeAny) {}
  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) throw new BadRequestException(result.error.format());
    return result.data;
  }
}
