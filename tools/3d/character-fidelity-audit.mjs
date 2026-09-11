import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const standards = JSON.parse(await readFile('tools/3d/character-fidelity-standards.json', 'utf8'));
const runtimeCatalog = JSON.parse(await readFile('public/data/model-runtime-catalog.json', 'utf8'));
const productionCatalog = JSON.parse(await readFile('public/data/model-production-catalog.json', 'utf8'));
let overrides = { models: [] };
try {
  overrides = JSON.parse(await readFile('public/data/model-provider-overrides.json', 'utf8'));
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

function parseGlb(buffer) {
  if (buffer.readUInt32LE(0) !== 0x46546c67 || buffer.readUInt32LE(4) !== 2) {
    throw new Error('Invalid glTF 2.0 GLB');
  }
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    if (type === 0x4e4f534a) {
      return JSON.parse(buffer.subarray(offset + 8, offset + 8 + length).toString('utf8').trim());
    }
    offset += 8 + length;
  }
  throw new Error('GLB JSON chunk is missing');
}

function triangleCount(gltf) {
  let total = 0;
  for (const mesh of gltf.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      const count = primitive.indices === undefined
        ? gltf.accessors?.[primitive.attributes?.POSITION]?.count ?? 0
        : gltf.accessors?.[primitive.indices]?.count ?? 0;
      total += (primitive.mode ?? 4) === 4 ? count / 3 : Math.max(0, count - 2);
    }
  }
  return Math.round(total);
}

function countMorphTargets(gltf) {
  return Math.max(0, ...(gltf.meshes ?? []).flatMap((mesh) => (
    mesh.primitives ?? []
  ).map((primitive) => primitive.targets?.length ?? 0)));
}

function countLods(gltf) {
  const names = [
    ...(gltf.meshes ?? []).map((mesh) => mesh.name ?? ''),
    ...(gltf.nodes ?? []).map((node) => node.name ?? ''),
  ];
  const levels = new Set();
  for (const name of names) {
    const match = name.match(/LOD[_ -]?(\d+)/i);
    if (match) levels.add(Number(match[1]));
  }
  return levels.size || 1;
}

function hasTextureChannel(gltf, channel) {
  const materials = gltf.materials ?? [];
  if (channel === 'baseColor') return materials.some((material) => material.pbrMetallicRoughness?.baseColorTexture);
  if (channel === 'metallic' || channel === 'roughness') {
    return materials.some((material) => material.pbrMetallicRoughness?.metallicRoughnessTexture);
  }
  if (channel === 'normal') return materials.some((material) => material.normalTexture);
  if (channel === 'ambientOcclusion') return materials.some((material) => material.occlusionTexture);
  return false;
}

const productionById = new Map(productionCatalog.characters.map((character) => [character.id, character]));
const overrideById = new Map((overrides.models ?? []).map((model) => [model.characterId, model]));
const weightedGates = standards.weightedGates;
const results = [];

for (const base of runtimeCatalog.models) {
  const record = { ...base, ...overrideById.get(base.characterId) };
  const production = productionById.get(record.characterId);
  const absolutePath = path.join(projectRoot, 'public', record.runtimePath.replace(/^\//, ''));
  try {
    const [buffer, file] = await Promise.all([readFile(absolutePath), stat(absolutePath)]);
    const gltf = parseGlb(buffer);
    const triangles = triangleCount(gltf);
    const materialCount = gltf.materials?.length ?? 0;
    const skinCount = gltf.skins?.length ?? 0;
    const morphTargets = countMorphTargets(gltf);
    const animationCount = gltf.animations?.length ?? 0;
    const lodLevels = Math.max(countLods(gltf), record.lodFiles?.length ?? 0);
    const textureChannels = Object.fromEntries(
      standards.targets.requiredTextureChannels.map((channel) => [channel, hasTextureChannel(gltf, channel)]),
    );
    const gates = {
      reference: (production?.references?.variationCount ?? 0) >= 20,
      mesh: (gltf.meshes?.length ?? 0) > 0 && triangles >= 10_000,
      topology: record.fidelityEvidence?.authoredTopology === true
        && triangles >= standards.targets.lod0Triangles.min
        && triangles <= standards.targets.lod0Triangles.max
        && !String(record.productionTier).includes('procedural'),
      materials: record.fidelityEvidence?.pbrMaterialSeparation === true
        && materialCount >= standards.targets.minimumMaterials,
      textures: Object.values(textureChannels).every(Boolean),
      rig: record.fidelityEvidence?.humanoidRig === true
        && skinCount >= standards.targets.minimumSkins,
      face: morphTargets >= standards.targets.minimumMorphTargets,
      motion: record.fidelityEvidence?.animationReviewed === true
        && animationCount >= standards.targets.minimumAnimations,
      lod: record.fidelityEvidence?.lodChain === true
        && lodLevels >= standards.targets.minimumLodLevels,
      engine: record.fidelityEvidence?.engineValidated === true
        && Boolean(record.engineValidation?.gameplayCamera && record.engineValidation?.deformationStress),
    };
    const score = weightedGates.reduce((sum, gate) => sum + (gates[gate.id] ? gate.weight : 0), 0);
    const tier = score >= standards.tiers.heroProduction.minimumScore
      ? 'heroProduction'
      : score >= standards.tiers.verticalSlice.minimumScore
        ? 'verticalSlice'
        : score >= standards.tiers.maquette.minimumScore
          ? 'maquette'
          : 'blocked';
    results.push({
      characterId: record.characterId,
      characterName: record.characterName,
      runtimePath: record.runtimePath,
      sourceTier: record.productionTier,
      score,
      tier,
      metrics: {
        bytes: file.size,
        triangles,
        materials: materialCount,
        skins: skinCount,
        morphTargets,
        animations: animationCount,
        lodLevels,
        textureChannels,
      },
      gates,
      blockers: weightedGates.filter((gate) => !gates[gate.id]).map((gate) => gate.label),
    });
  } catch (error) {
    results.push({
      characterId: record.characterId,
      characterName: record.characterName,
      runtimePath: record.runtimePath,
      score: 0,
      tier: 'blocked',
      metrics: null,
      gates: {},
      blockers: [error.message],
    });
  }
}

const summary = {
  total: results.length,
  blocked: results.filter((result) => result.tier === 'blocked').length,
  maquette: results.filter((result) => result.tier === 'maquette').length,
  verticalSlice: results.filter((result) => result.tier === 'verticalSlice').length,
  heroProduction: results.filter((result) => result.tier === 'heroProduction').length,
  averageScore: Number((results.reduce((sum, result) => sum + result.score, 0) / results.length).toFixed(1)),
};
const report = {
  schema: 'raonjena.character-fidelity-report',
  version: 1,
  generatedAt: new Date().toISOString(),
  standards,
  summary,
  results,
};
const markdown = [
  '# 라온제나 캐릭터 피델리티 보고서',
  '',
  `- 전체: ${summary.total}`,
  `- 형태 검증용: ${summary.maquette}`,
  `- 버티컬 슬라이스 준비: ${summary.verticalSlice}`,
  `- 히어로 제작 준비: ${summary.heroProduction}`,
  `- 평균 점수: ${summary.averageScore}/100`,
  '',
  '| 캐릭터 | 점수 | 현재 단계 | 삼각형 | 재질 | 스킨 | 표정 | 애니메이션 | LOD |',
  '|---|---:|---|---:|---:|---:|---:|---:|---:|',
  ...results.map((result) => `| ${result.characterName} | ${result.score} | ${result.tier} | ${result.metrics?.triangles ?? '-'} | ${result.metrics?.materials ?? '-'} | ${result.metrics?.skins ?? '-'} | ${result.metrics?.morphTargets ?? '-'} | ${result.metrics?.animations ?? '-'} | ${result.metrics?.lodLevels ?? '-'} |`),
  '',
  '## 판정 원칙',
  '',
  '- TripoSR/Hi3D/Meshy 결과는 실루엣 검토용 마켓이며 최종 게임 자산이 아니다.',
  '- 수동 리토폴로지, PBR 베이크, 스킨 웨이트, 표정, 애니메이션, LOD, 엔진 검증이 모두 있어야 버티컬 슬라이스 단계로 승격한다.',
  '- 폴리곤 수만 높여도 점수는 오르지 않는다. 움직임과 재질이 캐릭터의 생동감을 결정한다.',
  '',
  ...results.flatMap((result) => [
    `### ${result.characterName} (${result.characterId})`,
    ...result.blockers.map((blocker) => `- 미통과: ${blocker}`),
    '',
  ]),
].join('\n');

await mkdir('artifacts/3d', { recursive: true });
await Promise.all([
  writeFile('artifacts/3d/character-fidelity-report.json', `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
  writeFile('artifacts/3d/character-fidelity-report.md', `${markdown}\n`, 'utf8'),
  writeFile('public/data/character-fidelity-report.json', `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
]);
console.log(`Character fidelity: ${summary.averageScore}/100 average; ${summary.verticalSlice + summary.heroProduction}/${summary.total} playable-production ready`);
if (process.argv.includes('--strict') && summary.verticalSlice + summary.heroProduction === 0) process.exitCode = 1;
