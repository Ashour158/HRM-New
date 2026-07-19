import { Controller, Get, Post, Body, Param, Req, Res, BadRequestException, ForbiddenException, UseInterceptors, UploadedFile } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import multer from 'multer';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';
import { Uuid } from '@hcm/shared-kernel';
import { computeRequestHash } from '@hcm/platform-core';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { actorClientType, requireActor, requireTenantId } from '../../../platform/http/request-context.js';
import { HrCoreDirectoryQueryService } from '../../hr-core/hr-core-directory.query-service.js';
import { OrganizationDirectoryQueryService } from '../../organization/organization-directory.query-service.js';
import { DocumentExportService, EXPORT_CONTENT_TYPES } from '../../../platform/export/document-export.service.js';
import { LearningCourseRepository } from '../repositories/learning-course.repository.js';
import { LearningAssignmentRepository } from '../repositories/learning-assignment.repository.js';
import { CertificationRepository } from '../repositories/certification.repository.js';
import { LearningContentPackageRepository } from '../repositories/learning-content-package.repository.js';
import {
  LearningContentStorageService,
  LearningContentStorageValidationError,
  MAX_LEARNING_CONTENT_UPLOAD_BYTES,
} from '../services/learning-content-storage.service.js';
import type * as dtos from './dtos.js';
import {
  CreateLearningCourseDtoSchema, CreateLearningAssignmentDtoSchema,
  CompleteLearningAssignmentDtoSchema, CreateCertificationDtoSchema,
  RenewCertificationDtoSchema, CreateLearningContentPackageDtoSchema,
  ZodValidationPipe,
} from './dtos.js';

const LEARNING_ADMIN_ROLES = new Set(['HR_ADMIN', 'HRBP', 'SUPER_ADMIN']);

/** Strips characters that would break a Content-Disposition header value. */
function contentDispositionFileName(name: string): string {
  return name.replace(/["\r\n]/g, '_');
}

@ApiTags('Learning')
@Controller('learning')
export class LearningController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly courseRepo: LearningCourseRepository,
    private readonly assignmentRepo: LearningAssignmentRepository,
    private readonly certificationRepo: CertificationRepository,
    private readonly contentPackageRepo: LearningContentPackageRepository,
    private readonly hrCoreDirectory: HrCoreDirectoryQueryService,
    private readonly organizationDirectory: OrganizationDirectoryQueryService,
    private readonly documentExport: DocumentExportService,
    private readonly contentStorage: LearningContentStorageService,
  ) {}

  private buildCommand<TPayload>(
    commandName: string,
    aggregateType: string,
    payload: TPayload,
    req: Request,
    options?: { aggregateId?: Uuid; expectedState?: string; expectedVersion?: number; subjectWorkerId?: Uuid },
  ): HrCommandEnvelope<TPayload> {
    const tenantId = requireTenantId(req, 'Learning');
    const actor = requireActor(req, 'Learning');
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
      idempotencyKey: randomUUID(),
      correlationId: Uuid.generate(),
      reason: 'API request',
      payload,
      metadata: { requestHash: computeRequestHash(payload), clientType: actorClientType(actor) },
    };
  }

  private requireMatchingTenant(req: Request, tenantId: string): Uuid {
    const requestTenantId = requireTenantId(req, 'Learning');
    if (requestTenantId.value !== tenantId) {
      throw new BadRequestException('Tenant mismatch');
    }
    return requestTenantId;
  }

  private getActorId(req: Request): string {
    const actorId = req.actor?.actorId;
    if (actorId instanceof Uuid) return actorId.value;
    const actorIdLike = actorId as { value?: unknown } | undefined;
    if (typeof actorIdLike?.value === 'string') return actorIdLike.value;
    throw new ForbiddenException('Authenticated actor is required');
  }

  private getActorEmail(req: Request): string | undefined {
    return (req.actor as { email?: string } | undefined)?.email;
  }

  private hasLearningAdminScope(req: Request): boolean {
    return (req.actor?.roles ?? []).some((role) => LEARNING_ADMIN_ROLES.has(role));
  }

  private async resolveSelfWorkerId(req: Request): Promise<string | undefined> {
    const actorId = this.getActorId(req);
    try {
      const worker = await this.hrCoreDirectory.findWorkerById(new Uuid(actorId));
      if (worker) return worker.id.value;
    } catch {
      // Actor IDs from identity providers may be user IDs rather than worker IDs.
    }
    const email = this.getActorEmail(req);
    if (!email) return undefined;
    const worker = await this.hrCoreDirectory.findWorkerByEmail(email);
    return worker?.id.value;
  }

  /** Certificate access is limited to the certificate holder themself, or HR/admin scope. */
  private async assertCanAccessCertificate(req: Request, workerId: string): Promise<void> {
    if (this.hasLearningAdminScope(req)) return;
    const actorId = this.getActorId(req);
    if (actorId === workerId) return;
    const selfWorkerId = await this.resolveSelfWorkerId(req);
    if (selfWorkerId === workerId) return;
    throw new ForbiddenException('Certificate access is limited to the certificate holder or HR/admin roles');
  }

  private isPrivilegedLearningActor(req: Request): boolean {
    const actor = requireActor(req, 'Learning');
    return actor.actorType === 'SYSTEM'
      || actor.actorType === 'SERVICE_ACCOUNT'
      || actor.roles.some((role) => ['HR_ADMIN', 'HRBP', 'LEARNING_ADMIN', 'SUPER_ADMIN'].includes(role));
  }

  /**
   * Restricts worker-scoped learning/certification records to the worker
   * themselves, their reporting-line manager, or an HR/Learning admin role
   * (HCM-P0-11).
   */
  private async assertCanAccessWorker(req: Request, workerId: string): Promise<void> {
    const actor = requireActor(req, 'Learning');
    if (this.isPrivilegedLearningActor(req)) return;
    if (actor.actorId.value === workerId) return;

    const worker = await this.hrCoreDirectory.findWorkerById(new Uuid(workerId));
    if (!worker) throw new BadRequestException('Worker not found');

    const managerId = (worker as { managerId?: Uuid }).managerId?.value;
    if (actor.roles.includes('MANAGER') && managerId === actor.actorId.value) return;

    throw new ForbiddenException('Learning records are scoped to self, reporting line, or HR/Learning admin roles');
  }

  /**
   * Restricts tenant-wide learning/certification listings to HR/Learning
   * admin roles (HCM-P0-11).
   */
  private assertLearningAdminScope(req: Request): void {
    if (!this.isPrivilegedLearningActor(req)) {
      throw new ForbiddenException('Learning administrative data requires HR or Learning admin scope');
    }
  }

  /* Learning Courses */
  @Post('courses')
  async createCourse(@Body(new ZodValidationPipe(CreateLearningCourseDtoSchema)) dto: dtos.CreateLearningCourseDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateLearningCourse', 'LearningCourse', dto, req));
  }

  @Post('courses/:id/commands/publish')
  async publishCourse(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.courseRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Course not found');
    return this.commandBus.execute(this.buildCommand('PublishLearningCourse', 'LearningCourse', { learningCourseId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('courses/:id/commands/archive')
  async archiveCourse(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.courseRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Course not found');
    return this.commandBus.execute(this.buildCommand('ArchiveLearningCourse', 'LearningCourse', { learningCourseId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('courses/:id/commands/retire')
  async retireCourse(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.courseRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Course not found');
    return this.commandBus.execute(this.buildCommand('RetireLearningCourse', 'LearningCourse', { learningCourseId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  // Course catalog metadata carries no worker PII, so it is intentionally
  // readable tenant-wide by any authenticated actor (tenant scope is still
  // enforced via requireMatchingTenant on the tenant-listing route).
  @Get('courses/:id')
  async getCourse(@Param('id') id: string) {
    return this.courseRepo.findById(new Uuid(id));
  }

  @Get('courses/tenant/:tenantId')
  async getCoursesByTenant(@Param('tenantId') tenantId: string, @Req() req: Request) {
    return this.courseRepo.findByTenant(this.requireMatchingTenant(req, tenantId));
  }

  /* Learning Assignments */
  @Post('assignments')
  async createAssignment(@Body(new ZodValidationPipe(CreateLearningAssignmentDtoSchema)) dto: dtos.CreateLearningAssignmentDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateLearningAssignment', 'LearningAssignment', dto, req));
  }

  @Post('assignments/:id/commands/start')
  async startAssignment(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.assignmentRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Assignment not found');
    return this.commandBus.execute(this.buildCommand('StartLearningAssignment', 'LearningAssignment', { learningAssignmentId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('assignments/:id/commands/complete')
  async completeAssignment(@Param('id') id: string, @Body(new ZodValidationPipe(CompleteLearningAssignmentDtoSchema)) dto: dtos.CompleteLearningAssignmentDto, @Req() req: Request) {
    const ar = await this.assignmentRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Assignment not found');
    return this.commandBus.execute(this.buildCommand('CompleteLearningAssignment', 'LearningAssignment', { learningAssignmentId: new Uuid(id), score: dto.score }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('assignments/:id/commands/expire')
  async expireAssignment(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.assignmentRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Assignment not found');
    return this.commandBus.execute(this.buildCommand('ExpireLearningAssignment', 'LearningAssignment', { learningAssignmentId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('assignments/:id/commands/cancel')
  async cancelAssignment(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.assignmentRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Assignment not found');
    return this.commandBus.execute(this.buildCommand('CancelLearningAssignment', 'LearningAssignment', { learningAssignmentId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('assignments/:id')
  async getAssignment(@Param('id') id: string, @Req() req: Request) {
    const assignment = await this.assignmentRepo.findById(new Uuid(id));
    if (!assignment) return assignment;
    await this.assertCanAccessWorker(req, assignment.workerId.value);
    return assignment;
  }

  @Get('assignments/worker/:workerId')
  async getAssignmentsByWorker(@Param('workerId') workerId: string, @Req() req: Request) {
    await this.assertCanAccessWorker(req, workerId);
    return this.assignmentRepo.findByWorker(new Uuid(workerId));
  }

  @Get('assignments/course/:courseId')
  async getAssignmentsByCourse(@Param('courseId') courseId: string, @Req() req: Request) {
    this.assertLearningAdminScope(req);
    return this.assignmentRepo.findByCourse(new Uuid(courseId));
  }

  @Get('assignments/tenant/:tenantId')
  async getAssignmentsByTenant(@Param('tenantId') tenantId: string, @Req() req: Request) {
    this.assertLearningAdminScope(req);
    return this.assignmentRepo.findByTenant(this.requireMatchingTenant(req, tenantId));
  }

  /* Certifications */
  @Post('certifications')
  async createCertification(@Body(new ZodValidationPipe(CreateCertificationDtoSchema)) dto: dtos.CreateCertificationDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateCertification', 'Certification', dto, req));
  }

  @Post('certifications/:id/commands/renew')
  async renewCertification(@Param('id') id: string, @Body(new ZodValidationPipe(RenewCertificationDtoSchema)) dto: dtos.RenewCertificationDto, @Req() req: Request) {
    const ar = await this.certificationRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Certification not found');
    return this.commandBus.execute(this.buildCommand('RenewCertification', 'Certification', { certificationId: new Uuid(id), newExpiryDate: dto.newExpiryDate }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('certifications/:id/commands/expire')
  async expireCertification(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.certificationRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Certification not found');
    return this.commandBus.execute(this.buildCommand('ExpireCertification', 'Certification', { certificationId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('certifications/:id/commands/revoke')
  async revokeCertification(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.certificationRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Certification not found');
    return this.commandBus.execute(this.buildCommand('RevokeCertification', 'Certification', { certificationId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('certifications/:id')
  async getCertification(@Param('id') id: string, @Req() req: Request) {
    const certification = await this.certificationRepo.findById(new Uuid(id));
    if (!certification) return certification;
    await this.assertCanAccessWorker(req, certification.workerId.value);
    return certification;
  }

  @Get('certifications/worker/:workerId')
  async getCertificationsByWorker(@Param('workerId') workerId: string, @Req() req: Request) {
    await this.assertCanAccessWorker(req, workerId);
    return this.certificationRepo.findByWorker(new Uuid(workerId));
  }

  @Get('certifications/tenant/:tenantId')
  async getCertificationsByTenant(@Param('tenantId') tenantId: string, @Req() req: Request) {
    this.assertLearningAdminScope(req);
    return this.certificationRepo.findByTenant(this.requireMatchingTenant(req, tenantId));
  }

  /**
   * Generates and streams a certificate PDF on demand from the aggregate's scalar
   * fields — there is no stored document (no certificateUrl/documentUrl column).
   * Restricted to the certificate holder themself or HR/admin scope.
   */
  @Get('certifications/:id/certificate.pdf')
  async getCertificatePdf(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const tenantId = requireTenantId(req, 'Learning');
    const cert = await this.certificationRepo.findById(new Uuid(id));
    if (!cert) throw new BadRequestException('Certification not found');
    if (cert.tenantId.value !== tenantId.value) throw new ForbiddenException('Tenant mismatch');
    await this.assertCanAccessCertificate(req, cert.workerId.value);

    const worker = await this.hrCoreDirectory.findWorkerById(cert.workerId);
    const recipientName = worker ? `${worker.firstName} ${worker.lastName}`.trim() : undefined;

    const legalEntities = await this.organizationDirectory.findLegalEntitiesForTenant(tenantId);
    const organization = legalEntities.find((entity) => entity.status === 'ACTIVE') ?? legalEntities[0];

    const buffer = await this.documentExport.toCertificatePdf({
      recipientName: recipientName || cert.workerId.value,
      certificationName: cert.certificationName,
      issuingBody: cert.issuingBody,
      issueDate: cert.issueDate?.toISOString(),
      expiryDate: cert.expiryDate?.toISOString(),
      credentialId: cert.credentialId,
      organizationName: organization?.name,
      statusLabel: cert.status,
    });

    res.setHeader('Content-Type', EXPORT_CONTENT_TYPES.pdf);
    res.setHeader('Content-Disposition', `attachment; filename="certificate-${cert.id.value}.pdf"`);
    res.send(buffer);
  }

  /* Learning Content Packages */
  @Post('content-packages')
  async createContentPackage(@Body(new ZodValidationPipe(CreateLearningContentPackageDtoSchema)) dto: dtos.CreateLearningContentPackageDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateLearningContentPackage', 'LearningContentPackage', dto, req));
  }

  @Post('content-packages/:id/commands/parse')
  async parseContentPackage(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.contentPackageRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Content package not found');
    return this.commandBus.execute(this.buildCommand('ParseLearningContentPackage', 'LearningContentPackage', { learningContentPackageId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('content-packages/:id/commands/validate')
  async validateContentPackage(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.contentPackageRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Content package not found');
    return this.commandBus.execute(this.buildCommand('ValidateLearningContentPackage', 'LearningContentPackage', { learningContentPackageId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('content-packages/:id/commands/publish')
  async publishContentPackage(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.contentPackageRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Content package not found');
    return this.commandBus.execute(this.buildCommand('PublishLearningContentPackage', 'LearningContentPackage', { learningContentPackageId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('content-packages/:id/commands/deprecate')
  async deprecateContentPackage(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.contentPackageRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Content package not found');
    return this.commandBus.execute(this.buildCommand('DeprecateLearningContentPackage', 'LearningContentPackage', { learningContentPackageId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('content-packages/:id')
  async getContentPackage(@Param('id') id: string) {
    return this.contentPackageRepo.findById(new Uuid(id));
  }

  @Get('content-packages/tenant/:tenantId')
  async getContentPackagesByTenant(@Param('tenantId') tenantId: string, @Req() req: Request) {
    return this.contentPackageRepo.findByTenant(this.requireMatchingTenant(req, tenantId));
  }

  /**
   * Stores an uploaded SCORM/xAPI binary via the storage adapter and attaches its
   * fileUrl/checksum/size to the aggregate. Only allowed while the package is still
   * in its initial UPLOADED intake state (before parse/validate has run against it).
   */
  @Post('content-packages/:id/upload')
  @UseInterceptors(FileInterceptor('file', { storage: multer.memoryStorage(), limits: { fileSize: MAX_LEARNING_CONTENT_UPLOAD_BYTES } }))
  async uploadContentPackageFile(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request,
  ) {
    const tenantId = requireTenantId(req, 'Learning');
    if (!file) throw new BadRequestException('A file is required (multipart field "file")');
    const ar = await this.contentPackageRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Content package not found');
    if (ar.tenantId.value !== tenantId.value) throw new ForbiddenException('Tenant mismatch');

    let saved;
    try {
      saved = await this.contentStorage.save(file.buffer, {
        tenantId: tenantId.value,
        packageId: id,
        packageType: ar.packageType,
        originalFileName: file.originalname,
        mimeType: file.mimetype,
      });
    } catch (error) {
      if (error instanceof LearningContentStorageValidationError) throw new BadRequestException(error.message);
      throw error;
    }

    return this.commandBus.execute(this.buildCommand('AttachLearningContentPackageFile', 'LearningContentPackage', {
      learningContentPackageId: new Uuid(id),
      fileUrl: saved.fileUrl,
      checksum: saved.checksum,
      sizeBytes: saved.sizeBytes,
      mimeType: saved.mimeType,
      originalFileName: saved.originalFileName,
    }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  /** Streams the stored binary for a content package back out through the storage adapter. */
  @Get('content-packages/:id/download')
  async downloadContentPackageFile(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const tenantId = requireTenantId(req, 'Learning');
    const ar = await this.contentPackageRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Content package not found');
    if (ar.tenantId.value !== tenantId.value) throw new ForbiddenException('Tenant mismatch');
    if (!ar.fileUrl) throw new BadRequestException('No file has been uploaded for this content package');

    let buffer: Buffer;
    try {
      buffer = await this.contentStorage.read(ar.fileUrl);
    } catch (error) {
      if (error instanceof LearningContentStorageValidationError) throw new BadRequestException(error.message);
      throw error;
    }

    const fileName = contentDispositionFileName(ar.originalFileName ?? `${ar.title || 'content-package'}`);
    res.setHeader('Content-Type', ar.mimeType ?? 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  }
}
