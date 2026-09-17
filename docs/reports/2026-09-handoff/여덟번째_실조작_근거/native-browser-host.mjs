import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('<LOCAL_USER_HOME>/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const work = path.dirname(fileURLToPath(import.meta.url));
const repo = '<LOCAL_REPOSITORY>';
const dist = path.join(repo, 'dist');
const publicRoot = path.join(repo, 'public');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
const site = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://127.0.0.1:4409').pathname);
  const assetRoot = /^\/(art|models|content|data)\//.test(rel) ? publicRoot : dist;
  const file = path.resolve(assetRoot, '.' + (rel === '/' ? '/index.html' : rel));
  if (!file.startsWith(assetRoot + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((resolve) => site.listen(4409, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true, executablePath: '<LOCAL_PROGRAM_FILES> (x86)/Microsoft/Edge/Application/msedge.exe', args: ['--disk-cache-size=1048576', '--media-cache-size=1048576'] });
const context = await browser.newContext({ viewport: { width: 1365, height: 900 }, hasTouch: true, storageState: path.join(work, 'native-emergency-storage.json') });
const page = await context.newPage();
page.setDefaultTimeout(10000);
const errors = [], failedRequests = [], steps = JSON.parse(fs.readFileSync(path.join(work, 'native-root-steps.json'), 'utf8'));
page.on('pageerror', (e) => errors.push({ type: 'pageerror', message: e.message }));
page.on('console', (m) => { if (m.type() === 'error') errors.push({ type: 'console', message: m.text() }); });
page.on('requestfailed', (r) => failedRequests.push({ url: r.url(), failure: r.failure() }));
const state = { browser, context, page, work, repo, fs, errors, failedRequests, steps,
  async profile(slot = 1) { return page.evaluate((slot) => { const key = Object.keys(localStorage).find(k => k.endsWith('slot-' + slot)); return key ? JSON.parse(localStorage.getItem(key)).profile : null; }, slot); },
  async snap(name) { const file = path.join(work, 'native-' + name + '.png'); await page.screenshot({ path: file, fullPage: true }); return file; },
  log(name, data) { steps.push({ name, at: new Date().toISOString(), data }); fs.writeFileSync(path.join(work, 'native-root-steps.json'), JSON.stringify(steps, null, 2)); console.log(name); },
};
let busy = false;
const control = http.createServer(async (req, res) => {
  if (req.url !== '/run' || req.method !== 'POST') return res.writeHead(404).end();
  if (busy) return res.writeHead(409).end('Busy');
  busy = true;
  try {
    let body = ''; for await (const chunk of req) body += chunk;
    const file = path.resolve(work, JSON.parse(body).file);
    if (!file.startsWith(work + path.sep)) throw new Error('Steps must be in work');
    const mod = await import(pathToFileURL(file).href + '?v=' + Date.now());
    const result = await mod.default(state);
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(result ?? { ok: true }));
  } catch (e) {
    const error = { message: e.message, stack: e.stack };
    try { fs.writeFileSync(path.join(work, 'native-root-last-error.json'), JSON.stringify(error, null, 2)); } catch {}
    res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify(error));
  } finally { busy = false; }
});
await new Promise((resolve) => control.listen(4410, '127.0.0.1', resolve));
console.log(JSON.stringify({ ready: true, origin: 'http://127.0.0.1:4409', control: 4410, browser: browser.version() }));
async function cleanup() {
  await browser.close().catch(() => {});
  try { fs.writeFileSync(path.join(work, 'native-root-errors.json'), JSON.stringify({ errors, failedRequests }, null, 2)); } catch {}
  control.close(); site.close(); process.exit(0);
}
process.on('SIGINT', cleanup); process.on('SIGTERM', cleanup);
