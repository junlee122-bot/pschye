import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const outputRoot = path.join(projectRoot, 'artifacts', '3d', 'unity');
const files = [
  ['LOD0', 'public/models/characters/raon/raon-production-v2.glb'],
  ['LOD1', 'public/models/characters/raon/raon-production-lod1-v2.glb'],
  ['LOD2', 'public/models/characters/raon/raon-production-lod2-v2.glb'],
];

const requiredBones = [
  'Hips', 'Spine', 'Chest', 'UpperChest', 'Neck', 'Head',
  'LeftUpperLeg', 'LeftLowerLeg', 'LeftFoot',
  'RightUpperLeg', 'RightLowerLeg', 'RightFoot',
  'LeftShoulder', 'LeftUpperArm', 'LeftLowerArm', 'LeftHand',
  'RightShoulder', 'RightUpperArm', 'RightLowerArm', 'RightHand',
];
const requiredClips = [
  'idle', 'walk', 'run', 'sprint', 'jump', 'land',
  'dodge', 'attackLight', 'attackHeavy', 'guard', 'hit', 'talkNeutral',
];

function parseGlb(buffer) {
  if (buffer.length < 20 || buffer.readUInt32LE(0) !== 0x46546c67) throw new Error('Invalid GLB header');
  if (buffer.readUInt32LE(4) !== 2) throw new Error('Only glTF 2.0 is supported');
  if (buffer.readUInt32LE(8) !== buffer.length) throw new Error('Declared GLB size does not match file size');
  let offset = 12;
  let json;
  let binary = Buffer.alloc(0);
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + length;
    if (end > buffer.length) throw new Error('GLB chunk exceeds file bounds');
    if (type === 0x4e4f534a) json = JSON.parse(buffer.subarray(start, end).toString('utf8').trim());
    if (type === 0x004e4942) binary = buffer.subarray(start, end);
    offset = end;
  }
  if (!json) throw new Error('GLB JSON chunk is missing');
  return { json, binary };
}

const componentBytes = new Map([[5120, 1], [5121, 1], [5122, 2], [5123, 2], [5125, 4], [5126, 4]]);
const typeComponents = new Map([['SCALAR', 1], ['VEC2', 2], ['VEC3', 3], ['VEC4', 4], ['MAT4', 16]]);

function readComponent(buffer, offset, type) {
  if (type === 5120) return buffer.readInt8(offset);
  if (type === 5121) return buffer.readUInt8(offset);
  if (type === 5122) return buffer.readInt16LE(offset);
  if (type === 5123) return buffer.readUInt16LE(offset);
  if (type === 5125) return buffer.readUInt32LE(offset);
  if (type === 5126) return buffer.readFloatLE(offset);
  throw new Error(`Unsupported component type ${type}`);
}

function normalizeComponent(value, type) {
  if (type === 5120) return Math.max(value / 127, -1);
  if (type === 5121) return value / 255;
  if (type === 5122) return Math.max(value / 32767, -1);
  if (type === 5123) return value / 65535;
  return value;
}

function readAccessor(gltf, binary, accessorIndex) {
  const accessor = gltf.accessors?.[accessorIndex];
  if (!accessor || accessor.bufferView === undefined) return [];
  const view = gltf.bufferViews?.[accessor.bufferView];
  if (!view) return [];
  const componentCount = typeComponents.get(accessor.type);
  const bytes = componentBytes.get(accessor.componentType);
  if (!componentCount || !bytes) throw new Error(`Unsupported accessor ${accessor.type}/${accessor.componentType}`);
  const stride = view.byteStride ?? componentCount * bytes;
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const rows = [];
  for (let row = 0; row < accessor.count; row += 1) {
    const values = [];
    for (let component = 0; component < componentCount; component += 1) {
      let value = readComponent(binary, start + row * stride + component * bytes, accessor.componentType);
      if (accessor.normalized) value = normalizeComponent(value, accessor.componentType);
      values.push(value);
    }
    rows.push(values);
  }
  return rows;
}

function triangleCount(gltf) {
  let total = 0;
  for (const mesh of gltf.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      const count = primitive.indices === undefined
        ? gltf.accessors?.[primitive.attributes?.POSITION]?.count ?? 0
        : gltf.accessors?.[primitive.indices]?.count ?? 0;
      const mode = primitive.mode ?? 4;
      if (mode === 4) total += count / 3;
      if (mode === 5 || mode === 6) total += Math.max(0, count - 2);
    }
  }
  return Math.round(total);
}

function morphData(gltf) {
  let count = 0;
  const names = new Set();
  for (const mesh of gltf.meshes ?? []) {
    count = Math.max(count, ...(mesh.primitives ?? []).map((primitive) => primitive.targets?.length ?? 0));
    for (const name of mesh.extras?.targetNames ?? []) names.add(name);
  }
  return { count, names: [...names] };
}

function materialData(gltf) {
  const body = (gltf.materials ?? []).filter((material) => material.name?.endsWith('_PBR'));
  const hair = (gltf.materials ?? []).find((material) => material.name === 'Raon_HairCards');
  const channels = {
    baseColor: body.length >= 7 && body.every((material) => material.pbrMetallicRoughness?.baseColorTexture),
    metallicRoughness: body.length >= 7 && body.every((material) => material.pbrMetallicRoughness?.metallicRoughnessTexture),
    normal: body.length >= 7 && body.every((material) => material.normalTexture),
    occlusion: body.length >= 7 && body.every((material) => material.occlusionTexture),
  };
  return {
    count: gltf.materials?.length ?? 0,
    pbrBodyMaterials: body.length,
    channels,
    hairAlpha: Boolean(hair && ['BLEND', 'MASK'].includes(hair.alphaMode)),
  };
}

function skinData(gltf, binary) {
  const primitives = (gltf.meshes ?? []).flatMap((mesh) => mesh.primitives ?? []);
  const skinned = primitives.filter((primitive) => primitive.attributes?.JOINTS_0 !== undefined);
  let maxInfluences = 0;
  let maxWeightError = 0;
  let hasSecondaryInfluences = false;
  let finiteWeights = true;
  for (const primitive of skinned) {
    const primary = readAccessor(gltf, binary, primitive.attributes.WEIGHTS_0);
    const secondaryIndex = primitive.attributes.WEIGHTS_1;
    const secondary = secondaryIndex === undefined ? [] : readAccessor(gltf, binary, secondaryIndex);
    hasSecondaryInfluences ||= secondary.length > 0;
    for (let index = 0; index < primary.length; index += 1) {
      const values = [...primary[index], ...(secondary[index] ?? [])];
      finiteWeights &&= values.every(Number.isFinite);
      maxInfluences = Math.max(maxInfluences, values.filter((value) => value > 0.0001).length);
      maxWeightError = Math.max(maxWeightError, Math.abs(values.reduce((sum, value) => sum + value, 0) - 1));
    }
  }
  let inverseBindMatricesFinite = true;
  for (const skin of gltf.skins ?? []) {
    if (skin.inverseBindMatrices === undefined) continue;
    inverseBindMatricesFinite &&= readAccessor(gltf, binary, skin.inverseBindMatrices)
      .flat().every(Number.isFinite);
  }
  return {
    skins: gltf.skins?.length ?? 0,
    skinnedPrimitives: skinned.length,
    maxInfluences,
    maxWeightError: Number(maxWeightError.toFixed(6)),
    hasSecondaryInfluences,
    finiteWeights,
    inverseBindMatricesFinite,
  };
}

function animationData(gltf, binary) {
  const names = (gltf.animations ?? []).map((animation) => animation.name).filter(Boolean);
  let finite = true;
  const durations = {};
  for (const animation of gltf.animations ?? []) {
    let duration = 0;
    for (const sampler of animation.samplers ?? []) {
      const times = readAccessor(gltf, binary, sampler.input).flat();
      finite &&= times.every(Number.isFinite);
      finite &&= readAccessor(gltf, binary, sampler.output).flat().every(Number.isFinite);
      duration = Math.max(duration, ...times.filter(Number.isFinite));
    }
    if (animation.name) durations[animation.name] = Number(duration.toFixed(4));
  }
  return { count: names.length, names, durations, finite };
}

function bounds(gltf) {
  const minimum = [Infinity, Infinity, Infinity];
  const maximum = [-Infinity, -Infinity, -Infinity];
  for (const mesh of gltf.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      const accessor = gltf.accessors?.[primitive.attributes?.POSITION];
      if (!accessor?.min || !accessor?.max) continue;
      for (let axis = 0; axis < 3; axis += 1) {
        minimum[axis] = Math.min(minimum[axis], accessor.min[axis]);
        maximum[axis] = Math.max(maximum[axis], accessor.max[axis]);
      }
    }
  }
  return { minimum, maximum, size: maximum.map((value, index) => Number((value - minimum[index]).toFixed(4))) };
}

async function inspect(label, relativePath) {
  const absolutePath = path.join(projectRoot, relativePath);
  const [buffer, file] = await Promise.all([readFile(absolutePath), stat(absolutePath)]);
  const { json, binary } = parseGlb(buffer);
  const nodeNames = new Set((json.nodes ?? []).map((node) => node.name));
  return {
    label,
    path: relativePath.replaceAll('\\', '/'),
    bytes: file.size,
    triangles: triangleCount(json),
    meshes: json.meshes?.length ?? 0,
    nodes: json.nodes?.length ?? 0,
    boneNames: [...nodeNames].filter((name) => requiredBones.includes(name)),
    missingBones: requiredBones.filter((name) => !nodeNames.has(name)),
    morphs: morphData(json),
    materials: materialData(json),
    skin: skinData(json, binary),
    animations: animationData(json, binary),
    imageFormats: [...new Set((json.images ?? []).map((image) => image.mimeType).filter(Boolean))],
    bounds: bounds(json),
  };
}

const models = [];
const failures = [];
for (const file of files) {
  try {
    models.push(await inspect(...file));
  } catch (error) {
    failures.push(`${file[0]}: ${error.message}`);
  }
}

const lod0 = models.find((model) => model.label === 'LOD0');
if (lod0) {
  if (lod0.triangles < 35_000 || lod0.triangles > 90_000) failures.push(`LOD0 triangle budget: ${lod0.triangles}`);
  if (lod0.bytes > 20 * 1024 * 1024) failures.push(`LOD0 file budget: ${lod0.bytes}`);
  if (lod0.missingBones.length) failures.push(`Missing humanoid bones: ${lod0.missingBones.join(', ')}`);
  if (lod0.skin.skins < 1 || lod0.skin.skinnedPrimitives < 1) failures.push('No valid skinned primitive');
  if (lod0.skin.maxInfluences > 4 || lod0.skin.hasSecondaryInfluences) failures.push('Unity four-weight influence budget exceeded');
  if (!lod0.skin.finiteWeights || !lod0.skin.inverseBindMatricesFinite || lod0.skin.maxWeightError > 0.02) failures.push('Skin weights or bind matrices are invalid');
  if (lod0.morphs.count < 15) failures.push(`Facial morph target count: ${lod0.morphs.count}`);
  const missingClips = requiredClips.filter((name) => !lod0.animations.names.includes(name));
  if (missingClips.length || !lod0.animations.finite) failures.push(`Animation validation failed: ${missingClips.join(', ') || 'non-finite samples'}`);
  const zeroDurationClips = requiredClips.filter((name) => (lod0.animations.durations[name] ?? 0) <= 0.05);
  if (zeroDurationClips.length) failures.push(`Animation duration is effectively zero: ${zeroDurationClips.join(', ')}`);
  if (!Object.values(lod0.materials.channels).every(Boolean)) failures.push('PBR base/normal/ORM channels are incomplete');
  if (!lod0.materials.hairAlpha) failures.push('Hair-card alpha material is missing');
}
if (models.length === 3 && !(models[0].triangles > models[1].triangles && models[1].triangles > models[2].triangles)) {
  failures.push(`LOD triangle order invalid: ${models.map((model) => model.triangles).join(' > ')}`);
}

const report = {
  schema: 'raonjena.unity-compatibility-audit',
  version: 1,
  generatedAt: new Date().toISOString(),
  target: 'Unity 6 URP humanoid import candidate',
  actualUnityEditorValidation: false,
  status: failures.length ? 'fail' : 'pass',
  note: 'This is a deterministic GLB compatibility and deformation-data audit. A real Unity Editor import and animated camera/deformation pass is still required.',
  models,
  failures,
};
const markdown = [
  '# Raon Unity Compatibility Audit',
  '',
  `- Status: **${report.status.toUpperCase()}**`,
  '- Actual Unity Editor validation: **not run**',
  '- Target: Unity 6 URP humanoid import candidate',
  '',
  '| LOD | Triangles | File | Skins | Max influences | Morphs | Animations | PBR |',
  '|---|---:|---:|---:|---:|---:|---:|---|',
  ...models.map((model) => `| ${model.label} | ${model.triangles} | ${(model.bytes / 1024 / 1024).toFixed(2)} MB | ${model.skin.skins} | ${model.skin.maxInfluences} | ${model.morphs.count} | ${model.animations.count} | ${Object.values(model.materials.channels).every(Boolean) ? 'pass' : 'fail'} |`),
  '',
  '## Failures',
  '',
  ...(failures.length ? failures.map((failure) => `- ${failure}`) : ['- None in static GLB audit.']),
  '',
  '## Remaining Manual Gate',
  '',
  '- Import in Unity, configure Humanoid Avatar, and inspect shoulders, elbows, wrists, hips, knees, ankles, face, and hair under every clip.',
  '- Automated quad remesh is not a substitute for final manual facial and joint edge-loop retopology.',
].join('\n');

await mkdir(outputRoot, { recursive: true });
await Promise.all([
  writeFile(path.join(outputRoot, 'raon-unity-compatibility-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
  writeFile(path.join(outputRoot, 'raon-unity-compatibility-report.md'), `${markdown}\n`, 'utf8'),
]);
console.log(`Unity compatibility audit: ${report.status}; ${models.map((model) => `${model.label}=${model.triangles}`).join(', ')}`);
if (failures.length) process.exitCode = 1;
