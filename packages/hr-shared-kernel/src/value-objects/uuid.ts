/**
 * Regular expression for validating UUID format (accepts any RFC 4122 variant).
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Immutable UUID v4 value object.
 */
export class Uuid {
  /** The raw UUID string value. */
  readonly value: string;

  /**
   * Creates a new Uuid instance after validating the input.
   * @param value A UUID v4 string
   * @throws Error if the value is not a valid UUID v4
   */
  constructor(value: string) {
    if (!Uuid.isValid(value)) {
      throw new Error(`Invalid UUID v4: ${value}`);
    }
    this.value = value.toLowerCase();
  }

  /**
   * Generates a new random UUID v4.
   * @returns A new Uuid instance
   */
  static generate(): Uuid {
    const hex = '0123456789abcdef';
    let uuid = '';
    for (let i = 0; i < 36; i++) {
      if (i === 8 || i === 13 || i === 18 || i === 23) {
        uuid += '-';
      } else if (i === 14) {
        uuid += '4';
      } else if (i === 19) {
        uuid += hex[((Math.random() * 4) | 0) + 8];
      } else {
        uuid += hex[(Math.random() * 16) | 0];
      }
    }
    return new Uuid(uuid);
  }

  /**
   * Checks whether a string is a valid UUID v4.
   * @param value The string to check
   * @returns True if valid
   */
  static isValid(value: string): boolean {
    return UUID_REGEX.test(value);
  }

  /**
   * Compares two Uuid instances for equality.
   * @param other The other Uuid
   * @returns True if both UUIDs are equal
   */
  equals(other: Uuid): boolean {
    return this.value === other.value;
  }

  /**
   * Returns the string representation of the UUID.
   * @returns The UUID string
   */
  toString(): string {
    return this.value;
  }
}
