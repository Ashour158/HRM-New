import { Controller, ForbiddenException, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import { AuthGuard } from './guards/auth.guard.js';
import type { WorkerProfile } from './domains/hr-core/aggregates/worker-profile.aggregate.js';
import { PersonalDataRecordRepository } from './domains/hr-core/repositories/personal-data-record.repository.js';
import { WorkerRepository } from './domains/hr-core/repositories/worker.repository.js';

type PayloadByCategory = Record<string, Record<string, unknown>>;

type ManagerTeamWorker = {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  hireDate: string;
  status: string;
  departmentId?: string;
  departmentName?: string;
  jobTitle?: string;
  managerId?: string;
  managerName?: string;
  legalEntityId?: string;
  legalEntityName?: string;
};

type ManagerTeamMember = {
  worker: ManagerTeamWorker;
  compensationBand?: string;
};

@ApiTags('Manager Team')
@UseGuards(AuthGuard)
@Controller('manager')
export class ManagerTeamController {
  constructor(
    private readonly workerRepo: WorkerRepository,
    private readonly personalDataRepo: PersonalDataRecordRepository,
  ) {}

  @Get('team')
  async getTeam(@Req() req: Request, @Query('workerId') workerId?: string) {
    this.assertManagerActor(req);
    const tenantId = this.getTenantId(req);
    const manager = await this.resolveManagerWorker(req, tenantId);
    this.assertActiveManager(manager);

    const reports = (await this.workerRepo.findByManagerForTenant(manager.id, tenantId))
      .filter((worker) =>
        worker.tenantId.value === tenantId.value &&
        worker.managerId?.value === manager.id.value,
      );
    const teamMembers = await Promise.all(
      reports.map((worker) => this.toTeamMember(worker, tenantId, manager)),
    );
    const directReports = teamMembers.map((member) => member.worker);

    if (!workerId) {
      return { directReports };
    }

    const selected = teamMembers.find((member) => member.worker.id === workerId);
    if (!selected) {
      throw new ForbiddenException('Selected worker is not in your direct reports');
    }

    return {
      directReports,
      selectedMember: {
        ...selected.worker,
        compensationBand: selected.compensationBand,
        goals: [],
      },
    };
  }

  private assertManagerActor(req: Request): void {
    const actor = req.actor;
    if (!actor || actor.actorType !== 'USER' || !actor.roles.includes('MANAGER')) {
      throw new ForbiddenException('Manager team access requires a manager user session');
    }
  }

  private getTenantId(req: Request): Uuid {
    if (typeof req.tenantId === 'string' && Uuid.isValid(req.tenantId)) {
      return new Uuid(req.tenantId);
    }
    throw new ForbiddenException('Authenticated tenant is required');
  }

  private getActorId(req: Request): string {
    const actorId = req.actor?.actorId;
    if (actorId instanceof Uuid) return actorId.value;
    const actorIdLike = actorId as { value?: unknown } | undefined;
    if (typeof actorIdLike?.value === 'string') return actorIdLike.value;
    throw new ForbiddenException('Authenticated actor is required');
  }

  private async resolveManagerWorker(req: Request, tenantId: Uuid): Promise<WorkerProfile> {
    const actorId = this.getActorId(req);
    if (Uuid.isValid(actorId)) {
      const worker = await this.workerRepo.findByIdForTenant(new Uuid(actorId), tenantId);
      if (worker) return worker;
    }

    const email = (req.actor as { email?: string } | undefined)?.email;
    if (email) {
      const worker = await this.workerRepo.findByEmailForTenant(email, tenantId);
      if (worker) return worker;
    }

    throw new ForbiddenException('No manager employee profile is linked to the authenticated user');
  }

  private assertActiveManager(manager: WorkerProfile): void {
    if (manager.status !== 'ACTIVE' && manager.status !== 'REHIRED') {
      throw new ForbiddenException('Manager team access is available only to active workers');
    }
  }

  private async toTeamMember(
    worker: WorkerProfile,
    tenantId: Uuid,
    manager: WorkerProfile,
  ): Promise<ManagerTeamMember> {
    const payloadByCategory = await this.payloadByCategory(worker.id, tenantId);
    const basic = payloadByCategory.BASIC ?? {};
    const contact = payloadByCategory.CONTACT ?? {};
    const compensation = payloadByCategory.COMPENSATION ?? {};
    return {
      worker: {
        id: worker.id.value,
        employeeId: worker.employeeNumber,
        firstName: worker.firstName,
        lastName: worker.lastName,
        email: worker.email.toString(),
        phone: stringValue(basic.phone)
          ?? stringValue(basic.phoneNumber)
          ?? stringValue(basic.workPhoneNumber)
          ?? stringValue(contact.phone)
          ?? stringValue(contact.workPhoneNumber),
        hireDate: dateOnly(worker.hireDate) ?? '',
        status: worker.status,
        departmentId: worker.departmentId?.value,
        departmentName: stringValue(contact.departmentName),
        jobTitle: worker.jobTitle,
        managerId: worker.managerId?.value,
        managerName: stringValue(contact.managerName) ?? displayName(manager),
        legalEntityId: worker.legalEntityId?.value,
        legalEntityName: stringValue(contact.legalEntityName),
      },
      compensationBand: stringValue(compensation.compensationBand)
        ?? stringValue(compensation.band)
        ?? stringValue(compensation.payBand),
    };
  }

  private async payloadByCategory(workerId: Uuid, tenantId: Uuid): Promise<PayloadByCategory> {
    const records = await this.personalDataRepo.findByWorkerForTenant(workerId, tenantId);
    return Object.fromEntries(records.map((record) => [record.dataCategory, record.payload ?? {}])) as PayloadByCategory;
  }
}

function dateOnly(value: Date | string | undefined | null): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().slice(0, 10);
}

function displayName(worker: WorkerProfile): string {
  return `${worker.firstName} ${worker.lastName}`.trim() || worker.employeeNumber;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}
