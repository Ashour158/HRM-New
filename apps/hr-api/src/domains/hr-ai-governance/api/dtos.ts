import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

export const RegisterHrAiUseCaseDtoSchema = z.object({
  hrAiUseCaseId: z.string().uuid(),
  useCaseName: z.string().min(1),
  useCaseType: z.string().min(1),
  riskClassification: z.enum(['LOW', 'MEDIUM', 'HIGH', 'UNACCEPTABLE']),
  description: z.string().optional(),
  dataUsage: z.record(z.unknown()).optional(),
});
export class RegisterHrAiUseCaseDto {
  @ApiProperty() hrAiUseCaseId!: string;
  @ApiProperty() useCaseName!: string;
  @ApiProperty() useCaseType!: string;
  @ApiProperty() riskClassification!: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNACCEPTABLE';
  @ApiPropertyOptional() description?: string;
  @ApiPropertyOptional() dataUsage?: Record<string, unknown>;
}

export const CreateHrAiModelRunDtoSchema = z.object({
  hrAiModelRunId: z.string().uuid(),
  useCaseId: z.string().uuid(),
  modelVersion: z.string().min(1),
  inputDataSnapshot: z.record(z.unknown()).optional(),
});
export class CreateHrAiModelRunDto {
  @ApiProperty() hrAiModelRunId!: string;
  @ApiProperty() useCaseId!: string;
  @ApiProperty() modelVersion!: string;
  @ApiPropertyOptional() inputDataSnapshot?: Record<string, unknown>;
}

export const CompleteHrAiModelRunDtoSchema = z.object({
  hrAiModelRunId: z.string().uuid(),
  outputDataSnapshot: z.record(z.unknown()),
});
export class CompleteHrAiModelRunDto {
  @ApiProperty() hrAiModelRunId!: string;
  @ApiProperty() outputDataSnapshot!: Record<string, unknown>;
}

export const FailHrAiModelRunDtoSchema = z.object({
  hrAiModelRunId: z.string().uuid(),
  reason: z.string().min(1),
});
export class FailHrAiModelRunDto {
  @ApiProperty() hrAiModelRunId!: string;
  @ApiProperty() reason!: string;
}

export const PlanHrAiBiasTestDtoSchema = z.object({
  hrAiBiasTestId: z.string().uuid(),
  useCaseId: z.string().uuid(),
  testType: z.string().min(1),
  testData: z.record(z.unknown()).optional(),
  // Minimum acceptable four-fifths adverse-impact-ratio threshold (0, 1]. Defaults
  // to the standard EEOC 0.8 (80%) screen when omitted — see bias-metrics.ts.
  threshold: z.number().gt(0).lte(1).optional(),
});
export class PlanHrAiBiasTestDto {
  @ApiProperty() hrAiBiasTestId!: string;
  @ApiProperty() useCaseId!: string;
  @ApiProperty() testType!: string;
  @ApiPropertyOptional() testData?: Record<string, unknown>;
  @ApiPropertyOptional() threshold?: number;
}

export const BiasTestGroupOutcomeDtoSchema = z.object({
  group: z.string().min(1),
  selected: z.number().int().min(0),
  totalConsidered: z.number().int().min(0),
});
export class BiasTestGroupOutcomeDto {
  @ApiProperty() group!: string;
  @ApiProperty() selected!: number;
  @ApiProperty() totalConsidered!: number;
}

export const CompleteHrAiBiasTestDtoSchema = z.object({
  hrAiBiasTestId: z.string().uuid(),
  // Raw per-protected-class-group outcome counts. This is intentionally the only
  // caller-controlled input — the pass/fail verdict and metrics are computed by
  // the domain (four-fifths adverse-impact-ratio rule), never accepted directly.
  outcomeData: z.array(BiasTestGroupOutcomeDtoSchema).min(1),
});
export class CompleteHrAiBiasTestDto {
  @ApiProperty() hrAiBiasTestId!: string;
  @ApiProperty({ type: [BiasTestGroupOutcomeDto] }) outcomeData!: BiasTestGroupOutcomeDto[];
}

export const FailHrAiBiasTestDtoSchema = z.object({
  hrAiBiasTestId: z.string().uuid(),
  reason: z.string().min(1),
});
export class FailHrAiBiasTestDto {
  @ApiProperty() hrAiBiasTestId!: string;
  @ApiProperty() reason!: string;
}

export const ArmHrAiKillSwitchDtoSchema = z.object({
  hrAiKillSwitchId: z.string().uuid(),
  useCaseId: z.string().uuid(),
  triggeredBy: z.string().uuid(),
  triggerReason: z.string().min(1),
});
export class ArmHrAiKillSwitchDto {
  @ApiProperty() hrAiKillSwitchId!: string;
  @ApiProperty() useCaseId!: string;
  @ApiProperty() triggeredBy!: string;
  @ApiProperty() triggerReason!: string;
}

export const ResolveHrAiKillSwitchDtoSchema = z.object({
  hrAiKillSwitchId: z.string().uuid(),
  resolution: z.string().min(1),
});
export class ResolveHrAiKillSwitchDto {
  @ApiProperty() hrAiKillSwitchId!: string;
  @ApiProperty() resolution!: string;
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
