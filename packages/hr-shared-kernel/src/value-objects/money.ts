import { ValueObject } from '../domain/value-object.js';

/**
 * Supported ISO 4217 currency codes.
 */
export type CurrencyCode =
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'CAD'
  | 'AUD'
  | 'JPY'
  | 'CHF'
  | 'CNY'
  | 'INR'
  | 'SGD'
  | 'AED'
  | 'SAR';

/**
 * Number of decimal places for each supported currency.
 */
const CURRENCY_DECIMALS: Record<CurrencyCode, number> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  CAD: 2,
  AUD: 2,
  JPY: 0,
  CHF: 2,
  CNY: 2,
  INR: 2,
  SGD: 2,
  AED: 2,
  SAR: 2,
};

/**
 * Immutable Money value object.
 * Internally stores the amount as a bigint in the smallest currency unit to avoid floating-point errors.
 */
export class Money extends ValueObject {
  /** The amount in the smallest currency unit (e.g., cents for USD). */
  readonly amount: bigint;
  /** The ISO 4217 currency code. */
  readonly currency: CurrencyCode;

  /**
   * @param amount The amount in smallest currency units
   * @param currency The ISO 4217 currency code
   */
  constructor(amount: bigint, currency: CurrencyCode) {
    super();
    this.amount = amount;
    this.currency = currency;
  }

  /**
   * Creates a Money instance from a decimal string.
   * @param amount A decimal string such as "1234.56"
   * @param currency A currency code such as "USD"
   * @returns A new Money instance
   * @throws Error if the currency is unsupported or the amount is invalid
   */
  static fromDecimal(amount: string, currency: string): Money {
    const code = currency as CurrencyCode;
    const decimals = CURRENCY_DECIMALS[code];
    if (decimals === undefined) {
      throw new Error(`Unsupported currency: ${currency}`);
    }

    const negative = amount.startsWith('-');
    const positiveAmount = negative ? amount.slice(1) : amount;
    const [wholeStr, fractionStr = ''] = positiveAmount.split('.');
    const fractionPadded = fractionStr.padEnd(decimals, '0').slice(0, decimals);
    const whole = wholeStr || '0';
    const sign = negative ? '-' : '';
    const amountStr = `${sign}${whole}${fractionPadded}`;

    return new Money(BigInt(amountStr), code);
  }

  /**
   * Adds another Money value to this one.
   * @param other The Money to add
   * @returns A new Money instance
   * @throws Error if currencies do not match
   */
  add(other: Money): Money {
    this.ensureSameCurrency(other);
    return new Money(this.amount + other.amount, this.currency);
  }

  /**
   * Subtracts another Money value from this one.
   * @param other The Money to subtract
   * @returns A new Money instance
   * @throws Error if currencies do not match
   */
  subtract(other: Money): Money {
    this.ensureSameCurrency(other);
    return new Money(this.amount - other.amount, this.currency);
  }

  /**
   * Multiplies this Money by a numeric factor.
   * @param factor The multiplication factor
   * @returns A new Money instance
   */
  multiply(factor: number): Money {
    const factorStr = factor.toString();
    const negative = factorStr.startsWith('-');
    const positiveFactor = negative ? factorStr.slice(1) : factorStr;
    const [wholeStr, fractionStr = ''] = positiveFactor.split('.');
    const decimals = fractionStr.length;
    const multiplier = BigInt(wholeStr + fractionStr);
    const raw = this.amount * multiplier;
    const divisor = BigInt(10 ** decimals);
    const result = raw / divisor;
    return new Money(negative ? -result : result, this.currency);
  }

  /**
   * Divides this Money by a numeric divisor.
   * @param divisor The division divisor
   * @returns A new Money instance
   * @throws Error if divisor is zero
   */
  divide(divisor: number): Money {
    if (divisor === 0) {
      throw new Error('Division by zero');
    }
    const divisorStr = divisor.toString();
    const negative = divisorStr.startsWith('-');
    const positiveDivisor = negative ? divisorStr.slice(1) : divisorStr;
    const [wholeStr, fractionStr = ''] = positiveDivisor.split('.');
    const decimals = fractionStr.length;
    const div = BigInt(wholeStr + fractionStr);
    const multiplier = BigInt(10 ** decimals);
    const raw = this.amount * multiplier;
    const result = raw / div;
    return new Money(negative ? -result : result, this.currency);
  }

  /**
   * Compares two Money instances for equality.
   * @param other The other Money
   * @returns True if amount and currency are equal
   */
  equals(other: Money): boolean {
    return this.currency === other.currency && this.amount === other.amount;
  }

  /**
   * Compares this Money to another.
   * @param other The other Money
   * @returns -1 if less, 0 if equal, 1 if greater
   * @throws Error if currencies do not match
   */
  compareTo(other: Money): number {
    this.ensureSameCurrency(other);
    if (this.amount < other.amount) return -1;
    if (this.amount > other.amount) return 1;
    return 0;
  }

  /** Returns true if the amount is zero. */
  isZero(): boolean {
    return this.amount === 0n;
  }

  /** Returns true if the amount is negative. */
  isNegative(): boolean {
    return this.amount < 0n;
  }

  /** Returns true if the amount is positive. */
  isPositive(): boolean {
    return this.amount > 0n;
  }

  /**
   * Converts the internal bigint amount to a decimal string.
   * @returns A decimal string such as "1234.56"
   */
  toDecimal(): string {
    const decimals = CURRENCY_DECIMALS[this.currency];
    const negative = this.amount < 0n;
    const absAmount = negative ? -this.amount : this.amount;
    const amountStr = absAmount.toString().padStart(decimals + 1, '0');
    const whole = amountStr.slice(0, -decimals) || '0';
    const fraction = amountStr.slice(-decimals);
    const sign = negative ? '-' : '';
    return `${sign}${whole}.${fraction}`;
  }

  /**
   * Returns a human-readable representation.
   * @returns A string such as "1234.56 USD"
   */
  toString(): string {
    return `${this.toDecimal()} ${this.currency}`;
  }

  private ensureSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(`Currency mismatch: ${this.currency} vs ${other.currency}`);
    }
  }
}
