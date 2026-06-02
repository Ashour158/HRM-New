import { Injectable } from '@nestjs/common';
import { FieldAccessDecision, FieldPolicyEngine, type AbacContext } from '@hcm/access-control';
import { NotFoundError } from '@hcm/shared-kernel';
import type { Uuid } from '@hcm/shared-kernel';
import { WorkerRepository } from '../repositories/worker.repository.js';
import { JobAssignmentRepository } from '../repositories/job-assignment.repository.js';
import { EmploymentRelationshipRepository } from '../repositories/employment-relationship.repository.js';

/**
 * Flat read model for API responses combining WorkerProfile,
 * active JobAssignment and active EmploymentRelationship.
 */
export interface WorkerView {
  id: string;
  tenantId: string;
  employeeNumber: string;
  status: string;
  firstName: string;
  lastName: string;
  email: string;
  hireDate: Date;
  terminationDate?: Date;
  legalEntityId?: string;
  departmentId?: string;
  managerId?: string;
  jobTitle?: string;
  employmentType: string;
  activeAssignment?: { id: string; positionId?: string; jobTitle?: string };
  activeRelationship?: { id: string; relationshipType: string };
}

/**
 * Builds {@link WorkerView} projections and applies field-level access policies.
 */
@Injectable()
export class WorkerViewProjectionBuilder {
  private readonly fieldPolicy = new FieldPolicyEngine();

  constructor(
    private readonly workerRepo: WorkerRepository,
    private readonly jobAssignmentRepo: JobAssignmentRepository,
    private readonly employmentRelationshipRepo: EmploymentRelationshipRepository,
  ) {}

  /**
   * Assemble a {@link WorkerView} for the given worker.
   * @param workerId The worker UUID.
   * @param actorRoles Roles of the requesting actor.
   * @param abacContext ABAC context for field-level decisions.
   * @returns The assembled view with policies applied.
   */
  async buildView(
    workerId: Uuid,
    actorRoles: string[],
    abacContext: AbacContext,
  ): Promise<WorkerView> {
    const worker = await this.workerRepo.findById(workerId);
    if (!worker) {
      throw new NotFoundError('Worker not found');
    }

    const assignment = await this.jobAssignmentRepo.findActiveForWorkerForTenant(workerId, worker.tenantId);
    const relationships = await this.employmentRelationshipRepo.findByWorkerForTenant(workerId, worker.tenantId);
    const relationship = relationships.find((r) => r.state !== 'ENDED');

    const view: WorkerView = {
      id: worker.id.value,
      tenantId: worker.tenantId.value,
      employeeNumber: worker.employeeNumber,
      status: worker.status,
      firstName: worker.firstName,
      lastName: worker.lastName,
      email: worker.email.toString(),
      hireDate: worker.hireDate,
      terminationDate: worker.terminationDate,
      legalEntityId: worker.legalEntityId?.value,
      departmentId: worker.departmentId?.value,
      managerId: worker.managerId?.value,
      jobTitle: worker.jobTitle,
      employmentType: worker.employmentType,
      activeAssignment: assignment
        ? { id: assignment.id.value, positionId: assignment.positionId?.value, jobTitle: assignment.jobTitle }
        : undefined,
      activeRelationship: relationship
        ? { id: relationship.id.value, relationshipType: relationship.relationshipType }
        : undefined,
    };

    return this.applyFieldPolicy(view, actorRoles, abacContext);
  }

  private applyFieldPolicy(
    view: WorkerView,
    actorRoles: string[],
    abacContext: AbacContext,
  ): WorkerView {
    const result = { ...view };
    const nameDecision = this.fieldPolicy.evaluateFieldAccess(
      'worker.name',
      actorRoles,
      abacContext,
      'LOW',
    );
    if (nameDecision.decision === FieldAccessDecision.HIDDEN) {
      result.firstName = '***';
      result.lastName = '***';
    }
    return result;
  }
}
