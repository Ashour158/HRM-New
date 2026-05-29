import { z } from 'zod';
import type { Uuid } from '@hcm/shared-kernel';

/* ------------------------------------------------------------------ */
/*  Worker commands                                                    */
/* ------------------------------------------------------------------ */

export const CreateWorkerCommandName = 'CreateWorker' as const;

export interface CreateWorkerPayload {
  workerId: Uuid;
  employeeNumber?: string;
  firstName: string;
  lastName: string;
  gender?: string;
  dateOfBirth?: Date;
  email?: string;
  personalEmail?: string;
  workEmail?: string;
  phoneNumber?: string;
  workPhoneNumber?: string;
  photoUrl?: string;
  hireDate?: Date;
  employmentType?: 'FULL_TIME' | 'PART_TIME' | 'CONTRACTOR' | 'INTERN' | 'TEMPORARY';
  legalEntityId?: string;
  departmentId?: string;
  departmentName?: string;
  managerId?: string;
  dottedLineManagerId?: string;
  hrbpId?: string;
  mentorId?: string;
  colleagueIds?: string[];
  jobTitle?: string;
  salaryAmount?: number;
  grossSalaryAmount?: number;
  taxAmount?: number;
  insuranceAmount?: number;
  netSalaryAmount?: number;
  medicalInsuranceAmount?: number;
  otherBenefitsAmount?: number;
  salaryCurrency?: string;
  salaryBasis?: 'ANNUAL' | 'MONTHLY' | 'HOURLY';
  payFrequency?: 'WEEKLY' | 'BIWEEKLY' | 'SEMIMONTHLY' | 'MONTHLY';
  benefitsPackage?: Record<string, unknown>;
  address?: Record<string, unknown>;
  workLocation?: Record<string, unknown>;
  emergencyContact?: Record<string, unknown>;
  emergencyContacts?: Record<string, unknown>[];
  socialLinks?: Record<string, unknown>;
  photoAttachment?: Record<string, unknown>;
  documents?: Record<string, unknown>[];
  education?: Record<string, unknown>[];
  experience?: Record<string, unknown>[];
  certifications?: Record<string, unknown>[];
  workAuthorization?: Record<string, unknown>;
  taxProfile?: Record<string, unknown>;
  bankAccount?: Record<string, unknown>;
  dependents?: Record<string, unknown>[];
  beneficiaries?: Record<string, unknown>[];
  assets?: Record<string, unknown>[];
  accessBadges?: Record<string, unknown>[];
  skills?: Record<string, unknown>[];
  licenses?: Record<string, unknown>[];
  careerPreferences?: Record<string, unknown>;
  consents?: Record<string, unknown>[];
  privacyNotices?: Record<string, unknown>[];
  retentionHolds?: Record<string, unknown>[];
  employmentContract?: Record<string, unknown>;
}

export const CreateWorkerPayloadSchema = z.object({
  workerId: z.string().uuid(),
  employeeNumber: z.string().min(1).optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  gender: z.string().optional(),
  dateOfBirth: z.coerce.date().optional(),
  email: z.string().email().optional(),
  personalEmail: z.string().email().optional(),
  workEmail: z.string().email().optional(),
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

export const ActivateWorkerCommandName = 'ActivateWorker' as const;

export interface ActivateWorkerPayload {
  workerId: Uuid;
  activationDate?: Date;
}

export const ActivateWorkerPayloadSchema = z.object({
  workerId: z.string().uuid(),
  activationDate: z.coerce.date().optional(),
});

export const UpdateWorkerPersonalDataCommandName = 'UpdateWorkerPersonalData' as const;

export interface UpdateWorkerPersonalDataPayload {
  workerId: Uuid;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: Date;
  email?: string;
  phoneNumber?: string;
  photoUrl?: string;
  address?: Record<string, unknown>;
  emergencyContact?: Record<string, unknown>;
  socialLinks?: Record<string, unknown>;
  education?: Record<string, unknown>[];
  experience?: Record<string, unknown>[];
  certifications?: Record<string, unknown>[];
}

export const UpdateWorkerPersonalDataPayloadSchema = z.object({
  workerId: z.string().uuid(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  dateOfBirth: z.coerce.date().optional(),
  email: z.string().email().optional(),
  phoneNumber: z.string().optional(),
  photoUrl: z.string().url().optional(),
  address: z.record(z.unknown()).optional(),
  emergencyContact: z.record(z.unknown()).optional(),
  socialLinks: z.record(z.unknown()).optional(),
  education: z.array(z.record(z.unknown())).optional(),
  experience: z.array(z.record(z.unknown())).optional(),
  certifications: z.array(z.record(z.unknown())).optional(),
});

export const TerminateWorkerCommandName = 'TerminateWorker' as const;

export interface TerminateWorkerPayload {
  workerId: Uuid;
  terminationDate: Date;
  reason: string;
}

export const TerminateWorkerPayloadSchema = z.object({
  workerId: z.string().uuid(),
  terminationDate: z.coerce.date(),
  reason: z.string().min(1),
});

export const ReactivateWorkerCommandName = 'ReactivateWorker' as const;

export interface ReactivateWorkerPayload {
  workerId: Uuid;
  reason: string;
  reactivationDate?: Date;
}

export const ReactivateWorkerPayloadSchema = z.object({
  workerId: z.string().uuid(),
  reason: z.string().min(1),
  reactivationDate: z.coerce.date().optional(),
});

/* ------------------------------------------------------------------ */
/*  Job assignment commands                                            */
/* ------------------------------------------------------------------ */

export const CreateJobAssignmentCommandName = 'CreateJobAssignment' as const;

export interface CreateJobAssignmentPayload {
  assignmentId: Uuid;
  workerId: Uuid;
  positionId: Uuid;
  startDate: Date;
  endDate?: Date;
}

export const CreateJobAssignmentPayloadSchema = z.object({
  assignmentId: z.string().uuid(),
  workerId: z.string().uuid(),
  positionId: z.string().uuid(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
});

export const ActivateJobAssignmentCommandName = 'ActivateJobAssignment' as const;

export interface ActivateJobAssignmentPayload {
  assignmentId: Uuid;
}

export const ActivateJobAssignmentPayloadSchema = z.object({
  assignmentId: z.string().uuid(),
});

export const EndJobAssignmentCommandName = 'EndJobAssignment' as const;

export interface EndJobAssignmentPayload {
  assignmentId: Uuid;
  endDate: Date;
  reason: string;
}

export const EndJobAssignmentPayloadSchema = z.object({
  assignmentId: z.string().uuid(),
  endDate: z.coerce.date(),
  reason: z.string().min(1),
});

/* ------------------------------------------------------------------ */
/*  Employment contract commands                                       */
/* ------------------------------------------------------------------ */

export const CreateEmploymentContractCommandName = 'CreateEmploymentContract' as const;

export interface CreateEmploymentContractPayload {
  contractId: Uuid;
  workerId: Uuid;
  contractType: string;
  startDate: Date;
  endDate?: Date;
}

export const CreateEmploymentContractPayloadSchema = z.object({
  contractId: z.string().uuid(),
  workerId: z.string().uuid(),
  contractType: z.string().min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
});

export const SignEmploymentContractCommandName = 'SignEmploymentContract' as const;

export interface SignEmploymentContractPayload {
  contractId: Uuid;
  signedAt: Date;
}

export const SignEmploymentContractPayloadSchema = z.object({
  contractId: z.string().uuid(),
  signedAt: z.coerce.date(),
});

export const TerminateEmploymentContractCommandName = 'TerminateEmploymentContract' as const;

export interface TerminateEmploymentContractPayload {
  contractId: Uuid;
  terminationDate: Date;
  reason: string;
}

export const TerminateEmploymentContractPayloadSchema = z.object({
  contractId: z.string().uuid(),
  terminationDate: z.coerce.date(),
  reason: z.string().min(1),
});
