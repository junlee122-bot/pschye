import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const projectRoot = process.cwd();
const manifest = JSON.parse(await readFile(
  path.join(projectRoot, 'tools', '3d', 'hitem3d-production-manifest.json'),
  'utf8',
));
const outputRoot = path.join(projectRoot, 'artifacts', '3d', 'hitem3d-inputs');
const serverPort = process.env.HITEM_PREP_PORT ?? '4320';
const cdpPort = process.env.HITEM_PREP_CDP_PORT ?? '9225';
const profilePath = path.join(projectRoot, '.tmp', 'cdp-hitem-prep');
const outputWidth = 768;
const outputHeight = 1152;
const characterArgument = process.argv.find((argument) => argument.startsWith('--character='));
const requestedCharacterId = characterArgument?.split('=', 2)[1]?.trim() || null;
const selectedCharacters = requestedCharacterId
  ? manifest.characters.filter((character) => character.characterId === requestedCharacterId)
  : manifest.characters;

if (requestedCharacterId && selectedCharacters.length === 0) {
  throw new Error(`Unknown character: ${requestedCharacterId}`);
}

async function isReady(url) {
  try {
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
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

const serverRoot = `http://127.0.0.1:${serverPort}`;
let serverProcess = null;
let browserProcess = null;
if (!await isReady(`${serverRoot}/data/model-runtime-catalog.json`)) {
  serverProcess = spawn(process.execPath, ['tools/3d/serve-model-review.mjs'], {
    cwd: projectRoot,
    env: { ...process.env, REVIEW_PORT: serverPort },
    stdio: 'ignore',
    windowsHide: true,
  });
  for (let attempt = 0; attempt < 30 && !await isReady(`${serverRoot}/data/model-runtime-catalog.json`); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}
if (!await isReady(`${serverRoot}/data/model-runtime-catalog.json`)) {
  serverProcess?.kill();
  throw new Error('Reference asset server did not start.');
}

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
    // Try the next installed browser.
  }
}
if (!browserPath) throw new Error('Chrome or Edge executable was not found.');

await mkdir(profilePath, { recursive: true });
browserProcess = spawn(browserPath, [
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
for (let attempt = 0; attempt < 30 && !await isReady(`http://127.0.0.1:${cdpPort}/json/version`); attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 350));
}
if (!await isReady(`http://127.0.0.1:${cdpPort}/json/version`)) {
  await stopProcessTree(browserProcess);
  serverProcess?.kill();
  throw new Error('Chrome DevTools did not start.');
}

const targets = await fetch(`http://127.0.0.1:${cdpPort}/json/list`).then((response) => response.json());
const target = targets.find((candidate) => candidate.type === 'page');
if (!target?.webSocketDebuggerUrl) throw new Error('Chrome page target was not found.');
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let sequence = 0;
const pending = new Map();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
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

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: outputWidth,
  height: outputHeight,
  deviceScaleFactor: 1,
  mobile: false,
});

const report = [];
try {
  for (const character of selectedCharacters) {
    const characterDirectory = path.join(outputRoot, character.characterId);
    await mkdir(characterDirectory, { recursive: true });
    const sourceUrl = `${serverRoot}${character.sourceSheet}`;
    for (const view of character.views) {
      const crop = character[`${view}Crop`];
      if (!crop) throw new Error(`Missing ${view} crop for ${character.characterId}`);
      const [sourceWidth, sourceHeight] = character.sourceDimensions ?? [1024, 1536];
      const scale = Math.min(outputWidth / crop[2], outputHeight / crop[3]);
      const drawWidth = sourceWidth * scale;
      const drawHeight = sourceHeight * scale;
      const cropWidth = crop[2] * scale;
      const cropHeight = crop[3] * scale;
      const cropX = (outputWidth - cropWidth) / 2;
      const cropY = (outputHeight - cropHeight) / 2;
      const imageX = -crop[0] * scale;
      const imageY = -crop[1] * scale;
      const html = `<!doctype html>
        <meta charset="utf-8">
        <style>
          html,body{margin:0;width:${outputWidth}px;height:${outputHeight}px;overflow:hidden;background:#f6f0e2}
          #crop{position:absolute;left:${cropX}px;top:${cropY}px;width:${cropWidth}px;height:${cropHeight}px;overflow:hidden}
          img{position:absolute;left:${imageX}px;top:${imageY}px;width:${drawWidth}px;height:${drawHeight}px;max-width:none}
        </style>
        <div id="crop"><img id="reference" src="${sourceUrl}" alt=""></div>`;
      await send('Page.navigate', {
        url: `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
      });
      for (let attempt = 0; attempt < 30; attempt += 1) {
        const state = await send('Runtime.evaluate', {
          expression: '(() => { const image = document.querySelector("#reference"); return Boolean(image?.complete && image.naturalWidth); })()',
          returnByValue: true,
        });
        if (state.result.value) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const screenshot = await send('Page.captureScreenshot', {
        format: 'jpeg',
        quality: 92,
        captureBeyondViewport: false,
        fromSurface: true,
      });
      const outputPath = path.join(characterDirectory, `${view}.jpg`);
      await writeFile(outputPath, Buffer.from(screenshot.data, 'base64'));
      report.push({
        characterId: character.characterId,
        characterName: character.characterName,
        view,
        sourceUrl,
        crop,
        outputPath,
      });
      console.log(`${character.characterId}/${view}`);
    }
  }
} finally {
  socket.close();
  await stopProcessTree(browserProcess);
  serverProcess?.kill();
  await new Promise((resolve) => setTimeout(resolve, 400));
  try {
    await rm(profilePath, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  } catch {
    // Chrome can retain a telemetry file briefly; a later run can reuse the profile path.
  }
}

await mkdir(outputRoot, { recursive: true });
await writeFile(
  path.join(outputRoot, 'prepared-inputs.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
);
console.log(`Prepared ${report.length} Hi3D views for ${selectedCharacters.length} characters.`);
