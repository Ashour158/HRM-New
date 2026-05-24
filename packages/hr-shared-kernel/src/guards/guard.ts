import { Uuid } from '../value-objects/uuid.js';
import { Email } from '../value-objects/email.js';

/**
 * Guard clauses for defensive programming.
 * Each method throws an Error if its precondition is violated.
 */
export class Guard {
  /**
   * Throws if the value is null or undefined.
   * @template T The expected type
   * @param value The value to check
   * @param argumentName The name of the argument for the error message
   */
  static againstNullOrUndefined<T>(
    value: T | null | undefined,
    argumentName: string
  ): asserts value is T {
    if (value === null || value === undefined) {
      throw new Error(`${argumentName} is null or undefined`);
    }
  }

  /**
   * Throws if the value is an empty or whitespace-only string.
   * @param value The string to check
   * @param argumentName The name of the argument for the error message
   */
  static againstEmptyString(value: string, argumentName: string): void {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`${argumentName} is empty`);
    }
  }

  /**
   * Throws if the value is not a valid UUID v4.
   * @param value The string to check
   * @param argumentName The name of the argument for the error message
   */
  static againstInvalidUuid(value: string, argumentName: string): void {
    if (!Uuid.isValid(value)) {
      throw new Error(`${argumentName} is not a valid UUID`);
    }
  }

  /**
   * Throws if the value is a negative number.
   * @param value The number to check
   * @param argumentName The name of the argument for the error message
   */
  static againstNegativeNumber(value: number, argumentName: string): void {
    if (typeof value !== 'number' || value < 0) {
      throw new Error(`${argumentName} is negative`);
    }
  }

  /**
   * Throws if the date is in the future.
   * @param value The date to check
   * @param argumentName The name of the argument for the error message
   */
  static againstFutureDate(value: Date, argumentName: string): void {
    if (!(value instanceof Date) || value.getTime() > Date.now()) {
      throw new Error(`${argumentName} is in the future`);
    }
  }

  /**
   * Throws if the value is not a valid email address.
   * @param value The string to check
   * @param argumentName The name of the argument for the error message
   */
  static againstInvalidEmail(value: string, argumentName: string): void {
    if (!Email.isValid(value)) {
      throw new Error(`${argumentName} is not a valid email`);
    }
  }

  /**
   * Throws if the value is not one of the allowed enum values.
   * @template T The type of the enum values
   * @param value The string to check
   * @param validValues The array of valid values
   * @param argumentName The name of the argument for the error message
   */
  static againstInvalidEnum<T extends string>(
    value: string,
    validValues: readonly T[],
    argumentName: string
  ): asserts value is T {
    if (!validValues.includes(value as T)) {
      throw new Error(
        `${argumentName} must be one of [${validValues.join(', ')}], got: ${value}`
      );
    }
  }
}
