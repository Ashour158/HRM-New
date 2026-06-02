import { Controller, ForbiddenException, Get, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import { AuthGuard } from './guards/auth.guard.js';
import { WorkerRepository } from './domains/hr-core/repositories/worker.repository.js';
import { PersonalDataRecordRepository } from './domains/hr-core/repositories/personal-data-record.repository.js';
import { BenefitsEnrollmentRepository } from './domains/benefits/repositories/benefits-enrollment.repository.js';
import { BenefitsLifeEventRepository } from './domains/benefits/repositories/benefits-life-event.repository.js';
import { SpendingAccountRepository } from './domains/benefits/repositories/spending-account.repository.js';
import { BenefitsProgramRepository } from './domains/benefits/repositories/benefits-program.repository.js';
import { HcmSetupService } from './domains/hcm-setup/hcm-setup.service.js';
import type { WorkerProfile } from './domains/hr-core/aggregates/worker-profile.aggregate.js';

type PayloadMap = Record<string, Record<string, unknown>>;

function dateOnly(value: Date | string | undefined | null): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().slice(0, 10);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function maskedIdentifier(value: unknown): string | undefined {
  const raw = stringValue(value);
  if (!raw) return undefined;
  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 4) return `***-**-${digits.slice(-4)}`;
  return '***';
}

function addressValue(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  return [
    record.line1,
    record.line2,
    record.city,
    record.state,
    record.postalCode,
    record.country,
  ]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(', ');
}

function enrollmentStatusForUi(status: string): 'ACTIVE' | 'PENDING' | 'TERMINATED' {
  if (status === 'EFFECTIVE' || status === 'APPROVED') return 'ACTIVE';
  if (status === 'TERMINATED' || status === 'REJECTED') return 'TERMINATED';
  return 'PENDING';
}

@ApiTags('Employee Self Service')
@UseGuards(AuthGuard)
@Controller('employee')
export class EmployeeSelfServiceController {
  constructor(
    private readonly workerRepo: WorkerRepository,
    private readonly personalDataRepo: PersonalDataRecordRepository,
    private readonly benefitsEnrollmentRepo: BenefitsEnrollmentRepository,
    private readonly benefitsLifeEventRepo: BenefitsLifeEventRepository,
    private readonly spendingAccountRepo: SpendingAccountRepository,
    private readonly benefitsProgramRepo: BenefitsProgramRepository,
    private readonly hcmSetupService: HcmSetupService,
  ) {}

  @Get('profile')
  async getProfile(@Req() req: Request) {
    const worker = await this.resolveSelfWorker(req);
    this.assertActiveSelfServiceWorker(worker);
    const payloadByCategory = await this.payloadByCategory(worker.id);
    const basic = payloadByCategory.BASIC ?? {};
    const contact = payloadByCategory.CONTACT ?? {};
    const documentsPayload = payloadByCategory.DOCUMENT ?? payloadByCategory.DOCUMENTS ?? {};
    const documents = Array.isArray(documentsPayload.documents)
      ? documentsPayload.documents
      : Array.isArray(documentsPayload.items)
      ? documentsPayload.items
      : [];

    return {
      id: worker.id.value,
      employeeId: worker.employeeNumber,
      firstName: worker.firstName,
      lastName: worker.lastName,
      email: worker.email.toString(),
      phone: stringValue(basic.phone)
        ?? stringValue(basic.phoneNumber)
        ?? stringValue(basic.workPhoneNumber)
        ?? stringValue(contact.phone)
        ?? stringValue(contact.workPhoneNumber),
      dateOfBirth: stringValue(basic.dateOfBirth) ?? dateOnly(basic.dateOfBirth as Date | string | undefined),
      ssn: maskedIdentifier(basic.ssn),
      address: addressValue(basic.address) ?? addressValue(contact.address),
      hireDate: dateOnly(worker.hireDate) ?? '',
      employmentType: worker.employmentType,
      status: worker.status,
      department: stringValue(contact.departmentName) ?? worker.departmentId?.value ?? '',
      jobTitle: worker.jobTitle ?? '',
      manager: stringValue(contact.managerName) ?? worker.managerId?.value ?? '',
      legalEntity: stringValue(contact.legalEntityName) ?? worker.legalEntityId?.value ?? '',
      documents,
    };
  }

  @Get('benefits')
  async getBenefits(@Req() req: Request) {
    const worker = await this.resolveSelfWorker(req);
    this.assertActiveSelfServiceWorker(worker);
    const [enrollments, lifeEvents, spendingAccounts, activePrograms] = await Promise.all([
      this.benefitsEnrollmentRepo.findByWorker(worker.id),
      this.benefitsLifeEventRepo.findByWorker(worker.id),
      this.spendingAccountRepo.findByWorker(worker.id),
      this.benefitsProgramRepo.findActive(worker.tenantId),
    ]);

    const programById = new Map<string, Awaited<ReturnType<BenefitsProgramRepository['findById']>>>();
    for (const enrollment of enrollments) {
      const key = enrollment.programId.value;
      if (!programById.has(key)) {
        programById.set(key, await this.benefitsProgramRepo.findById(enrollment.programId));
      }
    }

    const dependents = enrollments
      .flatMap((enrollment) => enrollment.dependents)
      .map((dependent) => ({
        id: dependent.dependentId,
        name: `${dependent.firstName} ${dependent.lastName}`.trim(),
        relationship: dependent.relationship,
        dateOfBirth: dateOnly(dependent.dateOfBirth) ?? '',
      }));

    return {
      enrollments: enrollments.map((enrollment) => {
        const program = programById.get(enrollment.programId.value);
        return {
          id: enrollment.id.value,
          workerId: enrollment.workerId.value,
          benefitType: program?.programType ?? 'BENEFIT',
          planName: program?.programName ?? enrollment.programId.value,
          coverageLevel: enrollment.coverageLevel,
          effectiveDate: dateOnly(enrollment.effectiveDate) ?? '',
          status: enrollmentStatusForUi(enrollment.status),
        };
      }),
      openEnrollmentActive: activePrograms.some((program) => program.status === 'ACTIVE'),
      lifeEvents: lifeEvents.map((event) => ({
        id: event.id.value,
        type: event.eventType,
        date: dateOnly(event.eventDate) ?? '',
        status: event.status,
        description: event.description,
      })),
      dependents,
      spendingAccounts: spendingAccounts.map((account) => ({
        id: account.id.value,
        accountType: account.accountType,
        annualElection: account.annualElection,
        usedAmount: account.usedAmount,
        availableAmount: account.availableAmount,
        currency: account.currency,
        status: account.status,
      })),
    };
  }

  @Get('attendance-setup')
  async getAttendanceSetup(@Req() req: Request) {
    const worker = await this.resolveSelfWorker(req);
    this.assertActiveSelfServiceWorker(worker);
    const setup = await this.hcmSetupService.getSetup(this.getTenantId(req));
    return {
      locations: setup.locations,
      attendancePolicy: setup.attendancePolicy,
    };
  }

  private async payloadByCategory(workerId: Uuid): Promise<PayloadMap> {
    const records = await this.personalDataRepo.findByWorker(workerId);
    return Object.fromEntries(records.map((record) => [record.dataCategory, record.payload ?? {}])) as PayloadMap;
  }

  private async resolveSelfWorker(req: Request): Promise<WorkerProfile> {
    this.assertEmployeeSelfServiceActor(req);
    const tenantId = this.getTenantId(req);
    const actorId = this.getActorId(req);
    try {
      const worker = await this.workerRepo.findByIdForTenant(new Uuid(actorId), tenantId);
      if (worker) return worker;
    } catch {
      // Identity subjects may not be valid worker IDs.
    }

    const email = (req.actor as { email?: string } | undefined)?.email;
    if (email) {
      const worker = await this.workerRepo.findByEmailForTenant(email, tenantId);
      if (worker) return worker;
    }

    throw new ForbiddenException('No employee profile is linked to the authenticated user');
  }

  private assertActiveSelfServiceWorker(worker: WorkerProfile): void {
    if (worker.status !== 'ACTIVE' && worker.status !== 'REHIRED') {
      throw new ForbiddenException('Employee self-service is available only to active workers');
    }
  }

  private assertEmployeeSelfServiceActor(req: Request): void {
    const actor = req.actor;
    if (!actor) {
      throw new ForbiddenException('Authenticated actor is required');
    }
    if (actor.actorType !== 'USER' || !actor.roles.includes('EMPLOYEE')) {
      throw new ForbiddenException('Employee self-service requires an employee user session');
    }
  }

  private getActorId(req: Request): string {
    const actorId = req.actor?.actorId;
    if (actorId instanceof Uuid) return actorId.value;
    const actorIdLike = actorId as { value?: unknown } | undefined;
    if (typeof actorIdLike?.value === 'string') return actorIdLike.value;
    throw new ForbiddenException('Authenticated actor is required');
  }

  private getTenantId(req: Request): Uuid {
    if (typeof req.tenantId === 'string' && Uuid.isValid(req.tenantId)) {
      return new Uuid(req.tenantId);
    }
    throw new ForbiddenException('Authenticated tenant is required');
  }
}
