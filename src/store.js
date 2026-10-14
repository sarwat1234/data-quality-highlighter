import { sampleTemplate, sampleCustomers } from './data.js';

/** A tiny in-memory store. Everything resets when the server restarts. */
export function createStore() {
  const template = sampleTemplate();
  return {
    templates: { [template.id]: template },
    customers: sampleCustomers(),
  };
}
