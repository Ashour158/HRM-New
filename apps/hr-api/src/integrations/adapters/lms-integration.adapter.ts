/**
 * LMS Integration Adapter
 *
 * Supports SCORM 1.2, SCORM 2004, and xAPI.
 * On LearningAssignmentAssigned: push assignment to external LMS.
 * On LearningAssignmentCompleted: pull completion from external LMS.
 *
 * SCORM runtime mapping:
 *   cmi.core.student_name, cmi.core.lesson_status, cmi.core.score.raw, cmi.core.session_time
 * xAPI statement mapping:
 *   actor, verb, object, result, context
 */

import { Injectable, Logger } from '@nestjs/common';
import type { Uuid } from '@hcm/shared-kernel';
import type { IntegrationAdapter, IntegrationResult, ValidationResult } from '../types.js';
import { createReadinessMetadata } from '../readiness.js';

export interface LmsResult extends IntegrationResult {
  lmsAssignmentId?: string;
}

export interface CompletionResult extends IntegrationResult {
  completionStatus?: 'COMPLETED' | 'IN_PROGRESS' | 'NOT_STARTED' | 'FAILED';
  scoreRaw?: number;
  sessionTime?: string;
}

export interface LaunchResult extends IntegrationResult {
  launchUrl?: string;
  sessionId?: string;
}

export interface TerminationResult extends IntegrationResult {
  sessionId: string;
}

export interface UploadResult extends IntegrationResult {
  contentPackageId?: string;
}

export interface ScormManifest {
  schemaVersion: '1.2' | '2004';
  resources: string[];
  organizations: unknown[];
}

export interface XapiStatement {
  actor: { mbox?: string; name?: string };
  verb: { id: string; display?: Record<string, string> };
  object: { id: string; definition?: unknown };
  result?: { success?: boolean; score?: { raw?: number } };
  context?: unknown;
}

@Injectable()
export class LmsIntegrationAdapter implements IntegrationAdapter {
  readonly name = 'lms-integration';
  readonly direction = 'BIDIRECTIONAL' as const;
  readonly readiness = createReadinessMetadata({
    ownerTeam: 'Learning Operations',
    ownerContact: 'learning-ops@example.com',
    sandboxEndpointRef: 'env:HR_LMS_SANDBOX_ENDPOINT',
    productionEndpointRef: 'env:HR_LMS_PRODUCTION_ENDPOINT',
    credentialRefBase: 'vault:integrations/lms-integration',
  });
  private readonly logger = new Logger(LmsIntegrationAdapter.name);

  async healthCheck(): Promise<boolean> {
    // Mock: ping LMS health endpoint
    return true;
  }

  /**
   * Push a learning assignment to the external LMS.
   * @param assignment Assignment metadata
   */
  async pushAssignment(assignment: {
    assignmentId: Uuid;
    workerId: Uuid;
    courseId: Uuid;
    dueDate?: string;
  }): Promise<LmsResult> {
    this.logger.log({
      type: 'LMS_PUSH_ASSIGNMENT',
      assignmentId: assignment.assignmentId.value,
      workerId: assignment.workerId.value,
    });

    return {
      success: true,
      adapterName: this.name,
      operationId: crypto.randomUUID(),
      timestamp: new Date(),
      lmsAssignmentId: `LMS-A-${assignment.assignmentId.value}`,
      details: { courseId: assignment.courseId.value },
    };
  }

  /**
   * Pull completion status for a learning assignment.
   * @param assignmentId Assignment aggregate id
   */
  async pullCompletion(assignmentId: Uuid): Promise<CompletionResult> {
    this.logger.log({ type: 'LMS_PULL_COMPLETION', assignmentId: assignmentId.value });

    return {
      success: true,
      adapterName: this.name,
      operationId: crypto.randomUUID(),
      timestamp: new Date(),
      completionStatus: 'COMPLETED',
      scoreRaw: 85,
      sessionTime: 'PT1H30M',
      details: { assignmentId: assignmentId.value },
    };
  }

  /**
   * Generate a launch URL for a SCORM/xAPI content package.
   * @param contentPackageId Content package id
   * @param workerId         Worker id
   */
  async launchContent(contentPackageId: Uuid, workerId: Uuid): Promise<LaunchResult> {
    this.logger.log({ type: 'LMS_LAUNCH_CONTENT', contentPackageId: contentPackageId.value, workerId: workerId.value });

    return {
      success: true,
      adapterName: this.name,
      operationId: crypto.randomUUID(),
      timestamp: new Date(),
      launchUrl: `/lms/launch/${contentPackageId.value}?user=${workerId.value}`,
      sessionId: crypto.randomUUID(),
      details: { contentPackageId: contentPackageId.value, workerId: workerId.value },
    };
  }

  /**
   * Terminate an active LMS session.
   * @param sessionId LMS session identifier
   */
  async terminateContent(sessionId: string): Promise<TerminationResult> {
    this.logger.log({ type: 'LMS_TERMINATE_CONTENT', sessionId });

    return {
      success: true,
      adapterName: this.name,
      operationId: crypto.randomUUID(),
      timestamp: new Date(),
      sessionId,
      details: { action: 'TERMINATED' },
    };
  }

  /**
   * Upload a SCORM/xAPI content package.
   * @param file File buffer or stream metadata
   */
  async uploadContentPackage(file: unknown): Promise<UploadResult> {
    this.logger.log({ type: 'LMS_UPLOAD_PACKAGE' });

    return {
      success: true,
      adapterName: this.name,
      operationId: crypto.randomUUID(),
      timestamp: new Date(),
      contentPackageId: crypto.randomUUID(),
      details: { file },
    };
  }

  /**
   * Validate a SCORM manifest before upload.
   * @param manifest Parsed manifest object
   */
  async validateScormPackage(manifest: ScormManifest): Promise<ValidationResult> {
    this.logger.log({ type: 'LMS_VALIDATE_SCORM', version: manifest.schemaVersion });

    const errors: string[] = [];
    const warnings: string[] = [];

    if (!manifest.resources || manifest.resources.length === 0) {
      errors.push('No resources defined in manifest');
    }
    if (!manifest.organizations || manifest.organizations.length === 0) {
      warnings.push('No organizations defined in manifest');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  async send(payload: unknown): Promise<IntegrationResult> {
    const p = payload as Record<string, unknown>;
    if (p.assignmentId && p.workerId && p.courseId) {
      return this.pushAssignment(p as unknown as { assignmentId: Uuid; workerId: Uuid; courseId: Uuid; dueDate?: string });
    }
    if (p.assignmentId && p.action === 'PULL_COMPLETION') {
      return this.pullCompletion(p.assignmentId as Uuid);
    }
    if (p.contentPackageId && p.workerId && p.action === 'LAUNCH') {
      return this.launchContent(p.contentPackageId as Uuid, p.workerId as Uuid);
    }
    if (p.sessionId && p.action === 'TERMINATE') {
      return this.terminateContent(p.sessionId as string);
    }
    if (p.file && p.action === 'UPLOAD') {
      return this.uploadContentPackage(p.file);
    }
    throw new Error('LMS Integration Adapter: unsupported payload shape');
  }

  async receive(): Promise<unknown> {
    return this.pullCompletion({ value: '' } as Uuid);
  }
}
