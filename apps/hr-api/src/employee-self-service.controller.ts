import { BadRequestException, Body, Controller, ForbiddenException, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { randomUUID } from 'crypto';
import { computeRequestHash } from '@hcm/platform-core';
import type { CommandOutcome, CommandResult, HrCommandEnvelope } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { AuthGuard } from './guards/auth.guard.js';
import { CommandBus } from './platform/command-bus/command-bus.js';
import { WorkerRepository } from './domains/hr-core/repositories/worker.repository.js';
import { PersonalDataRecordRepository } from './domains/hr-core/repositories/personal-data-record.repository.js';
import { BenefitsEnrollmentRepository } from './domains/benefits/repositories/benefits-enrollment.repository.js';
import { BenefitsLifeEventRepository } from './domains/benefits/repositories/benefits-life-event.repository.js';
import { SpendingAccountRepository } from './domains/benefits/repositories/spending-account.repository.js';
import { BenefitsProgramRepository } from './domains/benefits/repositories/benefits-program.repository.js';
import { HcmSetupService } from './domains/hcm-setup/hcm-setup.service.js';
import type { WorkerProfile } from './domains/hr-core/aggregates/worker-profile.aggregate.js';

type PayloadMap = Record<string, Record<string, unknown>>;

type EmployeeBenefitsDependentBody = {
  dependentId?: string;
  firstName?: string;
  lastName?: string;
  relationship?: string;
  dateOfBirth?: Date | string;
};

type EmployeeBenefitsEnrollmentBody = {
  programId?: string;
  coverageLevel?: string;
  dependents?: EmployeeBenefitsDependentBody[];
  effectiveDate?: Date | string;
};

type EmployeeBenefitsLifeEventBody = {
  eventType?: string;
  eventDate?: Date | string;
  description?: string;
};

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
    private readonly commandBus?: CommandBus,
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
      activePrograms: activePrograms.map((program) => ({
        id: program.id.value,
        programName: program.programName,
        programType: program.programType,
        status: program.status,
        effectiveFrom: dateOnly(program.effectiveFrom),
        effectiveUntil: dateOnly(program.effectiveUntil),
      })),
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

  @Post('benefits/enrollments')
  async createBenefitsEnrollment(@Body() body: EmployeeBenefitsEnrollmentBody, @Req() req: Request) {
    const worker = await this.resolveSelfWorker(req);
    this.assertActiveSelfServiceWorker(worker);
    const payload = {
      enrollmentId: Uuid.generate(),
      workerId: worker.id,
      programId: this.requiredUuid(body.programId, 'programId'),
      coverageLevel: this.requiredString(body.coverageLevel, 'coverageLevel'),
      dependents: this.normalizeDependents(body.dependents ?? []),
      effectiveDate: this.requiredDate(body.effectiveDate ?? new Date(), 'effectiveDate'),
    };
    return this.assertCommandSucceeded(await this.getCommandBus().execute(this.buildCommand(
      'CreateBenefitsEnrollment',
      'BenefitsEnrollment',
      payload,
      req,
      { subjectWorkerId: worker.id },
    )));
  }

  @Post('benefits/life-events')
  async createBenefitsLifeEvent(@Body() body: EmployeeBenefitsLifeEventBody, @Req() req: Request) {
    const worker = await this.resolveSelfWorker(req);
    this.assertActiveSelfServiceWorker(worker);
    const payload = {
      lifeEventId: Uuid.generate(),
      workerId: worker.id,
      eventType: this.requiredString(body.eventType, 'eventType'),
      eventDate: this.requiredDate(body.eventDate ?? new Date(), 'eventDate'),
      description: stringValue(body.description),
    };
    return this.assertCommandSucceeded(await this.getCommandBus().execute(this.buildCommand(
      'CreateBenefitsLifeEvent',
      'BenefitsLifeEvent',
      payload,
      req,
      { subjectWorkerId: worker.id },
    )));
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

  private buildCommand<TPayload>(
    commandName: string,
    aggregateType: string,
    payload: TPayload,
    req: Request,
    options?: { aggregateId?: Uuid; expectedState?: string; expectedVersion?: number; subjectWorkerId?: Uuid },
  ): HrCommandEnvelope<TPayload> {
    if (!req.actor) throw new ForbiddenException('Authenticated actor is required');
    return {
      commandId: Uuid.generate(),
      commandName,
      commandSchemaVersion: 1,
      tenantId: this.getTenantId(req),
      actor: req.actor,
      aggregateType,
      aggregateId: options?.aggregateId,
      expectedState: options?.expectedState,
      expectedVersion: options?.expectedVersion,
      subjectWorkerId: options?.subjectWorkerId,
      idempotencyKey: randomUUID(),
      correlationId: Uuid.generate(),
      reason: 'Employee benefits self-service request',
      payload,
      metadata: { requestHash: computeRequestHash(payload), clientType: 'EMPLOYEE_PORTAL' },
    };
  }

  private assertCommandSucceeded<TData>(outcome: CommandOutcome<TData>): CommandResult<TData> {
    if (outcome.success) return outcome;
    throw new BadRequestException({
      errorCode: outcome.errorCode,
      errorMessage: outcome.errorMessage,
      errorDetails: outcome.errorDetails,
      stepFailed: outcome.stepFailed,
      retryable: outcome.retryable,
    });
  }

  private getCommandBus(): CommandBus {
    if (!this.commandBus) {
      throw new BadRequestException('Benefits self-service commands are not configured');
    }
    return this.commandBus;
  }

  private normalizeDependents(dependents: EmployeeBenefitsDependentBody[]) {
    return dependents.map((dependent) => ({
      dependentId: stringValue(dependent.dependentId) ?? Uuid.generate().value,
      firstName: this.requiredString(dependent.firstName, 'dependent.firstName'),
      lastName: this.requiredString(dependent.lastName, 'dependent.lastName'),
      relationship: this.requiredString(dependent.relationship, 'dependent.relationship'),
      dateOfBirth: this.requiredDate(dependent.dateOfBirth, 'dependent.dateOfBirth'),
    }));
  }

  private requiredString(value: unknown, fieldName: string): string {
    const parsed = stringValue(value);
    if (!parsed) throw new BadRequestException(`${fieldName} is required`);
    return parsed;
  }

  private requiredUuid(value: unknown, fieldName: string): Uuid {
    const parsed = this.requiredString(value, fieldName);
    if (!Uuid.isValid(parsed)) throw new BadRequestException(`${fieldName} must be a valid UUID`);
    return new Uuid(parsed);
  }

  private requiredDate(value: unknown, fieldName: string): Date {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    const parsed = typeof value === 'string' ? new Date(value) : undefined;
    if (!parsed || Number.isNaN(parsed.getTime())) throw new BadRequestException(`${fieldName} must be a valid date`);
    return parsed;
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
    if (actor.actorType !== 'USER') {
      throw new ForbiddenException('Employee self-service requires a user session linked to a worker profile');
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
