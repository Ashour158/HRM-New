import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { randomUUID } from 'crypto';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { Uuid } from '@hcm/shared-kernel';
import { OptionalAuthGuard } from '../../../guards/optional-auth.guard.js';
import { WorkerProfile } from '../aggregates/worker-profile.aggregate.js';
import { computeRequestHash } from '@hcm/platform-core';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { WorkerRepository } from '../repositories/worker.repository.js';
import { EmploymentRelationshipRepository } from '../repositories/employment-relationship.repository.js';
import { JobAssignmentRepository } from '../repositories/job-assignment.repository.js';
import { EmploymentContractRepository } from '../repositories/employment-contract.repository.js';
import { PersonalDataRecordRepository } from '../repositories/personal-data-record.repository.js';

import type * as dtos from './dtos.js';
import {
  CreateWorkerDtoSchema,
  UpdateWorkerDtoSchema,
  TerminateWorkerDtoSchema,
  CreateJobAssignmentDtoSchema,
  CreateEmploymentRelationshipDtoSchema,
  CreateEmploymentContractDtoSchema,
  ZodValidationPipe,
} from './dtos.js';

@ApiTags('HR Core')
@UseGuards(OptionalAuthGuard)
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
    const actor = req.actor ?? {
      actorType: 'SYSTEM' as const,
      actorId: Uuid.generate(),
      roles: ['HR_ADMIN'],
      permissions: ['WORKER_CREATE', 'WORKER_UPDATE', 'WORKER_READ', 'WORKER_TERMINATE'],
      mfaAuthenticated: true,
    };
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
    const worker = await this.workerRepo.findById(new Uuid(id));
    if (!worker) throw new BadRequestException('Worker not found');
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
    const worker = await this.workerRepo.findById(new Uuid(id));
    if (!worker) throw new BadRequestException('Worker not found');
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
  async suspendWorker(@Param('id') id: string, @Req() req: Request) {
    const worker = await this.workerRepo.findById(new Uuid(id));
    if (!worker) throw new BadRequestException('Worker not found');
    const command = this.buildCommand(
      'SuspendWorker',
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

  @Post('workers/:id/commands/reinstate')
  async reinstateWorker(@Param('id') id: string, @Req() req: Request) {
    const worker = await this.workerRepo.findById(new Uuid(id));
    if (!worker) throw new BadRequestException('Worker not found');
    const command = this.buildCommand(
      'ReinstateWorker',
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
    const worker = await this.workerRepo.findById(new Uuid(id));
    if (!worker) throw new BadRequestException('Worker not found');
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

  @Get('workers')
  async listWorkers(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('department') department?: string,
    @Query('manager') manager?: string,
    @Query('legalEntity') legalEntity?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const limit = pageSize ? parseInt(pageSize, 10) : 50;
    const offset = page ? (parseInt(page, 10) - 1) * limit : 0;

    let workers: WorkerProfile[];
    if (department) {
      workers = await this.workerRepo.findByDepartment(new Uuid(department));
    } else if (manager) {
      workers = await this.workerRepo.findByManager(new Uuid(manager));
    } else if (legalEntity) {
      workers = await this.workerRepo.findByLegalEntity(new Uuid(legalEntity));
    } else if (search) {
      workers = await this.workerRepo.search(search, { limit, offset });
    } else if (status) {
      workers = await this.workerRepo.findActive();
    } else {
      workers = await this.workerRepo.search('', { limit, offset });
    }

    return workers.map((w) => this.toWorkerDto(w));
  }

  @Get('workers/:id')
  async getWorker(@Param('id') id: string) {
    const worker = await this.workerRepo.findById(new Uuid(id));
    if (!worker) throw new BadRequestException('Worker not found');
    return this.toWorkerDto(worker);
  }

  @Get('workers/:id/allowed-actions')
  async getAllowedActions(@Param('id') id: string) {
    const worker = await this.workerRepo.findById(new Uuid(id));
    if (!worker) throw new BadRequestException('Worker not found');
    return this.fsm.getAllowedActionsFromState(worker.status, 'WorkerProfile');
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
  async getPersonalData(@Param('id') id: string) {
    const records = await this.personalDataRepo.findByWorker(new Uuid(id));
    return records.map((r) => ({
      id: r.id.value,
      dataCategory: r.dataCategory,
      dataClassification: r.dataClassification,
      payload: r.dataCategory === 'SPECIAL_CATEGORY' ? null : r.payload,
      encryptedPayloadRef: r.encryptedPayloadRef,
    }));
  }

  /* ---------------------------------------------------------------- */
  /*  Employment Relationships                                          */
  /* ---------------------------------------------------------------- */

  @Post('employment-relationships')
  async createEmploymentRelationship(
    @Body(new ZodValidationPipe(CreateEmploymentRelationshipDtoSchema)) dto: dtos.CreateEmploymentRelationshipDto,
    @Req() req: Request,
  ) {
    const command = this.buildCommand('CreateEmploymentRelationship', 'EmploymentRelationship', dto, req);
    return this.executeCommand(command);
  }

  @Post('employment-relationships/:id/commands/activate')
  async activateEmploymentRelationship(@Param('id') id: string, @Req() req: Request) {
    const relationship = await this.employmentRelationshipRepo.findById(new Uuid(id));
    if (!relationship) throw new BadRequestException('Employment relationship not found');
    const command = this.buildCommand(
      'ActivateEmploymentRelationship',
      'EmploymentRelationship',
      { workerId: relationship.workerId },
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
    const relationship = await this.employmentRelationshipRepo.findById(new Uuid(id));
    if (!relationship) throw new BadRequestException('Employment relationship not found');
    const command = this.buildCommand(
      'EndEmploymentRelationship',
      'EmploymentRelationship',
      { workerId: relationship.workerId, endDate: new Date(), reason: 'API end' },
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
  async getEmploymentRelationships(@Param('workerId') workerId: string) {
    return this.employmentRelationshipRepo.findByWorker(new Uuid(workerId));
  }

  /* ---------------------------------------------------------------- */
  /*  Job Assignments                                                   */
  /* ---------------------------------------------------------------- */

  @Post('job-assignments')
  async createJobAssignment(
    @Body(new ZodValidationPipe(CreateJobAssignmentDtoSchema)) dto: dtos.CreateJobAssignmentDto,
    @Req() req: Request,
  ) {
    const payload = { ...dto, assignmentId: Uuid.generate().value };
    const command = this.buildCommand('CreateJobAssignment', 'JobAssignment', payload, req);
    return this.executeCommand(command);
  }

  @Post('job-assignments/:id/commands/activate')
  async activateJobAssignment(@Param('id') id: string, @Req() req: Request) {
    const assignment = await this.jobAssignmentRepo.findById(new Uuid(id));
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
    const assignment = await this.jobAssignmentRepo.findById(new Uuid(id));
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
  async getJobAssignments(@Param('workerId') workerId: string) {
    return this.jobAssignmentRepo.findByWorker(new Uuid(workerId));
  }

  /* ---------------------------------------------------------------- */
  /*  Employment Contracts                                              */
  /* ---------------------------------------------------------------- */

  @Post('employment-contracts')
  async createEmploymentContract(
    @Body(new ZodValidationPipe(CreateEmploymentContractDtoSchema)) dto: dtos.CreateEmploymentContractDto,
    @Req() req: Request,
  ) {
    const command = this.buildCommand('CreateEmploymentContract', 'EmploymentContract', dto, req);
    return this.executeCommand(command);
  }

  @Post('employment-contracts/:id/commands/sign')
  async signEmploymentContract(@Param('id') id: string, @Req() req: Request) {
    const contract = await this.employmentContractRepo.findById(new Uuid(id));
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
  async getEmploymentContracts(@Param('workerId') workerId: string) {
    return this.employmentContractRepo.findByWorker(new Uuid(workerId));
  }
}
