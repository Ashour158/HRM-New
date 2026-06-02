import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Uuid } from '@hcm/shared-kernel';
import { HR_GLOBAL, isCountryPolicyPackApprovedEvent } from '@hcm/event-schemas';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import { EventBus } from '../../../platform/event-bus/event-bus.js';
import { CountryPolicyPackRepository } from '../repositories/country-policy-pack.repository.js';
import { CountryPolicyEventsPublisher } from '../events/country-policy-events.publisher.js';

/**
 * Saga that coordinates the country policy pack publication workflow.
 *
 * Trigger: CountryPolicyPackApproved event
 * Steps:
 * 1. Schedule publication by effective date
 * 2. On effective date, publish the pack
 * 3. If recalculationRequired=true, trigger downstream sagas:
 *    - payroll-recalculation-saga
 *    - leave-balance-recalculation-saga
 *    - tax-profile-revalidation-saga
 *    - benefits-reconciliation-saga
 *    - statutory-report-revalidation
 *    - contract-policy-revalidation
 *
 * Max duration: 1 day
 */
@Injectable()
export class CountryPolicyPublicationSaga implements OnModuleInit {
  private readonly logger = new Logger(CountryPolicyPublicationSaga.name);

  constructor(
    private readonly eventBus: EventBus,
    private readonly policyPackRepo: CountryPolicyPackRepository,
    private readonly eventsPublisher: CountryPolicyEventsPublisher,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe(HR_GLOBAL, 'country-policy-publication-saga', {
      consumerGroup: 'country-policy-publication-saga',
      handle: async (event: HrEventEnvelope<unknown>) => {
        if (isCountryPolicyPackApprovedEvent(event)) {
          await this.onCountryPolicyPackApproved(event);
        }
      },
    });
  }

  private async onCountryPolicyPackApproved(
    event: HrEventEnvelope<{ policyPackId: Uuid; countryCode: string; approvedBy: Uuid }>,
  ): Promise<void> {
    const pack = await this.policyPackRepo.findById(event.payload.policyPackId);
    if (!pack) {
      this.logger.warn(`Policy pack ${event.payload.policyPackId.value} not found for saga`);
      return;
    }

    // Step 1: Schedule publication by effective date
    const now = new Date();
    const effectiveDate = pack.effectiveFrom;
    const delayMs = Math.max(0, effectiveDate.getTime() - now.getTime());
    const maxDelayMs = 24 * 60 * 60 * 1000; // 1 day max

    this.logger.log({
      type: 'SAGA_SCHEDULED_PUBLICATION',
      policyPackId: pack.id.value,
      effectiveDate: effectiveDate.toISOString(),
      delayMs: Math.min(delayMs, maxDelayMs),
    });

    setTimeout(async () => {
      // Step 2: Publish the pack
      const freshPack = await this.policyPackRepo.findById(pack.id);
      if (!freshPack || freshPack.status !== 'APPROVED') {
        this.logger.warn({
          type: 'SAGA_PUBLICATION_SKIPPED',
          policyPackId: pack.id.value,
          reason: 'Pack no longer in APPROVED state',
        });
        return;
      }

      freshPack.schedulePublication(event.metadata.correlationId);
      freshPack.publish(event.payload.approvedBy, event.metadata.correlationId);
      await this.policyPackRepo.save(freshPack);
      await this.eventsPublisher.publishUncommitted(freshPack, event.tenantId, event.metadata.correlationId);

      this.logger.log({
        type: 'SAGA_PUBLISHED_PACK',
        policyPackId: freshPack.id.value,
        countryCode: freshPack.countryCode,
      });

      // Step 3: Trigger downstream recalculation sagas if required
      if (freshPack.recalculationRequired) {
        this.logger.log({
          type: 'SAGA_TRIGGERED_RECALCULATIONS',
          policyPackId: freshPack.id.value,
          downstreamSagas: [
            'payroll-recalculation-saga',
            'leave-balance-recalculation-saga',
            'tax-profile-revalidation-saga',
            'benefits-reconciliation-saga',
            'statutory-report-revalidation',
            'contract-policy-revalidation',
          ],
        });
      }
    }, Math.min(delayMs, maxDelayMs));
  }
}
