import { describe, expect, it } from 'vitest';
import {
  ExpressionEvaluationError,
  ExpressionSyntaxError,
  collectFieldReferences,
  evaluateExpression,
  parseExpression,
  validateCalculatedFieldExpression,
} from './calculated-field-expression.js';

describe('calculated-field-expression parser', () => {
  it('parses and evaluates arithmetic with correct precedence', () => {
    const ast = parseExpression('grossPay - deductionAmount + 10 * 2');
    expect(evaluateExpression(ast, { grossPay: 5200, deductionAmount: 780 })).toBe(5200 - 780 + 20);
  });

  it('respects parentheses for grouping', () => {
    const ast = parseExpression('(grossPay - deductionAmount) / 2');
    expect(evaluateExpression(ast, { grossPay: 100, deductionAmount: 20 })).toBe(40);
  });

  it('supports unary minus and unary plus', () => {
    expect(evaluateExpression(parseExpression('-lateMinutes'), { lateMinutes: 18 })).toBe(-18);
    expect(evaluateExpression(parseExpression('+lateMinutes'), { lateMinutes: 18 })).toBe(18);
    expect(evaluateExpression(parseExpression('5 - -3'), {})).toBe(8);
  });

  it('evaluates comparison operators to 1/0', () => {
    expect(evaluateExpression(parseExpression('lateMinutes > 10'), { lateMinutes: 18 })).toBe(1);
    expect(evaluateExpression(parseExpression('lateMinutes > 10'), { lateMinutes: 5 })).toBe(0);
    expect(evaluateExpression(parseExpression('exceptions == 0'), { exceptions: 0 })).toBe(1);
    expect(evaluateExpression(parseExpression('exceptions != 0'), { exceptions: 0 })).toBe(0);
    expect(evaluateExpression(parseExpression('a <= b'), { a: 2, b: 2 })).toBe(1);
    expect(evaluateExpression(parseExpression('a >= b'), { a: 1, b: 2 })).toBe(0);
  });

  it('treats missing row fields as 0', () => {
    expect(evaluateExpression(parseExpression('missingField + 5'), {})).toBe(5);
  });

  it('coerces numeric-looking string field values', () => {
    expect(evaluateExpression(parseExpression('a + b'), { a: '10', b: '5' })).toBe(15);
  });

  it('collects unique field references', () => {
    const ast = parseExpression('grossPay - deductionAmount + grossPay');
    expect(collectFieldReferences(ast)).toEqual(['grossPay', 'deductionAmount']);
  });

  it('throws ExpressionEvaluationError on division by zero', () => {
    const ast = parseExpression('grossPay / deductionAmount');
    expect(() => evaluateExpression(ast, { grossPay: 100, deductionAmount: 0 })).toThrow(ExpressionEvaluationError);
    expect(() => evaluateExpression(ast, { grossPay: 100, deductionAmount: 0 })).toThrow('Division by zero');
  });

  it('rejects empty expressions', () => {
    expect(() => parseExpression('')).toThrow(ExpressionSyntaxError);
    expect(() => parseExpression('   ')).toThrow(ExpressionSyntaxError);
  });

  it('rejects malformed expressions', () => {
    expect(() => parseExpression('grossPay +')).toThrow(ExpressionSyntaxError);
    expect(() => parseExpression('(grossPay + 1')).toThrow(ExpressionSyntaxError);
    expect(() => parseExpression('grossPay 5')).toThrow(ExpressionSyntaxError);
    expect(() => parseExpression('grossPay ** 2')).toThrow(ExpressionSyntaxError);
    expect(() => parseExpression('grossPay & deductionAmount')).toThrow(ExpressionSyntaxError);
    expect(() => parseExpression('"grossPay"')).toThrow(ExpressionSyntaxError);
  });

  it('rejects function calls', () => {
    expect(() => parseExpression('SUM(grossPay)')).toThrow(/Function calls are not supported/);
  });

  it('rejects an expression that is just a dangling operator sequence', () => {
    expect(() => parseExpression('* grossPay')).toThrow(ExpressionSyntaxError);
  });
});

describe('validateCalculatedFieldExpression', () => {
  const knownFields = ['grossPay', 'deductionAmount', 'netPay'];

  it('accepts valid expressions referencing only known fields', () => {
    const result = validateCalculatedFieldExpression('grossPay - deductionAmount', knownFields);
    expect(result).toEqual({ valid: true, errors: [], referencedFields: ['grossPay', 'deductionAmount'] });
  });

  it('rejects expressions referencing unknown fields', () => {
    const result = validateCalculatedFieldExpression('grossPay - totalCompensation', knownFields);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(['Unknown field "totalCompensation" for this data source']);
  });

  it('rejects syntactically invalid expressions and reports the parse error', () => {
    const result = validateCalculatedFieldExpression('grossPay -- deductionAmount +', knownFields);
    expect(result.valid).toBe(false);
    expect(result.referencedFields).toEqual([]);
    expect(result.errors).toHaveLength(1);
  });

  it('never evaluates anything (numeric literals alone are valid with no fields)', () => {
    const result = validateCalculatedFieldExpression('1 + 1', knownFields);
    expect(result).toEqual({ valid: true, errors: [], referencedFields: [] });
  });
});
