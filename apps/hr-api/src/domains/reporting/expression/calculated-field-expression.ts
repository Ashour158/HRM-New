/**
 * A small, explicit, dependency-free grammar for calculated-field formulas.
 *
 * Supported:
 *   - field references (bare identifiers, e.g. `grossPay`)
 *   - numeric literals (integers and decimals)
 *   - arithmetic operators: + - * /
 *   - comparison operators: == != < <= > >=  (evaluate to 1 / 0)
 *   - parentheses for grouping
 *   - unary minus / unary plus
 *
 * Explicitly NOT supported (by design, to keep this a safe, spreadsheet-style
 * formula language rather than a general-purpose scripting language):
 *   - function calls
 *   - string literals / string comparisons
 *   - logical operators (&&, ||, !)
 *   - assignment, statements, or anything beyond a single expression
 *
 * This module never uses `eval`/`new Function`. It hand-rolls a tokenizer and
 * a recursive-descent parser that produces a plain-data AST, which is then
 * walked by a small evaluator.
 */

export type ComparisonOperator = '==' | '!=' | '<' | '<=' | '>' | '>=';
export type ArithmeticOperator = '+' | '-' | '*' | '/';
export type BinaryOperator = ArithmeticOperator | ComparisonOperator;

export type ExpressionAstNode =
  | { type: 'number'; value: number }
  | { type: 'field'; name: string }
  | { type: 'unary'; operator: '-'; operand: ExpressionAstNode }
  | { type: 'binary'; operator: BinaryOperator; left: ExpressionAstNode; right: ExpressionAstNode };

/** Thrown for malformed expressions. Parse-only — never evaluates anything. */
export class ExpressionSyntaxError extends Error {
  readonly position: number;
  constructor(message: string, position: number) {
    super(message);
    this.name = 'ExpressionSyntaxError';
    this.position = position;
  }
}

/** Thrown for runtime evaluation failures against a specific row (e.g. division by zero). */
export class ExpressionEvaluationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExpressionEvaluationError';
  }
}

type TokenType = 'NUMBER' | 'IDENTIFIER' | 'OPERATOR' | 'LPAREN' | 'RPAREN' | 'EOF';

interface Token {
  type: TokenType;
  value: string;
  position: number;
}

const OPERATOR_PATTERN = /^(==|!=|<=|>=|<|>|\+|-|\*|\/)/;
const NUMBER_PATTERN = /^\d+(\.\d+)?/;
const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*/;
const COMPARISON_OPERATORS: ComparisonOperator[] = ['==', '!=', '<', '<=', '>', '>='];
const ADDITIVE_OPERATORS: ArithmeticOperator[] = ['+', '-'];
const MULTIPLICATIVE_OPERATORS: ArithmeticOperator[] = ['*', '/'];

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === '(') {
      tokens.push({ type: 'LPAREN', value: ch, position: i });
      i += 1;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'RPAREN', value: ch, position: i });
      i += 1;
      continue;
    }
    const rest = source.slice(i);
    const numberMatch = NUMBER_PATTERN.exec(rest);
    if (numberMatch) {
      tokens.push({ type: 'NUMBER', value: numberMatch[0], position: i });
      i += numberMatch[0].length;
      continue;
    }
    const identifierMatch = IDENTIFIER_PATTERN.exec(rest);
    if (identifierMatch) {
      tokens.push({ type: 'IDENTIFIER', value: identifierMatch[0], position: i });
      i += identifierMatch[0].length;
      continue;
    }
    const operatorMatch = OPERATOR_PATTERN.exec(rest);
    if (operatorMatch) {
      tokens.push({ type: 'OPERATOR', value: operatorMatch[0], position: i });
      i += operatorMatch[0].length;
      continue;
    }
    throw new ExpressionSyntaxError(`Unexpected character "${ch}" at position ${i}`, i);
  }
  tokens.push({ type: 'EOF', value: '', position: source.length });
  return tokens;
}

class ExpressionParser {
  private index = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): ExpressionAstNode {
    if (this.tokens.length === 1) {
      throw new ExpressionSyntaxError('Expression must not be empty', 0);
    }
    const node = this.parseComparison();
    this.expect('EOF');
    return node;
  }

  private parseComparison(): ExpressionAstNode {
    let node = this.parseAdditive();
    while (this.matchOperator(COMPARISON_OPERATORS)) {
      const operator = this.previous().value as ComparisonOperator;
      const right = this.parseAdditive();
      node = { type: 'binary', operator, left: node, right };
    }
    return node;
  }

  private parseAdditive(): ExpressionAstNode {
    let node = this.parseMultiplicative();
    while (this.matchOperator(ADDITIVE_OPERATORS)) {
      const operator = this.previous().value as ArithmeticOperator;
      const right = this.parseMultiplicative();
      node = { type: 'binary', operator, left: node, right };
    }
    return node;
  }

  private parseMultiplicative(): ExpressionAstNode {
    let node = this.parseUnary();
    while (this.matchOperator(MULTIPLICATIVE_OPERATORS)) {
      const operator = this.previous().value as ArithmeticOperator;
      const right = this.parseUnary();
      node = { type: 'binary', operator, left: node, right };
    }
    return node;
  }

  private parseUnary(): ExpressionAstNode {
    if (this.matchOperator(['-'])) {
      return { type: 'unary', operator: '-', operand: this.parseUnary() };
    }
    if (this.matchOperator(['+'])) {
      return this.parseUnary();
    }
    return this.parsePrimary();
  }

  private parsePrimary(): ExpressionAstNode {
    const token = this.peek();
    if (token.type === 'NUMBER') {
      this.advance();
      return { type: 'number', value: Number(token.value) };
    }
    if (token.type === 'IDENTIFIER') {
      this.advance();
      if (this.peek().type === 'LPAREN') {
        throw new ExpressionSyntaxError(
          `Function calls are not supported ("${token.value}(...)" at position ${token.position})`,
          token.position,
        );
      }
      return { type: 'field', name: token.value };
    }
    if (token.type === 'LPAREN') {
      this.advance();
      const node = this.parseComparison();
      this.expect('RPAREN');
      return node;
    }
    throw new ExpressionSyntaxError(
      `Unexpected token "${token.value || 'end of expression'}" at position ${token.position}`,
      token.position,
    );
  }

  private matchOperator(values: readonly string[]): boolean {
    const token = this.peek();
    if (token.type === 'OPERATOR' && values.includes(token.value)) {
      this.advance();
      return true;
    }
    return false;
  }

  private expect(type: TokenType): Token {
    const token = this.peek();
    if (token.type !== type) {
      const expected = type === 'RPAREN' ? '")"' : type === 'EOF' ? 'end of expression' : type;
      throw new ExpressionSyntaxError(
        `Expected ${expected} but found "${token.value || 'end of expression'}" at position ${token.position}`,
        token.position,
      );
    }
    return this.advance();
  }

  private peek(): Token {
    return this.tokens[this.index];
  }

  private previous(): Token {
    return this.tokens[this.index - 1];
  }

  private advance(): Token {
    const token = this.tokens[this.index];
    this.index += 1;
    return token;
  }
}

/** Parses a calculated-field expression into an AST. Throws `ExpressionSyntaxError` on malformed input. */
export function parseExpression(source: string): ExpressionAstNode {
  if (typeof source !== 'string' || source.trim().length === 0) {
    throw new ExpressionSyntaxError('Expression must not be empty', 0);
  }
  const tokens = tokenize(source);
  return new ExpressionParser(tokens).parse();
}

/** Collects the unique set of field names referenced anywhere in the AST. */
export function collectFieldReferences(node: ExpressionAstNode): string[] {
  const refs = new Set<string>();
  const visit = (current: ExpressionAstNode): void => {
    if (current.type === 'field') {
      refs.add(current.name);
      return;
    }
    if (current.type === 'unary') {
      visit(current.operand);
      return;
    }
    if (current.type === 'binary') {
      visit(current.left);
      visit(current.right);
    }
  };
  visit(node);
  return [...refs];
}

export interface CalculatedFieldValidationResult {
  valid: boolean;
  errors: string[];
  /** Field codes referenced by the expression (only populated when the expression parses). */
  referencedFields: string[];
}

/**
 * Parse-only validation: checks that the expression is syntactically valid AND that every
 * field it references is a known field for the target data source. Never evaluates anything.
 */
export function validateCalculatedFieldExpression(
  expression: string,
  knownFieldCodes: readonly string[],
): CalculatedFieldValidationResult {
  let ast: ExpressionAstNode;
  try {
    ast = parseExpression(expression);
  } catch (error) {
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : String(error)],
      referencedFields: [],
    };
  }
  const referencedFields = collectFieldReferences(ast);
  const known = new Set(knownFieldCodes);
  const unknownFields = referencedFields.filter((field) => !known.has(field));
  const errors = unknownFields.map((field) => `Unknown field "${field}" for this data source`);
  return { valid: errors.length === 0, errors, referencedFields };
}

/**
 * Evaluates a parsed expression against a row of already-resolved field values.
 * Missing fields are treated as 0 (consistent with how metrics are summed elsewhere in
 * semantic reporting). Comparison operators evaluate to 1 (true) or 0 (false).
 * Throws `ExpressionEvaluationError` for runtime failures such as division by zero.
 */
export function evaluateExpression(node: ExpressionAstNode, row: Record<string, unknown>): number {
  switch (node.type) {
    case 'number':
      return node.value;
    case 'field':
      return coerceNumber(row[node.name]);
    case 'unary':
      return -evaluateExpression(node.operand, row);
    case 'binary':
      return evaluateBinary(node.operator, evaluateExpression(node.left, row), evaluateExpression(node.right, row));
    default: {
      const exhaustive: never = node;
      throw new ExpressionEvaluationError(`Unsupported expression node: ${JSON.stringify(exhaustive)}`);
    }
  }
}

function evaluateBinary(operator: BinaryOperator, left: number, right: number): number {
  switch (operator) {
    case '+': return left + right;
    case '-': return left - right;
    case '*': return left * right;
    case '/':
      if (right === 0) throw new ExpressionEvaluationError('Division by zero');
      return left / right;
    case '==': return left === right ? 1 : 0;
    case '!=': return left !== right ? 1 : 0;
    case '<': return left < right ? 1 : 0;
    case '<=': return left <= right ? 1 : 0;
    case '>': return left > right ? 1 : 0;
    case '>=': return left >= right ? 1 : 0;
    default: {
      const exhaustive: never = operator;
      throw new ExpressionEvaluationError(`Unsupported operator: ${String(exhaustive)}`);
    }
  }
}

function coerceNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return 0;
}
