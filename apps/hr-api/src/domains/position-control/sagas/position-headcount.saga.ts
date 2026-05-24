import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Uuid } from '@hcm/shared-kernel';
import { isHeadcountRequestApprovedEvent, isWorkerTerminatedEvent } from '@hcm/event-schemas';
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
    this.eventBus.subscribe('hrm.headcount.events', 'position-control-saga', {
      consumerGroup: 'position-control-saga',
      handle: async (event: HrEventEnvelope<unknown>) => {
        if (isHeadcountRequestApprovedEvent(event)) {
          await this.onHeadcountRequestApproved(event);
        }
      },
    });

    this.eventBus.subscribe('hrm.worker.events', 'position-control-saga', {
      consumerGroup: 'position-control-saga',
      handle: async (event: HrEventEnvelope<unknown>) => {
        if (isWorkerTerminatedEvent(event)) {
          await this.onWorkerTerminated(event);
        }
      },
    });
  }

  private async onHeadcountRequestApproved(event: HrEventEnvelope<{ headcountRequestId: Uuid; approvedBy: Uuid; approvedPositionId?: Uuid }>): Promise<void> {
    const request = await this.headcountRepo.findById(event.payload.headcountRequestId);
    if (!request) {
      this.logger.warn(`Headcount request ${event.payload.headcountRequestId.value} not found for saga`);
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

  private async onWorkerTerminated(event: HrEventEnvelope<{ workerId: Uuid }>): Promise<void> {
    const position = await this.positionRepo.findByFilledWorkerId(event.payload.workerId);
    if (!position) {
      return;
    }

    position.vacate(event.metadata.correlationId);
    await this.positionRepo.save(position);
    await this.eventsPublisher.publishUncommitted(position, position.tenantId, event.metadata.correlationId);

    this.logger.log({
      type: 'SAGA_VACATED_POSITION',
      positionId: position.id.value,
      workerId: event.payload.workerId.value,
    });
  }
}
