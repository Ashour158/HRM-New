/**
 * Client-side mirror of the calculated-field expression grammar used by the reporting API
 * (apps/hr-api/src/domains/reporting/expression/calculated-field-expression.ts) so the admin
 * UI can show real-time parse-error feedback without a network round trip. The API remains the
 * authoritative validator at create/activate time — this is a UX convenience only.
 *
 * Supported: field references, numeric literals, + - * /, comparisons (== != < <= > >=),
 * parentheses, unary +/-. No function calls, no string literals, no logical operators.
 */

export type ExpressionAstNode =
  | { type: 'number'; value: number }
  | { type: 'field'; name: string }
  | { type: 'unary'; operator: '-'; operand: ExpressionAstNode }
  | { type: 'binary'; operator: string; left: ExpressionAstNode; right: ExpressionAstNode };

export class ExpressionSyntaxError extends Error {}

type TokenType = 'NUMBER' | 'IDENTIFIER' | 'OPERATOR' | 'LPAREN' | 'RPAREN' | 'EOF';

interface Token {
  type: TokenType;
  value: string;
  position: number;
}

const OPERATOR_PATTERN = /^(==|!=|<=|>=|<|>|\+|-|\*|\/)/;
const NUMBER_PATTERN = /^\d+(\.\d+)?/;
const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*/;
const COMPARISON_OPERATORS = ['==', '!=', '<', '<=', '>', '>='];
const ADDITIVE_OPERATORS = ['+', '-'];
const MULTIPLICATIVE_OPERATORS = ['*', '/'];

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (/\s/.test(ch)) { i += 1; continue; }
    if (ch === '(') { tokens.push({ type: 'LPAREN', value: ch, position: i }); i += 1; continue; }
    if (ch === ')') { tokens.push({ type: 'RPAREN', value: ch, position: i }); i += 1; continue; }
    const rest = source.slice(i);
    const numberMatch = NUMBER_PATTERN.exec(rest);
    if (numberMatch) { tokens.push({ type: 'NUMBER', value: numberMatch[0], position: i }); i += numberMatch[0].length; continue; }
    const identifierMatch = IDENTIFIER_PATTERN.exec(rest);
    if (identifierMatch) { tokens.push({ type: 'IDENTIFIER', value: identifierMatch[0], position: i }); i += identifierMatch[0].length; continue; }
    const operatorMatch = OPERATOR_PATTERN.exec(rest);
    if (operatorMatch) { tokens.push({ type: 'OPERATOR', value: operatorMatch[0], position: i }); i += operatorMatch[0].length; continue; }
    throw new ExpressionSyntaxError(`Unexpected character "${ch}" at position ${i}`);
  }
  tokens.push({ type: 'EOF', value: '', position: source.length });
  return tokens;
}

class ExpressionParser {
  private index = 0;
  constructor(private readonly tokens: Token[]) {}

  parse(): ExpressionAstNode {
    if (this.tokens.length === 1) throw new ExpressionSyntaxError('Expression must not be empty');
    const node = this.parseComparison();
    this.expect('EOF');
    return node;
  }

  private parseComparison(): ExpressionAstNode {
    let node = this.parseAdditive();
    while (this.matchOperator(COMPARISON_OPERATORS)) {
      const operator = this.previous().value;
      node = { type: 'binary', operator, left: node, right: this.parseAdditive() };
    }
    return node;
  }

  private parseAdditive(): ExpressionAstNode {
    let node = this.parseMultiplicative();
    while (this.matchOperator(ADDITIVE_OPERATORS)) {
      const operator = this.previous().value;
      node = { type: 'binary', operator, left: node, right: this.parseMultiplicative() };
    }
    return node;
  }

  private parseMultiplicative(): ExpressionAstNode {
    let node = this.parseUnary();
    while (this.matchOperator(MULTIPLICATIVE_OPERATORS)) {
      const operator = this.previous().value;
      node = { type: 'binary', operator, left: node, right: this.parseUnary() };
    }
    return node;
  }

  private parseUnary(): ExpressionAstNode {
    if (this.matchOperator(['-'])) return { type: 'unary', operator: '-', operand: this.parseUnary() };
    if (this.matchOperator(['+'])) return this.parseUnary();
    return this.parsePrimary();
  }

  private parsePrimary(): ExpressionAstNode {
    const token = this.peek();
    if (token.type === 'NUMBER') { this.advance(); return { type: 'number', value: Number(token.value) }; }
    if (token.type === 'IDENTIFIER') {
      this.advance();
      if (this.peek().type === 'LPAREN') {
        throw new ExpressionSyntaxError(`Function calls are not supported ("${token.value}(...)")`);
      }
      return { type: 'field', name: token.value };
    }
    if (token.type === 'LPAREN') {
      this.advance();
      const node = this.parseComparison();
      this.expect('RPAREN');
      return node;
    }
    throw new ExpressionSyntaxError(`Unexpected token "${token.value || 'end of expression'}" at position ${token.position}`);
  }

  private matchOperator(values: readonly string[]): boolean {
    const token = this.peek();
    if (token.type === 'OPERATOR' && values.includes(token.value)) { this.advance(); return true; }
    return false;
  }

  private expect(type: TokenType): Token {
    const token = this.peek();
    if (token.type !== type) {
      const expected = type === 'RPAREN' ? '")"' : type === 'EOF' ? 'end of expression' : type;
      throw new ExpressionSyntaxError(`Expected ${expected} but found "${token.value || 'end of expression'}" at position ${token.position}`);
    }
    return this.advance();
  }

  private peek(): Token { return this.tokens[this.index]; }
  private previous(): Token { return this.tokens[this.index - 1]; }
  private advance(): Token { const token = this.tokens[this.index]; this.index += 1; return token; }
}

export function parseExpression(source: string): ExpressionAstNode {
  if (typeof source !== 'string' || source.trim().length === 0) {
    throw new ExpressionSyntaxError('Expression must not be empty');
  }
  return new ExpressionParser(tokenize(source)).parse();
}

export function collectFieldReferences(node: ExpressionAstNode): string[] {
  const refs = new Set<string>();
  const visit = (current: ExpressionAstNode): void => {
    if (current.type === 'field') { refs.add(current.name); return; }
    if (current.type === 'unary') { visit(current.operand); return; }
    if (current.type === 'binary') { visit(current.left); visit(current.right); }
  };
  visit(node);
  return [...refs];
}

export interface CalculatedFieldValidationResult {
  valid: boolean;
  errors: string[];
  referencedFields: string[];
}

export function validateCalculatedFieldExpression(expression: string, knownFieldCodes: readonly string[]): CalculatedFieldValidationResult {
  let ast: ExpressionAstNode;
  try {
    ast = parseExpression(expression);
  } catch (error) {
    return { valid: false, errors: [error instanceof Error ? error.message : String(error)], referencedFields: [] };
  }
  const referencedFields = collectFieldReferences(ast);
  const known = new Set(knownFieldCodes);
  const unknownFields = referencedFields.filter((field) => !known.has(field));
  const errors = unknownFields.map((field) => `Unknown field "${field}" for this data source`);
  return { valid: errors.length === 0, errors, referencedFields };
}
