import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  Res,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { Uuid } from '@hcm/shared-kernel';
import { AuthGuard } from '../../../guards/auth.guard.js';
import { WorkerProfile, type WorkerStatus } from '../aggregates/worker-profile.aggregate.js';
import { computeRequestHash } from '@hcm/platform-core';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { WorkerRepository } from '../repositories/worker.repository.js';
import { EmploymentRelationshipRepository } from '../repositories/employment-relationship.repository.js';
import { JobAssignmentRepository } from '../repositories/job-assignment.repository.js';
import { EmploymentContractRepository } from '../repositories/employment-contract.repository.js';
import { PersonalDataRecordRepository } from '../repositories/personal-data-record.repository.js';
import { resolveTenantCurrency } from '../../hcm-setup/hcm-setup-currency.js';
import { HcmSetupService } from '../../hcm-setup/hcm-setup.service.js';
import { clampLimit } from '../../../platform/http/pagination.js';

import type * as dtos from './dtos.js';
import {
  CreateWorkerDtoSchema,
  WorkerDuplicateCheckDtoSchema,
  UpdateWorkerDtoSchema,
  TerminateWorkerDtoSchema,
  CreateJobAssignmentDtoSchema,
  CreateEmploymentRelationshipDtoSchema,
  CreateEmploymentContractDtoSchema,
  ZodValidationPipe,
} from './dtos.js';

type EmployeeMassUpdateRow = {
  employeeId?: string;
  firstName?: string;
  lastName?: string;
  workEmail?: string;
  personalEmail?: string;
  phoneNumber?: string;
  workPhoneNumber?: string;
  department?: string;
  legalEntityId?: string;
  departmentId?: string;
  managerEmployeeId?: string;
  jobTitle?: string;
  workLocationCode?: string;
  grossSalary?: number;
  currency?: string;
};

type EmployeeMassUpdateValidationError = { row: number; field: string; message: string };

type EmployeeMassUpdateValidationResult = {
  accepted: boolean;
  rowCount: number;
  rows: EmployeeMassUpdateRow[];
  workersByEmployeeId: Map<string, WorkerProfile>;
  managersByEmployeeId: Map<string, WorkerProfile>;
  createEmployeeIds: Set<string>;
  updateEmployeeIds: Set<string>;
  errors: EmployeeMassUpdateValidationError[];
  events: string[];
};

type ProfileSectionCategory =
  | 'BASIC'
  | 'CONTACT'
  | 'BANKING'
  | 'TAX'
  | 'MEDICAL'
  | 'EMERGENCY_CONTACT'
  | 'DEPENDENT'
  | 'BACKGROUND'
  | 'COMPENSATION'
  | 'DOCUMENT'
  | 'WORK_AUTHORIZATION'
  | 'ASSET_ACCESS'
  | 'SKILLS'
  | 'CONSENT'
  | 'CUSTOM';

type ExpiryAlert = {
  source: 'PERSONAL_DATA' | 'EMPLOYMENT_CONTRACT';
  workerId: string;
  recordId?: string;
  contractId?: string;
  category?: string;
  fieldPath?: string;
  expiryType: string;
  expiryDate: string;
  daysUntilExpiry: number;
  severity: 'EXPIRED' | 'CRITICAL' | 'WARNING';
};

const PROFILE_SECTION_CATEGORIES = new Set<ProfileSectionCategory>([
  'BASIC',
  'CONTACT',
  'BANKING',
  'TAX',
  'MEDICAL',
  'EMERGENCY_CONTACT',
  'DEPENDENT',
  'BACKGROUND',
  'COMPENSATION',
  'DOCUMENT',
  'WORK_AUTHORIZATION',
  'ASSET_ACCESS',
  'SKILLS',
  'CONSENT',
  'CUSTOM',
]);

const EXPIRY_KEY_PATTERN = /(expiry|expires|expiration|validUntil|valid_to|endDate|end_date)/i;
const EXPIRY_TYPE_PATTERNS: Array<[RegExp, string]> = [
  [/passport/i, 'PASSPORT'],
  [/work.?permit|work.?authorization/i, 'WORK_PERMIT'],
  [/licen[cs]e/i, 'LICENSE'],
  [/certification|certificate/i, 'CERTIFICATION'],
  [/insurance/i, 'INSURANCE'],
  [/health.?card|medical/i, 'HEALTH_CARD'],
  [/contract/i, 'CONTRACT_END'],
];

function csvEscape(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toCsv(rows: Array<Record<string, string | number | null | undefined>>): string {
  const headers = Object.keys(rows[0] ?? {});
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(',')),
  ].join('\n');
}

const HR_CORE_ADMIN_ROLES = new Set([
  'APP_ADMIN',
  'PLATFORM_ADMIN',
  'SUPER_ADMIN',
  'HR_ADMIN',
  'HRBP',
  'PEOPLE_ADMIN',
  'WORKFORCE_PLANNING_ADMIN',
  'SYSTEM_ACTOR',
]);

@ApiTags('HR Core')
@UseGuards(AuthGuard)
@Controller('hr/core')
export class HrCoreController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly workerRepo: WorkerRepository,
    private readonly employmentRelationshipRepo: EmploymentRelationshipRepository,
    private readonly jobAssignmentRepo: JobAssignmentRepository,
    private readonly employmentContractRepo: EmploymentContractRepository,
    private readonly personalDataRepo: PersonalDataRecordRepository,
    private readonly fsm: FsmFramework,
    private readonly hcmSetupService: HcmSetupService,
  ) {}

  private buildCommand<TPayload>(
    commandName: string,
    aggregateType: string,
    payload: TPayload,
    req: Request,
    options?: {
      aggregateId?: Uuid;
      expectedState?: string;
      expectedVersion?: number;
      subjectWorkerId?: Uuid;
      effectiveDate?: Date;
    },
  ): HrCommandEnvelope<TPayload> {
    const tenantId = new Uuid(
      (req['tenantId'] as string | undefined) ?? '00000000-0000-0000-0000-000000000001',
    );
    if (!req.actor) {
      throw new ForbiddenException('Authenticated actor is required');
    }
    const actor = req.actor;
    this.assertHrCoreAdminScope(req);
    return {
      commandId: Uuid.generate(),
      commandName,
      commandSchemaVersion: 1,
      tenantId,
      actor,
      aggregateType,
      aggregateId: options?.aggregateId,
      expectedState: options?.expectedState,
      expectedVersion: options?.expectedVersion,
      subjectWorkerId: options?.subjectWorkerId,
      effectiveDate: options?.effectiveDate,
      idempotencyKey: randomUUID(),
      correlationId: Uuid.generate(),
      reason: 'API request',
      payload,
      metadata: {
        requestHash: computeRequestHash(payload),
        clientType: this.mapRoleToClientType(actor.roles[0]),
      },
    };
  }

  private getTenantId(req: Request): Uuid {
    return new Uuid(
      (req['tenantId'] as string | undefined) ?? '00000000-0000-0000-0000-000000000001',
    );
  }

  private assertHrCoreAdminScope(req: Request): void {
    const roles = req.actor?.roles ?? [];
    if (roles.some((role) => HR_CORE_ADMIN_ROLES.has(role))) return;
    throw new ForbiddenException('Only HR administrators can access employee master data administration');
  }

  /**
   * Directory-level worker search (name/email/employeeId only, no compensation or
   * personal data) also needs to be reachable by managers so they can look up a
   * real worker to act on (e.g. delegating a workflow approval step) instead of
   * typing a raw UUID. Every other hr/core endpoint stays HR-admin-only.
   */
  private assertHrCoreAdminOrManagerScope(req: Request): void {
    const roles = req.actor?.roles ?? [];
    if (roles.some((role) => HR_CORE_ADMIN_ROLES.has(role)) || roles.includes('MANAGER')) return;
    throw new ForbiddenException('Only HR administrators or managers can search the employee directory');
  }

  private async getTenantWorker(id: string, req: Request): Promise<WorkerProfile> {
    const worker = await this.workerRepo.findByIdForTenant(new Uuid(id), this.getTenantId(req));
    if (!worker) throw new BadRequestException('Worker not found');
    return worker;
  }

  private mapRoleToClientType(role?: string): 'HR_ADMIN' | 'MANAGER_PORTAL' | 'EMPLOYEE_PORTAL' | 'SYSTEM' {
    switch (role) {
      case 'HR_ADMIN':
        return 'HR_ADMIN';
      case 'MANAGER':
        return 'MANAGER_PORTAL';
      case 'EMPLOYEE':
        return 'EMPLOYEE_PORTAL';
      default:
        return 'SYSTEM';
    }
  }

  private async executeCommand(command: HrCommandEnvelope<unknown>): Promise<unknown> {
    const result = await this.commandBus.execute(command);
    if (result && typeof result === 'object' && 'success' in result && result.success === false) {
      const errorResult = result as { errorCode: string; errorMessage: string };
      switch (errorResult.errorCode) {
        case 'COMMAND_HANDLER_NOT_FOUND':
          throw new NotFoundException(errorResult.errorMessage);
        case 'TENANT_RESOLUTION_FAILED':
        case 'TENANT_NOT_FOUND':
        case 'UNAUTHORIZED':
          throw new UnauthorizedException(errorResult.errorMessage);
        case 'ACCESS_CONTROL_DENIED':
        case 'SOD_VIOLATION':
          throw new ForbiddenException(errorResult.errorMessage);
        case 'FSM_TRANSITION_NOT_ALLOWED':
        case 'INVALID_PAYLOAD':
        case 'IDEMPOTENCY_HASH_MISMATCH':
          throw new BadRequestException(errorResult.errorMessage);
        case 'MODULE_DISABLED':
        case 'TENANT_INACTIVE':
          throw new ConflictException(errorResult.errorMessage);
        default:
          throw new BadRequestException(errorResult.errorMessage);
      }
    }
    return result;
  }

  /* ---------------------------------------------------------------- */
  /*  Workers                                                           */
  /* ---------------------------------------------------------------- */

  @Post('workers/duplicate-check')
  async checkWorkerDuplicates(
    @Body(new ZodValidationPipe(WorkerDuplicateCheckDtoSchema)) dto: dtos.WorkerDuplicateCheckDto,
    @Req() req: Request,
  ) {
    this.assertHrCoreAdminScope(req);
    const tenantId = this.getTenantId(req);
    const exactMatches: Array<{ field: string; value: string; workerId?: string; employeeId?: string }> = [];
    const warnings: Array<{ reason: string; workerId: string; employeeId: string; name: string }> = [];

    const emailChecks = [
      ['email', dto.email],
      ['personalEmail', dto.personalEmail],
      ['workEmail', dto.workEmail],
    ].filter((entry): entry is [string, string] => Boolean(entry[1]));

    for (const [field, value] of emailChecks) {
      const worker = await this.workerRepo.findByEmailForTenant(value, tenantId);
      if (worker) {
        exactMatches.push({
          field,
          value,
          workerId: worker.id.value,
          employeeId: worker.employeeNumber,
        });
      }
    }

    if (dto.employeeNumber) {
      const worker = await this.workerRepo.findByEmployeeNumberForTenant(dto.employeeNumber, tenantId);
      if (worker) {
        exactMatches.push({
          field: 'employeeId',
          value: dto.employeeNumber,
          workerId: worker.id.value,
          employeeId: worker.employeeNumber,
        });
      }
    }

    if (dto.phoneNumber) {
      const record = await this.personalDataRepo.findByPayloadFieldForTenant('BASIC', 'phoneNumber', dto.phoneNumber, tenantId);
      if (record) {
        exactMatches.push({
          field: 'phone',
          value: dto.phoneNumber,
          workerId: record.workerId.value,
        });
      }
    }

    if (dto.workPhoneNumber) {
      const record = await this.personalDataRepo.findByPayloadFieldForTenant('BASIC', 'workPhoneNumber', dto.workPhoneNumber, tenantId);
      if (record) {
        exactMatches.push({
          field: 'workPhone',
          value: dto.workPhoneNumber,
          workerId: record.workerId.value,
        });
      }
    }

    if (dto.firstName && dto.lastName) {
      const normalizedName = `${dto.firstName} ${dto.lastName}`.trim().toLowerCase();
      const nameMatches = await this.workerRepo.searchForTenant(`${dto.firstName} ${dto.lastName}`, tenantId, { limit: 10 });
      for (const worker of nameMatches) {
        const workerName = `${worker.firstName} ${worker.lastName}`.trim();
        if (workerName.toLowerCase() === normalizedName) {
          warnings.push({
            reason: 'Same full name',
            workerId: worker.id.value,
            employeeId: worker.employeeNumber,
            name: workerName,
          });
        }
      }
    }

    return {
      canCreate: exactMatches.length === 0,
      exactMatches,
      warnings,
    };
  }

  @Post('workers')
  async createWorker(
    @Body(new ZodValidationPipe(CreateWorkerDtoSchema)) dto: dtos.CreateWorkerDto,
    @Req() req: Request,
  ) {
    const payload = { ...dto, workerId: Uuid.generate().value };
    const command = this.buildCommand('CreateWorker', 'WorkerProfile', payload, req);
    return this.executeCommand(command);
  }

  @Post('workers/:id/commands/activate')
  async activateWorker(@Param('id') id: string, @Req() req: Request) {
    const worker = await this.getTenantWorker(id, req);
    const command = this.buildCommand(
      'ActivateWorker',
      'WorkerProfile',
      { workerId: new Uuid(id) },
      req,
      {
        aggregateId: new Uuid(id),
        expectedState: worker.status,
        expectedVersion: worker.aggregateVersion,
        subjectWorkerId: new Uuid(id),
      },
    );
    return this.executeCommand(command);
  }

  @Post('workers/:id/commands/terminate')
  async terminateWorker(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(TerminateWorkerDtoSchema)) dto: dtos.TerminateWorkerDto,
    @Req() req: Request,
  ) {
    const worker = await this.getTenantWorker(id, req);
    const command = this.buildCommand(
      'TerminateWorker',
      'WorkerProfile',
      { workerId: new Uuid(id), ...dto },
      req,
      {
        aggregateId: new Uuid(id),
        expectedState: worker.status,
        expectedVersion: worker.aggregateVersion,
        subjectWorkerId: new Uuid(id),
        effectiveDate: dto.terminationDate,
      },
    );
    return this.executeCommand(command);
  }

  @Post('workers/:id/commands/suspend')
  async suspendWorker(@Param('id') id: string, @Body() body: { reason?: string; effectiveDate?: string }, @Req() req: Request) {
    const worker = await this.getTenantWorker(id, req);
    const effectiveDate = body.effectiveDate ? new Date(body.effectiveDate) : undefined;
    const command = this.buildCommand(
      'SuspendWorker',
      'WorkerProfile',
      { workerId: new Uuid(id), reason: body.reason, effectiveDate },
      req,
      {
        aggregateId: new Uuid(id),
        expectedState: worker.status,
        expectedVersion: worker.aggregateVersion,
        subjectWorkerId: new Uuid(id),
        effectiveDate,
      },
    );
    return this.executeCommand(command);
  }

  @Post('workers/:id/commands/reinstate')
  async reinstateWorker(@Param('id') id: string, @Body() body: { effectiveDate?: string }, @Req() req: Request) {
    const worker = await this.getTenantWorker(id, req);
    const effectiveDate = body.effectiveDate ? new Date(body.effectiveDate) : undefined;
    const command = this.buildCommand(
      'ReinstateWorker',
      'WorkerProfile',
      { workerId: new Uuid(id), effectiveDate },
      req,
      {
        aggregateId: new Uuid(id),
        expectedState: worker.status,
        expectedVersion: worker.aggregateVersion,
        subjectWorkerId: new Uuid(id),
        effectiveDate,
      },
    );
    return this.executeCommand(command);
  }

  @Post('workers/:id/commands/rehire')
  async rehireWorker(@Param('id') id: string, @Req() req: Request) {
    const worker = await this.getTenantWorker(id, req);
    const command = this.buildCommand(
      'RehireWorker',
      'WorkerProfile',
      { workerId: new Uuid(id) },
      req,
      {
        aggregateId: new Uuid(id),
        expectedState: worker.status,
        expectedVersion: worker.aggregateVersion,
        subjectWorkerId: new Uuid(id),
      },
    );
    return this.executeCommand(command);
  }

  @Patch('workers/:id')
  async updateWorkerPersonalData(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateWorkerDtoSchema)) dto: dtos.UpdateWorkerDto,
    @Req() req: Request,
  ) {
    const worker = await this.getTenantWorker(id, req);
    const command = this.buildCommand(
      'UpdateWorkerPersonalData',
      'WorkerProfile',
      { workerId: new Uuid(id), ...dto },
      req,
      {
        aggregateId: new Uuid(id),
        expectedState: worker.status,
        expectedVersion: worker.aggregateVersion,
        subjectWorkerId: new Uuid(id),
      },
    );
    return this.executeCommand(command);
  }

  @Patch('workers/:id/profile-sections/:category')
  async upsertWorkerProfileSection(
    @Param('id') id: string,
    @Param('category') category: string,
    @Body() fields: Record<string, unknown>,
    @Req() req: Request,
  ) {
    const worker = await this.getTenantWorker(id, req);
    const dataCategory = this.normalizeProfileSectionCategory(category);
    const command = this.buildCommand(
      'UpsertWorkerProfileSection',
      'WorkerProfile',
      { workerId: new Uuid(id), dataCategory, fields },
      req,
      {
        aggregateId: new Uuid(id),
        expectedState: worker.status,
        expectedVersion: worker.aggregateVersion,
        subjectWorkerId: new Uuid(id),
      },
    );
    return this.executeCommand(command);
  }

  @Get('workers')
  async listWorkers(
    @Req() req: Request,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('department') department?: string,
    @Query('manager') manager?: string,
    @Query('legalEntity') legalEntity?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    this.assertHrCoreAdminOrManagerScope(req);
    const tenantId = this.getTenantId(req);
    const limit = clampLimit(pageSize, { def: 50, max: 200 });
    const offset = page ? Math.max(0, (parseInt(page, 10) - 1) * limit) : 0;

    const workers = await this.workerRepo.searchForTenant(search ?? '', tenantId, {
      limit,
      offset,
      status: status ? this.normalizeWorkerStatus(status) : undefined,
      departmentId: department ? new Uuid(department) : undefined,
      managerId: manager ? new Uuid(manager) : undefined,
      legalEntityId: legalEntity ? new Uuid(legalEntity) : undefined,
    });

    return workers.map((w) => this.toWorkerDto(w));
  }

  @Get('workers/export.csv')
  async exportWorkersCsv(@Req() req: Request, @Res() res: Response) {
    this.assertHrCoreAdminScope(req);
    const tenantId = this.getTenantId(req);
    const workers = await this.workerRepo.searchForTenant('', tenantId, { limit: 1000 });
    const rows = await Promise.all(workers.map(async (worker) => {
      const records = await this.personalDataRepo.findByWorkerForTenant(worker.id, tenantId);
      const payloadByCategory = Object.fromEntries(records.map((record) => [record.dataCategory, record.payload ?? {}])) as Record<string, Record<string, unknown>>;
      const basic = payloadByCategory.BASIC ?? {};
      const contact = payloadByCategory.CONTACT ?? {};
      const workLocation = contact.workLocation as Record<string, unknown> | undefined;

      return {
        employeeId: worker.employeeNumber,
        firstName: worker.firstName,
        lastName: worker.lastName,
        workEmail: String(basic.workEmail ?? worker.email.toString()),
        personalEmail: String(basic.personalEmail ?? ''),
        phoneNumber: String(basic.phoneNumber ?? ''),
        workPhoneNumber: String(basic.workPhoneNumber ?? ''),
        department: String(contact.departmentName ?? ''),
        jobTitle: worker.jobTitle ?? '',
        workLocationCode: String(workLocation?.code ?? ''),
        status: worker.status,
      };
    }));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="employees.csv"');
    res.send(toCsv(rows));
  }

  @Get('workers/mass-update-template.csv')
  async employeeMassUpdateTemplate(@Req() req: Request, @Res() res: Response) {
    this.assertHrCoreAdminScope(req);
    const setup = await this.hcmSetupService.getSetup(this.getTenantId(req));
    const csv = toCsv([{
      employeeId: 'EMP-001',
      firstName: 'Mona',
      lastName: 'Hassan',
      workEmail: 'mona.hassan@example.com',
      personalEmail: 'mona.personal@example.com',
      phoneNumber: '+201000000000',
      workPhoneNumber: '+202000000000',
      department: 'FINANCE',
      legalEntityId: '22222222-2222-4222-8222-222222222222',
      departmentId: '33333333-3333-4333-8333-333333333333',
      managerEmployeeId: 'MGR-001',
      jobTitle: 'PAYROLL_SPECIALIST',
      workLocationCode: 'CAIRO_HQ',
      grossSalary: 10000,
      currency: resolveTenantCurrency(setup),
    }]);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="employee-mass-update-template.csv"');
    res.send(csv);
  }

  @Post('workers/mass-update-preview')
  async employeeMassUpdatePreview(@Body() body: { rows?: EmployeeMassUpdateRow[] }, @Req() req: Request) {
    this.assertHrCoreAdminScope(req);
    const tenantId = this.getTenantId(req);
    const validation = await this.validateEmployeeMassUpdateRows(body.rows ?? [], tenantId);

    return {
      accepted: validation.accepted,
      rowCount: validation.rowCount,
      createCount: validation.createEmployeeIds.size,
      updateCount: validation.updateEmployeeIds.size,
      errors: validation.errors,
      events: validation.events,
    };
  }

  @Post('workers/mass-update-apply')
  async employeeMassUpdateApply(@Body() body: { rows?: EmployeeMassUpdateRow[] }, @Req() req: Request) {
    this.assertHrCoreAdminScope(req);
    const tenantId = this.getTenantId(req);
    const validation = await this.validateEmployeeMassUpdateRows(body.rows ?? [], tenantId);

    if (!validation.accepted) {
      return {
        accepted: false,
        rowCount: validation.rowCount,
        createCount: validation.createEmployeeIds.size,
        updateCount: validation.updateEmployeeIds.size,
        updatedCount: 0,
        createdCount: 0,
        errors: validation.errors,
        events: validation.events,
        applied: [],
      };
    }

    const applied: Array<{ employeeId: string; workerId: string; action: 'CREATE' | 'UPDATE'; updatedFields: string[] }> = [];

    for (const row of validation.rows) {
      const employeeId = row.employeeId!;
      const worker = validation.workersByEmployeeId.get(employeeId);
      const manager = validation.managersByEmployeeId.get(employeeId);
      if (!worker) {
        const commandResult = await this.executeCommand(this.buildCommand('CreateWorker', 'WorkerProfile', {
          workerId: Uuid.generate().value,
          employeeNumber: employeeId,
          firstName: row.firstName!,
          lastName: row.lastName!,
          workEmail: row.workEmail,
          personalEmail: row.personalEmail,
          phoneNumber: row.phoneNumber,
          workPhoneNumber: row.workPhoneNumber,
          departmentName: row.department,
          legalEntityId: row.legalEntityId,
          departmentId: row.departmentId,
          managerId: manager?.id.value,
          jobTitle: row.jobTitle,
          workLocation: this.hasMassUpdateValue(row.workLocationCode) ? { code: row.workLocationCode } : undefined,
          salaryAmount: row.grossSalary,
          grossSalaryAmount: row.grossSalary,
          salaryCurrency: row.currency?.toUpperCase(),
          salaryBasis: row.grossSalary !== undefined ? 'MONTHLY' : undefined,
          payFrequency: row.grossSalary !== undefined ? 'MONTHLY' : undefined,
        }, req));
        const result = commandResult as { data?: { workerId?: string }; aggregateId?: Uuid };
        applied.push({
          employeeId,
          workerId: result.data?.workerId ?? result.aggregateId?.value ?? '',
          action: 'CREATE',
          updatedFields: this.massUpdateEditableFields(row),
        });
        continue;
      }

      const updatedFields: string[] = [];
      const personalData: Record<string, unknown> = {};
      const profileSections: Array<{ dataCategory: ProfileSectionCategory; fields: Record<string, unknown> }> = [];
      const organizationAssignment: Record<string, unknown> = {};

      if (this.hasMassUpdateValue(row.firstName)) personalData.firstName = row.firstName;
      if (this.hasMassUpdateValue(row.lastName)) personalData.lastName = row.lastName;
      if (this.hasMassUpdateValue(row.workEmail)) personalData.email = row.workEmail;
      if (this.hasMassUpdateValue(row.phoneNumber)) personalData.phoneNumber = row.phoneNumber;
      updatedFields.push(...Object.keys(personalData));

      const basicFields = this.definedMassUpdateFields({
        workEmail: row.workEmail,
        personalEmail: row.personalEmail,
        phoneNumber: row.phoneNumber,
        workPhoneNumber: row.workPhoneNumber,
      });
      if (Object.keys(basicFields).length > 0) {
        profileSections.push({ dataCategory: 'BASIC', fields: basicFields });
        updatedFields.push(...Object.keys(basicFields));
      }

      const contactFields = this.definedMassUpdateFields({
        departmentName: row.department,
        workLocation: this.hasMassUpdateValue(row.workLocationCode) ? { code: row.workLocationCode } : undefined,
      });
      if (Object.keys(contactFields).length > 0) {
        profileSections.push({ dataCategory: 'CONTACT', fields: contactFields });
        updatedFields.push(...Object.keys(contactFields));
      }

      const compensationFields = this.definedMassUpdateFields({
        grossSalaryAmount: row.grossSalary,
        salaryAmount: row.grossSalary,
        salaryCurrency: row.currency?.toUpperCase(),
      });
      if (Object.keys(compensationFields).length > 0) {
        profileSections.push({ dataCategory: 'COMPENSATION', fields: compensationFields });
        updatedFields.push(...Object.keys(compensationFields));
      }

      if (this.hasMassUpdateValue(row.jobTitle)) {
        organizationAssignment.jobTitle = row.jobTitle;
        updatedFields.push('jobTitle');
      }
      if (this.hasMassUpdateValue(row.legalEntityId)) {
        organizationAssignment.legalEntityId = row.legalEntityId;
        updatedFields.push('legalEntityId');
      }
      if (this.hasMassUpdateValue(row.departmentId)) {
        organizationAssignment.departmentId = row.departmentId;
        updatedFields.push('departmentId');
      }
      if (manager) {
        organizationAssignment.managerId = manager.id.value;
        updatedFields.push('managerEmployeeId');
      }

      const uniqueUpdatedFields = Array.from(new Set(updatedFields));
      await this.executeCommand(this.buildCommand('ApplyWorkerMassUpdate', 'WorkerProfile', {
        workerId: worker.id,
        personalData: Object.keys(personalData).length > 0 ? personalData : undefined,
        profileSections,
        organizationAssignment: Object.keys(organizationAssignment).length > 0 ? organizationAssignment : undefined,
        updatedFields: uniqueUpdatedFields,
      }, req, {
          aggregateId: worker.id,
          expectedState: worker.status,
          expectedVersion: worker.aggregateVersion,
          subjectWorkerId: worker.id,
        }));

      applied.push({ employeeId, workerId: worker.id.value, action: 'UPDATE', updatedFields: uniqueUpdatedFields });
    }

    return {
      accepted: true,
      rowCount: validation.rowCount,
      createCount: validation.createEmployeeIds.size,
      updateCount: validation.updateEmployeeIds.size,
      createdCount: applied.filter((row) => row.action === 'CREATE').length,
      updatedCount: applied.filter((row) => row.action === 'UPDATE').length,
      errors: [],
      events: ['EmployeeMassUpdateApplied'],
      applied,
    };
  }

  private async validateEmployeeMassUpdateRows(
    rowsInput: EmployeeMassUpdateRow[],
    tenantId: Uuid,
  ): Promise<EmployeeMassUpdateValidationResult> {
    const rows = rowsInput.map((row) => this.normalizeEmployeeMassUpdateRow(row));
    const seenEmployeeIds = new Set<string>();
    const seenEmails = new Set<string>();
    const errors: EmployeeMassUpdateValidationError[] = [];
    const workersByEmployeeId = new Map<string, WorkerProfile>();
    const managersByEmployeeId = new Map<string, WorkerProfile>();
    const createEmployeeIds = new Set<string>();
    const updateEmployeeIds = new Set<string>();

    const employeeNumbersToLookup = new Set<string>();
    const emailsToLookup = new Set<string>();
    for (const row of rows) {
      if (row.employeeId) employeeNumbersToLookup.add(row.employeeId);
      if (row.managerEmployeeId) employeeNumbersToLookup.add(row.managerEmployeeId);
      if (row.workEmail) emailsToLookup.add(row.workEmail);
      if (row.personalEmail) emailsToLookup.add(row.personalEmail);
    }
    const [workersByEmployeeNumber, workersByEmail] = await Promise.all([
      this.workerRepo.findByEmployeeNumbersForTenant([...employeeNumbersToLookup], tenantId),
      this.workerRepo.findByEmailsForTenant([...emailsToLookup], tenantId),
    ]);

    for (const [index, row] of rows.entries()) {
      if (!row.employeeId) errors.push({ row: index + 1, field: 'employeeId', message: 'Employee ID is required' });
      if (this.massUpdateEditableFields(row).length === 0) {
        errors.push({ row: index + 1, field: 'row', message: 'At least one editable employee field is required' });
      }
      if (row.employeeId && seenEmployeeIds.has(row.employeeId)) errors.push({ row: index + 1, field: 'employeeId', message: 'Duplicate employee ID in upload' });
      if (row.employeeId) {
        seenEmployeeIds.add(row.employeeId);
        const existing = workersByEmployeeNumber.get(row.employeeId);
        if (existing) {
          workersByEmployeeId.set(row.employeeId, existing);
          updateEmployeeIds.add(row.employeeId);
        } else {
          createEmployeeIds.add(row.employeeId);
          if (!row.firstName || !row.lastName || !row.workEmail) {
            errors.push({ row: index + 1, field: 'employeeId', message: 'Employee does not exist for mass update' });
          }
          if (!row.firstName) errors.push({ row: index + 1, field: 'firstName', message: 'First name is required for new employees' });
          if (!row.lastName) errors.push({ row: index + 1, field: 'lastName', message: 'Last name is required for new employees' });
          if (!row.workEmail) errors.push({ row: index + 1, field: 'workEmail', message: 'Work email is required for new employees' });
        }
      }
      for (const field of ['legalEntityId', 'departmentId'] as const) {
        const value = row[field];
        if (value && !Uuid.isValid(value)) {
          errors.push({ row: index + 1, field, message: `${field} must be a valid UUID` });
        }
      }
      if (row.managerEmployeeId) {
        if (row.managerEmployeeId === row.employeeId) {
          errors.push({ row: index + 1, field: 'managerEmployeeId', message: 'Manager cannot be the same employee' });
        } else {
          const manager = workersByEmployeeNumber.get(row.managerEmployeeId);
          if (!manager) {
            errors.push({ row: index + 1, field: 'managerEmployeeId', message: 'Manager employee ID was not found' });
          } else if (row.employeeId) {
            managersByEmployeeId.set(row.employeeId, manager);
          }
        }
      }
      for (const [field, email] of [
        ['workEmail', row.workEmail],
        ['personalEmail', row.personalEmail],
      ] as const) {
        if (!email) continue;
        const normalizedEmail = email.toLowerCase();
        if (seenEmails.has(normalizedEmail)) {
          errors.push({ row: index + 1, field, message: 'Duplicate email in upload' });
        }
        seenEmails.add(normalizedEmail);
        const existingEmailOwner = workersByEmail.get(email);
        if (existingEmailOwner && existingEmailOwner.employeeNumber !== row.employeeId) {
          errors.push({ row: index + 1, field, message: 'Email already belongs to another employee' });
        }
      }
      if (row.grossSalary !== undefined && !Number.isFinite(Number(row.grossSalary))) errors.push({ row: index + 1, field: 'grossSalary', message: 'Gross salary must be a valid number' });
      if (row.grossSalary !== undefined && Number(row.grossSalary) < 0) errors.push({ row: index + 1, field: 'grossSalary', message: 'Gross salary cannot be negative' });
      if (row.currency && !/^[A-Z]{3}$/.test(row.currency)) errors.push({ row: index + 1, field: 'currency', message: 'Currency must be a 3-letter ISO code' });
    }

    return {
      accepted: errors.length === 0,
      rowCount: rows.length,
      rows,
      workersByEmployeeId,
      managersByEmployeeId,
      createEmployeeIds,
      updateEmployeeIds,
      errors,
      events: errors.length === 0 ? ['EmployeeMassUpdateValidated'] : ['EmployeeMassUpdateRejected'],
    };
  }

  private normalizeEmployeeMassUpdateRow(row: EmployeeMassUpdateRow): EmployeeMassUpdateRow {
    const normalizeString = (value?: string): string | undefined => {
      if (value === undefined || value === null) return undefined;
      const trimmed = String(value).trim();
      return trimmed.length > 0 ? trimmed : undefined;
    };
    const grossSalaryInput = row.grossSalary as unknown;
    const grossSalary = grossSalaryInput === undefined || grossSalaryInput === null || grossSalaryInput === ''
      ? undefined
      : Number(grossSalaryInput);
    return {
      employeeId: normalizeString(row.employeeId),
      firstName: normalizeString(row.firstName),
      lastName: normalizeString(row.lastName),
      workEmail: normalizeString(row.workEmail),
      personalEmail: normalizeString(row.personalEmail),
      phoneNumber: normalizeString(row.phoneNumber),
      workPhoneNumber: normalizeString(row.workPhoneNumber),
      department: normalizeString(row.department),
      legalEntityId: normalizeString(row.legalEntityId)?.toLowerCase(),
      departmentId: normalizeString(row.departmentId)?.toLowerCase(),
      managerEmployeeId: normalizeString(row.managerEmployeeId),
      jobTitle: normalizeString(row.jobTitle),
      workLocationCode: normalizeString(row.workLocationCode),
      grossSalary,
      currency: normalizeString(row.currency)?.toUpperCase(),
    };
  }

  private massUpdateEditableFields(row: EmployeeMassUpdateRow): string[] {
    return [
      'firstName',
      'lastName',
      'workEmail',
      'personalEmail',
      'phoneNumber',
      'workPhoneNumber',
      'department',
      'legalEntityId',
      'departmentId',
      'managerEmployeeId',
      'jobTitle',
      'workLocationCode',
      'grossSalary',
      'currency',
    ].filter((field) => this.hasMassUpdateValue(row[field as keyof EmployeeMassUpdateRow]));
  }

  private hasMassUpdateValue(value: unknown): boolean {
    if (value === undefined || value === null) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (typeof value === 'number') return Number.isFinite(value);
    return true;
  }

  private definedMassUpdateFields(fields: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(fields).filter(([, value]) => this.hasMassUpdateValue(value)));
  }

  @Get('workers/:id')
  async getWorker(@Param('id') id: string, @Req() req: Request) {
    this.assertHrCoreAdminScope(req);
    const worker = await this.getTenantWorker(id, req);
    return this.toWorkerDto(worker);
  }

  @Get('workers/:id/profile')
  async getWorkerProfile(@Param('id') id: string, @Req() req: Request) {
    this.assertHrCoreAdminScope(req);
    const tenantId = this.getTenantId(req);
    const worker = await this.getTenantWorker(id, req);
    const records = await this.personalDataRepo.findByWorkerForTenant(worker.id, tenantId);
    const byCategory = Object.fromEntries(records.map((record) => [record.dataCategory, record]));

    return {
      worker: this.toWorkerDto(worker),
      basic: byCategory.BASIC?.payload ?? {},
      contact: byCategory.CONTACT?.payload ?? {},
      emergencyContact: byCategory.EMERGENCY_CONTACT?.payload ?? {},
      background: byCategory.BACKGROUND?.payload ?? {},
      compensation: byCategory.COMPENSATION?.payload ?? {},
      documents: byCategory.DOCUMENT?.payload ?? {},
      workAuthorization: byCategory.WORK_AUTHORIZATION?.payload ?? {},
      tax: byCategory.TAX?.payload ?? {},
      banking: byCategory.BANKING?.payload ?? {},
      dependents: byCategory.DEPENDENT?.payload ?? {},
      assetAccess: byCategory.ASSET_ACCESS?.payload ?? {},
      skills: byCategory.SKILLS?.payload ?? {},
      consents: byCategory.CONSENT?.payload ?? {},
      governance: {
        dataClassification: worker.dataClassification,
        personalDataRecords: records.map((record) => ({
          id: record.id.value,
          dataCategory: record.dataCategory,
          dataClassification: record.dataClassification,
          consentStatus: record.consentStatus,
          state: record.state,
        })),
      },
    };
  }

  @Get('workers/:id/master-profile')
  async getWorkerMasterProfile(@Param('id') id: string, @Req() req: Request, @Query('expiryDays') expiryDays?: string) {
    this.assertHrCoreAdminScope(req);
    const tenantId = this.getTenantId(req);
    const worker = await this.getTenantWorker(id, req);

    const [records, relationships, jobAssignments, contracts] = await Promise.all([
      this.personalDataRepo.findByWorkerForTenant(worker.id, tenantId),
      this.employmentRelationshipRepo.findByWorkerForTenant(worker.id, tenantId),
      this.jobAssignmentRepo.findByWorkerForTenant(worker.id, tenantId),
      this.employmentContractRepo.findByWorkerForTenant(worker.id, tenantId),
    ]);
    const profileSections = Object.fromEntries(records.map((record) => [record.dataCategory, record.payload ?? {}]));
    const documentSection = profileSections.DOCUMENT as Record<string, unknown> | undefined;
    const days = this.parseDays(expiryDays, 30);

    return {
      worker: this.toWorkerDto(worker),
      profileSections,
      relationships,
      jobAssignments,
      contracts,
      digitalEmployeeFile: {
        documents: Array.isArray(documentSection?.documents) ? documentSection.documents : [],
        documentRecord: documentSection ?? {},
      },
      lifecycleTimeline: this.buildLifecycleTimeline(worker, relationships, jobAssignments, contracts),
      expiryAlerts: this.collectExpiryAlerts(records, contracts, days, worker.id),
      governance: {
        dataClassification: worker.dataClassification,
        personalDataRecords: records.map((record) => ({
          id: record.id.value,
          dataCategory: record.dataCategory,
          dataClassification: record.dataClassification,
          consentStatus: record.consentStatus,
          state: record.state,
        })),
      },
    };
  }

  @Get('workers/:id/allowed-actions')
  async getAllowedActions(@Param('id') id: string, @Req() req: Request) {
    const worker = await this.getTenantWorker(id, req);
    return this.fsm.getAllowedActionsFromState(worker.status, 'WorkerProfile');
  }

  private normalizeProfileSectionCategory(category: string): ProfileSectionCategory {
    const normalized = category.trim().toUpperCase().replace(/-/g, '_') as ProfileSectionCategory;
    if (!PROFILE_SECTION_CATEGORIES.has(normalized)) {
      throw new BadRequestException(`Unsupported profile section category ${category}`);
    }
    return normalized;
  }

  private normalizeWorkerStatus(status: string): WorkerStatus {
    const normalized = status.trim().toUpperCase() as WorkerStatus;
    if (!['DRAFT', 'PENDING_ACTIVATION', 'ACTIVE', 'SUSPENDED', 'TERMINATED', 'REHIRED'].includes(normalized)) {
      throw new BadRequestException(`Unsupported worker status ${status}`);
    }
    return normalized;
  }

  private parseDays(value: string | undefined, fallback: number): number {
    const parsed = value ? Number.parseInt(value, 10) : fallback;
    if (!Number.isFinite(parsed) || parsed < 0) return fallback;
    return parsed;
  }

  private buildLifecycleTimeline(
    worker: WorkerProfile,
    relationships: unknown[],
    jobAssignments: unknown[],
    contracts: unknown[],
  ) {
    return [
      { type: 'WORKER_HIRED', date: worker.hireDate.toISOString(), status: worker.status },
      ...relationships.map((relationship) => ({
        type: 'EMPLOYMENT_RELATIONSHIP',
        state: (relationship as { state?: string }).state,
        startDate: this.isoDate((relationship as { startDate?: Date | string }).startDate),
        endDate: this.isoDate((relationship as { endDate?: Date | string }).endDate),
      })),
      ...jobAssignments.map((assignment) => ({
        type: 'JOB_ASSIGNMENT',
        state: (assignment as { state?: string }).state,
        startDate: this.isoDate((assignment as { startDate?: Date | string }).startDate),
        endDate: this.isoDate((assignment as { endDate?: Date | string }).endDate),
      })),
      ...contracts.map((contract) => ({
        type: 'EMPLOYMENT_CONTRACT',
        state: (contract as { state?: string }).state,
        startDate: this.isoDate((contract as { startDate?: Date | string }).startDate),
        endDate: this.isoDate((contract as { endDate?: Date | string }).endDate),
      })),
    ];
  }

  private collectExpiryAlerts(
    records: Array<{
      id: Uuid;
      workerId: Uuid;
      dataCategory: string;
      payload?: Record<string, unknown> | null;
    }>,
    contracts: Array<{ id: Uuid; workerId?: Uuid; endDate?: Date | string }>,
    days: number,
    ownerWorkerId?: Uuid,
  ): ExpiryAlert[] {
    const alerts: ExpiryAlert[] = [];
    for (const record of records) {
      for (const candidate of this.findExpiryCandidates(record.payload ?? {}, record.dataCategory)) {
        const daysUntilExpiry = this.daysUntil(candidate.expiryDate);
        if (daysUntilExpiry <= days) {
          alerts.push({
            source: 'PERSONAL_DATA',
            workerId: record.workerId.value,
            recordId: record.id.value,
            category: record.dataCategory,
            fieldPath: candidate.fieldPath,
            expiryType: candidate.expiryType,
            expiryDate: candidate.expiryDate,
            daysUntilExpiry,
            severity: this.severityForDays(daysUntilExpiry),
          });
        }
      }
    }

    for (const contract of contracts) {
      const expiryDate = this.isoDate(contract.endDate);
      if (!expiryDate) continue;
      const daysUntilExpiry = this.daysUntil(expiryDate);
      if (daysUntilExpiry <= days) {
        alerts.push({
          source: 'EMPLOYMENT_CONTRACT',
          workerId: (contract.workerId ?? ownerWorkerId)?.value ?? '',
          contractId: contract.id.value,
          expiryType: 'CONTRACT_END',
          expiryDate,
          daysUntilExpiry,
          severity: this.severityForDays(daysUntilExpiry),
        });
      }
    }

    return alerts.sort((left, right) => left.daysUntilExpiry - right.daysUntilExpiry);
  }

  private findExpiryCandidates(
    value: unknown,
    context: string,
    path = '',
  ): Array<{ fieldPath: string; expiryType: string; expiryDate: string }> {
    if (!value || typeof value !== 'object') return [];
    if (Array.isArray(value)) {
      return value.flatMap((item, index) => this.findExpiryCandidates(item, context, `${path}[${index}]`));
    }

    const record = value as Record<string, unknown>;
    const matches: Array<{ fieldPath: string; expiryType: string; expiryDate: string }> = [];
    for (const [key, child] of Object.entries(record)) {
      const fieldPath = path ? `${path}.${key}` : key;
      if (EXPIRY_KEY_PATTERN.test(key)) {
        const expiryDate = this.isoDate(child as Date | string | undefined);
        if (expiryDate) {
          const siblingContext = Object.values(record)
            .filter((candidate): candidate is string => typeof candidate === 'string')
            .join('.');
          matches.push({
            fieldPath,
            expiryType: this.inferExpiryType(`${context}.${fieldPath}.${siblingContext}`),
            expiryDate,
          });
        }
      }
      matches.push(...this.findExpiryCandidates(child, `${context}.${key}`, fieldPath));
    }
    return matches;
  }

  private inferExpiryType(path: string): string {
    for (const [pattern, type] of EXPIRY_TYPE_PATTERNS) {
      if (pattern.test(path)) return type;
    }
    return 'DOCUMENT';
  }

  private isoDate(value: Date | string | undefined): string | undefined {
    if (!value) return undefined;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return undefined;
    return date.toISOString().slice(0, 10);
  }

  private daysUntil(value: Date | string): number {
    const expiry = value instanceof Date ? value : new Date(value);
    const todayUtc = new Date();
    const today = Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), todayUtc.getUTCDate());
    const expiryDay = Date.UTC(expiry.getUTCFullYear(), expiry.getUTCMonth(), expiry.getUTCDate());
    return Math.ceil((expiryDay - today) / (24 * 60 * 60 * 1000));
  }

  private severityForDays(daysUntilExpiry: number): 'EXPIRED' | 'CRITICAL' | 'WARNING' {
    if (daysUntilExpiry < 0) return 'EXPIRED';
    if (daysUntilExpiry <= 7) return 'CRITICAL';
    return 'WARNING';
  }

  private toWorkerDto(worker: WorkerProfile) {
    return {
      id: worker.id.value,
      employeeId: worker.employeeNumber,
      firstName: worker.firstName,
      lastName: worker.lastName,
      email: worker.email.toString(),
      hireDate: worker.hireDate?.toISOString() ?? null,
      status: worker.status,
      jobTitle: worker.jobTitle ?? undefined,
      departmentId: worker.departmentId?.value,
      departmentName: undefined,
      managerId: worker.managerId?.value,
      managerName: undefined,
      legalEntityId: worker.legalEntityId?.value,
      legalEntityName: undefined,
    };
  }

  @Get('workers/:id/timeline')
  async getWorkerTimeline(@Param('id') id: string) {
    // Would query audit ledger and transition ledger in production.
    return { workerId: id, timeline: [] };
  }

  @Get('workers/:id/personal-data')
  async getPersonalData(@Param('id') id: string, @Req() req: Request) {
    const tenantId = this.getTenantId(req);
    await this.getTenantWorker(id, req);
    const records = await this.personalDataRepo.findByWorkerForTenant(new Uuid(id), tenantId);
    return records.map((r) => ({
      id: r.id.value,
      dataCategory: r.dataCategory,
      dataClassification: r.dataClassification,
      payload: r.dataCategory === 'SPECIAL_CATEGORY' ? null : r.payload,
      encryptedPayloadRef: r.encryptedPayloadRef,
    }));
  }

  @Get('employee-alerts/expiring')
  async getExpiringEmployeeAlerts(@Req() req: Request, @Query('days') daysQuery?: string) {
    const tenantId = this.getTenantId(req);
    const days = this.parseDays(daysQuery, 30);
    const [personalDataAlerts, contractAlerts] = await Promise.all([
      this.personalDataRepo.findExpiringWithinForTenant(days, tenantId),
      this.employmentContractRepo.findExpiringWithinForTenant(days, tenantId),
    ]);

    return {
      days,
      alerts: [
        ...personalDataAlerts.map((alert) => ({
          source: 'PERSONAL_DATA' as const,
          workerId: alert.workerId,
          recordId: alert.recordId,
          category: alert.dataCategory,
          fieldPath: alert.fieldPath,
          expiryType: alert.expiryType,
          expiryDate: alert.expiryDate,
          daysUntilExpiry: alert.daysUntilExpiry,
          severity: this.severityForDays(alert.daysUntilExpiry),
        })),
        ...contractAlerts.map((alert) => ({
          source: 'EMPLOYMENT_CONTRACT' as const,
          workerId: alert.workerId,
          contractId: alert.contractId,
          expiryType: 'CONTRACT_END',
          expiryDate: alert.expiryDate,
          daysUntilExpiry: alert.daysUntilExpiry,
          severity: this.severityForDays(alert.daysUntilExpiry),
        })),
      ].sort((left, right) => left.daysUntilExpiry - right.daysUntilExpiry),
    };
  }

  /* ---------------------------------------------------------------- */
  /*  Employment Relationships                                          */
  /* ---------------------------------------------------------------- */

  @Post('employment-relationships')
  async createEmploymentRelationship(
    @Body(new ZodValidationPipe(CreateEmploymentRelationshipDtoSchema)) dto: dtos.CreateEmploymentRelationshipDto,
    @Req() req: Request,
  ) {
    await this.getTenantWorker(dto.workerId, req);
    const command = this.buildCommand(
      'CreateEmploymentRelationship',
      'EmploymentRelationship',
      { ...dto, relationshipId: Uuid.generate().value },
      req,
      { subjectWorkerId: new Uuid(dto.workerId) },
    );
    return this.executeCommand(command);
  }

  @Post('employment-relationships/:id/commands/activate')
  async activateEmploymentRelationship(@Param('id') id: string, @Req() req: Request) {
    const relationship = await this.employmentRelationshipRepo.findByIdForTenant(new Uuid(id), this.getTenantId(req));
    if (!relationship) throw new BadRequestException('Employment relationship not found');
    const command = this.buildCommand(
      'ActivateEmploymentRelationship',
      'EmploymentRelationship',
      { relationshipId: new Uuid(id) },
      req,
      {
        aggregateId: new Uuid(id),
        expectedState: relationship.state,
        expectedVersion: relationship.aggregateVersion,
      },
    );
    return this.executeCommand(command);
  }

  @Post('employment-relationships/:id/commands/end')
  async endEmploymentRelationship(@Param('id') id: string, @Req() req: Request) {
    const relationship = await this.employmentRelationshipRepo.findByIdForTenant(new Uuid(id), this.getTenantId(req));
    if (!relationship) throw new BadRequestException('Employment relationship not found');
    const command = this.buildCommand(
      'EndEmploymentRelationship',
      'EmploymentRelationship',
      { relationshipId: new Uuid(id), endDate: new Date(), reason: 'API end' },
      req,
      {
        aggregateId: new Uuid(id),
        expectedState: relationship.state,
        expectedVersion: relationship.aggregateVersion,
      },
    );
    return this.executeCommand(command);
  }

  @Get('employment-relationships/worker/:workerId')
  async getEmploymentRelationships(@Param('workerId') workerId: string, @Req() req: Request) {
    const tenantId = this.getTenantId(req);
    await this.getTenantWorker(workerId, req);
    return this.employmentRelationshipRepo.findByWorkerForTenant(new Uuid(workerId), tenantId);
  }

  /* ---------------------------------------------------------------- */
  /*  Job Assignments                                                   */
  /* ---------------------------------------------------------------- */

  @Post('job-assignments')
  async createJobAssignment(
    @Body(new ZodValidationPipe(CreateJobAssignmentDtoSchema)) dto: dtos.CreateJobAssignmentDto,
    @Req() req: Request,
  ) {
    await this.getTenantWorker(dto.workerId, req);
    const payload = { ...dto, assignmentId: Uuid.generate().value };
    const command = this.buildCommand('CreateJobAssignment', 'JobAssignment', payload, req, { subjectWorkerId: new Uuid(dto.workerId) });
    return this.executeCommand(command);
  }

  @Post('job-assignments/:id/commands/activate')
  async activateJobAssignment(@Param('id') id: string, @Req() req: Request) {
    const assignment = await this.jobAssignmentRepo.findByIdForTenant(new Uuid(id), this.getTenantId(req));
    if (!assignment) throw new BadRequestException('Job assignment not found');
    const command = this.buildCommand(
      'ActivateJobAssignment',
      'JobAssignment',
      { assignmentId: new Uuid(id) },
      req,
      {
        aggregateId: new Uuid(id),
        expectedState: assignment.state,
        expectedVersion: assignment.aggregateVersion,
      },
    );
    return this.executeCommand(command);
  }

  @Post('job-assignments/:id/commands/end')
  async endJobAssignment(@Param('id') id: string, @Req() req: Request) {
    const assignment = await this.jobAssignmentRepo.findByIdForTenant(new Uuid(id), this.getTenantId(req));
    if (!assignment) throw new BadRequestException('Job assignment not found');
    const command = this.buildCommand(
      'EndJobAssignment',
      'JobAssignment',
      { assignmentId: new Uuid(id), endDate: new Date(), reason: 'API end' },
      req,
      {
        aggregateId: new Uuid(id),
        expectedState: assignment.state,
        expectedVersion: assignment.aggregateVersion,
      },
    );
    return this.executeCommand(command);
  }

  @Get('job-assignments/worker/:workerId')
  async getJobAssignments(@Param('workerId') workerId: string, @Req() req: Request) {
    const tenantId = this.getTenantId(req);
    await this.getTenantWorker(workerId, req);
    return this.jobAssignmentRepo.findByWorkerForTenant(new Uuid(workerId), tenantId);
  }

  /* ---------------------------------------------------------------- */
  /*  Employment Contracts                                              */
  /* ---------------------------------------------------------------- */

  @Post('employment-contracts')
  async createEmploymentContract(
    @Body(new ZodValidationPipe(CreateEmploymentContractDtoSchema)) dto: dtos.CreateEmploymentContractDto,
    @Req() req: Request,
  ) {
    await this.getTenantWorker(dto.workerId, req);
    const command = this.buildCommand('CreateEmploymentContract', 'EmploymentContract', dto, req, { subjectWorkerId: new Uuid(dto.workerId) });
    return this.executeCommand(command);
  }

  @Post('employment-contracts/:id/commands/sign')
  async signEmploymentContract(@Param('id') id: string, @Req() req: Request) {
    const contract = await this.employmentContractRepo.findByIdForTenant(new Uuid(id), this.getTenantId(req));
    if (!contract) throw new BadRequestException('Contract not found');
    const command = this.buildCommand(
      'SignEmploymentContract',
      'EmploymentContract',
      { contractId: new Uuid(id), signedAt: new Date() },
      req,
      {
        aggregateId: new Uuid(id),
        expectedState: contract.state,
        expectedVersion: contract.aggregateVersion,
      },
    );
    return this.executeCommand(command);
  }

  @Get('employment-contracts/worker/:workerId')
  async getEmploymentContracts(@Param('workerId') workerId: string, @Req() req: Request) {
    const tenantId = this.getTenantId(req);
    await this.getTenantWorker(workerId, req);
    return this.employmentContractRepo.findByWorkerForTenant(new Uuid(workerId), tenantId);
  }
}
