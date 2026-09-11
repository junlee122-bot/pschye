import { Client, handle_file } from '@gradio/client';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const projectRoot = process.cwd();
const spaceId = 'stabilityai/TripoSR';
const overridePath = path.join(projectRoot, 'public', 'data', 'model-provider-overrides.json');
const runtimeCatalogPath = path.join(projectRoot, 'public', 'data', 'model-runtime-catalog.json');
const artifactRoot = path.join(projectRoot, 'artifacts', '3d', 'triposr');
const productionManifestPath = path.join(
  projectRoot,
  'tools',
  '3d',
  'hitem3d-production-manifest.json',
);

async function loadCharacter(characterId) {
  const [manifest, runtimeCatalog] = await Promise.all([
    readFile(productionManifestPath, 'utf8').then(JSON.parse),
    readFile(runtimeCatalogPath, 'utf8').then(JSON.parse),
  ]);
  const productionRecord = manifest.characters.find(
    (character) => character.characterId === characterId,
  );
  if (!productionRecord) return null;
  const runtimeRecord = runtimeCatalog.models.find(
    (model) => model.characterId === characterId,
  ) ?? {};
  return {
    characterId,
    characterName: runtimeRecord.characterName ?? productionRecord.characterName,
    stage: runtimeRecord.stage ?? productionRecord.stage,
    inputPath: path.join(
      projectRoot,
      'artifacts',
      '3d',
      'hitem3d-inputs',
      characterId,
      'front.jpg',
    ),
    thumbnail: runtimeRecord.thumbnail ?? '',
    sourceSheet: runtimeRecord.sourceSheet ?? productionRecord.sourceSheet,
    variationCount: runtimeRecord.variationCount ?? 20,
  };
}

function parseArguments(argv) {
  const options = {
    command: argv[2] ?? 'status',
    characterId: 'raon',
    resolution: 320,
    removeBackground: true,
    foregroundRatio: 0.85,
    force: false,
  };
  for (const argument of argv.slice(3)) {
    if (argument === '--force') options.force = true;
    else if (argument === '--keep-background') options.removeBackground = false;
    else if (argument.startsWith('--character=')) {
      options.characterId = argument.slice('--character='.length);
    } else if (argument.startsWith('--resolution=')) {
      options.resolution = Number(argument.slice('--resolution='.length));
    } else if (argument.startsWith('--foreground-ratio=')) {
      options.foregroundRatio = Number(argument.slice('--foreground-ratio='.length));
    }
  }
  if (!Number.isFinite(options.resolution) || options.resolution < 32 || options.resolution > 320) {
    throw new Error('Marching cubes resolution must be between 32 and 320.');
  }
  if (
    !Number.isFinite(options.foregroundRatio)
    || options.foregroundRatio < 0.5
    || options.foregroundRatio > 1
  ) {
    throw new Error('Foreground ratio must be between 0.5 and 1.');
  }
  return options;
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function findFileUrl(value) {
  if (typeof value === 'string' && /^https?:\/\//i.test(value)) return value;
  if (!value || typeof value !== 'object') return null;
  if (typeof value.url === 'string') return value.url;
  if (typeof value.path === 'string' && /^https?:\/\//i.test(value.path)) return value.path;
  if (Array.isArray(value)) {
    for (const item of value) {
      const url = findFileUrl(item);
      if (url) return url;
    }
  }
  for (const item of Object.values(value)) {
    const url = findFileUrl(item);
    if (url) return url;
  }
  return null;
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
    nodes: gltf.nodes?.length ?? 0,
    triangles,
  };
}

function validateReviewMesh(metrics) {
  const failures = [];
  if (metrics.bytes < 100_000) failures.push('GLB is smaller than 100 KB');
  if (metrics.meshes < 1) failures.push('no mesh primitives');
  if (metrics.nodes < 1) failures.push('no scene nodes');
  if (metrics.triangles < 10_000) failures.push('fewer than 10,000 triangles');
  if (metrics.triangles > 1_500_000) failures.push('more than 1,500,000 triangles');
  if (failures.length) {
    throw new Error(`TripoSR review mesh failed quality gate: ${failures.join(', ')}`);
  }
  return {
    status: 'passed',
    tier: 'ai-single-view-review',
    checks: {
      minimumBytes: 100_000,
      triangleRange: [10_000, 1_500_000],
      requiresMesh: true,
      requiresMaterial: false,
      requiresNode: true,
    },
  };
}

async function downloadFile(url, outputPath) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`TripoSR download failed: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, buffer);
  return buffer;
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

async function promoteOverride(character, metrics, qualityGate, options) {
  const overrides = await loadOverrides();
  const baseCatalog = JSON.parse(await readFile(runtimeCatalogPath, 'utf8'));
  const baseRecord = baseCatalog.models.find(
    (model) => model.characterId === character.characterId,
  ) ?? {};
  const nextRecord = {
    ...baseRecord,
    id: `${character.characterId}-triposr-v1`,
    characterId: character.characterId,
    characterName: character.characterName,
    stage: character.stage,
    runtimePath: `/models/characters/${character.characterId}/${character.characterId}-triposr-v1.glb`,
    thumbnail: character.thumbnail,
    sourceSheet: character.sourceSheet,
    variationCount: character.variationCount,
    status: 'review',
    productionTier: 'ai-generated-single-view-review',
    generator: 'Stability AI TripoSR',
    intendedUpgrade: 'Multi-view reconstruction, retopology, humanoid rig, facial blendshapes, animation and LOD bake',
    providerTaskId: `${spaceId}:${new Date().toISOString()}`,
    providerCoverUrl: '',
    sourceViews: ['front'],
    qualityGate,
    reconstruction: {
      space: spaceId,
      marchingCubesResolution: options.resolution,
      removeBackground: options.removeBackground,
      foregroundRatio: options.foregroundRatio,
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

async function loadLocalGenerationOptions(character, fallbackOptions) {
  const metadataPath = path.join(artifactRoot, character.characterId, 'local-generation.json');
  try {
    const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
    return {
      ...fallbackOptions,
      resolution: metadata.settings?.resolution ?? fallbackOptions.resolution,
      foregroundRatio: metadata.settings?.foregroundRatio ?? fallbackOptions.foregroundRatio,
    };
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    return fallbackOptions;
  }
}

async function connect() {
  return Client.connect(spaceId, {
    status_callback: (status) => {
      if (status?.status && status.status !== 'running') {
        console.log(`TripoSR Space: ${status.status}`);
      }
    },
  });
}

async function generate(character, options) {
  const runtimeDirectory = path.join(
    projectRoot,
    'public',
    'models',
    'characters',
    character.characterId,
  );
  const runtimePath = path.join(
    runtimeDirectory,
    `${character.characterId}-triposr-v1.glb`,
  );
  if (!options.force && await fileExists(runtimePath)) {
    const buffer = await readFile(runtimePath);
    const metrics = inspectGlb(buffer);
    const qualityGate = validateReviewMesh(metrics);
    const effectiveOptions = await loadLocalGenerationOptions(character, options);
    await promoteOverride(character, metrics, qualityGate, effectiveOptions);
    console.log(JSON.stringify({
      mode: 'existing',
      characterId: character.characterId,
      runtimePath,
      metrics,
      qualityGate,
    }, null, 2));
    return;
  }

  const app = await connect();
  console.log(`${character.characterId}: preprocessing source image`);
  const preprocessed = await app.predict('/preprocess', [
    handle_file(character.inputPath),
    options.removeBackground,
    options.foregroundRatio,
  ]);
  const processedImage = preprocessed.data?.[0];
  if (!processedImage) throw new Error('TripoSR preprocessing returned no image.');

  console.log(`${character.characterId}: generating ${options.resolution}³ marching-cubes mesh`);
  const generated = await app.predict('/generate', [
    processedImage,
    options.resolution,
  ]);
  const outputUrl = findFileUrl(generated.data?.[1]);
  if (!outputUrl) {
    throw new Error(`TripoSR returned no GLB URL: ${JSON.stringify(generated.data)}`);
  }

  const artifactDirectory = path.join(artifactRoot, character.characterId);
  await mkdir(artifactDirectory, { recursive: true });
  const artifactPath = path.join(artifactDirectory, `${character.characterId}-triposr-v1.glb`);
  const buffer = await downloadFile(outputUrl, artifactPath);
  const metrics = inspectGlb(buffer);
  const qualityGate = validateReviewMesh(metrics);
  await mkdir(runtimeDirectory, { recursive: true });
  await writeFile(runtimePath, buffer);
  await writeFile(
    path.join(artifactDirectory, 'generation.json'),
    `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      provider: 'Stability AI',
      model: 'TripoSR',
      space: spaceId,
      characterId: character.characterId,
      inputPath: path.relative(projectRoot, character.inputPath).replaceAll('\\', '/'),
      outputPath: path.relative(projectRoot, runtimePath).replaceAll('\\', '/'),
      settings: {
        marchingCubesResolution: options.resolution,
        removeBackground: options.removeBackground,
        foregroundRatio: options.foregroundRatio,
      },
      metrics,
      qualityGate,
    }, null, 2)}\n`,
    'utf8',
  );
  await promoteOverride(character, metrics, qualityGate, options);
  console.log(JSON.stringify({
    mode: 'generated',
    characterId: character.characterId,
    runtimePath,
    metrics,
    qualityGate,
  }, null, 2));
  app.close();
}

async function main() {
  const options = parseArguments(process.argv);
  const character = await loadCharacter(options.characterId);
  if (!character) throw new Error(`Unsupported TripoSR character: ${options.characterId}`);
  const inputReady = await fileExists(character.inputPath);

  if (options.command === 'status' || options.command === 'plan') {
    console.log(JSON.stringify({
      provider: 'Stability AI',
      model: 'TripoSR',
      space: spaceId,
      characterId: character.characterId,
      inputPath: character.inputPath,
      inputReady,
      resolution: options.resolution,
      removeBackground: options.removeBackground,
      foregroundRatio: options.foregroundRatio,
      qualityTier: 'ai-single-view-review',
    }, null, 2));
    return;
  }
  if (options.command !== 'generate') {
    throw new Error('Usage: node tools/3d/triposr-client.mjs status|plan|generate [--character=raon] [--force]');
  }
  if (!inputReady) throw new Error(`Missing source image: ${character.inputPath}`);
  await generate(character, options);
}

const keepAlive = setInterval(() => {}, 1_000);
try {
  await main();
} finally {
  clearInterval(keepAlive);
}
