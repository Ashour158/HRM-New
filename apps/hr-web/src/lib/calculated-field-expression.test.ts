import { describe, expect, it } from 'vitest';
import { parseExpression, validateCalculatedFieldExpression } from './calculated-field-expression';

describe('calculated-field-expression (client validator)', () => {
  const knownFields = ['grossPay', 'deductionAmount', 'netPay'];

  it('accepts valid expressions referencing only known fields', () => {
    const result = validateCalculatedFieldExpression('grossPay - deductionAmount', knownFields);
    expect(result).toEqual({ valid: true, errors: [], referencedFields: ['grossPay', 'deductionAmount'] });
  });

  it('accepts arithmetic with parentheses and comparisons', () => {
    expect(validateCalculatedFieldExpression('(grossPay - deductionAmount) / 2', knownFields).valid).toBe(true);
    expect(validateCalculatedFieldExpression('grossPay > deductionAmount', knownFields).valid).toBe(true);
  });

  it('rejects expressions referencing unknown fields', () => {
    const result = validateCalculatedFieldExpression('grossPay - totalCompensation', knownFields);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(['Unknown field "totalCompensation" for this data source']);
  });

  it('rejects malformed expressions', () => {
    expect(validateCalculatedFieldExpression('grossPay +', knownFields).valid).toBe(false);
    expect(validateCalculatedFieldExpression('', knownFields).valid).toBe(false);
    expect(validateCalculatedFieldExpression('(grossPay + 1', knownFields).valid).toBe(false);
  });

  it('rejects function calls', () => {
    expect(validateCalculatedFieldExpression('SUM(grossPay)', knownFields).valid).toBe(false);
  });

  it('parseExpression throws on empty input', () => {
    expect(() => parseExpression('')).toThrow();
  });
});
