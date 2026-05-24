/**
 * Option/Maybe type for handling nullable values safely.
 *
 * Use {@link Some} for present values and {@link None} for absent values.
 * @template T The type of the contained value
 */
export type Option<T> = Some<T> | None<T>;

/**
 * Represents a present value.
 * @template T The type of the contained value
 */
export class Some<T> {
  readonly kind = 'some' as const;

  /**
   * @param value The contained value
   */
  constructor(readonly value: T) {}

  /** Returns true. */
  isSome(): boolean {
    return true;
  }

  /** Returns false. */
  isNone(): boolean {
    return false;
  }

  /**
   * Maps a function over the contained value.
   * @template U The type of the mapped value
   * @param fn The mapping function
   * @returns A new Some containing the mapped value
   */
  map<U>(fn: (value: T) => U): Some<U> {
    return new Some(fn(this.value));
  }

  /**
   * Maps a function that returns an Option over the contained value and flattens.
   * @template U The type of the mapped value
   * @param fn The function returning an Option
   * @returns The flattened Option
   */
  flatMap<U>(fn: (value: T) => Option<U>): Option<U> {
    return fn(this.value);
  }

  /**
   * Pattern matches over the Option.
   * @template U The return type of the match
   * @param someFn Function applied to the contained value
   * @param _noneFn Function applied when None (unused for Some)
   * @returns The result of applying the appropriate function
   */
  match<U>(someFn: (value: T) => U, _noneFn: () => U): U {
    return someFn(this.value);
  }

  /** Unwraps the contained value. */
  unwrap(): T {
    return this.value;
  }

  /** Unwraps the contained value, ignoring the default. */
  unwrapOr(_defaultValue: T): T {
    return this.value;
  }
}

/**
 * Represents an absent value.
 * @template T The type of the value that could have been present
 */
export class None<T> {
  readonly kind = 'none' as const;

  /** Returns false. */
  isSome(): boolean {
    return false;
  }

  /** Returns true. */
  isNone(): boolean {
    return true;
  }

  /**
   * Maps a function over the contained value.
   * For None this is a no-op.
   * @template U The type of the mapped value
   * @returns A new None
   */
  map<U>(_fn: (value: T) => U): None<U> {
    return new None<U>();
  }

  /**
   * Maps a function that returns an Option over the contained value and flattens.
   * For None this returns a new None.
   * @template U The type of the mapped value
   * @returns A new None
   */
  flatMap<U>(_fn: (value: T) => Option<U>): None<U> {
    return new None<U>();
  }

  /**
   * Pattern matches over the Option.
   * @template U The return type of the match
   * @param _someFn Function applied to the contained value (unused for None)
   * @param noneFn Function applied when None
   * @returns The result of applying the appropriate function
   */
  match<U>(_someFn: (value: T) => U, noneFn: () => U): U {
    return noneFn();
  }

  /** Unwraps the contained value, throwing because this is None. */
  unwrap(): never {
    throw new Error('Tried to unwrap a None value');
  }

  /** Unwraps the contained value, returning the default. */
  unwrapOr(defaultValue: T): T {
    return defaultValue;
  }
}
