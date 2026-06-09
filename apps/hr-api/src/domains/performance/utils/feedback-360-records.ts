export function parseJsonRecord<T extends number | string>(
  value: unknown,
  valueType: 'number' | 'string',
): Record<string, T> | undefined {
  if (!value) return undefined;

  const isExpectedRecord = (candidate: unknown): candidate is Record<string, T> => {
    if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) return false;
    return Object.values(candidate).every((entry) => typeof entry === valueType);
  };

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return isExpectedRecord(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }

  return isExpectedRecord(value) ? value : undefined;
}
