import { access, mkdir, readFile, statfs, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const projectRoot = process.cwd();
const statusPath = path.join(projectRoot, 'artifacts', '3d', 'provider-status.json');
const raonInputPath = path.join(projectRoot, 'artifacts', '3d', 'hitem3d-inputs', 'raon', 'front.jpg');
const raonTripoSrPath = path.join(
  projectRoot,
  'public',
  'models',
  'characters',
  'raon',
  'raon-triposr-v1.glb',
);
const tripoSrPythonPath = path.join(
  projectRoot,
  'artifacts',
  '3d',
  'triposr-runtime',
  '.venv',
  'Scripts',
  'python.exe',
);
const tripoSrSourcePath = path.join(projectRoot, '.tmp', 'TripoSR-official');

function parseArguments(argv) {
  const options = {
    command: argv[2] ?? 'status',
    provider: 'auto',
    characterId: 'raon',
    execute: false,
    force: false,
  };
  for (const argument of argv.slice(3)) {
    if (argument === '--execute') options.execute = true;
    else if (argument === '--force') options.force = true;
    else if (argument.startsWith('--provider=')) {
      options.provider = argument.slice('--provider='.length);
    } else if (argument.startsWith('--character=')) {
      options.characterId = argument.slice('--character='.length);
    }
  }
  const supported = ['auto', 'hitem3d', 'meshy', 'triposr-local', 'procedural'];
  if (!supported.includes(options.provider)) {
    throw new Error(`Unsupported provider. Choose one of: ${supported.join(', ')}`);
  }
  return options;
}

async function loadLocalEnvironment() {
  const environmentPath = path.join(projectRoot, '.env.3d.local');
  try {
    const source = await readFile(environmentPath, 'utf8');
    for (const line of source.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function responsePayload(response) {
  const source = await response.text();
  if (!source) return {};
  try {
    return JSON.parse(source);
  } catch {
    return {};
  }
}

async function probeHi3D() {
  const clientId = process.env.HITEM3D_CLIENT_ID ?? process.env.HI3D_CLIENT_ID;
  const clientSecret = process.env.HITEM3D_CLIENT_SECRET ?? process.env.HI3D_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return {
      id: 'hitem3d',
      label: 'Hi3D',
      kind: 'cloud',
      configured: false,
      available: false,
      reason: 'credentials-missing',
    };
  }
  try {
    const authorization = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const authResponse = await fetch('https://api.hitem3d.ai/open-api/v1/auth/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authorization}`,
        'Content-Type': 'application/json',
      },
    });
    const authPayload = await responsePayload(authResponse);
    if (!authResponse.ok || authPayload.code !== 200 || !authPayload.data?.accessToken) {
      throw new Error(authPayload.msg ?? authPayload.message ?? `HTTP ${authResponse.status}`);
    }
    const balanceResponse = await fetch('https://api.hitem3d.ai/open-api/v1/balance', {
      headers: { Authorization: `Bearer ${authPayload.data.accessToken}` },
    });
    const balancePayload = await responsePayload(balanceResponse);
    if (!balanceResponse.ok || balancePayload.code !== 200) {
      throw new Error(balancePayload.msg ?? `HTTP ${balanceResponse.status}`);
    }
    const balance = Number(balancePayload.data?.totalBalance ?? 0);
    return {
      id: 'hitem3d',
      label: 'Hi3D',
      kind: 'cloud',
      configured: true,
      authenticated: true,
      balance,
      available: balance > 0,
      reason: balance > 0 ? 'ready' : 'insufficient-balance',
      qualityTier: 'multi-view-high-density-pbr',
    };
  } catch (error) {
    return {
      id: 'hitem3d',
      label: 'Hi3D',
      kind: 'cloud',
      configured: true,
      authenticated: false,
      available: false,
      reason: 'provider-unavailable',
      error: error.message,
    };
  }
}

async function probeMeshy() {
  const apiKey = process.env.MESHY_API_KEY;
  if (!apiKey) {
    return {
      id: 'meshy',
      label: 'Meshy 6',
      kind: 'cloud',
      configured: false,
      available: false,
      reason: 'api-key-missing',
      qualityTier: 'multi-view-pbr-review',
    };
  }
  try {
    const response = await fetch('https://api.meshy.ai/openapi/v1/balance', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const payload = await responsePayload(response);
    if (!response.ok) throw new Error(payload.message ?? `HTTP ${response.status}`);
    const balance = Number(payload.balance ?? 0);
    return {
      id: 'meshy',
      label: 'Meshy 6',
      kind: 'cloud',
      configured: true,
      authenticated: true,
      balance,
      available: balance > 0,
      reason: balance > 0 ? 'ready' : 'insufficient-credits',
      qualityTier: 'multi-view-pbr-review',
    };
  } catch (error) {
    return {
      id: 'meshy',
      label: 'Meshy 6',
      kind: 'cloud',
      configured: true,
      authenticated: false,
      available: false,
      reason: 'provider-unavailable',
      error: error.message,
      qualityTier: 'multi-view-pbr-review',
    };
  }
}

async function probeLocalProviders() {
  const inputReady = await fileExists(raonInputPath);
  const tripoSrRuntimeReady = await fileExists(tripoSrPythonPath)
    && await fileExists(tripoSrSourcePath);
  const existingMesh = await fileExists(raonTripoSrPath);
  return [
    {
      id: 'triposr-local',
      label: 'Stability AI TripoSR',
      kind: 'local-cpu',
      configured: tripoSrRuntimeReady,
      available: inputReady && (tripoSrRuntimeReady || existingMesh),
      reason: existingMesh
        ? 'validated-existing-mesh'
        : tripoSrRuntimeReady && inputReady
          ? 'ready-for-cpu-generation'
          : 'runtime-or-input-missing',
      existingMesh,
      qualityTier: 'single-view-review',
    },
    {
      id: 'stable-fast-3d',
      label: 'Stability AI Stable Fast 3D',
      kind: 'local-gpu',
      configured: false,
      available: false,
      reason: 'disabled-hardware-requires-about-6gb-vram',
      qualityTier: 'single-view-textured-game-asset',
    },
    {
      id: 'hunyuan3d-2',
      label: 'Tencent Hunyuan3D 2',
      kind: 'local-gpu',
      configured: false,
      available: false,
      reason: 'disabled-hardware-requires-6gb-shape-or-16gb-shape-texture-vram',
      qualityTier: 'high-resolution-shape-and-texture',
    },
    {
      id: 'procedural',
      label: 'Raonjena procedural maquette',
      kind: 'local-node',
      configured: true,
      available: true,
      reason: 'last-resort-prototype',
      qualityTier: 'procedural-maquette',
    },
  ];
}

async function getMachineBudget() {
  const disk = await statfs(projectRoot);
  return {
    platform: process.platform,
    architecture: process.arch,
    freeDiskBytes: disk.bavail * disk.bsize,
    localGpuClass: 'integrated-1gb-detected',
    heavyDiffusionInstallAllowed: false,
  };
}

async function collectStatus(options) {
  const [hitem3d, meshy, localProviders, machine] = await Promise.all([
    probeHi3D(),
    probeMeshy(),
    probeLocalProviders(),
    getMachineBudget(),
  ]);
  const providers = [hitem3d, meshy, ...localProviders];
  const cloudSpendAllowed = options.execute
    && process.env.RAONJENA_3D_ALLOW_SPEND === 'true';
  return {
    schema: 'raonjena.3d-provider-status',
    version: 1,
    generatedAt: new Date().toISOString(),
    requestedProvider: options.provider,
    characterId: options.characterId,
    cloudSpendAllowed,
    machine,
    providers,
    fallbackOrder: ['hitem3d', 'meshy', 'triposr-local', 'procedural'],
  };
}

function selectProvider(status, options, excluded = new Set()) {
  if (options.provider !== 'auto') {
    const requested = status.providers.find((provider) => provider.id === options.provider);
    if (!requested) throw new Error(`Provider is not registered: ${options.provider}`);
    if (!requested.available) {
      throw new Error(`${requested.label} is unavailable: ${requested.reason}`);
    }
    if (requested.kind === 'cloud' && !status.cloudSpendAllowed) {
      throw new Error('Cloud generation requires --execute and RAONJENA_3D_ALLOW_SPEND=true.');
    }
    return requested;
  }
  for (const providerId of status.fallbackOrder) {
    if (excluded.has(providerId)) continue;
    const provider = status.providers.find((item) => item.id === providerId);
    if (!provider?.available) continue;
    if (provider.kind === 'cloud' && !status.cloudSpendAllowed) continue;
    return provider;
  }
  throw new Error('No 3D provider is currently available.');
}

function runNodeScript(scriptPath, argumentsList) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...argumentsList], {
      cwd: projectRoot,
      env: process.env,
      stdio: 'inherit',
      windowsHide: true,
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${path.basename(scriptPath)} exited with code ${code}`));
    });
  });
}

async function executeProvider(provider, options) {
  const commonArguments = ['generate', `--character=${options.characterId}`];
  if (options.force) commonArguments.push('--force');
  if (provider.kind === 'cloud') commonArguments.push('--execute');
  if (provider.id === 'hitem3d') {
    await runNodeScript(path.join(projectRoot, 'tools', '3d', 'hitem3d-client.mjs'), commonArguments);
    return;
  }
  if (provider.id === 'meshy') {
    await runNodeScript(path.join(projectRoot, 'tools', '3d', 'meshy-client.mjs'), commonArguments);
    return;
  }
  if (provider.id === 'triposr-local') {
    await runNodeScript(path.join(projectRoot, 'tools', '3d', 'triposr-client.mjs'), commonArguments);
    return;
  }
  if (provider.id === 'procedural') {
    await runNodeScript(path.join(projectRoot, 'tools', '3d', 'generate-procedural-glb.mjs'), []);
    return;
  }
  throw new Error(`Provider execution is not implemented: ${provider.id}`);
}

async function writeStatus(status) {
  await mkdir(path.dirname(statusPath), { recursive: true });
  await writeFile(statusPath, `${JSON.stringify(status, null, 2)}\n`, 'utf8');
}

async function main() {
  await loadLocalEnvironment();
  const options = parseArguments(process.argv);
  const status = await collectStatus(options);
  if (options.command === 'status' || options.command === 'plan') {
    const selected = selectProvider(status, {
      ...options,
      provider: options.command === 'plan' && options.provider === 'auto'
        ? 'auto'
        : options.provider,
    });
    const result = {
      ...status,
      selectedProvider: selected.id,
      selectionReason: selected.reason,
      note: status.cloudSpendAllowed
        ? 'Paid providers are eligible.'
        : 'Paid providers are skipped; no credits can be spent.',
    };
    await writeStatus(result);
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (options.command !== 'generate') {
    throw new Error('Usage: node tools/3d/provider-router.mjs status|plan|generate [--provider=auto] [--character=raon] [--execute]');
  }

  const excluded = new Set();
  const attempts = [];
  while (excluded.size < status.fallbackOrder.length) {
    const provider = selectProvider(status, options, excluded);
    try {
      console.log(`3D provider selected: ${provider.label} (${provider.reason})`);
      await executeProvider(provider, options);
      const result = {
        ...status,
        completedAt: new Date().toISOString(),
        selectedProvider: provider.id,
        attempts: [...attempts, { provider: provider.id, status: 'succeeded' }],
      };
      await writeStatus(result);
      console.log(JSON.stringify({
        mode: 'completed',
        selectedProvider: provider.id,
        attempts: result.attempts,
        statusPath,
      }, null, 2));
      return;
    } catch (error) {
      attempts.push({
        provider: provider.id,
        status: 'failed',
        error: error.message,
      });
      excluded.add(provider.id);
      if (options.provider !== 'auto') throw error;
      console.warn(`${provider.label} failed; continuing to the next verified provider.`);
    }
  }
  throw new Error(`All 3D providers failed: ${JSON.stringify(attempts)}`);
}

await main();
