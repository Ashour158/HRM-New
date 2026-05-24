/**
 * Creates a type-safe enum-like object from an array of string values.
 * @template T The union of string literal values
 * @param values The array of enum values
 * @returns An object where each key maps to itself
 */
export function createEnum<T extends string>(values: T[]): { [K in T]: K } {
  const obj = {} as { [K in T]: K };
  for (const value of values) {
    obj[value] = value;
  }
  return obj;
}

/**
 * Extracts the values from an enum object.
 * @template T The type of the enum values
 * @param enumObj The enum object
 * @returns An array of enum values
 */
export function enumValues<T>(enumObj: object): T[] {
  return Object.values(enumObj) as T[];
}

/**
 * Extracts the keys from an enum object.
 * @param enumObj The enum object
 * @returns An array of enum keys
 */
export function enumKeys(enumObj: object): string[] {
  return Object.keys(enumObj);
}
