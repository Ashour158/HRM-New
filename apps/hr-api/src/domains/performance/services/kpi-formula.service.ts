import { Injectable } from '@nestjs/common';
import { ValidationError } from '@hcm/shared-kernel';

type Token = string;

@Injectable()
export class KpiFormulaService {
  calculate(input: {
    formula?: string;
    measuredValue: number;
    targetValue?: number;
    baselineValue?: number;
  }): number {
    if (!input.formula?.trim()) return input.measuredValue;

    const variables: Record<string, number> = {
      measuredValue: input.measuredValue,
      actualValue: input.measuredValue,
      targetValue: input.targetValue ?? 0,
      baselineValue: input.baselineValue ?? 0,
    };
    const rpn = this.toRpn(this.tokenize(input.formula));
    const stack: number[] = [];

    for (const token of rpn) {
      if (token in variables) {
        stack.push(variables[token]);
        continue;
      }
      if (/^\d+(\.\d+)?$/.test(token)) {
        stack.push(Number(token));
        continue;
      }
      const right = stack.pop();
      const left = stack.pop();
      if (left === undefined || right === undefined) {
        throw new ValidationError('KPI formula is incomplete');
      }
      switch (token) {
        case '+':
          stack.push(left + right);
          break;
        case '-':
          stack.push(left - right);
          break;
        case '*':
          stack.push(left * right);
          break;
        case '/':
          if (right === 0) throw new ValidationError('KPI formula cannot divide by zero');
          stack.push(left / right);
          break;
        default:
          throw new ValidationError(`Unsupported KPI formula operator: ${token}`);
      }
    }

    if (stack.length !== 1 || !Number.isFinite(stack[0])) {
      throw new ValidationError('KPI formula did not produce a finite numeric result');
    }
    return Math.round(stack[0] * 100) / 100;
  }

  private tokenize(formula: string): Token[] {
    const tokens: Token[] = [];
    let index = 0;
    const pattern = /\s*([A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?|[()+\-*/])\s*/gy;
    while (index < formula.length) {
      pattern.lastIndex = index;
      const match = pattern.exec(formula);
      if (!match) throw new ValidationError('KPI formula contains unsupported characters');
      tokens.push(match[1]);
      index = pattern.lastIndex;
    }
    return tokens;
  }

  private toRpn(tokens: Token[]): Token[] {
    const output: Token[] = [];
    const operators: Token[] = [];
    const precedence: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 };

    for (const token of tokens) {
      if (/^\d+(\.\d+)?$/.test(token) || /^[A-Za-z_][A-Za-z0-9_]*$/.test(token)) {
        if (/^[A-Za-z_]/.test(token) && !['measuredValue', 'actualValue', 'targetValue', 'baselineValue'].includes(token)) {
          throw new ValidationError(`Unsupported KPI formula variable: ${token}`);
        }
        output.push(token);
        continue;
      }
      if (token === '(') {
        operators.push(token);
        continue;
      }
      if (token === ')') {
        while (operators.length && operators[operators.length - 1] !== '(') {
          output.push(operators.pop() as Token);
        }
        if (operators.pop() !== '(') throw new ValidationError('KPI formula parentheses are unbalanced');
        continue;
      }
      if (!(token in precedence)) throw new ValidationError(`Unsupported KPI formula token: ${token}`);
      while (operators.length && (precedence[operators[operators.length - 1]] ?? 0) >= precedence[token]) {
        output.push(operators.pop() as Token);
      }
      operators.push(token);
    }

    while (operators.length) {
      const operator = operators.pop() as Token;
      if (operator === '(') throw new ValidationError('KPI formula parentheses are unbalanced');
      output.push(operator);
    }
    return output;
  }
}
