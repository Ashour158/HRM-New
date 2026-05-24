import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

export const CreateWorkScheduleDtoSchema = z.object({
  workerId: z.string().uuid(),
  scheduleType: z.string().min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  daysOfWeek: z.array(z.string()).optional(),
  hoursPerDay: z.number().nonnegative().optional(),
  timezone: z.string().min(1),
});

export class CreateWorkScheduleDto {
  @ApiProperty() workerId!: string;
  @ApiProperty() scheduleType!: string;
  @ApiProperty() startDate!: Date;
  @ApiPropertyOptional() endDate?: Date;
  @ApiPropertyOptional() daysOfWeek?: string[];
  @ApiPropertyOptional() hoursPerDay?: number;
  @ApiProperty() timezone!: string;
}

export const CreateTimesheetDtoSchema = z.object({
  workerId: z.string().uuid(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  entries: z.array(z.object({ date: z.coerce.date(), hours: z.number().nonnegative(), projectCode: z.string().optional() })).optional(),
});

export class CreateTimesheetDto {
  @ApiProperty() workerId!: string;
  @ApiProperty() periodStart!: Date;
  @ApiProperty() periodEnd!: Date;
  @ApiPropertyOptional() entries?: Array<{ date: Date; hours: number; projectCode?: string }>;
}

export const RecordTimeClockEventDtoSchema = z.object({
  workerId: z.string().uuid(),
  eventType: z.enum(['CLOCK_IN', 'CLOCK_OUT', 'BREAK_START', 'BREAK_END']),
  timestamp: z.coerce.date(),
  location: z.string().optional(),
  deviceId: z.string().optional(),
});

export class RecordTimeClockEventDto {
  @ApiProperty() workerId!: string;
  @ApiProperty() eventType!: 'CLOCK_IN' | 'CLOCK_OUT' | 'BREAK_START' | 'BREAK_END';
  @ApiProperty() timestamp!: Date;
  @ApiPropertyOptional() location?: string;
  @ApiPropertyOptional() deviceId?: string;
}

export const CreateAttendanceExceptionDtoSchema = z.object({
  workerId: z.string().uuid(),
  exceptionType: z.string().min(1),
  description: z.string().min(1),
  detectedAt: z.coerce.date(),
});

export class CreateAttendanceExceptionDto {
  @ApiProperty() workerId!: string;
  @ApiProperty() exceptionType!: string;
  @ApiProperty() description!: string;
  @ApiProperty() detectedAt!: Date;
}

export const RequestOvertimeDtoSchema = z.object({
  workerId: z.string().uuid(),
  requestedHours: z.number().positive(),
  reason: z.string().min(1),
});

export class RequestOvertimeDto {
  @ApiProperty() workerId!: string;
  @ApiProperty() requestedHours!: number;
  @ApiProperty() reason!: string;
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
