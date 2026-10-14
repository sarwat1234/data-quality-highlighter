import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore } from './src/store.js';
import { createRule, RuleError } from './src/engine.js';
import { checkCustomer, saveCustomer, NotFoundError, UnsupportedRequestError } from './src/api.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const store = createStore();
const templateId = 'small-business';
const PORT = process.env.PORT || 3000;

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': mime['.json'] });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error('Invalid JSON')); }
    });
  });
}

function serveStatic(res, urlPath) {
  const rel = urlPath === '/' ? '/public/index.html' : urlPath;
  const allowed = rel.startsWith('/public/') || rel.startsWith('/src/');
  const file = path.join(root, rel);
  if (!allowed || !file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;
  try {
    if (req.method === 'GET' && p === '/api/template') return sendJson(res, 200, store.templates[templateId]);
    if (req.method === 'GET' && p === '/api/customers') return sendJson(res, 200, Object.values(store.customers));

    let m = p.match(/^\/api\/customers\/([^/]+)\/check$/);
    if (req.method === 'GET' && m) return sendJson(res, 200, checkCustomer(store, decodeURIComponent(m[1])));

    m = p.match(/^\/api\/customers\/([^/]+)$/);
    if (req.method === 'POST' && m) {
      const body = await readBody(req);
      return sendJson(res, 200, saveCustomer(store, decodeURIComponent(m[1]), body.record || {}));
    }

    if (req.method === 'POST' && p === '/api/rules') {
      const body = await readBody(req);
      return sendJson(res, 201, createRule(store.templates[templateId], body));
    }

    if (p.startsWith('/api/')) return sendJson(res, 404, { error: 'Unknown endpoint' });
    return serveStatic(res, p);
  } catch (err) {
    if (err instanceof NotFoundError) return sendJson(res, 404, { error: err.message });
    if (err instanceof RuleError || err instanceof UnsupportedRequestError || err.message === 'Invalid JSON') {
      return sendJson(res, 400, { error: err.message });
    }
    console.error(err);
    return sendJson(res, 500, { error: 'Something went wrong' });
  }
});

server.listen(PORT, () => {
  console.log(`Demo running at http://localhost:${PORT}  (press Ctrl+C to stop)`);
});
