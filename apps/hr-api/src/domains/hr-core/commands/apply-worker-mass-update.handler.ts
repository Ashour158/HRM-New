import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandResult, HrCommandEnvelope } from '@hcm/command-contracts';
import { Email, NotFoundError, Uuid, ValidationError } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { WorkerRepository } from '../repositories/worker.repository.js';
import { PersonalDataRecordRepository } from '../repositories/personal-data-record.repository.js';
import { PersonalDataRecord, type DataCategory } from '../aggregates/personal-data-record.aggregate.js';

const UPSERTABLE_CATEGORIES = new Set<DataCategory>([
  'BASIC',
  'CONTACT',
  'BANKING',
  'TAX',
  'MEDICAL',
  'EMERGENCY_CONTACT',
  'DEPENDENT',
  'BACKGROUND',
  'COMPENSATION',
  'DOCUMENT',
  'WORK_AUTHORIZATION',
  'ASSET_ACCESS',
  'SKILLS',
  'CONSENT',
  'CUSTOM',
]);

function toUuid(value: Uuid | string | null | undefined): Uuid | null | undefined {
  if (value === null || value === undefined) return value;
  return value instanceof Uuid ? value : new Uuid(value);
}

interface ApplyWorkerMassUpdatePayload {
  workerId: Uuid | string;
  personalData?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phoneNumber?: string;
  };
  profileSections?: Array<{
    dataCategory: string;
    fields: Record<string, unknown>;
  }>;
  organizationAssignment?: {
    legalEntityId?: Uuid | string | null;
    departmentId?: Uuid | string | null;
    managerId?: Uuid | string | null;
    jobTitle?: string | null;
  };
  updatedFields?: string[];
}

@CommandHandler('ApplyWorkerMassUpdate')
@Injectable()
export class ApplyWorkerMassUpdateHandler {
  constructor(
    private readonly workerRepo: WorkerRepository,
    private readonly personalDataRepo: PersonalDataRecordRepository,
    private readonly fsm: FsmFramework,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as ApplyWorkerMassUpdatePayload;
    const workerId = toUuid(payload.workerId);
    if (!workerId) throw new ValidationError('Worker ID is required for mass update');

    const worker = await this.workerRepo.findByIdForTenant(workerId, command.tenantId);
    if (!worker) throw new NotFoundError('Worker not found');

    let workerChanged = false;
    const personalData = payload.personalData ?? {};
    if (
      personalData.firstName !== undefined ||
      personalData.lastName !== undefined ||
      personalData.email !== undefined
    ) {
      worker.updatePersonalData(
        {
          firstName: personalData.firstName,
          lastName: personalData.lastName,
          email: personalData.email ? new Email(personalData.email) : undefined,
        },
        command.correlationId,
      );
      workerChanged = true;
    }

    const organizationAssignment = payload.organizationAssignment;
    if (organizationAssignment && Object.keys(organizationAssignment).length > 0) {
      worker.updateJobInfo(
        {
          legalEntityId: toUuid(organizationAssignment.legalEntityId),
          departmentId: toUuid(organizationAssignment.departmentId),
          managerId: toUuid(organizationAssignment.managerId),
          jobTitle: organizationAssignment.jobTitle,
        },
        command.correlationId,
      );
      workerChanged = true;
    }

    if (workerChanged) {
      await this.workerRepo.save(worker);
    }

    const eventsEmitted = worker.domainEvents.map((event) => event.eventName);
    for (const section of payload.profileSections ?? []) {
      const dataCategory = String(section.dataCategory).toUpperCase() as DataCategory;
      if (!UPSERTABLE_CATEGORIES.has(dataCategory)) {
        throw new ValidationError(`Unsupported profile section category ${section.dataCategory}`);
      }
      if (!section.fields || Object.keys(section.fields).length === 0) continue;

      let record = await this.personalDataRepo.findByWorkerAndCategoryForTenant(worker.id, command.tenantId, dataCategory);
      if (record) {
        record.update(section.fields, command.correlationId);
      } else {
        record = PersonalDataRecord.create(
          {
            id: Uuid.generate(),
            tenantId: command.tenantId,
            workerId: worker.id,
            dataCategory,
            dataClassification: this.classifyDataCategory(dataCategory),
            payload: section.fields,
            consentStatus: 'GRANTED',
            state: 'DRAFT',
          },
          command.correlationId,
        );
        record.activate(command.correlationId);
      }

      eventsEmitted.push(...record.domainEvents.map((event) => event.eventName));
      await this.personalDataRepo.save(record);
    }

    return {
      success: true,
      data: {
        workerId: worker.id.value,
        updatedFields: payload.updatedFields ?? [],
      },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: worker.id,
      newState: worker.status,
      newVersion: worker.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(worker.status, 'WorkerProfile'),
      fieldAccessDecisions: {},
      eventsEmitted,
      auditRecordId: command.commandId,
    };
  }

  private classifyDataCategory(dataCategory: DataCategory): 'LOW' | 'CONFIDENTIAL' | 'HIGH_SENSITIVITY' | 'SPECIAL_CATEGORY' | 'LEGAL_HOLD' {
    if (dataCategory === 'CONSENT') return 'LEGAL_HOLD';
    if (['BACKGROUND', 'COMPENSATION', 'DOCUMENT', 'TAX', 'BANKING', 'DEPENDENT', 'MEDICAL'].includes(dataCategory)) {
      return 'HIGH_SENSITIVITY';
    }
    return 'CONFIDENTIAL';
  }
}
