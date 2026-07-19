/**
 * Shared, recursive redaction denylist for anything written to the audit
 * ledger or an HTTP audit-interceptor record. Covers identity/auth secrets,
 * HIGH_SENSITIVITY financial fields, and SPECIAL_CATEGORY free-text fields --
 * a single source of truth so the audit-log and HTTP-interceptor paths can't
 * drift out of sync with each other.
 */
const SENSITIVE_KEYS = new Set([
  // Identity
  'ssn',
  'nationalId',
  'sin',
  'passportNumber',
  'biometric',
  // Auth secrets
  'password',
  'currentPassword',
  'newPassword',
  'oldPassword',
  'confirmPassword',
  'passwordHash',
  'token',
  'accessToken',
  'idToken',
  'authToken',
  'sessionToken',
  'refreshToken',
  // Financial (HIGH_SENSITIVITY)
  'bankAccount',
  'accountNumber',
  'iban',
  'routingNumber',
  'swiftCode',
  'salaryAmount',
  'grossSalaryAmount',
  'netSalaryAmount',
  // SPECIAL_CATEGORY free text
  'medicalDocumentation',
  'notes',
  'findings',
  'description',
]);

export function redactSensitiveFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redactSensitiveFields(entry));
  }
  if (typeof value !== 'object' || value === null) {
    return value;
  }
  const clone: Record<string, unknown> = {};
  for (const [key, entryValue] of Object.entries(value as Record<string, unknown>)) {
    clone[key] = SENSITIVE_KEYS.has(key) ? '***REDACTED***' : redactSensitiveFields(entryValue);
  }
  return clone;
}
