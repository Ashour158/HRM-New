import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

export const CreatePayrollCycleDtoSchema = z.object({
  cycleName: z.string().min(1),
  payPeriodStart: z.coerce.date(),
  payPeriodEnd: z.coerce.date(),
  payDate: z.coerce.date().optional(),
});

export class CreatePayrollCycleDto {
  @ApiProperty() cycleName!: string;
  @ApiProperty() payPeriodStart!: Date;
  @ApiProperty() payPeriodEnd!: Date;
  @ApiPropertyOptional() payDate?: Date;
}

export const CreatePayrollInputDtoSchema = z.object({
  workerId: z.string().uuid(),
  payrollCycleId: z.string().uuid(),
  inputType: z.string().min(1),
  amount: z.number(),
  currency: z.string().length(3),
  description: z.string().optional(),
});

export class CreatePayrollInputDto {
  @ApiProperty() workerId!: string;
  @ApiProperty() payrollCycleId!: string;
  @ApiProperty() inputType!: string;
  @ApiProperty() amount!: number;
  @ApiProperty() currency!: string;
  @ApiPropertyOptional() description?: string;
}

export const StartPayrollCalculationRunDtoSchema = z.object({
  payrollCycleId: z.string().uuid(),
  currency: z.string().length(3),
});

export class StartPayrollCalculationRunDto {
  @ApiProperty() payrollCycleId!: string;
  @ApiProperty() currency!: string;
}

export const CalculatePayrollResultLineDtoSchema = z.object({
  workerId: z.string().uuid(),
  payrollCycleId: z.string().uuid(),
  calculationRunId: z.string().uuid(),
  lineType: z.string().min(1),
  description: z.string().min(1),
  amount: z.number(),
  currency: z.string().length(3),
  ruleSetId: z.string().optional(),
  ruleId: z.string().optional(),
  calculationStep: z.string().optional(),
  inputSnapshotHash: z.string().optional(),
});

export class CalculatePayrollResultLineDto {
  @ApiProperty() workerId!: string;
  @ApiProperty() payrollCycleId!: string;
  @ApiProperty() calculationRunId!: string;
  @ApiProperty() lineType!: string;
  @ApiProperty() description!: string;
  @ApiProperty() amount!: number;
  @ApiProperty() currency!: string;
  @ApiPropertyOptional() ruleSetId?: string;
  @ApiPropertyOptional() ruleId?: string;
  @ApiPropertyOptional() calculationStep?: string;
  @ApiPropertyOptional() inputSnapshotHash?: string;
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
