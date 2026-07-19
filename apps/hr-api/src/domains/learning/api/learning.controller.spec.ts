import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import type { HrActor } from '@hcm/command-contracts';
import { LearningController } from './learning.controller.js';
import type { CommandBus } from '../../../platform/command-bus/command-bus.js';
import type { LearningCourseRepository } from '../repositories/learning-course.repository.js';
import type { LearningAssignmentRepository } from '../repositories/learning-assignment.repository.js';
import type { CertificationRepository } from '../repositories/certification.repository.js';
import type { LearningContentPackageRepository } from '../repositories/learning-content-package.repository.js';
import type { HrCoreDirectoryQueryService } from '../../hr-core/hr-core-directory.query-service.js';
import type { OrganizationDirectoryQueryService } from '../../organization/organization-directory.query-service.js';
import type { DocumentExportService } from '../../../platform/export/document-export.service.js';
import { LearningContentStorageService, LearningContentStorageValidationError } from '../services/learning-content-storage.service.js';

const tenantId = '00000000-0000-0000-0000-000000000001';
const actorId = '00000000-0000-0000-0000-000000000010';
const courseId = '00000000-0000-0000-0000-000000000100';
const assignmentId = '00000000-0000-0000-0000-000000000200';
const certificationId = '00000000-0000-0000-0000-000000000300';
const workerId = '00000000-0000-0000-0000-000000000400';
const otherWorkerId = '00000000-0000-0000-0000-000000000500';
const managerId = '00000000-0000-0000-0000-000000000600';

function actor(overrides?: Partial<HrActor>): HrActor {
  return {
    actorType: 'USER',
    actorId: new Uuid(actorId),
    roles: ['HR_ADMIN'],
    permissions: ['LEARNING_WRITE', 'LEARNING_READ'],
    email: 'hr.admin@example.com',
    mfaAuthenticated: true,
    ...overrides,
  };
}

function request(overrides?: Partial<HrActor>): Request {
  return {
    tenantId,
    actor: actor(overrides),
    headers: {},
  } as unknown as Request;
}

function mockResponse(): Response {
  return {
    setHeader: vi.fn(),
    send: vi.fn(),
  } as unknown as Response;
}

function employeeActor(id: string): HrActor {
  return {
    actorType: 'USER',
    actorId: new Uuid(id),
    roles: ['EMPLOYEE'],
    permissions: ['LEARNING_READ'],
    email: 'employee@example.com',
    mfaAuthenticated: true,
  };
}

function managerActor(id: string): HrActor {
  return {
    actorType: 'USER',
    actorId: new Uuid(id),
    roles: ['MANAGER'],
    permissions: ['LEARNING_READ'],
    email: 'manager@example.com',
    mfaAuthenticated: true,
  };
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
  const workerRepo = {
    findWorkerById: vi.fn(),
    findWorkerByEmail: vi.fn(),
  } as unknown as HrCoreDirectoryQueryService;
  const legalEntityRepo = {
    findLegalEntitiesForTenant: vi.fn(async () => []),
  } as unknown as OrganizationDirectoryQueryService;
  const documentExport = {
    toCertificatePdf: vi.fn(async () => Buffer.from('%PDF-1.7 fake')),
  } as unknown as DocumentExportService;
  const contentStorage: LearningContentStorageService = {
    save: vi.fn(),
    read: vi.fn(),
  };

  const controller = new LearningController(
    commandBus,
    courseRepo,
    assignmentRepo,
    certificationRepo,
    contentPackageRepo,
    workerRepo,
    legalEntityRepo,
    documentExport,
    contentStorage,
  );

  return { controller, commandBus, courseRepo, assignmentRepo, certificationRepo, contentPackageRepo, workerRepo, legalEntityRepo, documentExport, contentStorage };
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

  describe('content package upload', () => {
    const packageId = '00000000-0000-0000-0000-000000000500';

    function pendingPackage(overrides?: Record<string, unknown>) {
      return {
        id: new Uuid(packageId),
        tenantId: new Uuid(tenantId),
        packageType: 'SCORM_2004',
        title: 'Safety SCORM package',
        status: 'UPLOADED',
        aggregateVersion: 0,
        ...overrides,
      };
    }

    function multerFile(overrides?: Partial<Express.Multer.File>): Express.Multer.File {
      return {
        buffer: Buffer.from('zip-bytes'),
        originalname: 'course.zip',
        mimetype: 'application/zip',
        size: 9,
        fieldname: 'file',
        encoding: '7bit',
        stream: undefined as never,
        destination: '',
        filename: '',
        path: '',
        ...overrides,
      } as Express.Multer.File;
    }

    it('stores an uploaded file through the storage adapter and attaches it via a real command', async () => {
      const { controller, commandBus, contentPackageRepo, contentStorage } = makeController();
      (contentPackageRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(pendingPackage());
      (contentStorage.save as ReturnType<typeof vi.fn>).mockResolvedValue({
        fileUrl: `local://learning-content/${tenantId}/${packageId}/course.zip`,
        checksum: 'abc123',
        sizeBytes: 9,
        mimeType: 'application/zip',
        originalFileName: 'course.zip',
      });
      const file = multerFile();

      await controller.uploadContentPackageFile(packageId, file, request());

      expect(contentStorage.save).toHaveBeenCalledWith(file.buffer, expect.objectContaining({
        tenantId,
        packageId,
        packageType: 'SCORM_2004',
        originalFileName: 'course.zip',
        mimeType: 'application/zip',
      }));
      expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
        commandName: 'AttachLearningContentPackageFile',
        aggregateType: 'LearningContentPackage',
        aggregateId: new Uuid(packageId),
        expectedState: 'UPLOADED',
        expectedVersion: 0,
        payload: expect.objectContaining({
          fileUrl: `local://learning-content/${tenantId}/${packageId}/course.zip`,
          checksum: 'abc123',
          sizeBytes: 9,
        }),
      }));
    });

    it('rejects an upload with no file attached', async () => {
      const { controller } = makeController();
      await expect(controller.uploadContentPackageFile(packageId, undefined, request()))
        .rejects.toThrow('A file is required');
    });

    it('rejects an upload for an unknown content package', async () => {
      const { controller, contentPackageRepo } = makeController();
      (contentPackageRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      await expect(controller.uploadContentPackageFile(packageId, multerFile(), request()))
        .rejects.toThrow('Content package not found');
    });

    it('rejects an upload that fails storage validation (wrong extension/MIME) without issuing a command', async () => {
      const { controller, contentPackageRepo, contentStorage, commandBus } = makeController();
      (contentPackageRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(pendingPackage());
      (contentStorage.save as ReturnType<typeof vi.fn>).mockRejectedValue(
        new LearningContentStorageValidationError(
          'SCORM content packages must be uploaded as a .zip file (got ".txt").',
          'INVALID_EXTENSION',
        ),
      );
      const file = multerFile({ originalname: 'notes.txt', mimetype: 'text/plain' });

      await expect(controller.uploadContentPackageFile(packageId, file, request()))
        .rejects.toThrow('SCORM content packages must be uploaded as a .zip file');
      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('rejects an upload for a content package owned by a different tenant', async () => {
      const { controller, contentPackageRepo, contentStorage } = makeController();
      (contentPackageRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        pendingPackage({ tenantId: new Uuid('00000000-0000-0000-0000-000000000999') }),
      );
      await expect(controller.uploadContentPackageFile(packageId, multerFile(), request()))
        .rejects.toThrow('Tenant mismatch');
      expect(contentStorage.save).not.toHaveBeenCalled();
    });
  });

  describe('certificate PDF generation', () => {
    function activeCertification(overrides?: Record<string, unknown>) {
      return {
        id: new Uuid(certificationId),
        tenantId: new Uuid(tenantId),
        workerId: new Uuid(workerId),
        certificationName: 'Safety essentials certified',
        issuingBody: 'Enterprise HR Academy',
        issueDate: new Date('2026-06-30T00:00:00.000Z'),
        expiryDate: new Date('2027-06-30T00:00:00.000Z'),
        credentialId: 'SAFE-2026-001',
        status: 'ACTIVE',
        ...overrides,
      };
    }

    it('generates and streams a certificate PDF for an HR admin', async () => {
      const { controller, certificationRepo, workerRepo, legalEntityRepo, documentExport } = makeController();
      (certificationRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(activeCertification());
      (workerRepo.findWorkerById as ReturnType<typeof vi.fn>).mockResolvedValue({ id: new Uuid(workerId), firstName: 'Maya', lastName: 'Hassan' });
      (legalEntityRepo.findLegalEntitiesForTenant as ReturnType<typeof vi.fn>).mockResolvedValue([{ name: 'Acme Health', status: 'ACTIVE' }]);
      const res = mockResponse();

      await controller.getCertificatePdf(certificationId, request(), res);

      expect(documentExport.toCertificatePdf).toHaveBeenCalledWith(expect.objectContaining({
        recipientName: 'Maya Hassan',
        certificationName: 'Safety essentials certified',
        issuingBody: 'Enterprise HR Academy',
        credentialId: 'SAFE-2026-001',
        organizationName: 'Acme Health',
      }));
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', expect.stringContaining(`certificate-${certificationId}.pdf`));
      expect(res.send).toHaveBeenCalledWith(expect.any(Buffer));
    });

    it('allows the certificate holder to download their own certificate', async () => {
      const { controller, certificationRepo, workerRepo, legalEntityRepo, documentExport } = makeController();
      (certificationRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(activeCertification());
      (workerRepo.findWorkerById as ReturnType<typeof vi.fn>).mockResolvedValue({ id: new Uuid(workerId), firstName: 'Maya', lastName: 'Hassan' });
      (legalEntityRepo.findLegalEntitiesForTenant as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      const res = mockResponse();

      const selfReq = request({ actorId: new Uuid(workerId), roles: ['EMPLOYEE'], email: 'maya.hassan@example.com' });
      await controller.getCertificatePdf(certificationId, selfReq, res);

      expect(documentExport.toCertificatePdf).toHaveBeenCalled();
      expect(res.send).toHaveBeenCalled();
    });

    it('denies certificate access to an unrelated non-admin worker', async () => {
      const { controller, certificationRepo, workerRepo } = makeController();
      (certificationRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(activeCertification());
      (workerRepo.findWorkerById as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (workerRepo.findWorkerByEmail as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const otherWorkerId = '00000000-0000-0000-0000-000000000999';
      const req = request({ actorId: new Uuid(otherWorkerId), roles: ['EMPLOYEE'], email: 'someone.else@example.com' });

      await expect(controller.getCertificatePdf(certificationId, req, mockResponse()))
        .rejects.toThrow('Certificate access is limited');
    });

    it('rejects certificate access across tenants', async () => {
      const { controller, certificationRepo } = makeController();
      (certificationRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        activeCertification({ tenantId: new Uuid('00000000-0000-0000-0000-000000000999') }),
      );
      await expect(controller.getCertificatePdf(certificationId, request(), mockResponse()))
        .rejects.toThrow('Tenant mismatch');
    });
  });

  describe('worker-scoped authorization (HCM-P0-11)', () => {
    it('allows an employee to read their own learning assignment and certification', async () => {
      const { controller, assignmentRepo, certificationRepo } = makeController();
      (assignmentRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({ id: new Uuid(assignmentId), workerId: new Uuid(workerId) });
      (certificationRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({ id: new Uuid(certificationId), workerId: new Uuid(workerId) });
      (assignmentRepo.findByWorker as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (certificationRepo.findByWorker as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await expect(controller.getAssignment(assignmentId, request(employeeActor(workerId)))).resolves.toBeDefined();
      await expect(controller.getCertification(certificationId, request(employeeActor(workerId)))).resolves.toBeDefined();
      await expect(controller.getAssignmentsByWorker(workerId, request(employeeActor(workerId)))).resolves.toEqual([]);
      await expect(controller.getCertificationsByWorker(workerId, request(employeeActor(workerId)))).resolves.toEqual([]);
    });

    it('denies an employee from reading a coworker learning assignment or certification', async () => {
      const { controller, assignmentRepo, certificationRepo, workerRepo } = makeController();
      (assignmentRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({ id: new Uuid(assignmentId), workerId: new Uuid(workerId) });
      (certificationRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({ id: new Uuid(certificationId), workerId: new Uuid(workerId) });
      (workerRepo.findWorkerById as ReturnType<typeof vi.fn>).mockResolvedValue({ id: new Uuid(workerId), managerId: undefined });

      const coworker = request(employeeActor(otherWorkerId));

      await expect(controller.getAssignment(assignmentId, coworker)).rejects.toThrow(
        'Learning records are scoped to self, reporting line, or HR/Learning admin roles',
      );
      await expect(controller.getCertification(certificationId, coworker)).rejects.toThrow(
        'Learning records are scoped to self, reporting line, or HR/Learning admin roles',
      );
      await expect(controller.getAssignmentsByWorker(workerId, coworker)).rejects.toThrow(
        'Learning records are scoped to self, reporting line, or HR/Learning admin roles',
      );
      await expect(controller.getCertificationsByWorker(workerId, coworker)).rejects.toThrow(
        'Learning records are scoped to self, reporting line, or HR/Learning admin roles',
      );
    });

    it('allows a manager to read their direct report learning assignment', async () => {
      const { controller, assignmentRepo, workerRepo } = makeController();
      (assignmentRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({ id: new Uuid(assignmentId), workerId: new Uuid(workerId) });
      (workerRepo.findWorkerById as ReturnType<typeof vi.fn>).mockResolvedValue({ id: new Uuid(workerId), managerId: new Uuid(managerId) });

      await expect(controller.getAssignment(assignmentId, request(managerActor(managerId)))).resolves.toBeDefined();
    });

    it('denies a non-admin actor from listing tenant-wide or course-wide learning rosters', async () => {
      const { controller } = makeController();
      const employee = request(employeeActor(workerId));

      await expect(controller.getAssignmentsByCourse(courseId, employee)).rejects.toThrow(
        'Learning administrative data requires HR or Learning admin scope',
      );
      await expect(controller.getAssignmentsByTenant(tenantId, employee)).rejects.toThrow(
        'Learning administrative data requires HR or Learning admin scope',
      );
      await expect(controller.getCertificationsByTenant(tenantId, employee)).rejects.toThrow(
        'Learning administrative data requires HR or Learning admin scope',
      );
    });
  });
});
