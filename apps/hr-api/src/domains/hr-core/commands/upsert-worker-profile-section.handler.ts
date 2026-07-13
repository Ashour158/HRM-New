import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandResult, HrCommandEnvelope } from '@hcm/command-contracts';
import { NotFoundError, Uuid, ValidationError } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { WorkerRepository } from '../repositories/worker.repository.js';
import { PersonalDataRecordRepository } from '../repositories/personal-data-record.repository.js';
import { PersonalDataRecord, type DataCategory } from '../aggregates/personal-data-record.aggregate.js';
import { HcmSetupService } from '../../hcm-setup/hcm-setup.service.js';
import { filterAllowedCustomFieldValues, validateCustomFieldSection } from '../custom-field-values.js';

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

function toUuid(value: Uuid | string): Uuid {
  return value instanceof Uuid ? value : new Uuid(value);
}

interface UpsertWorkerProfileSectionPayload {
  workerId: Uuid | string;
  dataCategory: string;
  fields: Record<string, unknown>;
}

@CommandHandler('UpsertWorkerProfileSection')
@Injectable()
export class UpsertWorkerProfileSectionHandler {
  constructor(
    private readonly workerRepo: WorkerRepository,
    private readonly personalDataRepo: PersonalDataRecordRepository,
    private readonly fsm: FsmFramework,
    private readonly hcmSetup: HcmSetupService,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as UpsertWorkerProfileSectionPayload;
    const workerId = toUuid(payload.workerId as Uuid | string);
    const dataCategory = String(payload.dataCategory).toUpperCase() as DataCategory;
    if (!UPSERTABLE_CATEGORIES.has(dataCategory)) {
      throw new ValidationError(`Unsupported profile section category ${payload.dataCategory}`);
    }

    const worker = await this.workerRepo.findByIdForTenant(workerId, command.tenantId);
    if (!worker) throw new NotFoundError('Worker not found');

    let record = await this.personalDataRepo.findByWorkerAndCategoryForTenant(worker.id, command.tenantId, dataCategory);

    let fields = payload.fields;
    if (dataCategory === 'CUSTOM') {
      const setup = await this.hcmSetup.getSetup(command.tenantId);
      fields = filterAllowedCustomFieldValues(payload.fields, setup);
      const merged = { ...(record?.payload ?? {}), ...fields };
      validateCustomFieldSection(setup, merged, new Set(Object.keys(fields)));
    }

    if (record) {
      record.update(fields, command.correlationId);
    } else {
      record = PersonalDataRecord.create(
        {
          id: Uuid.generate(),
          tenantId: command.tenantId,
          workerId: worker.id,
          dataCategory,
          dataClassification: this.classifyDataCategory(dataCategory),
          payload: fields,
          consentStatus: 'GRANTED',
          state: 'DRAFT',
        },
        command.correlationId,
      );
      record.activate(command.correlationId);
    }

    const eventsEmitted = record.domainEvents.map((event) => event.eventName);
    await this.personalDataRepo.save(record);

    return {
      success: true,
      data: {
        workerId: worker.id.value,
        recordId: record.id.value,
        dataCategory: record.dataCategory,
        state: record.state,
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
