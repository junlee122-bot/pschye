import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const projectRoot = process.cwd();
const manifestPath = path.join(projectRoot, 'tools', '3d', 'hitem3d-production-manifest.json');
const preparedRoot = path.join(projectRoot, 'artifacts', '3d', 'hitem3d-inputs');
const providerArtifactRoot = path.join(projectRoot, 'artifacts', '3d', 'hitem3d');
const overridePath = path.join(projectRoot, 'public', 'data', 'model-provider-overrides.json');
const apiRoot = 'https://api.hitem3d.ai/open-api/v1';

function parseArguments(argv) {
  const options = {
    command: argv[2] ?? 'status',
    characters: [],
    execute: false,
    force: false,
    pollIntervalMs: 15_000,
    timeoutMs: 30 * 60 * 1000,
  };
  for (const argument of argv.slice(3)) {
    if (argument === '--execute') options.execute = true;
    else if (argument === '--force') options.force = true;
    else if (argument.startsWith('--character=')) {
      options.characters.push(...argument.slice('--character='.length).split(',').filter(Boolean));
    } else if (argument.startsWith('--poll=')) {
      options.pollIntervalMs = Number(argument.slice('--poll='.length)) * 1000;
    } else if (argument.startsWith('--timeout=')) {
      options.timeoutMs = Number(argument.slice('--timeout='.length)) * 60 * 1000;
    }
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

function requiredCredentials() {
  const clientId = process.env.HITEM3D_CLIENT_ID ?? process.env.HI3D_CLIENT_ID;
  const clientSecret = process.env.HITEM3D_CLIENT_SECRET ?? process.env.HI3D_CLIENT_SECRET;
  return { clientId, clientSecret };
}

async function getToken(clientId, clientSecret) {
  const authorization = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(`${apiRoot}/auth/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authorization}`,
      'Content-Type': 'application/json',
    },
  });
  const payload = await response.json();
  if (!response.ok || payload.code !== 200 || !payload.data?.accessToken) {
    throw new Error(`Hi3D authentication failed: ${payload.msg ?? payload.message ?? response.status}`);
  }
  return payload.data.accessToken;
}

async function queryBalance(token) {
  const response = await fetch(`${apiRoot}/balance`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await response.json();
  if (!response.ok || payload.code !== 200) {
    throw new Error(`Hi3D balance query failed: ${payload.msg ?? response.status}`);
  }
  return payload.data?.totalBalance;
}

function viewBit(views) {
  const order = ['front', 'back', 'left', 'right'];
  return order.map((view) => (views.includes(view) ? '1' : '0')).join('');
}

async function submitTask(token, character, manifest) {
  const form = new FormData();
  const views = character.views ?? ['front'];
  if (views.length === 1) {
    const filePath = path.join(preparedRoot, character.characterId, `${views[0]}.jpg`);
    const bytes = await readFile(filePath);
    form.append('images', new Blob([bytes], { type: 'image/jpeg' }), path.basename(filePath));
  } else {
    for (const view of views) {
      const filePath = path.join(preparedRoot, character.characterId, `${view}.jpg`);
      const bytes = await readFile(filePath);
      form.append('multi_images', new Blob([bytes], { type: 'image/jpeg' }), path.basename(filePath));
    }
    form.append('multi_images_bit', viewBit(views));
  }
  form.append('request_type', '3');
  form.append('resolution', manifest.resolution);
  form.append('face', String(manifest.faceCount));
  form.append('model', manifest.model);
  form.append('format', '2');
  form.append('pbr', manifest.pbr ? '1' : '0');

  const response = await fetch(`${apiRoot}/submit-task`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const payload = await response.json();
  if (!response.ok || payload.code !== 200 || !payload.data?.task_id) {
    throw new Error(`Hi3D submit failed for ${character.characterId}: ${payload.msg ?? response.status}`);
  }
  return payload.data.task_id;
}

async function queryTask(token, taskId) {
  const url = new URL(`${apiRoot}/query-task`);
  url.searchParams.set('task_id', taskId);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await response.json();
  if (!response.ok || payload.code !== 200) {
    throw new Error(`Hi3D query failed: ${payload.msg ?? response.status}`);
  }
  return payload.data;
}

async function waitForTask(token, taskId, options) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < options.timeoutMs) {
    const task = await queryTask(token, taskId);
    console.log(`${taskId}: ${task.state}`);
    if (task.state === 'success') return task;
    if (task.state === 'failed') throw new Error(`Hi3D task failed: ${taskId}`);
    await new Promise((resolve) => setTimeout(resolve, options.pollIntervalMs));
  }
  throw new Error(`Hi3D task timed out after ${Math.round(options.timeoutMs / 60_000)} minutes: ${taskId}`);
}

function inspectGlb(buffer) {
  if (buffer.length < 20 || buffer.toString('utf8', 0, 4) !== 'glTF') {
    throw new Error('Downloaded file is not a GLB 2.0 binary.');
  }
  const declaredLength = buffer.readUInt32LE(8);
  if (declaredLength !== buffer.length) {
    throw new Error(`GLB length mismatch: header=${declaredLength}, file=${buffer.length}`);
  }
  const jsonLength = buffer.readUInt32LE(12);
  const jsonType = buffer.toString('utf8', 16, 20);
  if (jsonType !== 'JSON') throw new Error('GLB JSON chunk is missing.');
  const gltf = JSON.parse(buffer.toString('utf8', 20, 20 + jsonLength).trim());
  let triangles = 0;
  for (const mesh of gltf.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      if (primitive.mode != null && primitive.mode !== 4) continue;
      const accessorIndex = primitive.indices ?? primitive.attributes?.POSITION;
      const accessor = gltf.accessors?.[accessorIndex];
      if (accessor?.count) triangles += Math.floor(accessor.count / 3);
    }
  }
  return {
    bytes: buffer.length,
    meshes: gltf.meshes?.length ?? 0,
    materials: gltf.materials?.length ?? 0,
    nodes: gltf.nodes?.length ?? 0,
    triangles,
  };
}

function validateRawMeshMetrics(metrics) {
  const failures = [];
  if (metrics.bytes < 1_000_000) failures.push('GLB is smaller than 1 MB');
  if (metrics.meshes < 1) failures.push('no mesh primitives');
  if (metrics.materials < 1) failures.push('no materials');
  if (metrics.nodes < 1) failures.push('no scene nodes');
  if (metrics.triangles < 50_000) failures.push('fewer than 50,000 triangles');
  if (metrics.triangles > 2_500_000) failures.push('more than 2,500,000 triangles');
  if (failures.length) {
    throw new Error(`Hi3D raw mesh failed quality gate: ${failures.join(', ')}`);
  }
  return {
    status: 'passed',
    tier: 'raw-high-density',
    checks: {
      minimumBytes: 1_000_000,
      triangleRange: [50_000, 2_500_000],
      requiresMesh: true,
      requiresMaterial: true,
      requiresNode: true,
    },
  };
}

async function downloadModel(task, character) {
  if (!task.url) throw new Error(`Hi3D completed without a model URL: ${character.characterId}`);
  const response = await fetch(task.url);
  if (!response.ok) throw new Error(`Hi3D model download failed: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const metrics = inspectGlb(buffer);
  const qualityGate = validateRawMeshMetrics(metrics);
  const outputDirectory = path.join(projectRoot, 'public', 'models', 'characters', character.characterId);
  await mkdir(outputDirectory, { recursive: true });
  const outputPath = path.join(outputDirectory, `${character.characterId}-hitem3d-v1.glb`);
  await writeFile(outputPath, buffer);
  return { outputPath, metrics, qualityGate };
}

async function loadOverrides() {
  try {
    return JSON.parse(await readFile(overridePath, 'utf8'));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    return {
      schema: 'raonjena.model-provider-overrides',
      version: 1,
      generatedAt: null,
      models: [],
    };
  }
}

async function promoteOverride(character, task, metrics, qualityGate) {
  const overrides = await loadOverrides();
  const baseCatalog = JSON.parse(await readFile(
    path.join(projectRoot, 'public', 'data', 'model-runtime-catalog.json'),
    'utf8',
  ));
  const baseRecord = baseCatalog.models.find(
    (model) => model.characterId === character.characterId,
  ) ?? {};
  const nextRecord = {
    ...baseRecord,
    id: `${character.characterId}-hitem3d-v1`,
    characterId: character.characterId,
    characterName: character.characterName,
    stage: character.stage,
    runtimePath: `/models/characters/${character.characterId}/${character.characterId}-hitem3d-v1.glb`,
    status: 'review',
    productionTier: 'ai-generated-high-density',
    generator: 'Hitem3D hitem3dv2.1',
    intendedUpgrade: 'Retopology, humanoid rig, facial blendshapes, animation and LOD bake',
    providerTaskId: task.task_id,
    providerCoverUrl: task.cover_url ?? '',
    sourceViews: character.views,
    qualityGate,
    ...metrics,
  };
  const models = overrides.models.filter((model) => model.characterId !== character.characterId);
  models.push(nextRecord);
  await mkdir(path.dirname(overridePath), { recursive: true });
  await writeFile(overridePath, `${JSON.stringify({
    ...overrides,
    generatedAt: new Date().toISOString(),
    models,
  }, null, 2)}\n`, 'utf8');
}

async function describePlan(manifest, selectedCharacters) {
  const checks = [];
  for (const character of selectedCharacters) {
    for (const view of character.views) {
      const inputPath = path.join(preparedRoot, character.characterId, `${view}.jpg`);
      checks.push({
        characterId: character.characterId,
        view,
        inputPath,
        ready: await fileExists(inputPath),
      });
    }
  }
  return {
    provider: manifest.provider,
    model: manifest.model,
    resolution: manifest.resolution,
    faceCount: manifest.faceCount,
    pbr: manifest.pbr,
    selectedCharacters: selectedCharacters.map((character) => character.characterId),
    inputs: checks,
  };
}

async function main() {
  await loadLocalEnvironment();
  const options = parseArguments(process.argv);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const selectedCharacters = options.characters.length
    ? manifest.characters.filter((character) => options.characters.includes(character.characterId))
    : manifest.characters;
  if (!selectedCharacters.length) throw new Error('No matching characters in the Hi3D manifest.');

  const plan = await describePlan(manifest, selectedCharacters);
  if (options.command === 'status' || options.command === 'plan') {
    const { clientId, clientSecret } = requiredCredentials();
    console.log(JSON.stringify({
      ...plan,
      credentials: clientId && clientSecret ? 'present' : 'missing',
      readyInputs: plan.inputs.filter((input) => input.ready).length,
      requiredInputs: plan.inputs.length,
    }, null, 2));
    return;
  }

  if (options.command === 'balance') {
    const { clientId, clientSecret } = requiredCredentials();
    if (!clientId || !clientSecret) {
      throw new Error('Set HITEM3D_CLIENT_ID and HITEM3D_CLIENT_SECRET in .env.3d.local.');
    }
    const token = await getToken(clientId, clientSecret);
    console.log(JSON.stringify({
      provider: manifest.provider,
      authenticated: true,
      balance: await queryBalance(token),
    }, null, 2));
    return;
  }

  if (options.command !== 'generate') {
    throw new Error('Usage: node tools/3d/hitem3d-client.mjs status|plan|balance|generate [--character=raon] [--execute]');
  }
  const missingInputs = plan.inputs.filter((input) => !input.ready);
  if (missingInputs.length) {
    throw new Error(`Prepare Hi3D inputs first. Missing ${missingInputs.length} files.`);
  }
  const spendAllowed = process.env.HITEM3D_ALLOW_SPEND === 'true'
    || process.env.RAONJENA_3D_ALLOW_SPEND === 'true';
  if (!options.execute || !spendAllowed) {
    console.log(JSON.stringify({
      mode: 'dry-run',
      message: 'No credits were spent. Add --execute and either HITEM3D_ALLOW_SPEND=true or RAONJENA_3D_ALLOW_SPEND=true after reviewing the plan.',
      ...plan,
    }, null, 2));
    return;
  }

  const { clientId, clientSecret } = requiredCredentials();
  if (!clientId || !clientSecret) {
    throw new Error('Set HITEM3D_CLIENT_ID and HITEM3D_CLIENT_SECRET in .env.3d.local.');
  }
  const token = await getToken(clientId, clientSecret);
  console.log(`Hi3D balance: ${await queryBalance(token)}`);

  for (const character of selectedCharacters) {
    const outputPath = path.join(
      projectRoot,
      'public',
      'models',
      'characters',
      character.characterId,
      `${character.characterId}-hitem3d-v1.glb`,
    );
    if (!options.force && await fileExists(outputPath)) {
      console.log(`${character.characterId}: existing Hi3D model kept`);
      continue;
    }

    const taskId = await submitTask(token, character, manifest);
    const task = await waitForTask(token, taskId, options);
    const { metrics, qualityGate } = await downloadModel(task, character);
    const artifactDirectory = path.join(providerArtifactRoot, character.characterId);
    await mkdir(artifactDirectory, { recursive: true });
    await writeFile(path.join(artifactDirectory, 'task.json'), `${JSON.stringify(task, null, 2)}\n`, 'utf8');
    await promoteOverride(character, task, metrics, qualityGate);
    console.log(`${character.characterId}: promoted ${metrics.triangles.toLocaleString()} triangle Hi3D GLB`);
  }
}

await main();
