import { runChecks } from './engine.js';

/**
 * The behaviour behind the on-screen form, kept separate from the HTML so it
 * can be tested. Checks only run when the user asks (FR-06), highlights stay
 * until the check is run again (FR-09), and saving is never blocked (FR-12).
 */
export class FormSession {
  constructor(template, record) {
    this.template = template;
    this.record = { ...record };
    this.highlights = {};
  }

  setValue(field, value) {
    this.record[field] = value;
  }

  pressCheck() {
    this.highlights = runChecks(this.template, this.record).highlights;
    return this.highlights;
  }

  tooltipFor(field) {
    const h = this.highlights[field];
    return h ? h.messages.join('\n') : '';
  }

  canSave() {
    return true;
  }

  save(saveFn) {
    return saveFn({ ...this.record });
  }
}
