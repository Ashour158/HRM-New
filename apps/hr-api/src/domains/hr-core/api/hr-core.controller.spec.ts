import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request } from 'express';
import { HrCoreController } from './hr-core.controller.js';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { WorkerRepository } from '../repositories/worker.repository.js';
import { EmploymentRelationshipRepository } from '../repositories/employment-relationship.repository.js';
import { JobAssignmentRepository } from '../repositories/job-assignment.repository.js';
import { EmploymentContractRepository } from '../repositories/employment-contract.repository.js';
import { PersonalDataRecordRepository } from '../repositories/personal-data-record.repository.js';
import { WorkerProfile } from '../aggregates/worker-profile.aggregate.js';
import { Uuid, Email } from '@hcm/shared-kernel';

describe('HrCoreController smoke test', () => {
  const commandBus = { execute: vi.fn() } as unknown as CommandBus;
  const workerRepo = {
    findById: vi.fn(),
    findActive: vi.fn(),
    search: vi.fn(),
    findByEmail: vi.fn(),
    findByEmployeeNumber: vi.fn(),
  } as unknown as WorkerRepository;
  const personalDataRepo = {
    findByWorker: vi.fn(),
    findByPayloadField: vi.fn(),
  } as unknown as PersonalDataRecordRepository & { findByPayloadField: ReturnType<typeof vi.fn> };
  const fsm = { getAllowedActionsFromState: vi.fn(() => ['ActivateWorker']) } as unknown as FsmFramework;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const controller = new HrCoreController(
    commandBus,
    workerRepo,
    {} as EmploymentRelationshipRepository,
    {} as JobAssignmentRepository,
    {} as EmploymentContractRepository,
    personalDataRepo,
    fsm,
  );

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('createWorker delegates to commandBus', async () => {
    const dto = {
      workerId: '550e8400-e29b-41d4-a716-446655440001',
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@example.com',
    };
    const req = {
      headers: {},
      tenantId: '550e8400-e29b-41d4-a716-446655440001',
      actor: {
        actorType: 'USER',
        actorId: new Uuid('550e8400-e29b-41d4-a716-446655440010'),
        roles: ['HR_ADMIN'],
        permissions: ['WORKER_CREATE'],
        mfaAuthenticated: true,
      },
    } as unknown as Request;
    (commandBus.execute as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, data: { workerId: dto.workerId, status: 'DRAFT' } });

    const result = await controller.createWorker(dto, req);
    expect(commandBus.execute).toHaveBeenCalledTimes(1);
    expect((commandBus.execute as ReturnType<typeof vi.fn>).mock.calls[0][0].commandName).toBe('CreateWorker');
    expect(result.success).toBe(true);
  });

  it('createWorker rejects unauthenticated requests instead of falling back to a system HR admin actor', async () => {
    const req = { headers: {}, tenantId: '550e8400-e29b-41d4-a716-446655440001' } as unknown as Request;

    await expect(controller.createWorker({
      firstName: 'No',
      lastName: 'Actor',
      email: 'no.actor@example.com',
    }, req)).rejects.toMatchObject({
      message: 'Authenticated actor is required',
    });
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('activateWorker delegates to commandBus', async () => {
    const workerId = '550e8400-e29b-41d4-a716-446655440001';
    const req = {
      headers: {},
      tenantId: workerId,
      actor: {
        actorType: 'USER',
        actorId: new Uuid('550e8400-e29b-41d4-a716-446655440010'),
        roles: ['HR_ADMIN'],
        permissions: ['WORKER_UPDATE'],
        mfaAuthenticated: true,
      },
    } as unknown as Request;
    (workerRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({ id: { value: workerId }, status: 'DRAFT', aggregateVersion: 1 });
    (commandBus.execute as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, data: { workerId, status: 'ACTIVE' } });

    const result = await controller.activateWorker(workerId, req);
    expect(commandBus.execute).toHaveBeenCalledTimes(1);
    expect((commandBus.execute as ReturnType<typeof vi.fn>).mock.calls[0][0].commandName).toBe('ActivateWorker');
    expect(result.success).toBe(true);
  });

  it('listWorkers maps aggregates to Worker DTOs', async () => {
    const worker = new WorkerProfile({
      id: new Uuid('550e8400-e29b-41d4-a716-446655440001'),
      tenantId: new Uuid('550e8400-e29b-41d4-a716-446655440002'),
      employeeNumber: 'EMP-001',
      status: 'ACTIVE',
      firstName: 'Alice',
      lastName: 'Smith',
      email: new Email('alice@example.com'),
      hireDate: new Date('2023-01-15'),
      jobTitle: 'Engineer',
    });
    (workerRepo.search as ReturnType<typeof vi.fn>).mockResolvedValue([worker]);

    const result = await controller.listWorkers('alice');
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toMatchObject({
      id: '550e8400-e29b-41d4-a716-446655440001',
      employeeId: 'EMP-001',
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@example.com',
      status: 'ACTIVE',
      jobTitle: 'Engineer',
    });
  });

  it('getWorker returns mapped DTO', async () => {
    const worker = new WorkerProfile({
      id: new Uuid('550e8400-e29b-41d4-a716-446655440001'),
      tenantId: new Uuid('550e8400-e29b-41d4-a716-446655440002'),
      employeeNumber: 'EMP-001',
      status: 'DRAFT',
      firstName: 'Bob',
      lastName: 'Jones',
      email: new Email('bob@example.com'),
      hireDate: new Date('2023-06-01'),
    });
    (workerRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(worker);

    const result = await controller.getWorker('550e8400-e29b-41d4-a716-446655440001');
    expect(result).toMatchObject({
      id: '550e8400-e29b-41d4-a716-446655440001',
      employeeId: 'EMP-001',
      firstName: 'Bob',
      lastName: 'Jones',
      status: 'DRAFT',
    });
  });

  it('checkWorkerDuplicates returns exact and warning matches', async () => {
    const emailMatch = new WorkerProfile({
      id: new Uuid('550e8400-e29b-41d4-a716-446655440001'),
      tenantId: new Uuid('550e8400-e29b-41d4-a716-446655440002'),
      employeeNumber: 'EMP-001',
      status: 'ACTIVE',
      firstName: 'Alice',
      lastName: 'Smith',
      email: new Email('alice@example.com'),
      hireDate: new Date('2023-01-15'),
    });
    const nameMatch = new WorkerProfile({
      id: new Uuid('550e8400-e29b-41d4-a716-446655440003'),
      tenantId: new Uuid('550e8400-e29b-41d4-a716-446655440002'),
      employeeNumber: 'EMP-002',
      status: 'DRAFT',
      firstName: 'Alice',
      lastName: 'Smith',
      email: new Email('alice.smith2@example.com'),
      hireDate: new Date('2024-01-15'),
    });
    (workerRepo.findByEmail as ReturnType<typeof vi.fn>).mockResolvedValue(emailMatch);
    (workerRepo.findByEmployeeNumber as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (workerRepo.search as ReturnType<typeof vi.fn>).mockResolvedValue([emailMatch, nameMatch]);
    (personalDataRepo.findByPayloadField as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const result = await controller.checkWorkerDuplicates({
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@example.com',
    });

    expect(result.canCreate).toBe(false);
    expect(result.exactMatches).toContainEqual(expect.objectContaining({ field: 'email', value: 'alice@example.com' }));
    expect(result.warnings).toContainEqual(expect.objectContaining({ reason: 'Same full name' }));
  });
});
