/**
 * Abstract base class for all domain errors.
 */
export abstract class DomainError extends Error {
  /** A machine-readable error code. */
  abstract readonly code: string;
  /** Additional contextual details about the error. */
  readonly details?: Record<string, unknown>;

  /**
   * @param message A human-readable error message
   * @param details Optional contextual details
   */
  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
  }
}

/**
 * Error thrown when the request is malformed or violates business rules.
 */
export class BadRequestError extends DomainError {
  readonly code = 'BAD_REQUEST';
}

/**
 * Error thrown when a requested resource is not found.
 */
export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';
}

/**
 * Error thrown when an operation conflicts with the current state.
 */
export class ConflictError extends DomainError {
  readonly code = 'CONFLICT';
}

/**
 * Error thrown when the caller is not authenticated.
 */
export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';
}

/**
 * Error thrown when the caller lacks permission.
 */
export class ForbiddenError extends DomainError {
  readonly code = 'FORBIDDEN';
}

/**
 * Error thrown when input validation fails.
 */
export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
}
