import { ValueObject } from '../domain/value-object.js';

/**
 * Immutable DateRange value object representing a closed interval [start, end].
 */
export class DateRange extends ValueObject {
  /** The start date (inclusive). */
  readonly start: Date;
  /** The end date (inclusive). */
  readonly end: Date;

  /**
   * @param start The start date
   * @param end The end date
   * @throws Error if start is after end
   */
  constructor(start: Date, end: Date) {
    super();
    this.start = new Date(start.getTime());
    this.end = new Date(end.getTime());
    if (!this.isValid()) {
      throw new Error('Invalid date range: start must be <= end');
    }
  }

  /**
   * Checks whether this date range overlaps with another.
   * @param other The other date range
   * @returns True if the ranges overlap
   */
  overlaps(other: DateRange): boolean {
    return this.start < other.end && this.end > other.start;
  }

  /**
   * Checks whether this date range contains a specific date.
   * @param date The date to check
   * @returns True if the date is within the range (inclusive)
   */
  contains(date: Date): boolean {
    return this.start <= date && date <= this.end;
  }

  /**
   * Calculates the duration of the range in milliseconds.
   * @returns Duration in milliseconds
   */
  durationMs(): number {
    return this.end.getTime() - this.start.getTime();
  }

  /**
   * Validates that start is less than or equal to end.
   * @returns True if valid
   */
  isValid(): boolean {
    return this.start.getTime() <= this.end.getTime();
  }

  /**
   * Compares two DateRange instances for equality.
   * @param other The other DateRange
   * @returns True if both start and end timestamps are equal
   */
  equals(other: DateRange): boolean {
    return (
      this.start.getTime() === other.start.getTime() &&
      this.end.getTime() === other.end.getTime()
    );
  }

  /**
   * Returns an ISO string representation of the range.
   * @returns A string such as "2024-01-01T00:00:00.000Z - 2024-12-31T23:59:59.999Z"
   */
  toString(): string {
    return `${this.start.toISOString()} - ${this.end.toISOString()}`;
  }
}
