import { runChecks } from './engine.js';

export class UnsupportedRequestError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnsupportedRequestError';
  }
}

export class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
  }
}

/**
 * Data quality status for ONE customer (FR-10, FR-11).
 * Returns { customerId, status, failedRules } where status is
 * Blocked, Warning or Passed.
 */
export function checkCustomer(store, customerId) {
  if (Array.isArray(customerId)) {
    throw new UnsupportedRequestError('Checking more than one customer per call is not supported');
  }
  const customer = store.customers[customerId];
  if (!customer) throw new NotFoundError(`Customer ${customerId} not found`);
  const template = store.templates[customer.templateId];
  const { status, failedRules } = runChecks(template, customer.record);
  return {
    customerId,
    status,
    failedRules: failedRules.map(({ id, type, description }) => ({ id, type, description })),
  };
}

export function saveCustomer(store, customerId, record) {
  const customer = store.customers[customerId];
  if (!customer) throw new NotFoundError(`Customer ${customerId} not found`);
  customer.record = { ...record };
  return customer;
}
