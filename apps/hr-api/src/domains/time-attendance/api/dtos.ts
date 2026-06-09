import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

export const CaptureMethodSchema = z.enum([
  'API_IMPORT',
  'BIOMETRIC_DEVICE',
  'FACIAL_RECOGNITION',
  'MANUAL_CORRECTION',
  'MOBILE_GEOFENCE',
  'QR_CODE',
  'RFID_CARD',
  'WEB_KIOSK',
]);

export const VerificationStatusSchema = z.enum(['FAILED', 'NOT_REQUIRED', 'PENDING', 'VERIFIED']);
const OptionalNullableNumberSchema = z.preprocess((value) => value === null ? undefined : value, z.number().optional());

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

export const CreateTimesheetFromLedgerDtoSchema = z.object({
  workerId: z.string().uuid(),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  submit: z.boolean().optional(),
});

export class CreateTimesheetFromLedgerDto {
  @ApiProperty() workerId!: string;
  @ApiProperty() periodStart!: string;
  @ApiProperty() periodEnd!: string;
  @ApiPropertyOptional() submit?: boolean;
}

export const RecordTimeClockEventDtoSchema = z.object({
  workerId: z.string().uuid(),
  eventType: z.enum(['CLOCK_IN', 'CLOCK_OUT', 'BREAK_START', 'BREAK_END']),
  timestamp: z.coerce.date(),
  location: z.string().optional(),
  latitude: OptionalNullableNumberSchema,
  longitude: OptionalNullableNumberSchema,
  accuracyMeters: OptionalNullableNumberSchema,
  workplaceCode: z.string().optional(),
  deviceId: z.string().optional(),
  captureMethod: CaptureMethodSchema.optional(),
  captureDeviceKind: z.string().optional(),
  captureReference: z.string().optional(),
  verificationStatus: VerificationStatusSchema.optional(),
  captureEvidence: z.record(z.unknown()).optional(),
});

export class RecordTimeClockEventDto {
  @ApiProperty() workerId!: string;
  @ApiProperty() eventType!: 'CLOCK_IN' | 'CLOCK_OUT' | 'BREAK_START' | 'BREAK_END';
  @ApiProperty() timestamp!: Date;
  @ApiPropertyOptional() location?: string;
  @ApiPropertyOptional() latitude?: number;
  @ApiPropertyOptional() longitude?: number;
  @ApiPropertyOptional() accuracyMeters?: number;
  @ApiPropertyOptional() workplaceCode?: string;
  @ApiPropertyOptional() deviceId?: string;
  @ApiPropertyOptional() captureMethod?: z.infer<typeof CaptureMethodSchema>;
  @ApiPropertyOptional() captureDeviceKind?: string;
  @ApiPropertyOptional() captureReference?: string;
  @ApiPropertyOptional() verificationStatus?: z.infer<typeof VerificationStatusSchema>;
  @ApiPropertyOptional() captureEvidence?: Record<string, unknown>;
}

export const CheckInOutDtoSchema = z.object({
  workerId: z.string().uuid(),
  workplaceCode: z.string().optional(),
  latitude: OptionalNullableNumberSchema,
  longitude: OptionalNullableNumberSchema,
  accuracyMeters: OptionalNullableNumberSchema,
  deviceId: z.string().optional(),
  timestamp: z.coerce.date().optional(),
  idempotencyKey: z.string().trim().min(1).optional(),
  clientRequestId: z.string().trim().min(1).optional(),
  captureMethod: CaptureMethodSchema.optional(),
  captureDeviceKind: z.string().optional(),
  captureReference: z.string().optional(),
  verificationStatus: VerificationStatusSchema.optional(),
  captureEvidence: z.record(z.unknown()).optional(),
});

export class CheckInOutDto {
  @ApiProperty() workerId!: string;
  @ApiPropertyOptional() workplaceCode?: string;
  @ApiPropertyOptional() latitude?: number;
  @ApiPropertyOptional() longitude?: number;
  @ApiPropertyOptional() accuracyMeters?: number;
  @ApiPropertyOptional() deviceId?: string;
  @ApiPropertyOptional() timestamp?: Date;
  @ApiPropertyOptional() idempotencyKey?: string;
  @ApiPropertyOptional() clientRequestId?: string;
  @ApiPropertyOptional() captureMethod?: z.infer<typeof CaptureMethodSchema>;
  @ApiPropertyOptional() captureDeviceKind?: string;
  @ApiPropertyOptional() captureReference?: string;
  @ApiPropertyOptional() verificationStatus?: z.infer<typeof VerificationStatusSchema>;
  @ApiPropertyOptional() captureEvidence?: Record<string, unknown>;
}

export const OnDutyRequestDtoSchema = z.object({
  workerId: z.string().uuid(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  reason: z.string().min(1),
  location: z.string().optional(),
});

export class OnDutyRequestDto {
  @ApiProperty() workerId!: string;
  @ApiProperty() startAt!: Date;
  @ApiProperty() endAt!: Date;
  @ApiProperty() reason!: string;
  @ApiPropertyOptional() location?: string;
}

export const FinalizeDailyLedgerDtoSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  payrollCycleId: z.string().uuid().optional(),
  workplaceCode: z.string().optional(),
});

export class FinalizeDailyLedgerDto {
  @ApiProperty() date!: string;
  @ApiPropertyOptional() payrollCycleId?: string;
  @ApiPropertyOptional() workplaceCode?: string;
}

export const AttendancePeriodCloseQueryDtoSchema = z.object({
  year: z.coerce.number().int().min(1900).max(2200).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  workplaceCode: z.string().optional(),
});

export class AttendancePeriodCloseQueryDto {
  @ApiPropertyOptional() year?: number;
  @ApiPropertyOptional() month?: number;
  @ApiPropertyOptional() periodStart?: string;
  @ApiPropertyOptional() periodEnd?: string;
  @ApiPropertyOptional() workplaceCode?: string;
}

export const FinalizeAttendancePeriodDtoSchema = AttendancePeriodCloseQueryDtoSchema.extend({
  payrollCycleId: z.string().uuid().optional(),
  overrideReadiness: z.boolean().optional(),
  overrideReason: z.string().optional(),
});

export class FinalizeAttendancePeriodDto extends AttendancePeriodCloseQueryDto {
  @ApiPropertyOptional() payrollCycleId?: string;
  @ApiPropertyOptional() overrideReadiness?: boolean;
  @ApiPropertyOptional() overrideReason?: string;
}

export const CreateAttendanceCorrectionRequestDtoSchema = z.object({
  workerId: z.string().uuid(),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  correctionType: z.enum(['ADD_CLOCK_EVENT', 'EDIT_CLOCK_EVENT', 'DELETE_CLOCK_EVENT']),
  requestedEventType: z.enum(['CLOCK_IN', 'CLOCK_OUT', 'BREAK_START', 'BREAK_END']).optional(),
  requestedTimestamp: z.coerce.date().optional(),
  targetEventId: z.string().uuid().optional(),
  reason: z.string().min(1),
});

export class CreateAttendanceCorrectionRequestDto {
  @ApiProperty() workerId!: string;
  @ApiProperty() workDate!: string;
  @ApiProperty() correctionType!: 'ADD_CLOCK_EVENT' | 'EDIT_CLOCK_EVENT' | 'DELETE_CLOCK_EVENT';
  @ApiPropertyOptional() requestedEventType?: 'CLOCK_IN' | 'CLOCK_OUT' | 'BREAK_START' | 'BREAK_END';
  @ApiPropertyOptional() requestedTimestamp?: Date;
  @ApiPropertyOptional() targetEventId?: string;
  @ApiProperty() reason!: string;
}

export const ReviewAttendanceCorrectionRequestDtoSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  note: z.string().optional(),
});

export class ReviewAttendanceCorrectionRequestDto {
  @ApiProperty() decision!: 'APPROVE' | 'REJECT';
  @ApiPropertyOptional() note?: string;
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
