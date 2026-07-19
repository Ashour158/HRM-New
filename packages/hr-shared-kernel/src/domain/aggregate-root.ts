import { Entity } from './entity.js';
import { DomainEvent } from './domain-event.js';

/**
 * Base class for aggregate roots.
 * Manages optimistic locking (versioning) and domain event collection.
 */
export abstract class AggregateRoot extends Entity {
  private _version = 0;
  private _loadedVersion = 0;
  private _domainEvents: DomainEvent[] = [];

  /** The optimistic lock version, starting at 0. */
  get version(): number {
    return this._version;
  }

  /**
   * The version this aggregate was loaded from persistence at, before any
   * in-memory transitions ran. Repositories use this (not `version`, which
   * reflects in-memory increments) as the compare-and-swap guard on save, so
   * two concurrent loads of the same version can't silently overwrite one
   * another.
   */
  get loadedVersion(): number {
    return this._loadedVersion;
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
    this._loadedVersion = version;
  }

  /**
   * Marks the current in-memory `version` as durably persisted. Call after a
   * successful save so a subsequent transition + save on the same in-memory
   * instance is guarded against the version it just wrote, not the stale
   * version it was originally loaded at.
   */
  markPersisted(): void {
    this._loadedVersion = this._version;
  }
}
