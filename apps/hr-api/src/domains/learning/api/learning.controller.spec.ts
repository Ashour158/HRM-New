import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import type { HrActor } from '@hcm/command-contracts';
import { LearningController } from './learning.controller.js';
import type { CommandBus } from '../../../platform/command-bus/command-bus.js';
import type { LearningCourseRepository } from '../repositories/learning-course.repository.js';
import type { LearningAssignmentRepository } from '../repositories/learning-assignment.repository.js';
import type { CertificationRepository } from '../repositories/certification.repository.js';
import type { LearningContentPackageRepository } from '../repositories/learning-content-package.repository.js';

const tenantId = '00000000-0000-0000-0000-000000000001';
const actorId = '00000000-0000-0000-0000-000000000010';
const courseId = '00000000-0000-0000-0000-000000000100';
const assignmentId = '00000000-0000-0000-0000-000000000200';
const certificationId = '00000000-0000-0000-0000-000000000300';
const workerId = '00000000-0000-0000-0000-000000000400';

function actor(): HrActor {
  return {
    actorType: 'USER',
    actorId: new Uuid(actorId),
    roles: ['HR_ADMIN'],
    permissions: ['LEARNING_WRITE', 'LEARNING_READ'],
    email: 'hr.admin@example.com',
    mfaAuthenticated: true,
  };
}

function request(): Request {
  return {
    tenantId,
    actor: actor(),
    headers: {},
  } as unknown as Request;
}

function makeController() {
  const commandBus = { execute: vi.fn(async () => ({ success: true })) } as unknown as CommandBus;
  const courseRepo = {
    findById: vi.fn(),
    findByTenant: vi.fn(),
  } as unknown as LearningCourseRepository;
  const assignmentRepo = {
    findById: vi.fn(),
    findByWorker: vi.fn(),
    findByCourse: vi.fn(),
    findByTenant: vi.fn(),
  } as unknown as LearningAssignmentRepository;
  const certificationRepo = {
    findById: vi.fn(),
    findByWorker: vi.fn(),
    findByTenant: vi.fn(),
  } as unknown as CertificationRepository;
  const contentPackageRepo = {
    findById: vi.fn(),
    findByTenant: vi.fn(),
  } as unknown as LearningContentPackageRepository;

  const controller = new LearningController(
    commandBus,
    courseRepo,
    assignmentRepo,
    certificationRepo,
    contentPackageRepo,
  );

  return { controller, commandBus, courseRepo, assignmentRepo, certificationRepo, contentPackageRepo };
}

describe('LearningController', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('creates learning courses through authenticated command envelopes', async () => {
    const { controller, commandBus } = makeController();

    await controller.createCourse({
      title: 'Safety essentials',
      description: 'Mandatory workplace safety course',
      contentType: 'VIDEO',
      durationMinutes: 45,
      credits: 2,
      certificationEligible: true,
    }, request());

    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'CreateLearningCourse',
      aggregateType: 'LearningCourse',
      tenantId: new Uuid(tenantId),
      actor: expect.objectContaining({ actorId: new Uuid(actorId) }),
      payload: expect.objectContaining({
        title: 'Safety essentials',
        contentType: 'VIDEO',
        certificationEligible: true,
      }),
    }));
  });

  it('assigns and completes learning assignments with aggregate state guards', async () => {
    const { controller, commandBus, assignmentRepo } = makeController();
    (assignmentRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: new Uuid(assignmentId),
      workerId: new Uuid(workerId),
      status: 'IN_PROGRESS',
      aggregateVersion: 2,
    });

    await controller.createAssignment({
      workerId,
      courseId,
      assignedBy: actorId,
      dueDate: new Date('2026-07-15T00:00:00.000Z'),
    }, request());
    await controller.completeAssignment(assignmentId, { score: 94 }, request());

    expect(commandBus.execute).toHaveBeenNthCalledWith(1, expect.objectContaining({
      commandName: 'CreateLearningAssignment',
      aggregateType: 'LearningAssignment',
      payload: expect.objectContaining({
        workerId,
        courseId,
        assignedBy: actorId,
      }),
    }));
    expect(commandBus.execute).toHaveBeenNthCalledWith(2, expect.objectContaining({
      commandName: 'CompleteLearningAssignment',
      aggregateType: 'LearningAssignment',
      aggregateId: new Uuid(assignmentId),
      expectedState: 'IN_PROGRESS',
      expectedVersion: 2,
      payload: {
        learningAssignmentId: new Uuid(assignmentId),
        score: 94,
      },
    }));
  });

  it('creates and renews certifications after learning completion', async () => {
    const { controller, commandBus, certificationRepo } = makeController();
    const expiryDate = new Date('2027-06-30T00:00:00.000Z');
    const newExpiryDate = new Date('2028-06-30T00:00:00.000Z');
    (certificationRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: new Uuid(certificationId),
      workerId: new Uuid(workerId),
      status: 'ACTIVE',
      aggregateVersion: 1,
    });

    await controller.createCertification({
      workerId,
      certificationName: 'Safety essentials certified',
      issuingBody: 'Enterprise HR Academy',
      issueDate: new Date('2026-06-30T00:00:00.000Z'),
      expiryDate,
      credentialId: 'SAFE-2026-001',
    }, request());
    await controller.renewCertification(certificationId, { newExpiryDate }, request());

    expect(commandBus.execute).toHaveBeenNthCalledWith(1, expect.objectContaining({
      commandName: 'CreateCertification',
      aggregateType: 'Certification',
      payload: expect.objectContaining({
        workerId,
        certificationName: 'Safety essentials certified',
        credentialId: 'SAFE-2026-001',
      }),
    }));
    expect(commandBus.execute).toHaveBeenNthCalledWith(2, expect.objectContaining({
      commandName: 'RenewCertification',
      aggregateType: 'Certification',
      aggregateId: new Uuid(certificationId),
      expectedState: 'ACTIVE',
      expectedVersion: 1,
      payload: {
        certificationId: new Uuid(certificationId),
        newExpiryDate,
      },
    }));
  });

  it('lists learning records by the authenticated tenant only', async () => {
    const { controller, courseRepo, assignmentRepo, certificationRepo, contentPackageRepo } = makeController();
    (courseRepo.findByTenant as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: new Uuid(courseId) }]);
    (assignmentRepo.findByTenant as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: new Uuid(assignmentId) }]);
    (certificationRepo.findByTenant as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: new Uuid(certificationId) }]);
    (contentPackageRepo.findByTenant as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await expect(controller.getCoursesByTenant(tenantId, request())).resolves.toHaveLength(1);
    await expect(controller.getAssignmentsByTenant(tenantId, request())).resolves.toHaveLength(1);
    await expect(controller.getCertificationsByTenant(tenantId, request())).resolves.toHaveLength(1);
    await expect(controller.getContentPackagesByTenant(tenantId, request())).resolves.toEqual([]);
    await expect(controller.getCoursesByTenant('00000000-0000-0000-0000-000000000999', request())).rejects.toThrow('Tenant mismatch');

    expect(assignmentRepo.findByTenant).toHaveBeenCalledWith(new Uuid(tenantId));
    expect(certificationRepo.findByTenant).toHaveBeenCalledWith(new Uuid(tenantId));
  });
});
