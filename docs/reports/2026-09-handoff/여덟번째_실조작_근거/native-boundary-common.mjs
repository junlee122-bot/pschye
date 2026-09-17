import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('<LOCAL_USER_HOME>/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
export const work = path.dirname(fileURLToPath(import.meta.url));
export const origin = 'http://127.0.0.1:4409';
export const key = 'raonjena-campaign-v10-slot-';
export function write(name, value) { fs.writeFileSync(path.join(work, 'native-boundary-' + name + '.json'), JSON.stringify(value, null, 2)); }
export function clean(profile) { if (!profile) return profile; const copy = structuredClone(profile); delete copy._savedAt; return copy; }
export async function create(name, state = 'native-village-near-kazrin-storage.json') {
  const browser = await chromium.launch({ headless: true, executablePath: '<LOCAL_PROGRAM_FILES> (x86)/Microsoft/Edge/Application/msedge.exe', args: ['--disk-cache-size=1048576'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, storageState: state ? path.join(work, state) : undefined });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const logs = [], requests = [], steps = [];
  page.on('pageerror', error => logs.push({ type: 'pageerror', message: error.message }));
  page.on('console', message => { if (['warning', 'error'].includes(message.type())) logs.push({ type: message.type(), message: message.text() }); });
  page.on('requestfailed', request => requests.push({ url: request.url(), error: request.failure() }));
  const run = { browser, context, page, name, logs, requests, steps, screenshots: [],
    async profile(slot = 1) { return page.evaluate(({ key, slot }) => JSON.parse(localStorage.getItem(key + slot)), { key, slot }); },
    async backup(slot = 1) { return page.evaluate(slot => new Promise((resolve, reject) => { const open = indexedDB.open('raonjena-saves', 1); open.onerror = () => reject(open.error); open.onsuccess = () => { const db = open.result; const tx = db.transaction('campaign-slots', 'readonly'); const read = tx.objectStore('campaign-slots').get(slot); read.onerror = () => { db.close(); reject(read.error); }; read.onsuccess = () => { const result = read.result ?? null; tx.oncomplete = () => { db.close(); resolve(result); }; }; }; }), slot); },
    async xy() { return page.locator('.village-minimap').evaluate(el => ({ x: parseFloat(el.style.getPropertyValue('--village-player-x')) * 12.8, y: parseFloat(el.style.getPropertyValue('--village-player-y')) * 7.2 })); },
    async snap(label) {
      const file = path.join(work, 'native-boundary-' + name + '-' + label + '.png');
      await page.screenshot({ path: file, fullPage: true }); run.screenshots.push(file); return file;
    },
    async metrics() { return page.evaluate(() => ({ viewport: { width: innerWidth, height: innerHeight }, document: { client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }, body: { client: document.body.clientWidth, scroll: document.body.scrollWidth }, buttons: [...document.querySelectorAll('button')].filter(el => el.getClientRects().length).map(el => { const b = el.getBoundingClientRect(); return { name: el.getAttribute('aria-label') || el.textContent.trim(), x: b.x, y: b.y, width: b.width, height: b.height }; }) })); },
    record(label, data) { steps.push({ label, checkedAt: new Date().toISOString(), data }); write(name, { origin, sourceCommit: 'bbcf10eed6a359fc54d37b16caa9f533b939dcf5', browserVersion: browser.version(), checkpoint: state, steps, logs, requests, screenshots: run.screenshots }); console.log(label); },
    async finish(error) { if (error) run.record('failure', { message: error.message, stack: error.stack }); await context.close(); await browser.close(); run.record('cleanup', { contextClosed: true, browserClosed: true, rootServerUnchanged: true }); },
  };
  return run;
}
