import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

export const CreateShiftScheduleDtoSchema = z.object({
  workerId: z.string().uuid(),
  shiftDate: z.coerce.date(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  breakDuration: z.number().min(0),
  departmentId: z.string().uuid(),
});

export class CreateShiftScheduleDto {
  @ApiProperty() workerId!: string;
  @ApiProperty() shiftDate!: Date;
  @ApiProperty() startTime!: Date;
  @ApiProperty() endTime!: Date;
  @ApiProperty() breakDuration!: number;
  @ApiProperty() departmentId!: string;
}

export const CreateOpenShiftDtoSchema = z.object({
  departmentId: z.string().uuid(),
  shiftDate: z.coerce.date(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  requiredSkills: z.array(z.string()).optional(),
  bidDeadline: z.coerce.date().optional(),
});

export class CreateOpenShiftDto {
  @ApiProperty() departmentId!: string;
  @ApiProperty() shiftDate!: Date;
  @ApiProperty() startTime!: Date;
  @ApiProperty() endTime!: Date;
  @ApiPropertyOptional() requiredSkills?: string[];
  @ApiPropertyOptional() bidDeadline?: Date;
}

export const CreateShiftBidDtoSchema = z.object({
  workerId: z.string().uuid(),
  openShiftId: z.string().uuid(),
});

export class CreateShiftBidDto {
  @ApiProperty() workerId!: string;
  @ApiProperty() openShiftId!: string;
}

export const CreateShiftSwapRequestDtoSchema = z.object({
  requesterWorkerId: z.string().uuid(),
  requestedWorkerId: z.string().uuid(),
  originalShiftId: z.string().uuid(),
  targetShiftId: z.string().uuid(),
  reason: z.string().optional(),
});

export class CreateShiftSwapRequestDto {
  @ApiProperty() requesterWorkerId!: string;
  @ApiProperty() requestedWorkerId!: string;
  @ApiProperty() originalShiftId!: string;
  @ApiProperty() targetShiftId!: string;
  @ApiPropertyOptional() reason?: string;
}

export const RequestWfmOvertimeDtoSchema = z.object({
  workerId: z.string().uuid(),
  requestedHours: z.number().positive(),
  reason: z.string().min(1),
  shiftDate: z.coerce.date().optional(),
});

export class RequestWfmOvertimeDto {
  @ApiProperty() workerId!: string;
  @ApiProperty() requestedHours!: number;
  @ApiProperty() reason!: string;
  @ApiPropertyOptional() shiftDate?: Date;
}

export const CreateCoverageGapDtoSchema = z.object({
  departmentId: z.string().uuid(),
  shiftDate: z.coerce.date(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  requiredSkills: z.array(z.string()).optional(),
});

export class CreateCoverageGapDto {
  @ApiProperty() departmentId!: string;
  @ApiProperty() shiftDate!: Date;
  @ApiProperty() startTime!: Date;
  @ApiProperty() endTime!: Date;
  @ApiPropertyOptional() requiredSkills?: string[];
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
