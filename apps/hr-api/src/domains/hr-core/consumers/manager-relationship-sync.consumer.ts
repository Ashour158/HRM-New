import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HR_GLOBAL, type HrEventEnvelope } from '@hcm/event-schemas';
import { Uuid } from '@hcm/shared-kernel';
import { EventBus } from '../../../platform/event-bus/event-bus.js';
import { InboxConsumer } from '../../../platform/outbox-inbox/inbox-consumer.js';
import { WorkerRepository } from '../repositories/worker.repository.js';

/**
 * Manager Relationship Sync Consumer
 *
 * The `organization` domain owns manager reporting lines via the
 * `ManagerRelationship` aggregate (see `assign-manager.handler.ts` /
 * `end-manager-relationship.handler.ts`). `WorkerProfile.managerId` in
 * `hr-core` is a denormalized copy of "who is this worker's manager" that a
 * wide range of consumers read directly (absence/leave approval routing,
 * performance review peer/manager detection, time & attendance manager
 * scoping, "my team" listings, IAM/notification recipient resolution).
 *
 * `PATCH /organization/worker-assignments/:workerId` keeps both in sync via
 * a synchronous, same-request saga in the controller. `POST
 * /organization/manager-relationships` (and any other future caller of
 * `AssignManager` / `EndManagerRelationship`) does NOT — it only mutates
 * `ManagerRelationship`, which leaves `WorkerProfile.managerId` stale.
 *
 * This consumer closes that gap generically: it listens for
 * `ManagerRelationshipCreated` / `ManagerRelationshipActivated` (forward
 * sync) and `ManagerRelationshipEnded` (clears the field, but only if it
 * still points at the manager that relationship represented, so it never
 * clobbers a newer assignment that raced ahead of the old relationship's
 * end event).
 *
 * Consumer group: hr-core-manager-relationship-sync
 */
@Injectable()
export class ManagerRelationshipSyncConsumer implements OnModuleInit {
  private readonly logger = new Logger(ManagerRelationshipSyncConsumer.name);
  private readonly consumerName = 'hr-core-manager-relationship-sync';
  private readonly consumerVersion = '1';

  constructor(
    private readonly eventBus: EventBus,
    private readonly inboxConsumer: InboxConsumer,
    private readonly workerRepo: WorkerRepository,
  ) {}

  onModuleInit(): void {
    this.inboxConsumer.registerReplayHandler(this.consumerName, this.consumerVersion, {
      handle: async (event) => this.handle(event),
    });
    this.eventBus.subscribe(HR_GLOBAL, this.consumerName, {
      consumerGroup: this.consumerName,
      handle: async (event: HrEventEnvelope<unknown>) => {
        await this.inboxConsumer.consume(event, this.consumerName, this.consumerVersion, {
          handle: async () => this.handle(event),
        });
      },
    });
  }

  private async handle(event: HrEventEnvelope<unknown>): Promise<void> {
    if (
      event.eventName !== 'ManagerRelationshipCreated' &&
      event.eventName !== 'ManagerRelationshipActivated' &&
      event.eventName !== 'ManagerRelationshipEnded'
    ) {
      return;
    }

    const payload = event.payload as { workerId?: string; managerId?: string } | undefined;
    const workerId = payload?.workerId;
    if (!workerId) {
      this.logger.debug({ type: 'MANAGER_SYNC_SKIPPED_NO_WORKER_ID', eventName: event.eventName });
      return;
    }

    const worker = await this.workerRepo.findByIdForTenant(new Uuid(workerId), event.tenantId);
    if (!worker) {
      this.logger.debug({ type: 'MANAGER_SYNC_WORKER_NOT_FOUND', workerId, eventName: event.eventName });
      return;
    }

    if (event.eventName === 'ManagerRelationshipEnded') {
      if (payload?.managerId && worker.managerId?.value === payload.managerId) {
        worker.updateJobInfo({ managerId: null }, event.metadata.correlationId);
        await this.workerRepo.save(worker);
        this.logger.log({ type: 'MANAGER_SYNC_CLEARED', workerId, previousManagerId: payload.managerId });
      }
      return;
    }

    if (payload?.managerId && worker.managerId?.value !== payload.managerId) {
      worker.updateJobInfo({ managerId: new Uuid(payload.managerId) }, event.metadata.correlationId);
      await this.workerRepo.save(worker);
      this.logger.log({ type: 'MANAGER_SYNC_APPLIED', workerId, managerId: payload.managerId });
    }
  }
}
