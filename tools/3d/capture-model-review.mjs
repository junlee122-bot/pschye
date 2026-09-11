import { access, mkdir, readdir, rm, truncate, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const cdpPort = process.env.CDP_PORT ?? '9223';
const targetUrl = process.argv[2] ?? 'http://127.0.0.1:4173/?section=archive&archive=models';
const outputPath = path.resolve(process.argv[3] ?? 'docs/screenshots/3d-review-desktop.jpg');
const viewportWidth = Number.parseInt(process.env.REVIEW_WIDTH ?? '1440', 10);
const viewportHeight = Number.parseInt(process.env.REVIEW_HEIGHT ?? '1000', 10);
const mobileViewport = process.env.REVIEW_MOBILE === 'true';

let chromeProcess = null;
let profilePath = null;
let reviewServerProcess = null;
async function devtoolsReady() {
  try {
    const response = await fetch(`http://127.0.0.1:${cdpPort}/json/version`);
    return response.ok;
  } catch {
    return false;
  }
}

async function targetReady() {
  try {
    const response = await fetch(targetUrl);
    return response.ok;
  } catch {
    return false;
  }
}

if (!await targetReady()) {
  const reviewUrl = new URL(targetUrl);
  const isAppReview = reviewUrl.searchParams.get('section') === 'archive';
  let usePreview = false;
  if (isAppReview) {
    try {
      await access(path.resolve('dist', 'index.html'));
      usePreview = true;
    } catch {
      usePreview = false;
    }
  }
  const executable = process.execPath;
  const args = isAppReview
    ? [
        'node_modules/vite/bin/vite.js',
        ...(usePreview ? ['preview'] : []),
        '--host',
        '127.0.0.1',
        '--port',
        reviewUrl.port || '4318',
      ]
    : ['tools/3d/serve-model-review.mjs'];
  reviewServerProcess = spawn(executable, args, {
    cwd: process.cwd(),
    env: { ...process.env, REVIEW_PORT: reviewUrl.port || '4318' },
    stdio: 'ignore',
    windowsHide: true,
  });
  for (let attempt = 0; attempt < 30 && !await targetReady(); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!await targetReady()) {
    reviewServerProcess.kill();
    throw new Error(`Review server did not start for ${targetUrl}`);
  }
}

if (!await devtoolsReady()) {
  const browserCandidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  let browserPath = null;
  for (const candidate of browserCandidates) {
    try {
      await access(candidate);
      browserPath = candidate;
      break;
    } catch {
      // Continue to the next installed browser candidate.
    }
  }
  if (!browserPath) throw new Error('Chrome or Edge executable was not found');
  profilePath = path.resolve('.tmp', `cdp-model-review-${process.pid}-${Date.now()}`);
  await mkdir(profilePath, { recursive: true });
  chromeProcess = spawn(browserPath, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-application-cache',
    '--disk-cache-size=1048576',
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${profilePath}`,
    'about:blank',
  ], {
    stdio: 'ignore',
    windowsHide: true,
  });
  for (let attempt = 0; attempt < 30 && !await devtoolsReady(); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  if (!await devtoolsReady()) {
    chromeProcess.kill();
    throw new Error('Chrome DevTools did not start');
  }
}

const targets = await fetch(`http://127.0.0.1:${cdpPort}/json/list`).then((response) => response.json());
const target = targets.find((candidate) => candidate.type === 'page');
if (!target?.webSocketDebuggerUrl) throw new Error('Chrome DevTools page target was not found');

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let sequence = 0;
const pending = new Map();
const diagnostics = [];
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.method === 'Runtime.exceptionThrown') {
    diagnostics.push({
      type: 'exception',
      text: message.params?.exceptionDetails?.text ?? 'Runtime exception',
      description: message.params?.exceptionDetails?.exception?.description ?? null,
    });
  }
  if (message.method === 'Log.entryAdded') {
    diagnostics.push({
      type: message.params?.entry?.level ?? 'log',
      text: message.params?.entry?.text ?? '',
      url: message.params?.entry?.url ?? null,
    });
  }
  if (message.method === 'Network.loadingFailed') {
    diagnostics.push({
      type: 'network-failure',
      text: message.params?.errorText ?? 'Network request failed',
      requestId: message.params?.requestId ?? null,
    });
  }
  if (!message.id) return;
  const operation = pending.get(message.id);
  if (!operation) return;
  pending.delete(message.id);
  if (message.error) operation.reject(new Error(message.error.message));
  else operation.resolve(message.result);
});

function send(method, params = {}) {
  sequence += 1;
  socket.send(JSON.stringify({ id: sequence, method, params }));
  return new Promise((resolve, reject) => pending.set(sequence, { resolve, reject }));
}

async function stopProcessTree(child) {
  if (!child?.pid) return;
  if (process.platform === 'win32') {
    await new Promise((resolve) => {
      const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
      killer.on('close', resolve);
      killer.on('error', resolve);
    });
  } else {
    child.kill('SIGKILL');
  }
}

await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');
await send('Network.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: viewportWidth,
  height: viewportHeight,
  deviceScaleFactor: mobileViewport ? 2 : 1,
  mobile: mobileViewport,
});
await send('Page.navigate', { url: targetUrl });
await new Promise((resolve) => setTimeout(resolve, 18_000));

const modelLoadAudit = await send('Runtime.evaluate', {
  expression: `(async () => {
    const overrides = await fetch('/data/model-provider-overrides.json').then((response) => response.json());
    const results = [];
    for (const model of overrides.models ?? []) {
      const button = document.querySelector('[data-model-id="' + CSS.escape(model.id) + '"]');
      if (!(button instanceof HTMLButtonElement)) {
        results.push({ id: model.id, loaded: false, reason: 'card-missing' });
        continue;
      }
      button.click();
      const startedAt = performance.now();
      let viewer = null;
      while (performance.now() - startedAt < 12000) {
        viewer = document.querySelector('model-viewer');
        if (viewer?.loaded && String(viewer.src).endsWith(model.runtimePath)) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      results.push({
        id: model.id,
        loaded: Boolean(viewer?.loaded),
        sourceMatches: Boolean(viewer && String(viewer.src).endsWith(model.runtimePath)),
        source: viewer ? String(viewer.src) : null,
      });
    }
    return results;
  })()`,
  awaitPromise: true,
  returnByValue: true,
});

const animationAudit = await send('Runtime.evaluate', {
  expression: `(async () => {
    const raonButton = document.querySelector('[data-model-id="raon-blender-rigged-v1"]');
    if (raonButton instanceof HTMLButtonElement) raonButton.click();
    const startedAt = performance.now();
    let viewer = null;
    while (performance.now() - startedAt < 12000) {
      viewer = document.querySelector('model-viewer');
      if (viewer?.loaded && String(viewer.src).includes('raon-blender-rigged-v1.glb')) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const select = document.querySelector('#model-animation-select');
    if (select instanceof HTMLSelectElement) {
      select.value = 'run';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
    return {
      loaded: Boolean(viewer?.loaded),
      source: viewer ? String(viewer.src) : null,
      selectedAnimation: viewer?.animationName ?? null,
      availableAnimations: Array.from(viewer?.availableAnimations ?? []),
      controlOptions: select instanceof HTMLSelectElement
        ? Array.from(select.options, (option) => option.value)
        : [],
    };
  })()`,
  awaitPromise: true,
  returnByValue: true,
});

const moduleProbe = await send('Runtime.evaluate', {
  expression: `fetch(location.pathname)
    .then((response) => ({ ok: response.ok, status: response.status }))
    .catch((error) => ({ ok: false, status: 0, error: String(error) }))`,
  awaitPromise: true,
  returnByValue: true,
});
const inspection = await send('Runtime.evaluate', {
  expression: `(() => {
    const viewer = document.querySelector('model-viewer');
    return {
      title: document.title,
      bodyLength: document.body.innerText.trim().length,
      errorOverlay: Boolean(document.querySelector('.vite-error-overlay, #webpack-dev-server-client-overlay')),
      viewerDefined: Boolean(customElements.get('model-viewer')),
      viewerPresent: Boolean(viewer),
      viewerLoaded: Boolean(viewer && viewer.loaded),
      viewerSource: viewer?.getAttribute('src') ?? null,
      selectedAnimation: viewer?.animationName ?? null,
      availableAnimations: Array.from(viewer?.availableAnimations ?? []),
      animationControlPresent: Boolean(document.querySelector('#model-animation-select')),
      modelCards: document.querySelectorAll('.model-review-card').length,
      selectedName: document.querySelector('.model-review-inspector h3')?.textContent ?? null,
      rootHtml: document.querySelector('#root')?.innerHTML.slice(0, 500) ?? null,
      scripts: [...document.scripts].map((script) => script.src || script.textContent?.slice(0, 80)),
      resources: performance.getEntriesByType('resource').map((entry) => entry.name).slice(0, 30),
    };
  })()`,
  returnByValue: true,
});
const screenshot = await send('Page.captureScreenshot', {
  format: 'jpeg',
  quality: 84,
  captureBeyondViewport: false,
  fromSurface: true,
});

socket.close();
await stopProcessTree(chromeProcess);
await stopProcessTree(reviewServerProcess);
await new Promise((resolve) => setTimeout(resolve, 500));
if (profilePath) {
  async function truncateTree(directory) {
    let entries = [];
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await truncateTree(absolute);
      else if (entry.isFile()) {
        try {
          await truncate(absolute, 0);
        } catch {
          // Locked telemetry files are harmless and are removed on the next capture.
        }
      }
    }
  }
  await truncateTree(profilePath);
  try {
    await rm(profilePath, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 });
  } catch {
    // Windows can briefly hold Chrome telemetry files after process shutdown.
  }
}
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, Buffer.from(screenshot.data, 'base64'));
console.log(JSON.stringify(inspection.result.value, null, 2));
console.log(JSON.stringify({ moduleProbe: moduleProbe.result.value }, null, 2));
console.log(JSON.stringify({ modelLoadAudit: modelLoadAudit.result.value }, null, 2));
console.log(JSON.stringify({ animationAudit: animationAudit.result.value }, null, 2));
if (diagnostics.length) console.log(JSON.stringify({ diagnostics }, null, 2));
console.log(`screenshot: ${outputPath}`);
