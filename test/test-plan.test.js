// Automated versions of the sample test cases in docs/Test_Plan (TC-01 to TC-19).
// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleTemplate } from '../src/data.js';
import { createStore } from '../src/store.js';
import { createRule, runChecks, RuleError } from '../src/engine.js';
import { checkCustomer, saveCustomer, UnsupportedRequestError } from '../src/api.js';
import { FormSession } from '../src/session.js';

// A clean record that passes every rule in the sample template.
const good = () => ({ customerName: 'Test Co', revenue: 100000, netIncome: 9000, cost: 50000, costComment: '' });

// A template with no rules, for tests that add their own rule.
const emptyTemplate = () => ({ ...sampleTemplate(), rules: [] });

test('TC-01 admin creates a mandatory rule with formula, description and highlight field (FR-01, 02, 05)', () => {
  const t = emptyTemplate();
  const rule = createRule(t, {
    type: 'mandatory',
    formula: 'revenue < 50000',
    description: 'Revenue should be at least 50,000.',
    highlight: ['revenue'],
  });
  assert.equal(t.rules.length, 1);
  assert.equal(t.rules[0].id, rule.id);
  assert.equal(t.rules[0].type, 'mandatory');
  assert.equal(t.rules[0].description, 'Revenue should be at least 50,000.');
});

test('TC-02 invalid formulas are rejected and not saved (FR-14)', () => {
  const t = emptyTemplate();
  const bad = ['revenue <', '(revenue < 5', 'revenue ** 2', 'nonsense > 3', 'revenue + 1', '', 'drop(revenue)'];
  for (const formula of bad) {
    assert.throws(
      () => createRule(t, { type: 'mandatory', formula, description: 'x', highlight: ['revenue'] }),
      RuleError,
      `expected "${formula}" to be rejected`,
    );
  }
  assert.equal(t.rules.length, 0);
});

test('TC-03 rule fails when revenue is 49,999 and highlights revenue (FR-03)', () => {
  const t = emptyTemplate();
  createRule(t, { type: 'mandatory', formula: 'revenue < 50000', description: 'Revenue low', highlight: ['revenue'] });
  const result = runChecks(t, { ...good(), revenue: 49999 });
  assert.equal(result.failedRules.length, 1);
  assert.ok(result.highlights.revenue);
});

test('TC-04 boundary: revenue of exactly 50,000 does not fail (FR-03)', () => {
  const t = emptyTemplate();
  createRule(t, { type: 'mandatory', formula: 'revenue < 50000', description: 'Revenue low', highlight: ['revenue'] });
  const result = runChecks(t, { ...good(), revenue: 50000 });
  assert.equal(result.failedRules.length, 0);
  assert.deepEqual(result.highlights, {});
});

test('TC-05 desired rule: cost above 100k with no comment is a warning; a comment clears it (FR-03)', () => {
  const t = sampleTemplate();
  const record = { ...good(), cost: 150000, costComment: '' };
  const first = runChecks(t, record);
  assert.equal(first.status, 'Warning');
  assert.equal(first.highlights.costComment.type, 'desired');
  const second = runChecks(t, { ...record, costComment: 'One-off equipment purchase' });
  assert.equal(second.status, 'Passed');
  assert.equal(second.highlights.costComment, undefined);
});

test('TC-06 a revenue rule can highlight net income instead (FR-04)', () => {
  const t = emptyTemplate();
  createRule(t, { type: 'mandatory', formula: 'revenue < 50000', description: 'Check income', highlight: ['netIncome'] });
  const { highlights } = runChecks(t, { ...good(), revenue: 10 });
  assert.ok(highlights.netIncome);
  assert.equal(highlights.revenue, undefined);
});

test('TC-07 one rule can highlight several fields (FR-04)', () => {
  const t = emptyTemplate();
  createRule(t, { type: 'desired', formula: 'netIncome > revenue', description: 'Income above revenue', highlight: ['netIncome', 'revenue', 'cost'] });
  const { highlights } = runChecks(t, { ...good(), netIncome: 500000 });
  assert.deepEqual(Object.keys(highlights).sort(), ['cost', 'netIncome', 'revenue']);
});

test('TC-08 no highlights appear until the check button is pressed (FR-06)', () => {
  const session = new FormSession(sampleTemplate(), { ...good(), revenue: 100 });
  assert.deepEqual(session.highlights, {});
  session.pressCheck();
  assert.ok(session.highlights.revenue);
});

test('TC-09 mandatory and desired failures use different colors (FR-07)', () => {
  const t = sampleTemplate();
  const session = new FormSession(t, { ...good(), revenue: 100, cost: 200000 });
  const h = session.pressCheck();
  assert.equal(h.revenue.type, 'mandatory');
  assert.equal(h.costComment.type, 'desired');
  assert.equal(h.revenue.color, t.colors.mandatory);
  assert.equal(h.costComment.color, t.colors.desired);
  assert.notEqual(h.revenue.color, h.costComment.color);
});

test('TC-10 tooltip shows the rule description (FR-08)', () => {
  const session = new FormSession(sampleTemplate(), { ...good(), revenue: 100 });
  session.pressCheck();
  assert.equal(session.tooltipFor('revenue'), 'Revenue should be at least 50,000.');
});

test('TC-11 fixing one field and re-running clears only that highlight (FR-09)', () => {
  const session = new FormSession(sampleTemplate(), { ...good(), revenue: 100, customerName: '' });
  session.pressCheck();
  assert.ok(session.highlights.revenue);
  assert.ok(session.highlights.customerName);
  session.setValue('revenue', 75000);
  assert.ok(session.highlights.revenue, 'highlight stays until the check is run again');
  session.pressCheck();
  assert.equal(session.highlights.revenue, undefined);
  assert.ok(session.highlights.customerName);
});

test('TC-12 when all rules pass there are no highlights and no message (FR-13)', () => {
  const session = new FormSession(sampleTemplate(), good());
  const highlights = session.pressCheck();
  assert.deepEqual(highlights, {});
  assert.equal(runChecks(sampleTemplate(), good()).status, 'Passed');
});

test('TC-13 saving and progressing are allowed even when rules fail (FR-12)', () => {
  const store = createStore();
  const session = new FormSession(store.templates['small-business'], { ...good(), revenue: 1, customerName: '' });
  session.pressCheck();
  assert.equal(session.canSave(), true);
  session.save((record) => saveCustomer(store, 'C-1002', record));
  assert.equal(store.customers['C-1002'].record.revenue, 1);
});

test('TC-14 API: failed mandatory rule returns Blocked with failed rules listed (FR-10, 11)', () => {
  const result = checkCustomer(createStore(), 'C-1002');
  assert.equal(result.status, 'Blocked');
  assert.deepEqual(result.failedRules.map((r) => r.id), ['R002']);
});

test('TC-15 API: only desired rules failing returns Warning (FR-11)', () => {
  const result = checkCustomer(createStore(), 'C-1003');
  assert.equal(result.status, 'Warning');
  assert.deepEqual(result.failedRules.map((r) => r.id), ['R003']);
});

test('TC-16 API: mandatory and desired both failing returns Blocked, listing all (FR-11)', () => {
  const result = checkCustomer(createStore(), 'C-1004');
  assert.equal(result.status, 'Blocked');
  const types = new Set(result.failedRules.map((r) => r.type));
  assert.ok(types.has('mandatory') && types.has('desired'));
});

test('TC-17 API: no failures returns Passed (FR-11)', () => {
  const result = checkCustomer(createStore(), 'C-1001');
  assert.equal(result.status, 'Passed');
  assert.deepEqual(result.failedRules, []);
});

test('TC-18 API: more than one customer in a call is not supported (FR-10)', () => {
  assert.throws(() => checkCustomer(createStore(), ['C-1001', 'C-1002']), UnsupportedRequestError);
});

test('TC-19 regression: running checks does not change data, and existing save still works', () => {
  // The browser part of this case (Chrome and Edge) is checked by hand, not here.
  const store = createStore();
  const before = JSON.stringify(store.customers['C-1002'].record);
  checkCustomer(store, 'C-1002');
  runChecks(store.templates['small-business'], store.customers['C-1002'].record);
  assert.equal(JSON.stringify(store.customers['C-1002'].record), before);
  saveCustomer(store, 'C-1002', { ...store.customers['C-1002'].record, customerName: 'Renamed' });
  assert.equal(store.customers['C-1002'].record.customerName, 'Renamed');
});
