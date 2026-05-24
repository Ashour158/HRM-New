import { Entity } from './entity.js';
import { DomainEvent } from './domain-event.js';

/**
 * Base class for aggregate roots.
 * Manages optimistic locking (versioning) and domain event collection.
 */
export abstract class AggregateRoot extends Entity {
  private _version = 0;
  private _domainEvents: DomainEvent[] = [];

  /** The optimistic lock version, starting at 0. */
  get version(): number {
    return this._version;
  }

  /** The list of uncommitted domain events. */
  get domainEvents(): DomainEvent[] {
    return [...this._domainEvents];
  }

  /**
   * Adds a domain event to the aggregate's event collection.
   * @param event The domain event to add
   */
  addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  /** Clears all uncommitted domain events. */
  clearDomainEvents(): void {
    this._domainEvents = [];
  }

  /**
   * Returns a shallow copy of the uncommitted domain events.
   * @returns An array of domain events
   */
  getUncommittedEvents(): DomainEvent[] {
    return [...this._domainEvents];
  }

  /** Increments the optimistic lock version. */
  incrementVersion(): void {
    this._version++;
  }

  /**
   * Restores the version when reconstructing from persistence.
   * @param version The version to set
   */
  restoreVersion(version: number): void {
    this._version = version;
  }
}
