// Rule engine: parses and evaluates admin-written formulas.
// A rule FAILS when its formula returns true (FR-03).

export class FormulaError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FormulaError';
  }
}

export class RuleError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RuleError';
  }
}

// ---------- Tokenizer ----------

function tokenize(src) {
  const tokens = [];
  let i = 0;
  const twoChar = ['<=', '>=', '==', '!=', '&&', '||'];
  const oneChar = '<>!+-*/(),';
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      const text = src.slice(i, j);
      if (!/^\d+(\.\d+)?$/.test(text)) throw new FormulaError(`Invalid number "${text}"`);
      tokens.push({ type: 'num', value: Number(text), pos: i });
      i = j;
      continue;
    }
    if (c === '"' || c === "'") {
      const end = src.indexOf(c, i + 1);
      if (end === -1) throw new FormulaError('Unterminated text value');
      tokens.push({ type: 'str', value: src.slice(i + 1, end), pos: i });
      i = end + 1;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      const text = src.slice(i, j);
      if (text === 'true' || text === 'false') tokens.push({ type: 'bool', value: text === 'true', pos: i });
      else tokens.push({ type: 'ident', value: text, pos: i });
      i = j;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (twoChar.includes(two)) {
      tokens.push({ type: 'op', value: two, pos: i });
      i += 2;
      continue;
    }
    if (oneChar.includes(c)) {
      tokens.push({ type: 'op', value: c, pos: i });
      i++;
      continue;
    }
    throw new FormulaError(`Unexpected character "${c}"`);
  }
  return tokens;
}

// ---------- Parser (recursive descent) ----------

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.i = 0;
  }
  peek() { return this.tokens[this.i]; }
  match(...ops) {
    const t = this.peek();
    if (t && t.type === 'op' && ops.includes(t.value)) { this.i++; return t.value; }
    return null;
  }
  expect(op) {
    if (!this.match(op)) throw new FormulaError(`Expected "${op}"`);
  }
  parse() {
    if (this.tokens.length === 0) throw new FormulaError('Formula is empty');
    const node = this.or();
    if (this.peek()) throw new FormulaError(`Unexpected "${this.peek().value}"`);
    return node;
  }
  or() {
    let left = this.and();
    while (this.match('||')) left = { type: 'logical', op: '||', left, right: this.and() };
    return left;
  }
  and() {
    let left = this.equality();
    while (this.match('&&')) left = { type: 'logical', op: '&&', left, right: this.equality() };
    return left;
  }
  equality() {
    let left = this.comparison();
    let op;
    while ((op = this.match('==', '!='))) left = { type: 'binary', op, left, right: this.comparison() };
    return left;
  }
  comparison() {
    let left = this.additive();
    let op;
    while ((op = this.match('<=', '>=', '<', '>'))) left = { type: 'binary', op, left, right: this.additive() };
    return left;
  }
  additive() {
    let left = this.multiplicative();
    let op;
    while ((op = this.match('+', '-'))) left = { type: 'binary', op, left, right: this.multiplicative() };
    return left;
  }
  multiplicative() {
    let left = this.unary();
    let op;
    while ((op = this.match('*', '/'))) left = { type: 'binary', op, left, right: this.unary() };
    return left;
  }
  unary() {
    const op = this.match('!', '-');
    if (op) return { type: 'unary', op, operand: this.unary() };
    return this.primary();
  }
  primary() {
    const t = this.peek();
    if (!t) throw new FormulaError('Formula ended unexpectedly');
    if (t.type === 'num' || t.type === 'str' || t.type === 'bool') {
      this.i++;
      return { type: t.type, value: t.value };
    }
    if (t.type === 'ident') {
      this.i++;
      if (this.match('(')) {
        const args = [];
        if (!this.match(')')) {
          do { args.push(this.or()); } while (this.match(','));
          this.expect(')');
        }
        return { type: 'call', name: t.value, args };
      }
      return { type: 'ident', name: t.value };
    }
    if (this.match('(')) {
      const inner = this.or();
      this.expect(')');
      return inner;
    }
    throw new FormulaError(`Unexpected "${t.value}"`);
  }
}

const COMPARISON_OPS = ['<', '<=', '>', '>=', '==', '!='];

function producesBoolean(node) {
  switch (node.type) {
    case 'bool':
    case 'logical':
      return true;
    case 'unary':
      return node.op === '!';
    case 'binary':
      return COMPARISON_OPS.includes(node.op);
    case 'call':
      return node.name === 'isBlank';
    default:
      return false;
  }
}

function checkNode(node, allowedFields) {
  switch (node.type) {
    case 'ident':
      if (allowedFields && !allowedFields.includes(node.name)) {
        throw new FormulaError(`Unknown field "${node.name}"`);
      }
      break;
    case 'call':
      if (node.name !== 'isBlank') throw new FormulaError(`Unknown function "${node.name}"`);
      if (node.args.length !== 1) throw new FormulaError('isBlank() takes exactly one field');
      node.args.forEach((a) => checkNode(a, allowedFields));
      break;
    case 'unary':
      checkNode(node.operand, allowedFields);
      break;
    case 'binary':
    case 'logical':
      checkNode(node.left, allowedFields);
      checkNode(node.right, allowedFields);
      break;
    default:
      break;
  }
}

const parseCache = new Map();

/** Parses and validates a formula. Throws FormulaError if it is not acceptable. */
export function validateFormula(formula, allowedFields) {
  if (typeof formula !== 'string') throw new FormulaError('Formula must be text');
  const ast = new Parser(tokenize(formula)).parse();
  checkNode(ast, allowedFields);
  if (!producesBoolean(ast)) {
    throw new FormulaError('Formula must be a true/false test, such as "revenue < 50000"');
  }
  return ast;
}

// ---------- Evaluation ----------

export function isBlank(v) {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

function readField(record, name) {
  const v = record[name];
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return v;
}

function evaluate(node, record) {
  switch (node.type) {
    case 'num':
    case 'str':
    case 'bool':
      return node.value;
    case 'ident':
      return readField(record, node.name);
    case 'call':
      return isBlank(evaluate(node.args[0], record));
    case 'unary': {
      const v = evaluate(node.operand, record);
      if (node.op === '!') {
        if (typeof v !== 'boolean') throw new FormulaError('"!" needs a true/false value');
        return !v;
      }
      if (typeof v !== 'number') throw new FormulaError('"-" needs a number');
      return -v;
    }
    case 'logical': {
      const l = evaluate(node.left, record);
      if (typeof l !== 'boolean') throw new FormulaError(`"${node.op}" needs true/false values`);
      if (node.op === '&&' && !l) return false;
      if (node.op === '||' && l) return true;
      const r = evaluate(node.right, record);
      if (typeof r !== 'boolean') throw new FormulaError(`"${node.op}" needs true/false values`);
      return r;
    }
    case 'binary': {
      const l = evaluate(node.left, record);
      const r = evaluate(node.right, record);
      if (node.op === '==') return isBlank(l) && isBlank(r) ? true : l === r;
      if (node.op === '!=') return isBlank(l) && isBlank(r) ? false : l !== r;
      if (['<', '<=', '>', '>='].includes(node.op)) {
        // A blank or non-numeric value never satisfies a comparison.
        // Rule authors test for it explicitly with isBlank().
        if (typeof l !== 'number' || typeof r !== 'number') return false;
        if (node.op === '<') return l < r;
        if (node.op === '<=') return l <= r;
        if (node.op === '>') return l > r;
        return l >= r;
      }
      if (typeof l !== 'number' || typeof r !== 'number') {
        throw new FormulaError(`"${node.op}" needs numbers`);
      }
      if (node.op === '+') return l + r;
      if (node.op === '-') return l - r;
      if (node.op === '*') return l * r;
      return l / r;
    }
    default:
      throw new FormulaError('Unknown formula element');
  }
}

/** True when the rule fails for this record (its formula returns true). */
export function ruleFails(rule, record) {
  let ast = parseCache.get(rule.formula);
  if (!ast) {
    ast = validateFormula(rule.formula);
    parseCache.set(rule.formula, ast);
  }
  return evaluate(ast, record) === true;
}

// ---------- Rule administration ----------

let nextRuleNumber = 100;

/** Adds a rule to a template after validating every part of it. */
export function createRule(template, rule) {
  const { type, formula, description, highlight } = rule;
  if (type !== 'mandatory' && type !== 'desired') {
    throw new RuleError('Rule type must be "mandatory" or "desired"');
  }
  if (typeof description !== 'string' || description.trim() === '') {
    throw new RuleError('A description is required (it is shown as the tooltip)');
  }
  if (!Array.isArray(highlight) || highlight.length === 0) {
    throw new RuleError('Choose at least one field to highlight');
  }
  const fieldNames = template.fields.map((f) => f.name);
  for (const f of highlight) {
    if (!fieldNames.includes(f)) throw new RuleError(`Cannot highlight unknown field "${f}"`);
  }
  try {
    validateFormula(formula, fieldNames);
  } catch (err) {
    if (err instanceof FormulaError) throw new RuleError(`Invalid formula: ${err.message}`);
    throw err;
  }
  const saved = {
    id: rule.id || `R${++nextRuleNumber}`,
    type,
    formula,
    description: description.trim(),
    highlight: [...highlight],
  };
  template.rules.push(saved);
  return saved;
}

// ---------- Running all rules for a record ----------

/**
 * Runs every rule in a template against a record.
 * Status: Blocked if any mandatory rule failed, Warning if only desired rules
 * failed, Passed if nothing failed. Nothing here stops anyone from saving.
 */
export function runChecks(template, record) {
  const failedRules = [];
  const highlights = {};
  for (const rule of template.rules) {
    if (!ruleFails(rule, record)) continue;
    failedRules.push(rule);
    for (const field of rule.highlight) {
      const entry = highlights[field] || { type: 'desired', color: template.colors.desired, messages: [] };
      if (rule.type === 'mandatory') {
        entry.type = 'mandatory';
        entry.color = template.colors.mandatory;
      }
      entry.messages.push(rule.description);
      highlights[field] = entry;
    }
  }
  let status = 'Passed';
  if (failedRules.some((r) => r.type === 'mandatory')) status = 'Blocked';
  else if (failedRules.length > 0) status = 'Warning';
  return { status, failedRules, highlights };
}
