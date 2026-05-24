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
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { randomUUID } from 'crypto';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { Uuid } from '@hcm/shared-kernel';
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
    return {
      commandId: Uuid.generate(),
      commandName,
      commandSchemaVersion: 1,
      tenantId,
      actor: {
        actorType: 'SYSTEM',
        actorId: Uuid.generate(),
        roles: ['HR_ADMIN'],
        permissions: ['WORKER_CREATE', 'WORKER_UPDATE', 'WORKER_READ', 'WORKER_TERMINATE'],
        mfaAuthenticated: true,
      },
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
        clientType: 'HR_ADMIN',
      },
    };
  }

  /* ---------------------------------------------------------------- */
  /*  Workers                                                           */
  /* ---------------------------------------------------------------- */

  @Post('workers')
  async createWorker(
    @Body(new ZodValidationPipe(CreateWorkerDtoSchema)) dto: dtos.CreateWorkerDto,
    @Req() req: Request,
  ) {
    const command = this.buildCommand('CreateWorker', 'WorkerProfile', dto, req);
    return this.commandBus.execute(command);
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
    return this.commandBus.execute(command);
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
    return this.commandBus.execute(command);
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
    return this.commandBus.execute(command);
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
    return this.commandBus.execute(command);
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
    return this.commandBus.execute(command);
  }

  @Get('workers')
  async listWorkers(
    @Query('status') status?: string,
    @Query('department') department?: string,
    @Query('manager') manager?: string,
    @Query('legalEntity') legalEntity?: string,
  ) {
    if (department) {
      return this.workerRepo.findByDepartment(new Uuid(department));
    }
    if (manager) {
      return this.workerRepo.findByManager(new Uuid(manager));
    }
    if (legalEntity) {
      return this.workerRepo.findByLegalEntity(new Uuid(legalEntity));
    }
    if (status) {
      // repository has findActive; could extend for arbitrary status
      return this.workerRepo.findActive();
    }
    return this.workerRepo.findActive();
  }

  @Get('workers/:id')
  async getWorker(@Param('id') id: string) {
    return this.workerRepo.findById(new Uuid(id));
  }

  @Get('workers/:id/allowed-actions')
  async getAllowedActions(@Param('id') id: string) {
    const worker = await this.workerRepo.findById(new Uuid(id));
    if (!worker) throw new BadRequestException('Worker not found');
    return this.fsm.getAllowedActionsFromState(worker.status, 'WorkerProfile');
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
    return this.commandBus.execute(command);
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
    return this.commandBus.execute(command);
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
    return this.commandBus.execute(command);
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
    const command = this.buildCommand('CreateJobAssignment', 'JobAssignment', dto, req);
    return this.commandBus.execute(command);
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
    return this.commandBus.execute(command);
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
    return this.commandBus.execute(command);
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
    return this.commandBus.execute(command);
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
    return this.commandBus.execute(command);
  }

  @Get('employment-contracts/worker/:workerId')
  async getEmploymentContracts(@Param('workerId') workerId: string) {
    return this.employmentContractRepo.findByWorker(new Uuid(workerId));
  }
}
