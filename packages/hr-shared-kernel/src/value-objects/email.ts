import { ValueObject } from '../domain/value-object.js';

/**
 * Regular expression for validating email addresses.
 */
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * Immutable Email value object.
 */
export class Email extends ValueObject {
  /** The local part of the email (before @). */
  readonly localPart: string;
  /** The domain part of the email (after @). */
  readonly domain: string;

  /**
   * Creates a new Email instance after validating the input.
   * @param value A valid email address string
   * @throws Error if the value is not a valid email
   */
  constructor(value: string) {
    super();
    if (!Email.isValid(value)) {
      throw new Error(`Invalid email: ${value}`);
    }
    const [local, domain] = value.split('@');
    this.localPart = local;
    this.domain = domain;
  }

  /**
   * Checks whether a string is a valid email address.
   * @param value The string to check
   * @returns True if valid
   */
  static isValid(value: string): boolean {
    return EMAIL_REGEX.test(value);
  }

  /**
   * Compares two Email instances for equality.
   * @param other The other Email
   * @returns True if both emails are equal (case-sensitive local part, case-insensitive domain)
   */
  equals(other: Email): boolean {
    return (
      this.localPart === other.localPart &&
      this.domain.toLowerCase() === other.domain.toLowerCase()
    );
  }

  /**
   * Returns the full email address string.
   * @returns The email address
   */
  toString(): string {
    return `${this.localPart}@${this.domain}`;
  }
}
