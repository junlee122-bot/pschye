import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const projectRoot = process.cwd();
const manifestPath = path.join(projectRoot, 'tools', '3d', 'hitem3d-production-manifest.json');
const preparedRoot = path.join(projectRoot, 'artifacts', '3d', 'hitem3d-inputs');
const providerArtifactRoot = path.join(projectRoot, 'artifacts', '3d', 'meshy');
const overridePath = path.join(projectRoot, 'public', 'data', 'model-provider-overrides.json');
const runtimeCatalogPath = path.join(projectRoot, 'public', 'data', 'model-runtime-catalog.json');
const apiRoot = 'https://api.meshy.ai/openapi/v1';

function parseArguments(argv) {
  const options = {
    command: argv[2] ?? 'status',
    characters: ['raon'],
    execute: false,
    force: false,
    pollIntervalMs: 10_000,
    timeoutMs: 30 * 60 * 1000,
    targetPolycount: 100_000,
    textureResolution: '2k',
  };
  for (const argument of argv.slice(3)) {
    if (argument === '--execute') options.execute = true;
    else if (argument === '--force') options.force = true;
    else if (argument.startsWith('--character=')) {
      options.characters = argument.slice('--character='.length).split(',').filter(Boolean);
    } else if (argument.startsWith('--poll=')) {
      options.pollIntervalMs = Number(argument.slice('--poll='.length)) * 1000;
    } else if (argument.startsWith('--timeout=')) {
      options.timeoutMs = Number(argument.slice('--timeout='.length)) * 60 * 1000;
    } else if (argument.startsWith('--target-polycount=')) {
      options.targetPolycount = Number(argument.slice('--target-polycount='.length));
    } else if (argument.startsWith('--texture-resolution=')) {
      options.textureResolution = argument.slice('--texture-resolution='.length);
    }
  }
  if (
    !Number.isInteger(options.targetPolycount)
    || options.targetPolycount < 10_000
    || options.targetPolycount > 300_000
  ) {
    throw new Error('Meshy target polycount must be an integer between 10,000 and 300,000.');
  }
  if (!['2k', '4k', '8k'].includes(options.textureResolution)) {
    throw new Error('Meshy texture resolution must be 2k, 4k, or 8k.');
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

async function parseResponse(response) {
  const source = await response.text();
  if (!source) return {};
  try {
    return JSON.parse(source);
  } catch {
    return { message: source.slice(0, 500) };
  }
}

function meshyError(response, payload, action) {
  const message = payload?.message
    ?? payload?.task_error?.message
    ?? payload?.detail
    ?? response.statusText
    ?? `HTTP ${response.status}`;
  const error = new Error(`Meshy ${action} failed: ${message}`);
  error.status = response.status;
  error.code = response.status === 402 ? 'MESHY_INSUFFICIENT_CREDITS' : 'MESHY_API_ERROR';
  return error;
}

async function meshyRequest(apiKey, endpoint, init = {}) {
  const response = await fetch(`${apiRoot}${endpoint}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  const payload = await parseResponse(response);
  if (!response.ok) throw meshyError(response, payload, endpoint);
  return payload;
}

async function queryBalance(apiKey) {
  const payload = await meshyRequest(apiKey, '/balance');
  return payload.balance;
}

async function imageDataUri(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const mimeType = extension === '.png' ? 'image/png' : 'image/jpeg';
  const buffer = await readFile(filePath);
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
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
  if (buffer.toString('utf8', 16, 20) !== 'JSON') {
    throw new Error('GLB JSON chunk is missing.');
  }
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
    textures: gltf.textures?.length ?? 0,
    images: gltf.images?.length ?? 0,
    nodes: gltf.nodes?.length ?? 0,
    triangles,
  };
}

function validateReviewMesh(metrics) {
  const failures = [];
  if (metrics.bytes < 500_000) failures.push('GLB is smaller than 500 KB');
  if (metrics.meshes < 1) failures.push('no mesh primitives');
  if (metrics.materials < 1) failures.push('no materials');
  if (metrics.nodes < 1) failures.push('no scene nodes');
  if (metrics.triangles < 10_000) failures.push('fewer than 10,000 triangles');
  if (metrics.triangles > 500_000) failures.push('more than 500,000 triangles');
  if (failures.length) {
    throw new Error(`Meshy review mesh failed quality gate: ${failures.join(', ')}`);
  }
  return {
    status: 'passed',
    tier: 'ai-multi-view-pbr-review',
    checks: {
      minimumBytes: 500_000,
      triangleRange: [10_000, 500_000],
      requiresMesh: true,
      requiresMaterial: true,
      requiresNode: true,
    },
  };
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

async function promoteOverride(character, task, metrics, qualityGate, options) {
  const overrides = await loadOverrides();
  const baseCatalog = JSON.parse(await readFile(runtimeCatalogPath, 'utf8'));
  const baseRecord = baseCatalog.models.find(
    (model) => model.characterId === character.characterId,
  ) ?? {};
  const nextRecord = {
    ...baseRecord,
    id: `${character.characterId}-meshy-v1`,
    characterId: character.characterId,
    characterName: character.characterName,
    stage: character.stage,
    runtimePath: `/models/characters/${character.characterId}/${character.characterId}-meshy-v1.glb`,
    status: 'review',
    productionTier: 'ai-generated-multi-view-pbr-review',
    generator: 'Meshy 6 multi-image-to-3d',
    intendedUpgrade: 'Manual silhouette review, retopology, humanoid rig, facial blendshapes, animation and LOD bake',
    providerTaskId: task.id ?? 'existing-local-artifact',
    providerCoverUrl: task.thumbnail_url ?? '',
    sourceViews: character.views,
    consumedCredits: task.consumed_credits ?? null,
    qualityGate,
    reconstruction: {
      provider: 'Meshy',
      api: 'multi-image-to-3d',
      aiModel: 'meshy-6',
      poseMode: 'a-pose',
      targetPolycount: options.targetPolycount,
      textureResolution: options.textureResolution,
      pbr: true,
    },
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

async function describePlan(selectedCharacters, options) {
  const inputs = [];
  for (const character of selectedCharacters) {
    for (const view of character.views.slice(0, 4)) {
      const inputPath = path.join(preparedRoot, character.characterId, `${view}.jpg`);
      inputs.push({
        characterId: character.characterId,
        view,
        inputPath,
        ready: await fileExists(inputPath),
      });
    }
  }
  return {
    provider: 'Meshy',
    endpoint: 'multi-image-to-3d',
    aiModel: 'meshy-6',
    selectedCharacters: selectedCharacters.map((character) => character.characterId),
    inputs,
    settings: {
      shouldTexture: true,
      enablePbr: true,
      textureResolution: options.textureResolution,
      shouldRemesh: true,
      topology: 'triangle',
      targetPolycount: options.targetPolycount,
      poseMode: 'a-pose',
      imageEnhancement: true,
      removeLighting: true,
      targetFormats: ['glb'],
      autoSize: true,
      originAt: 'bottom',
      multiViewThumbnails: true,
    },
  };
}

async function submitTask(apiKey, character, options) {
  const imageUrls = [];
  for (const view of character.views.slice(0, 4)) {
    const inputPath = path.join(preparedRoot, character.characterId, `${view}.jpg`);
    imageUrls.push(await imageDataUri(inputPath));
  }
  const payload = await meshyRequest(apiKey, '/multi-image-to-3d', {
    method: 'POST',
    body: JSON.stringify({
      image_urls: imageUrls,
      ai_model: 'meshy-6',
      should_texture: true,
      enable_pbr: true,
      texture_resolution: options.textureResolution,
      should_remesh: true,
      topology: 'triangle',
      target_polycount: options.targetPolycount,
      pose_mode: 'a-pose',
      image_enhancement: true,
      remove_lighting: true,
      target_formats: ['glb'],
      auto_size: true,
      origin_at: 'bottom',
      multi_view_thumbnails: true,
    }),
  });
  if (!payload.result) throw new Error('Meshy task submission returned no task id.');
  return payload.result;
}

async function queryTask(apiKey, taskId) {
  return meshyRequest(apiKey, `/multi-image-to-3d/${encodeURIComponent(taskId)}`);
}

async function waitForTask(apiKey, taskId, options) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < options.timeoutMs) {
    const task = await queryTask(apiKey, taskId);
    console.log(`${taskId}: ${task.status} ${task.progress ?? 0}%`);
    if (task.status === 'SUCCEEDED') return task;
    if (['FAILED', 'CANCELED'].includes(task.status)) {
      throw new Error(`Meshy task ${task.status.toLowerCase()}: ${task.task_error?.message ?? taskId}`);
    }
    await new Promise((resolve) => setTimeout(resolve, options.pollIntervalMs));
  }
  throw new Error(`Meshy task timed out after ${Math.round(options.timeoutMs / 60_000)} minutes: ${taskId}`);
}

async function downloadBinary(url, label) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Meshy ${label} download failed: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function savePreviewImages(task, artifactDirectory) {
  const previewUrls = {
    front: task.thumbnail_urls?.front ?? task.thumbnail_url,
    right: task.thumbnail_urls?.right,
    back: task.thumbnail_urls?.back,
    left: task.thumbnail_urls?.left,
  };
  for (const [view, url] of Object.entries(previewUrls)) {
    if (!url) continue;
    const buffer = await downloadBinary(url, `${view} preview`);
    await writeFile(path.join(artifactDirectory, `preview-${view}.png`), buffer);
  }
}

async function downloadAndPromote(task, character, options) {
  const modelUrl = task.model_urls?.glb;
  if (!modelUrl) throw new Error(`Meshy completed without a GLB URL: ${character.characterId}`);
  const buffer = await downloadBinary(modelUrl, 'GLB');
  const metrics = inspectGlb(buffer);
  const qualityGate = validateReviewMesh(metrics);
  const artifactDirectory = path.join(providerArtifactRoot, character.characterId);
  const runtimeDirectory = path.join(projectRoot, 'public', 'models', 'characters', character.characterId);
  await mkdir(artifactDirectory, { recursive: true });
  await mkdir(runtimeDirectory, { recursive: true });
  const artifactPath = path.join(artifactDirectory, `${character.characterId}-meshy-v1.glb`);
  const runtimePath = path.join(runtimeDirectory, `${character.characterId}-meshy-v1.glb`);
  await writeFile(artifactPath, buffer);
  await writeFile(runtimePath, buffer);
  await writeFile(path.join(artifactDirectory, 'task.json'), `${JSON.stringify(task, null, 2)}\n`, 'utf8');
  await savePreviewImages(task, artifactDirectory);
  await promoteOverride(character, task, metrics, qualityGate, options);
  return { artifactPath, runtimePath, metrics, qualityGate };
}

async function useExisting(character, options) {
  const runtimePath = path.join(
    projectRoot,
    'public',
    'models',
    'characters',
    character.characterId,
    `${character.characterId}-meshy-v1.glb`,
  );
  if (!await fileExists(runtimePath)) return null;
  const buffer = await readFile(runtimePath);
  const metrics = inspectGlb(buffer);
  const qualityGate = validateReviewMesh(metrics);
  let task = {};
  const taskPath = path.join(providerArtifactRoot, character.characterId, 'task.json');
  if (await fileExists(taskPath)) task = JSON.parse(await readFile(taskPath, 'utf8'));
  await promoteOverride(character, task, metrics, qualityGate, options);
  return { runtimePath, metrics, qualityGate };
}

async function main() {
  await loadLocalEnvironment();
  const options = parseArguments(process.argv);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const selectedCharacters = manifest.characters.filter(
    (character) => options.characters.includes(character.characterId),
  );
  if (!selectedCharacters.length) throw new Error('No matching characters in the 3D production manifest.');

  const plan = await describePlan(selectedCharacters, options);
  const apiKey = process.env.MESHY_API_KEY;
  if (options.command === 'status' || options.command === 'plan') {
    console.log(JSON.stringify({
      ...plan,
      credentials: apiKey ? 'present' : 'missing',
      readyInputs: plan.inputs.filter((input) => input.ready).length,
      requiredInputs: plan.inputs.length,
      spendGate: 'RAONJENA_3D_ALLOW_SPEND=true plus --execute',
    }, null, 2));
    return;
  }
  if (options.command === 'balance') {
    if (!apiKey) throw new Error('Set MESHY_API_KEY in .env.3d.local.');
    console.log(JSON.stringify({
      provider: 'Meshy',
      authenticated: true,
      balance: await queryBalance(apiKey),
    }, null, 2));
    return;
  }
  if (options.command !== 'generate') {
    throw new Error('Usage: node tools/3d/meshy-client.mjs status|plan|balance|generate [--character=raon] [--execute]');
  }

  const missingInputs = plan.inputs.filter((input) => !input.ready);
  if (missingInputs.length) {
    throw new Error(`Prepare 3D inputs first. Missing ${missingInputs.length} files.`);
  }
  for (const character of selectedCharacters) {
    if (!options.force) {
      const existing = await useExisting(character, options);
      if (existing) {
        console.log(JSON.stringify({
          mode: 'existing',
          provider: 'Meshy',
          characterId: character.characterId,
          ...existing,
        }, null, 2));
        continue;
      }
    }
    if (!options.execute || process.env.RAONJENA_3D_ALLOW_SPEND !== 'true') {
      console.log(JSON.stringify({
        mode: 'dry-run',
        message: 'No credits were spent. Add --execute and RAONJENA_3D_ALLOW_SPEND=true after reviewing the plan.',
        characterId: character.characterId,
        ...plan,
      }, null, 2));
      continue;
    }
    if (!apiKey) throw new Error('Set MESHY_API_KEY in .env.3d.local.');
    const balance = await queryBalance(apiKey);
    console.log(`Meshy balance: ${balance}`);
    if (!Number.isFinite(balance) || balance <= 0) {
      const error = new Error('Meshy balance is not sufficient for a generation task.');
      error.code = 'MESHY_INSUFFICIENT_CREDITS';
      throw error;
    }
    const taskId = await submitTask(apiKey, character, options);
    const task = await waitForTask(apiKey, taskId, options);
    const result = await downloadAndPromote(task, character, options);
    console.log(JSON.stringify({
      mode: 'generated',
      provider: 'Meshy',
      characterId: character.characterId,
      taskId,
      consumedCredits: task.consumed_credits ?? null,
      ...result,
    }, null, 2));
  }
}

await main();
