/**
 * Base class for all value objects.
 * Value objects are identified by their structural equality.
 */
export abstract class ValueObject {
  /**
   * Compares this value object with another for structural equality.
   * @param other The other value object to compare
   * @returns True if both objects are structurally equal
   */
  abstract equals(other: ValueObject): boolean;

  /**
   * Returns a string representation of the value object.
   * @returns The string representation
   */
  abstract toString(): string;
}
