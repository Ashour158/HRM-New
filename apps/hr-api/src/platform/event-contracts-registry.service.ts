import { Injectable } from '@nestjs/common';
import { getEventContractRegistry, type EventContractRegistrySnapshot } from '@hcm/event-schemas';

@Injectable()
export class EventContractsRegistryService {
  getRegistry(): EventContractRegistrySnapshot {
    return getEventContractRegistry();
  }
}
