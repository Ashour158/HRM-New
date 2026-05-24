import { Uuid } from '../value-objects/uuid.js';

/**
 * Base class for all domain entities.
 * Entities are identified by their identity (Uuid), not by their attributes.
 */
export abstract class Entity {
  /** The unique identifier of the entity. */
  readonly id: Uuid;

  /**
   * @param id The unique identifier
   */
  constructor(id: Uuid) {
    this.id = id;
  }

  /**
   * Compares two entities for identity equality.
   * @param other The other entity
   * @returns True if both entities are of the same type and have the same id
   */
  equals(other: Entity): boolean {
    if (this.constructor !== other.constructor) {
      return false;
    }
    return this.id.equals(other.id);
  }

  /**
   * Returns a string representation of the entity.
   * @returns A string including the constructor name and id
   */
  toString(): string {
    return `${this.constructor.name}(${this.id.toString()})`;
  }
}
