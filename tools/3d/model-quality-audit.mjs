import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const catalogPath = path.join(projectRoot, 'public', 'data', 'model-runtime-catalog.json');
const overridePath = path.join(projectRoot, 'public', 'data', 'model-provider-overrides.json');
const reportRoot = path.join(projectRoot, 'artifacts', '3d');
const checkMode = process.argv.includes('--check');

function parseGlb(buffer) {
  if (buffer.length < 20) throw new Error('GLB header is truncated');
  if (buffer.readUInt32LE(0) !== 0x46546c67) throw new Error('Invalid GLB magic');
  if (buffer.readUInt32LE(4) !== 2) throw new Error('Only glTF 2.0 is supported');
  const declaredLength = buffer.readUInt32LE(8);
  if (declaredLength !== buffer.length) {
    throw new Error(`Declared length ${declaredLength} differs from file length ${buffer.length}`);
  }

  let offset = 12;
  let json = null;
  let binaryLength = 0;
  while (offset + 8 <= buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLength;
    if (chunkEnd > buffer.length) throw new Error('GLB chunk exceeds file bounds');
    if (chunkType === 0x4e4f534a) {
      json = JSON.parse(buffer.subarray(chunkStart, chunkEnd).toString('utf8').trim());
    } else if (chunkType === 0x004e4942) {
      binaryLength += chunkLength;
    }
    offset = chunkEnd;
  }
  if (!json) throw new Error('GLB JSON chunk is missing');
  return { json, binaryLength };
}

function triangleCount(gltf) {
  let triangles = 0;
  for (const mesh of gltf.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      const mode = primitive.mode ?? 4;
      const count = primitive.indices === undefined
        ? gltf.accessors?.[primitive.attributes?.POSITION]?.count ?? 0
        : gltf.accessors?.[primitive.indices]?.count ?? 0;
      if (mode === 4) triangles += count / 3;
      if (mode === 5 || mode === 6) triangles += Math.max(0, count - 2);
    }
  }
  return Math.round(triangles);
}

function boundsFromAccessors(gltf) {
  const positionAccessors = [];
  for (const mesh of gltf.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      const accessor = gltf.accessors?.[primitive.attributes?.POSITION];
      if (accessor?.min && accessor?.max) positionAccessors.push(accessor);
    }
  }
  if (!positionAccessors.length) return null;
  const minimum = [Infinity, Infinity, Infinity];
  const maximum = [-Infinity, -Infinity, -Infinity];
  for (const accessor of positionAccessors) {
    for (let axis = 0; axis < 3; axis += 1) {
      minimum[axis] = Math.min(minimum[axis], accessor.min[axis]);
      maximum[axis] = Math.max(maximum[axis], accessor.max[axis]);
    }
  }
  return {
    minimum,
    maximum,
    size: maximum.map((value, axis) => Number((value - minimum[axis]).toFixed(4))),
  };
}

function auditModel(record, gltf, fileStats, binaryLength) {
  const issues = [];
  const meshes = gltf.meshes?.length ?? 0;
  const nodes = gltf.nodes?.length ?? 0;
  const materials = gltf.materials?.length ?? 0;
  const skins = gltf.skins?.length ?? 0;
  const animations = gltf.animations?.length ?? 0;
  const triangles = triangleCount(gltf);
  const bounds = boundsFromAccessors(gltf);
  const unnamedMeshes = (gltf.meshes ?? []).filter((mesh) => !mesh.name).length;
  const unnamedMaterials = (gltf.materials ?? []).filter((material) => !material.name).length;

  if (!meshes) issues.push({ severity: 'fail', code: 'NO_MESH', message: '렌더링 가능한 메시가 없습니다.' });
  if (!nodes) issues.push({ severity: 'fail', code: 'NO_NODE', message: '씬 노드가 없습니다.' });
  if (!materials) issues.push({ severity: 'warn', code: 'NO_MATERIAL', message: '재질이 없습니다.' });
  if (!bounds) issues.push({ severity: 'fail', code: 'NO_BOUNDS', message: 'POSITION 경계를 계산할 수 없습니다.' });
  if (unnamedMeshes) issues.push({ severity: 'warn', code: 'UNNAMED_MESH', message: `이름 없는 메시 ${unnamedMeshes}개` });
  if (unnamedMaterials) issues.push({ severity: 'warn', code: 'UNNAMED_MATERIAL', message: `이름 없는 재질 ${unnamedMaterials}개` });
  if (!skins) issues.push({ severity: 'warn', code: 'RIG_PENDING', message: '스킨/본 리깅이 아직 없습니다.' });
  if (!animations) issues.push({ severity: 'warn', code: 'ANIMATION_PENDING', message: '애니메이션 클립이 아직 없습니다.' });
  if (triangles > 120_000) issues.push({ severity: 'warn', code: 'TRIANGLE_BUDGET', message: `LOD0 권장 예산을 초과했습니다: ${triangles}` });
  if (fileStats.size > 30 * 1024 * 1024) issues.push({ severity: 'warn', code: 'FILE_BUDGET', message: '모델 파일이 30MB를 초과합니다.' });
  if (bounds && Math.max(...bounds.size) > 4) issues.push({ severity: 'warn', code: 'SCALE_RANGE', message: '미터 단위 캐릭터로 보기에는 경계가 큽니다.' });

  const failCount = issues.filter((issue) => issue.severity === 'fail').length;
  const warnCount = issues.filter((issue) => issue.severity === 'warn').length;
  return {
    id: record.id,
    characterId: record.characterId,
    runtimePath: record.runtimePath,
    tier: record.productionTier,
    status: failCount ? 'fail' : warnCount ? 'warn' : 'pass',
    metrics: {
      bytes: fileStats.size,
      binaryBytes: binaryLength,
      meshes,
      nodes,
      materials,
      skins,
      animations,
      triangles,
      bounds,
    },
    issues,
  };
}

await mkdir(reportRoot, { recursive: true });
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
let overrides = { models: [] };
try {
  overrides = JSON.parse(await readFile(overridePath, 'utf8'));
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}
const overrideByCharacter = new Map(
  (overrides.models ?? []).map((model) => [model.characterId, model]),
);
catalog.models = (catalog.models ?? []).map((record) => ({
  ...record,
  ...overrideByCharacter.get(record.characterId),
}));
for (const record of overrides.models ?? []) {
  if (!catalog.models.some((base) => base.characterId === record.characterId)) {
    catalog.models.push(record);
  }
}
const results = [];

for (const record of catalog.models ?? []) {
  const absolutePath = path.join(projectRoot, 'public', record.runtimePath.replace(/^\//, ''));
  try {
    const [buffer, fileStats] = await Promise.all([readFile(absolutePath), stat(absolutePath)]);
    const { json, binaryLength } = parseGlb(buffer);
    results.push(auditModel(record, json, fileStats, binaryLength));
  } catch (error) {
    results.push({
      id: record.id,
      characterId: record.characterId,
      runtimePath: record.runtimePath,
      tier: record.productionTier,
      status: 'fail',
      metrics: null,
      issues: [{ severity: 'fail', code: 'PARSE_ERROR', message: error.message }],
    });
  }
}

const summary = {
  total: results.length,
  pass: results.filter((result) => result.status === 'pass').length,
  warn: results.filter((result) => result.status === 'warn').length,
  fail: results.filter((result) => result.status === 'fail').length,
};
const report = {
  schema: 'raonjena.model-quality-report',
  version: 1,
  generatedAt: new Date().toISOString(),
  thresholds: {
    lod0TriangleWarning: 120_000,
    fileSizeWarningBytes: 30 * 1024 * 1024,
    requiredForPrototype: ['valid glTF 2.0 GLB', 'mesh', 'node', 'POSITION bounds'],
    requiredForProduction: ['skin', 'animation set', 'LOD chain', 'facial blend shapes'],
  },
  summary,
  results,
};

const markdown = [
  '# 라온제나 3D 모델 품질 보고서',
  '',
  `- 생성: ${report.generatedAt}`,
  `- 전체: ${summary.total}`,
  `- 통과: ${summary.pass}`,
  `- 경고: ${summary.warn}`,
  `- 실패: ${summary.fail}`,
  '',
  '| 모델 | 상태 | 삼각형 | 메시 | 재질 | 스킨 | 애니메이션 |',
  '|---|---:|---:|---:|---:|---:|---:|',
  ...results.map((result) => {
    const metrics = result.metrics ?? {};
    return `| ${result.id} | ${result.status} | ${metrics.triangles ?? '-'} | ${metrics.meshes ?? '-'} | ${metrics.materials ?? '-'} | ${metrics.skins ?? '-'} | ${metrics.animations ?? '-'} |`;
  }),
  '',
  '## 판정',
  '',
  ...results.flatMap((result) => [
    `### ${result.id}`,
    ...(result.issues.length
      ? result.issues.map((issue) => `- **${issue.severity.toUpperCase()} / ${issue.code}** — ${issue.message}`)
      : ['- 문제 없음']),
    '',
  ]),
].join('\n');

await Promise.all([
  writeFile(path.join(reportRoot, 'model-quality-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
  writeFile(path.join(reportRoot, 'model-quality-report.md'), `${markdown}\n`, 'utf8'),
]);

console.log(`3D model audit: ${summary.pass} pass / ${summary.warn} warn / ${summary.fail} fail`);
for (const result of results) {
  console.log(`${result.status.toUpperCase().padEnd(4)} ${result.id} — ${result.metrics?.triangles ?? 0} triangles`);
}
if (checkMode && summary.fail > 0) process.exitCode = 1;
