import { ForbiddenException } from '@nestjs/common';
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

const testTenantId = '550e8400-e29b-41d4-a716-446655440001';

function requestForTenant(tenantId = testTenantId): Request {
  return {
    headers: {},
    tenantId,
    actor: {
      actorType: 'USER',
      actorId: new Uuid('550e8400-e29b-41d4-a716-446655440010'),
      roles: ['HR_ADMIN'],
      permissions: ['WORKER_UPDATE'],
      mfaAuthenticated: true,
    },
  } as unknown as Request;
}

function employeeRequestForTenant(tenantId = testTenantId): Request {
  return {
    headers: {},
    tenantId,
    actor: {
      actorType: 'USER',
      actorId: new Uuid('550e8400-e29b-41d4-a716-446655440012'),
      roles: ['EMPLOYEE'],
      permissions: [],
      mfaAuthenticated: true,
    },
  } as unknown as Request;
}

describe('HrCoreController smoke test', () => {
  const commandBus = { execute: vi.fn() } as unknown as CommandBus;
  const workerRepo = {
    findById: vi.fn(),
    findByIdForTenant: vi.fn(),
    findActive: vi.fn(),
    search: vi.fn(),
    searchForTenant: vi.fn(),
    findByEmail: vi.fn(),
    findByEmailForTenant: vi.fn(),
    findByEmployeeNumber: vi.fn(),
    findByEmployeeNumberForTenant: vi.fn(),
  } as unknown as WorkerRepository;
  const employmentRelationshipRepo = {
    findById: vi.fn(),
    findByIdForTenant: vi.fn(),
    findByWorker: vi.fn(),
    findByWorkerForTenant: vi.fn(),
  } as unknown as EmploymentRelationshipRepository;
  const jobAssignmentRepo = {
    findById: vi.fn(),
    findByIdForTenant: vi.fn(),
    findByWorker: vi.fn(),
    findByWorkerForTenant: vi.fn(),
  } as unknown as JobAssignmentRepository;
  const employmentContractRepo = {
    findById: vi.fn(),
    findByIdForTenant: vi.fn(),
    findByWorker: vi.fn(),
    findByWorkerForTenant: vi.fn(),
    findExpiringWithin: vi.fn(),
    findExpiringWithinForTenant: vi.fn(),
  } as unknown as EmploymentContractRepository & { findExpiringWithin: ReturnType<typeof vi.fn>; findExpiringWithinForTenant: ReturnType<typeof vi.fn> };
  const personalDataRepo = {
    findByWorker: vi.fn(),
    findByWorkerForTenant: vi.fn(),
    findByPayloadField: vi.fn(),
    findByPayloadFieldForTenant: vi.fn(),
    findExpiringWithin: vi.fn(),
    findExpiringWithinForTenant: vi.fn(),
  } as unknown as PersonalDataRecordRepository & {
    findByPayloadField: ReturnType<typeof vi.fn>;
    findByPayloadFieldForTenant: ReturnType<typeof vi.fn>;
    findExpiringWithin: ReturnType<typeof vi.fn>;
    findExpiringWithinForTenant: ReturnType<typeof vi.fn>;
  };
  const fsm = { getAllowedActionsFromState: vi.fn(() => ['ActivateWorker']) } as unknown as FsmFramework;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const controller = new HrCoreController(
    commandBus,
    workerRepo,
    employmentRelationshipRepo,
    jobAssignmentRepo,
    employmentContractRepo,
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
    (workerRepo.findByIdForTenant as ReturnType<typeof vi.fn>).mockResolvedValue({ id: { value: workerId }, status: 'DRAFT', aggregateVersion: 1 });
    (commandBus.execute as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, data: { workerId, status: 'ACTIVE' } });

    const result = await controller.activateWorker(workerId, req);
    expect(commandBus.execute).toHaveBeenCalledTimes(1);
    expect((commandBus.execute as ReturnType<typeof vi.fn>).mock.calls[0][0].commandName).toBe('ActivateWorker');
    expect(result.success).toBe(true);
  });

  it('rehireWorker delegates to commandBus with worker state guards', async () => {
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
    (workerRepo.findByIdForTenant as ReturnType<typeof vi.fn>).mockResolvedValue({ id: { value: workerId }, status: 'TERMINATED', aggregateVersion: 4 });
    (commandBus.execute as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, data: { workerId, status: 'REHIRED' } });

    const result = await controller.rehireWorker(workerId, req);
    expect(commandBus.execute).toHaveBeenCalledTimes(1);
    const sent = (commandBus.execute as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(sent.commandName).toBe('RehireWorker');
    expect(sent.expectedState).toBe('TERMINATED');
    expect(result.success).toBe(true);
  });

  it('upsertWorkerProfileSection delegates custom fields to the generic profile section command', async () => {
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
    (workerRepo.findByIdForTenant as ReturnType<typeof vi.fn>).mockResolvedValue({ id: { value: workerId }, status: 'ACTIVE', aggregateVersion: 2 });
    (commandBus.execute as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: { workerId, dataCategory: 'CUSTOM' },
      allowedNextActions: ['TerminateWorker'],
      eventsEmitted: ['PersonalDataRecordUpdated'],
    });

    const result = await controller.upsertWorkerProfileSection(workerId, 'custom', { localPayrollCode: 'EG-01' }, req);
    const sent = (commandBus.execute as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(sent.commandName).toBe('UpsertWorkerProfileSection');
    expect(sent.payload).toMatchObject({
      dataCategory: 'CUSTOM',
      fields: { localPayrollCode: 'EG-01' },
    });
    expect(result).toMatchObject({ success: true, allowedNextActions: ['TerminateWorker'] });
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
    (workerRepo.searchForTenant as ReturnType<typeof vi.fn>).mockResolvedValue([worker]);

    const result = await controller.listWorkers(requestForTenant(), 'alice');
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

  it('rejects employee users from the tenant worker directory', async () => {
    await expect(controller.listWorkers(employeeRequestForTenant(), 'alice')).rejects.toBeInstanceOf(ForbiddenException);
    expect(workerRepo.searchForTenant).not.toHaveBeenCalled();
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
    (workerRepo.findByIdForTenant as ReturnType<typeof vi.fn>).mockResolvedValue(worker);

    const result = await controller.getWorker('550e8400-e29b-41d4-a716-446655440001', requestForTenant());
    expect(result).toMatchObject({
      id: '550e8400-e29b-41d4-a716-446655440001',
      employeeId: 'EMP-001',
      firstName: 'Bob',
      lastName: 'Jones',
      status: 'DRAFT',
    });
  });

  it('getWorkerMasterProfile returns relationships, assignments, contracts, digital file, timeline basis, and expiry alerts', async () => {
    const worker = new WorkerProfile({
      id: new Uuid('550e8400-e29b-41d4-a716-446655440001'),
      tenantId: new Uuid('550e8400-e29b-41d4-a716-446655440002'),
      employeeNumber: 'EMP-001',
      status: 'ACTIVE',
      firstName: 'Amina',
      lastName: 'Nour',
      email: new Email('amina.nour@example.com'),
      hireDate: new Date('2024-01-01'),
    });
    (workerRepo.findByIdForTenant as ReturnType<typeof vi.fn>).mockResolvedValue(worker);
    (personalDataRepo.findByWorkerForTenant as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: { value: '550e8400-e29b-41d4-a716-446655440020' },
        workerId: worker.id,
        dataCategory: 'DOCUMENT',
        dataClassification: 'HIGH_SENSITIVITY',
        consentStatus: 'GRANTED',
        state: 'ACTIVE',
        payload: {
          documents: [
            { documentType: 'PASSPORT', documentId: 'P-123', expiryDate: '2026-06-20' },
          ],
        },
      },
      {
        id: { value: '550e8400-e29b-41d4-a716-446655440021' },
        workerId: worker.id,
        dataCategory: 'CUSTOM',
        dataClassification: 'CONFIDENTIAL',
        consentStatus: 'GRANTED',
        state: 'ACTIVE',
        payload: { localField: 'value' },
      },
    ]);
    (employmentRelationshipRepo.findByWorkerForTenant as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: { value: 'relationship-1' }, state: 'ACTIVE' }]);
    (jobAssignmentRepo.findByWorkerForTenant as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: { value: 'assignment-1' }, state: 'ACTIVE' }]);
    (employmentContractRepo.findByWorkerForTenant as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: { value: 'contract-1' }, state: 'ACTIVE', endDate: new Date('2026-06-25') }]);

    const result = await controller.getWorkerMasterProfile('550e8400-e29b-41d4-a716-446655440001', requestForTenant(), '30');
    expect(result).toMatchObject({
      worker: { employeeId: 'EMP-001', status: 'ACTIVE' },
      relationships: [{ state: 'ACTIVE' }],
      jobAssignments: [{ state: 'ACTIVE' }],
      contracts: [{ state: 'ACTIVE' }],
      profileSections: {
        CUSTOM: { localField: 'value' },
      },
      digitalEmployeeFile: {
        documents: [{ documentType: 'PASSPORT', documentId: 'P-123', expiryDate: '2026-06-20' }],
      },
    });
    expect(result.lifecycleTimeline.length).toBeGreaterThan(0);
    expect(result.expiryAlerts).toContainEqual(expect.objectContaining({
      workerId: '550e8400-e29b-41d4-a716-446655440001',
      category: 'DOCUMENT',
      expiryType: 'PASSPORT',
    }));
  });

  it('getExpiringEmployeeAlerts combines personal data and contract expiry alerts', async () => {
    (personalDataRepo.findExpiringWithinForTenant as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        workerId: '550e8400-e29b-41d4-a716-446655440001',
        recordId: '550e8400-e29b-41d4-a716-446655440020',
        dataCategory: 'WORK_AUTHORIZATION',
        fieldPath: 'workPermit.expiryDate',
        expiryType: 'WORK_PERMIT',
        expiryDate: '2026-06-20',
        daysUntilExpiry: 19,
      },
    ]);
    (employmentContractRepo.findExpiringWithinForTenant as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        workerId: '550e8400-e29b-41d4-a716-446655440001',
        contractId: '550e8400-e29b-41d4-a716-446655440030',
        expiryDate: '2026-06-25',
        daysUntilExpiry: 24,
      },
    ]);

    const result = await controller.getExpiringEmployeeAlerts(requestForTenant(), '30');
    expect(result).toMatchObject({
      days: 30,
      alerts: [
        { source: 'PERSONAL_DATA', expiryType: 'WORK_PERMIT' },
        { source: 'EMPLOYMENT_CONTRACT', expiryType: 'CONTRACT_END' },
      ],
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
    (workerRepo.findByEmailForTenant as ReturnType<typeof vi.fn>).mockResolvedValue(emailMatch);
    (workerRepo.findByEmployeeNumberForTenant as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (workerRepo.searchForTenant as ReturnType<typeof vi.fn>).mockResolvedValue([emailMatch, nameMatch]);
    (personalDataRepo.findByPayloadFieldForTenant as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const result = await controller.checkWorkerDuplicates({
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@example.com',
    }, requestForTenant());

    expect(result.canCreate).toBe(false);
    expect(result.exactMatches).toContainEqual(expect.objectContaining({ field: 'email', value: 'alice@example.com' }));
    expect(result.warnings).toContainEqual(expect.objectContaining({ reason: 'Same full name' }));
  });
});
