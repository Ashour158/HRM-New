import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Uuid } from '@hcm/shared-kernel';
import { HR_CORE } from '@hcm/event-schemas';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import { EventBus } from '../../../platform/event-bus/event-bus.js';
import { HeadcountRequestRepository } from '../repositories/headcount-request.repository.js';
import { PositionRepository } from '../repositories/position.repository.js';
import { Position } from '../aggregates/position.aggregate.js';
import { PositionEventsPublisher } from '../events/position-events.publisher.js';

/**
 * Saga that coordinates cross-aggregate workflows between Position
 * and HeadcountRequest domains.
 *
 * - On HeadcountRequestApproved: auto-creates Position(s) if enabled.
 * - On WorkerTerminated: vacates the position filled by that worker.
 */
@Injectable()
export class PositionHeadcountSaga implements OnModuleInit {
  private readonly logger = new Logger(PositionHeadcountSaga.name);

  constructor(
    private readonly eventBus: EventBus,
    private readonly headcountRepo: HeadcountRequestRepository,
    private readonly positionRepo: PositionRepository,
    private readonly eventsPublisher: PositionEventsPublisher,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe(HR_CORE, 'position-control-saga', {
      consumerGroup: 'position-control-saga',
      handle: async (event: HrEventEnvelope<unknown>) => {
        if (event.eventName === 'HeadcountRequestApproved') {
          await this.onHeadcountRequestApproved(event);
        }
      },
    });

    this.eventBus.subscribe(HR_CORE, 'position-control-saga', {
      consumerGroup: 'position-control-saga',
      handle: async (event: HrEventEnvelope<unknown>) => {
        if (event.eventName === 'WorkerTerminated') {
          await this.onWorkerTerminated(event);
        }
      },
    });
  }

  private async onHeadcountRequestApproved(event: HrEventEnvelope<unknown>): Promise<void> {
    const headcountRequestId = this.payloadUuid(event.payload, 'headcountRequestId') ?? event.aggregateId;
    const request = await this.headcountRepo.findById(headcountRequestId);
    if (!request) {
      this.logger.warn(`Headcount request ${headcountRequestId.value} not found for saga`);
      return;
    }

    if (!request.autoCreatePosition || !request.positionsApproved) {
      return;
    }

    for (let i = 0; i < request.positionsApproved; i++) {
      const position = Position.create({
        id: Uuid.generate(),
        tenantId: request.tenantId,
        positionCode: `${request.requestNumber}-${String(i + 1).padStart(3, '0')}`,
        title: `Position from ${request.requestNumber}`,
        departmentId: request.departmentId,
        legalEntityId: request.legalEntityId,
        employmentType: 'FULL_TIME',
        headcountRequestId: request.id,
      });

      await this.positionRepo.save(position);
      await this.eventsPublisher.publishUncommitted(position, request.tenantId, event.metadata.correlationId);
    }

    this.logger.log({
      type: 'SAGA_AUTO_CREATED_POSITIONS',
      headcountRequestId: request.id.value,
      count: request.positionsApproved,
    });
  }

  private async onWorkerTerminated(event: HrEventEnvelope<unknown>): Promise<void> {
    const workerId = this.payloadUuid(event.payload, 'workerId') ?? event.aggregateId;
    const position = await this.positionRepo.findByFilledWorkerId(workerId);
    if (!position) {
      return;
    }

    position.vacate(event.metadata.correlationId);
    await this.positionRepo.save(position);
    await this.eventsPublisher.publishUncommitted(position, position.tenantId, event.metadata.correlationId);

    this.logger.log({
      type: 'SAGA_VACATED_POSITION',
      positionId: position.id.value,
      workerId: workerId.value,
    });
  }

  private payloadUuid(payload: unknown, key: string): Uuid | undefined {
    if (typeof payload !== 'object' || payload === null) return undefined;
    const value = (payload as Record<string, unknown>)[key];
    if (value instanceof Uuid) return value;
    if (typeof value === 'string' && Uuid.isValid(value)) return new Uuid(value);
    if (typeof value === 'object' && value !== null && 'value' in value) {
      const raw = (value as { value?: unknown }).value;
      return typeof raw === 'string' && Uuid.isValid(raw) ? new Uuid(raw) : undefined;
    }
    return undefined;
  }
}
