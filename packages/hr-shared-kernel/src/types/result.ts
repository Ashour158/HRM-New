/**
 * Railway-oriented programming Result type for error handling without exceptions.
 *
 * Use {@link Ok} for success values and {@link Err} for error values.
 * @template T The type of the success value
 * @template E The type of the error value
 */
export type Result<T, E> = Ok<T, E> | Err<T, E>;

/**
 * Represents a successful Result containing a value.
 * @template T The type of the success value
 * @template E The type of the error value (phantom, for signature alignment)
 */
export class Ok<T, E> {
  readonly kind = 'ok' as const;

  /**
   * @param value The success value
   */
  constructor(readonly value: T) {}

  /** Returns true. */
  isOk(): boolean {
    return true;
  }

  /** Returns false. */
  isErr(): boolean {
    return false;
  }

  /**
   * Maps a function over the success value.
   * @template U The type of the mapped value
   * @param fn The mapping function
   * @returns A new Ok containing the mapped value
   */
  map<U>(fn: (value: T) => U): Ok<U, E> {
    return new Ok(fn(this.value));
  }

  /**
   * Maps a function over the error value.
   * For Ok this is a no-op.
   * @template F The type of the mapped error
   * @returns This Ok cast to the new error type
   */
  mapErr<F>(_fn: (error: E) => F): Result<T, F> {
    return new Ok(this.value) as unknown as Result<T, F>;
  }

  /**
   * Maps a function that returns a Result over the success value and flattens.
   * @template U The type of the mapped value
   * @template F The type of the mapped error
   * @param fn The function returning a Result
   * @returns The flattened Result
   */
  flatMap<U, F>(fn: (value: T) => Result<U, F>): Result<U, E | F> {
    return fn(this.value) as Result<U, E | F>;
  }

  /**
   * Pattern matches over the Result.
   * @template U The return type of the match
   * @param okFn Function applied to the success value
   * @param _errFn Function applied to the error value (unused for Ok)
   * @returns The result of applying the appropriate function
   */
  match<U>(okFn: (value: T) => U, _errFn: (error: E) => U): U {
    return okFn(this.value);
  }

  /** Unwraps the success value. */
  unwrap(): T {
    return this.value;
  }

  /** Unwraps the success value, returning the default if this were Err (never happens for Ok). */
  unwrapOr(_defaultValue: T): T {
    return this.value;
  }
}

/**
 * Represents a failed Result containing an error.
 * @template T The type of the success value (phantom, for signature alignment)
 * @template E The type of the error value
 */
export class Err<T, E> {
  readonly kind = 'err' as const;

  /**
   * @param error The error value
   */
  constructor(readonly error: E) {}

  /** Returns false. */
  isOk(): boolean {
    return false;
  }

  /** Returns true. */
  isErr(): boolean {
    return true;
  }

  /**
   * Maps a function over the success value.
   * For Err this is a no-op.
   * @template U The type of the mapped value
   * @returns This Err cast to the new success type
   */
  map<U>(_fn: (value: T) => U): Result<U, E> {
    return this as unknown as Result<U, E>;
  }

  /**
   * Maps a function over the error value.
   * @template F The type of the mapped error
   * @param fn The mapping function
   * @returns A new Err containing the mapped error
   */
  mapErr<F>(fn: (error: E) => F): Err<T, F> {
    return new Err(fn(this.error));
  }

  /**
   * Maps a function that returns a Result over the success value and flattens.
   * For Err this returns the current error.
   * @template U The type of the mapped value
   * @template F The type of the mapped error
   * @returns This Err cast to the combined error type
   */
  flatMap<U, F>(_fn: (value: T) => Result<U, F>): Result<U, E | F> {
    return this as unknown as Result<U, E | F>;
  }

  /**
   * Pattern matches over the Result.
   * @template U The return type of the match
   * @param _okFn Function applied to the success value (unused for Err)
   * @param errFn Function applied to the error value
   * @returns The result of applying the appropriate function
   */
  match<U>(_okFn: (value: T) => U, errFn: (error: E) => U): U {
    return errFn(this.error);
  }

  /** Unwraps the success value, throwing because this is an Err. */
  unwrap(): never {
    throw new Error(`Tried to unwrap an Err: ${String(this.error)}`);
  }

  /** Unwraps the success value, returning the default. */
  unwrapOr(defaultValue: T): T {
    return defaultValue;
  }
}
