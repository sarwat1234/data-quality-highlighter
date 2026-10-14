import { FormSession } from '/src/session.js';

const $ = (id) => document.getElementById(id);
let template;
let customers = [];
let session;

async function getJson(url, options) {
  const res = await fetch(url, options);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Request failed');
  return body;
}

function say(el, text, kind) {
  el.textContent = text;
  el.className = `message ${kind || ''}`;
}

function currentCustomer() {
  return customers.find((c) => c.id === $('customer').value);
}

function renderForm() {
  const form = $('form');
  form.innerHTML = '';
  for (const f of template.fields) {
    const wrap = document.createElement('div');
    wrap.className = 'field';
    wrap.dataset.field = f.name;
    const label = document.createElement('label');
    label.textContent = f.label;
    const input = document.createElement('input');
    input.type = f.type === 'number' ? 'number' : 'text';
    input.value = session.record[f.name] ?? '';
    input.addEventListener('input', () => session.setValue(f.name, input.value));
    wrap.append(label, input);
    form.append(wrap);
  }
  applyHighlights();
}

function applyHighlights() {
  for (const wrap of $('form').children) {
    const h = session.highlights[wrap.dataset.field];
    wrap.classList.toggle('flagged', Boolean(h));
    if (h) {
      wrap.style.setProperty('--halo', h.color);
      wrap.dataset.tip = session.tooltipFor(wrap.dataset.field);
    } else {
      wrap.style.removeProperty('--halo');
      delete wrap.dataset.tip;
    }
  }
}

function renderRules() {
  const body = document.querySelector('#rules tbody');
  body.innerHTML = '';
  for (const r of template.rules) {
    const tr = document.createElement('tr');
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.style.background = template.colors[r.type];
    badge.textContent = r.type;
    const cells = [r.id, null, r.formula, r.description, r.highlight.join(', ')];
    cells.forEach((text, i) => {
      const td = document.createElement('td');
      if (i === 1) td.append(badge);
      else if (i === 2) { const c = document.createElement('code'); c.textContent = text; td.append(c); }
      else td.textContent = text;
      tr.append(td);
    });
    body.append(tr);
  }
}

function startSession() {
  session = new FormSession(template, currentCustomer().record);
  say($('message'), '');
  $('api-result').textContent = 'Press the button to call GET /api/customers/<id>/check';
  renderForm();
}

$('customer').addEventListener('change', startSession);

$('check').addEventListener('click', () => {
  const highlights = session.pressCheck();
  applyHighlights();
  const n = Object.keys(highlights).length;
  say($('message'), n ? `${n} field(s) need attention. Hover over a highlighted field for details.` : '', '');
});

$('save').addEventListener('click', async () => {
  try {
    const saved = await session.save((record) =>
      getJson(`/api/customers/${encodeURIComponent($('customer').value)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record }),
      }));
    currentCustomer().record = saved.record;
    say($('message'), 'Saved. (Saving is never blocked by the rules.)', 'ok');
  } catch (err) {
    say($('message'), err.message, 'error');
  }
});

$('api').addEventListener('click', async () => {
  try {
    const result = await getJson(`/api/customers/${encodeURIComponent($('customer').value)}/check`);
    $('api-result').textContent = JSON.stringify(result, null, 2);
  } catch (err) {
    $('api-result').textContent = err.message;
  }
});

$('r-add').addEventListener('click', async () => {
  const msg = $('rule-message');
  try {
    await getJson('/api/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formula: $('r-formula').value,
        type: $('r-type').value,
        description: $('r-desc').value,
        highlight: $('r-fields').value.split(',').map((s) => s.trim()).filter(Boolean),
      }),
    });
    template = await getJson('/api/template');
    session.template = template;
    renderRules();
    say(msg, 'Rule added. Press "Check data quality" to try it.', 'ok');
  } catch (err) {
    say(msg, err.message, 'error');
  }
});

async function init() {
  template = await getJson('/api/template');
  customers = await getJson('/api/customers');
  for (const c of customers) {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.id}: ${c.record.customerName}`;
    $('customer').append(opt);
  }
  renderRules();
  startSession();
}

init();
