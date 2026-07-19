import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

/* ------------------------------------------------------------------ */
/*  Worker DTOs                                                        */
/* ------------------------------------------------------------------ */

export const CreateWorkerDtoSchema = z.object({
  employeeNumber: z.string().min(1).optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  gender: z.string().optional(),
  email: z.string().email().optional(),
  personalEmail: z.string().email().optional(),
  workEmail: z.string().email().optional(),
  dateOfBirth: z.coerce.date().optional(),
  phoneNumber: z.string().optional(),
  workPhoneNumber: z.string().optional(),
  photoUrl: z.string().url().optional(),
  hireDate: z.coerce.date().optional(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACTOR', 'INTERN', 'TEMPORARY']).optional(),
  legalEntityId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  departmentName: z.string().optional(),
  managerId: z.string().uuid().optional(),
  dottedLineManagerId: z.string().uuid().optional(),
  hrbpId: z.string().uuid().optional(),
  mentorId: z.string().uuid().optional(),
  colleagueIds: z.array(z.string().uuid()).optional(),
  jobTitle: z.string().optional(),
  salaryAmount: z.number().nonnegative().optional(),
  grossSalaryAmount: z.number().nonnegative().optional(),
  taxAmount: z.number().nonnegative().optional(),
  insuranceAmount: z.number().nonnegative().optional(),
  netSalaryAmount: z.number().nonnegative().optional(),
  medicalInsuranceAmount: z.number().nonnegative().optional(),
  otherBenefitsAmount: z.number().nonnegative().optional(),
  salaryCurrency: z.string().length(3).optional(),
  salaryBasis: z.enum(['ANNUAL', 'MONTHLY', 'HOURLY']).optional(),
  payFrequency: z.enum(['WEEKLY', 'BIWEEKLY', 'SEMIMONTHLY', 'MONTHLY']).optional(),
  benefitsPackage: z.record(z.unknown()).optional(),
  address: z.record(z.unknown()).optional(),
  workLocation: z.record(z.unknown()).optional(),
  emergencyContact: z.record(z.unknown()).optional(),
  emergencyContacts: z.array(z.record(z.unknown())).optional(),
  socialLinks: z.record(z.unknown()).optional(),
  photoAttachment: z.record(z.unknown()).optional(),
  documents: z.array(z.record(z.unknown())).optional(),
  education: z.array(z.record(z.unknown())).optional(),
  experience: z.array(z.record(z.unknown())).optional(),
  certifications: z.array(z.record(z.unknown())).optional(),
  workAuthorization: z.record(z.unknown()).optional(),
  taxProfile: z.record(z.unknown()).optional(),
  bankAccount: z.record(z.unknown()).optional(),
  dependents: z.array(z.record(z.unknown())).optional(),
  beneficiaries: z.array(z.record(z.unknown())).optional(),
  assets: z.array(z.record(z.unknown())).optional(),
  accessBadges: z.array(z.record(z.unknown())).optional(),
  skills: z.array(z.record(z.unknown())).optional(),
  licenses: z.array(z.record(z.unknown())).optional(),
  careerPreferences: z.record(z.unknown()).optional(),
  consents: z.array(z.record(z.unknown())).optional(),
  privacyNotices: z.array(z.record(z.unknown())).optional(),
  retentionHolds: z.array(z.record(z.unknown())).optional(),
  employmentContract: z.record(z.unknown()).optional(),
});

export class CreateWorkerDto {
  @ApiPropertyOptional() employeeNumber?: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiPropertyOptional() gender?: string;
  @ApiPropertyOptional() email?: string;
  @ApiPropertyOptional() personalEmail?: string;
  @ApiPropertyOptional() workEmail?: string;
  @ApiPropertyOptional() dateOfBirth?: Date;
  @ApiPropertyOptional() phoneNumber?: string;
  @ApiPropertyOptional() workPhoneNumber?: string;
  @ApiPropertyOptional() photoUrl?: string;
  @ApiPropertyOptional() hireDate?: Date;
  @ApiPropertyOptional() employmentType?: string;
  @ApiPropertyOptional() legalEntityId?: string;
  @ApiPropertyOptional() departmentId?: string;
  @ApiPropertyOptional() departmentName?: string;
  @ApiPropertyOptional() managerId?: string;
  @ApiPropertyOptional() dottedLineManagerId?: string;
  @ApiPropertyOptional() hrbpId?: string;
  @ApiPropertyOptional() mentorId?: string;
  @ApiPropertyOptional() colleagueIds?: string[];
  @ApiPropertyOptional() jobTitle?: string;
  @ApiPropertyOptional() salaryAmount?: number;
  @ApiPropertyOptional() grossSalaryAmount?: number;
  @ApiPropertyOptional() taxAmount?: number;
  @ApiPropertyOptional() insuranceAmount?: number;
  @ApiPropertyOptional() netSalaryAmount?: number;
  @ApiPropertyOptional() medicalInsuranceAmount?: number;
  @ApiPropertyOptional() otherBenefitsAmount?: number;
  @ApiPropertyOptional() salaryCurrency?: string;
  @ApiPropertyOptional() salaryBasis?: string;
  @ApiPropertyOptional() payFrequency?: string;
  @ApiPropertyOptional() benefitsPackage?: Record<string, unknown>;
  @ApiPropertyOptional() address?: Record<string, unknown>;
  @ApiPropertyOptional() workLocation?: Record<string, unknown>;
  @ApiPropertyOptional() emergencyContact?: Record<string, unknown>;
  @ApiPropertyOptional() emergencyContacts?: Record<string, unknown>[];
  @ApiPropertyOptional() socialLinks?: Record<string, unknown>;
  @ApiPropertyOptional() photoAttachment?: Record<string, unknown>;
  @ApiPropertyOptional() documents?: Record<string, unknown>[];
  @ApiPropertyOptional() education?: Record<string, unknown>[];
  @ApiPropertyOptional() experience?: Record<string, unknown>[];
  @ApiPropertyOptional() certifications?: Record<string, unknown>[];
  @ApiPropertyOptional() workAuthorization?: Record<string, unknown>;
  @ApiPropertyOptional() taxProfile?: Record<string, unknown>;
  @ApiPropertyOptional() bankAccount?: Record<string, unknown>;
  @ApiPropertyOptional() dependents?: Record<string, unknown>[];
  @ApiPropertyOptional() beneficiaries?: Record<string, unknown>[];
  @ApiPropertyOptional() assets?: Record<string, unknown>[];
  @ApiPropertyOptional() accessBadges?: Record<string, unknown>[];
  @ApiPropertyOptional() skills?: Record<string, unknown>[];
  @ApiPropertyOptional() licenses?: Record<string, unknown>[];
  @ApiPropertyOptional() careerPreferences?: Record<string, unknown>;
  @ApiPropertyOptional() consents?: Record<string, unknown>[];
  @ApiPropertyOptional() privacyNotices?: Record<string, unknown>[];
  @ApiPropertyOptional() retentionHolds?: Record<string, unknown>[];
  @ApiPropertyOptional() employmentContract?: Record<string, unknown>;
}

export const UpdateWorkerDtoSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  dateOfBirth: z.coerce.date().optional(),
  phoneNumber: z.string().optional(),
  photoUrl: z.string().url().optional(),
  address: z.record(z.unknown()).optional(),
  emergencyContact: z.record(z.unknown()).optional(),
  socialLinks: z.record(z.unknown()).optional(),
  education: z.array(z.record(z.unknown())).optional(),
  experience: z.array(z.record(z.unknown())).optional(),
  certifications: z.array(z.record(z.unknown())).optional(),
});

export class UpdateWorkerDto {
  @ApiPropertyOptional() firstName?: string;
  @ApiPropertyOptional() lastName?: string;
  @ApiPropertyOptional() email?: string;
  @ApiPropertyOptional() dateOfBirth?: Date;
  @ApiPropertyOptional() phoneNumber?: string;
  @ApiPropertyOptional() photoUrl?: string;
  @ApiPropertyOptional() address?: Record<string, unknown>;
  @ApiPropertyOptional() emergencyContact?: Record<string, unknown>;
  @ApiPropertyOptional() socialLinks?: Record<string, unknown>;
  @ApiPropertyOptional() education?: Record<string, unknown>[];
  @ApiPropertyOptional() experience?: Record<string, unknown>[];
  @ApiPropertyOptional() certifications?: Record<string, unknown>[];
}

export const WorkerDuplicateCheckDtoSchema = z.object({
  employeeNumber: z.string().min(1).optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  personalEmail: z.string().email().optional(),
  workEmail: z.string().email().optional(),
  phoneNumber: z.string().optional(),
  workPhoneNumber: z.string().optional(),
  dateOfBirth: z.coerce.date().optional(),
});

export class WorkerDuplicateCheckDto {
  @ApiPropertyOptional() employeeNumber?: string;
  @ApiPropertyOptional() firstName?: string;
  @ApiPropertyOptional() lastName?: string;
  @ApiPropertyOptional() email?: string;
  @ApiPropertyOptional() personalEmail?: string;
  @ApiPropertyOptional() workEmail?: string;
  @ApiPropertyOptional() phoneNumber?: string;
  @ApiPropertyOptional() workPhoneNumber?: string;
  @ApiPropertyOptional() dateOfBirth?: Date;
}

export const TerminateWorkerDtoSchema = z.object({
  terminationDate: z.coerce.date(),
  reason: z.string().min(1),
});

export class TerminateWorkerDto {
  @ApiProperty() terminationDate!: Date;
  @ApiProperty() reason!: string;
}

/* ------------------------------------------------------------------ */
/*  Job Assignment DTOs                                                */
/* ------------------------------------------------------------------ */

export const CreateJobAssignmentDtoSchema = z.object({
  workerId: z.string().uuid(),
  positionId: z.string().uuid(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
});

export class CreateJobAssignmentDto {
  @ApiProperty() workerId!: string;
  @ApiProperty() positionId!: string;
  @ApiProperty() startDate!: Date;
  @ApiPropertyOptional() endDate?: Date;
}

/* ------------------------------------------------------------------ */
/*  Employment Relationship DTOs                                       */
/* ------------------------------------------------------------------ */

export const CreateEmploymentRelationshipDtoSchema = z.object({
  workerId: z.string().uuid(),
  relationshipType: z.string().min(1),
  startDate: z.coerce.date(),
  legalEntityId: z.string().uuid().optional(),
  contractType: z.string().optional(),
  probationEndDate: z.coerce.date().optional(),
});

export class CreateEmploymentRelationshipDto {
  @ApiProperty() workerId!: string;
  @ApiProperty() relationshipType!: string;
  @ApiProperty() startDate!: Date;
  @ApiPropertyOptional() legalEntityId?: string;
  @ApiPropertyOptional() contractType?: string;
  @ApiPropertyOptional() probationEndDate?: Date;
}

export const StartProbationEmploymentRelationshipDtoSchema = z.object({
  probationEndDate: z.coerce.date(),
});

export class StartProbationEmploymentRelationshipDto {
  @ApiProperty() probationEndDate!: Date;
}

/* ------------------------------------------------------------------ */
/*  Employment Contract DTOs                                           */
/* ------------------------------------------------------------------ */

export const CreateEmploymentContractDtoSchema = z.object({
  contractId: z.string().uuid(),
  workerId: z.string().uuid(),
  contractType: z.string().min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  terms: z.record(z.unknown()).optional(),
});

export class CreateEmploymentContractDto {
  @ApiProperty() contractId!: string;
  @ApiProperty() workerId!: string;
  @ApiProperty() contractType!: string;
  @ApiProperty() startDate!: Date;
  @ApiPropertyOptional() endDate?: Date;
  @ApiPropertyOptional() terms?: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/*  Zod Validation Pipe                                                */
/* ------------------------------------------------------------------ */

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: z.ZodTypeAny) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException(result.error.format());
    }
    return result.data;
  }
}
