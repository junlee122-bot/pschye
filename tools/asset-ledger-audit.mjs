import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const publicRoot = path.join(projectRoot, 'public');
const artRoot = path.join(publicRoot, 'art');
const sourceManifestPath = path.join(projectRoot, 'docs', 'source', 'asset-sources.json');
const outputDirectory = path.join(projectRoot, 'artifacts', 'asset-ledger');
const publicCatalogDirectory = path.join(publicRoot, 'data');
const checkMode = process.argv.includes('--check');
const qualityCheckMode = process.argv.includes('--quality-check');

const supportedExtensions = new Set([
  '.avif',
  '.fbx',
  '.gif',
  '.glb',
  '.gltf',
  '.jpeg',
  '.jpg',
  '.mp3',
  '.mp4',
  '.ogg',
  '.png',
  '.svg',
  '.wav',
  '.webm',
  '.webp',
]);

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function toRuntimePath(filePath) {
  return `/${toPosix(path.relative(publicRoot, filePath))}`;
}

function makeId(runtimePath) {
  return runtimePath
    .replace(/^\/art\//, '')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      results.push(...await walk(fullPath));
      continue;
    }

    if (supportedExtensions.has(path.extname(entry.name).toLowerCase())) {
      results.push(fullPath);
    }
  }

  return results;
}

function readUInt24LE(buffer, offset) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function readPngMetadata(buffer) {
  if (buffer.length < 26 || buffer.toString('ascii', 1, 4) !== 'PNG') return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    alpha: [4, 6].includes(buffer[25]),
  };
}

function readWebpMetadata(buffer) {
  if (buffer.length < 30 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') {
    return null;
  }

  const chunk = buffer.toString('ascii', 12, 16);
  if (chunk === 'VP8X') {
    return {
      width: readUInt24LE(buffer, 24) + 1,
      height: readUInt24LE(buffer, 27) + 1,
      alpha: Boolean(buffer[20] & 0b00010000),
    };
  }

  if (chunk === 'VP8L' && buffer.length >= 25) {
    const byte1 = buffer[21];
    const byte2 = buffer[22];
    const byte3 = buffer[23];
    const byte4 = buffer[24];
    return {
      width: 1 + (byte1 | ((byte2 & 0x3f) << 8)),
      height: 1 + ((byte2 >> 6) | (byte3 << 2) | ((byte4 & 0x0f) << 10)),
      alpha: true,
    };
  }

  if (chunk === 'VP8 ') {
    const marker = buffer.indexOf(Buffer.from([0x9d, 0x01, 0x2a]), 20);
    if (marker >= 0 && buffer.length >= marker + 7) {
      return {
        width: buffer.readUInt16LE(marker + 3) & 0x3fff,
        height: buffer.readUInt16LE(marker + 5) & 0x3fff,
        alpha: false,
      };
    }
  }

  return null;
}

function readJpegMetadata(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  const frameMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    if (frameMarkers.has(marker)) {
      return {
        width: buffer.readUInt16BE(offset + 7),
        height: buffer.readUInt16BE(offset + 5),
        alpha: false,
      };
    }

    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }

    const length = buffer.readUInt16BE(offset + 2);
    if (!Number.isFinite(length) || length < 2) break;
    offset += length + 2;
  }

  return null;
}

function readGifMetadata(buffer) {
  if (buffer.length < 10 || !['GIF87a', 'GIF89a'].includes(buffer.toString('ascii', 0, 6))) return null;
  return {
    width: buffer.readUInt16LE(6),
    height: buffer.readUInt16LE(8),
    alpha: true,
  };
}

function getImageMetadata(buffer, extension) {
  if (extension === '.png') return readPngMetadata(buffer);
  if (extension === '.webp') return readWebpMetadata(buffer);
  if (extension === '.jpg' || extension === '.jpeg') return readJpegMetadata(buffer);
  if (extension === '.gif') return readGifMetadata(buffer);
  return null;
}

async function inspectFile(filePath) {
  const buffer = await readFile(filePath);
  const extension = path.extname(filePath).toLowerCase();
  return {
    sha256: createHash('sha256').update(buffer).digest('hex').slice(0, 16),
    dimensions: getImageMetadata(buffer, extension),
  };
}

function inferProvenance(runtimePath, sourceRecord) {
  if (sourceRecord) return 'provided-reference';
  if (runtimePath.includes('/story/scenes/')) return 'generated-story-2d';
  if (runtimePath.includes('/locations/') || runtimePath.includes('/world/')) return 'generated-world-2d';
  if (runtimePath.includes('/village/')) return 'generated-level-2d';
  if (runtimePath.includes('/portraits/') || runtimePath.includes('/characters/')) return 'generated-character-2d';
  if (runtimePath.includes('/archive/')) return 'generated-archive-2d';
  if (runtimePath.includes('/generated/')) return 'generated-2d';
  return 'project-asset';
}

const characterNames = {
  abel: '아벨',
  achero: '아케로',
  adeline: '아델린',
  akari: '아카리',
  ann: '앤',
  bao: '바오',
  bellatrice: '벨라트리체',
  boksonga: '복송아',
  brigitte: '브리짓',
  chasey: '체이시',
  chris: '크리스',
  colin: '콜린',
  crowd: '크라우드',
  dimitri: '디미트리',
  eitan: '에이탄',
  elaine: '엘레인',
  evan: '에반',
  garam: '가람',
  guillaume: '기욤',
  hadori: '하도리',
  haechan: '해찬',
  jinhwon: '진훤',
  kael: '카엘',
  kain: '카인',
  kampta: '캄프타',
  kangrim: '강림',
  kazrin: '카즈린',
  kitty: '키티',
  laila: '라일라',
  lami: '라미',
  leo: '레오',
  list: '리스트',
  lucas: '루카스',
  luka: '루카',
  maru: '마루',
  mire: '미르',
  moira: '모이라',
  'nabi-nia': '나비 / 니아',
  night: '나이트',
  perseus: '페르세우스',
  raon: '라온',
  remesis: '레메시스',
  rose: '로즈',
  sebastian: '세바스티안',
  spinoza: '스피노자',
  'tena-elion': '테나 엘리온',
  volver: '볼버',
  yeri: '예리',
};

const archiveNames = {
  'archive-cover': '프시케 인물 도감 표지',
  'generation-01': '프시케 제1기',
  'generation-02': '프시케 제2기',
  'generation-03': '프시케 제3기',
  'generation-04': '프시케 제4기',
  'generation-05-original': '프시케 제5기',
  'generation-06': '프시케 제6기',
  'generation-07': '프시케 제7기',
  'hadori-sheet': '하도리 캐릭터 시트',
  'haechan-sheet': '해찬 캐릭터 시트',
  'jinhwon-sheet': '진훤 캐릭터 시트',
  'kain-sheet': '카인 캐릭터 시트',
  'kazrin-sheet': '카즈린 캐릭터 시트',
  'lami-sheet': '라미 캐릭터 시트',
  'legends-past-present-01': '중요 인물 과거와 현재 I',
  'legends-past-present-02': '중요 인물 과거와 현재 II',
  'leo-sheet': '레오 캐릭터 시트',
  'maru-sheet': '마루 캐릭터 시트',
  'nabi-nia-sheet': '나비 / 니아 캐릭터 시트',
  'raon-sheet': '라온 캐릭터 시트',
};

function getCatalogIdentity(runtimePath) {
  const parts = runtimePath.split('/').filter(Boolean);
  const root = parts[1] ?? 'other';
  const collection = parts[2] ?? root;
  const filename = parts.at(-1) ?? runtimePath;
  const variant = filename.replace(/\.[^.]+$/, '');

  if (root === 'characters') {
    return {
      category: 'character',
      collection,
      title: characterNames[collection] ?? collection,
      variant,
    };
  }

  if (root === 'archive') {
    return {
      category: 'archive',
      collection: variant,
      title: archiveNames[variant] ?? variant.replace(/[-_]+/g, ' '),
      variant: '제공 설정화 원본',
    };
  }

  if (root === 'story') {
    return {
      category: 'story',
      collection: parts[3] ?? collection,
      title: parts[3] ?? collection,
      variant,
    };
  }

  if (root === 'locations') {
    return {
      category: 'location',
      collection,
      title: collection,
      variant,
    };
  }

  return {
    category: root === 'generated' ? 'mission' : root,
    collection,
    title: variant.replace(/[-_]+/g, ' '),
    variant,
  };
}

function getMinimumResolution(category, runtimePath) {
  if (category === 'story' && runtimePath.endsWith('/thumb.webp')) return { width: 320, height: 180 };
  if (category === 'story' && runtimePath.includes('/beats/')) return { width: 960, height: 540 };
  if (category === 'story' || category === 'location' || category === 'village' || category === 'mission') {
    return { width: 1280, height: 720 };
  }
  if (category === 'character' || category === 'portrait') return { width: 512, height: 512 };
  if (category === 'archive') return { width: 900, height: 1200 };
  return { width: 512, height: 512 };
}

function evaluateQuality({ category, runtimePath, dimensions, bytes, sourceRecord, duplicateCount }) {
  const gates = [];
  let score = 100;
  const minimum = getMinimumResolution(category, runtimePath);

  if (!dimensions) {
    gates.push({ id: 'dimensions', status: 'warn', label: '이미지 크기를 자동 판독하지 못함' });
    score -= 18;
  } else if (dimensions.width < minimum.width || dimensions.height < minimum.height) {
    gates.push({
      id: 'resolution',
      status: 'fail',
      label: `권장 ${minimum.width}×${minimum.height} 미만`,
    });
    score -= 30;
  } else {
    gates.push({
      id: 'resolution',
      status: 'pass',
      label: `${dimensions.width}×${dimensions.height} 해상도 통과`,
    });
  }

  if (bytes > 5 * 1024 * 1024) {
    gates.push({ id: 'budget', status: 'warn', label: '5MB 초과 · 런타임 압축 검토' });
    score -= 8;
  } else {
    gates.push({ id: 'budget', status: 'pass', label: '파일 용량 예산 통과' });
  }

  if (sourceRecord) {
    gates.push({ id: 'provenance', status: 'pass', label: '원본 출처가 명시됨' });
  } else {
    gates.push({ id: 'provenance', status: 'warn', label: '경로 기반 출처 추정 · 생성 기록 보강 필요' });
    score -= 10;
  }

  if (duplicateCount > 1) {
    gates.push({ id: 'duplicate', status: 'warn', label: `동일 파일 ${duplicateCount}개 경로에서 사용` });
    score -= 5;
  } else {
    gates.push({ id: 'duplicate', status: 'pass', label: '고유 파일 해시' });
  }

  return {
    score: Math.max(0, score),
    status: score >= 85 ? 'pass' : score >= 60 ? 'warn' : 'fail',
    gates,
  };
}

async function collectStaticReferences() {
  const roots = ['src', 'docs', 'tools'];
  const references = new Map();
  const mediaPattern = /\/art\/[a-zA-Z0-9가-힣_./-]+\.(?:avif|fbx|gif|glb|gltf|jpe?g|mp3|mp4|ogg|png|svg|wav|webm|webp)/g;

  async function scanDirectory(directory) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await scanDirectory(fullPath);
        continue;
      }

      if (!/\.(?:css|html|js|json|md|mjs|ts|tsx)$/.test(entry.name)) continue;
      const content = await readFile(fullPath, 'utf8');
      for (const match of content.matchAll(mediaPattern)) {
        const runtimePath = match[0];
        const owners = references.get(runtimePath) ?? [];
        owners.push(toPosix(path.relative(projectRoot, fullPath)));
        references.set(runtimePath, owners);
      }
    }
  }

  for (const root of roots) {
    await scanDirectory(path.join(projectRoot, root));
  }

  return references;
}

async function loadSourceManifest() {
  try {
    const records = JSON.parse(await readFile(sourceManifestPath, 'utf8'));
    return new Map(records.map((record) => [
      `/${toPosix(record.destination).replace(/^\/+/, '').replace(/^public\//, '')}`,
      record,
    ]));
  } catch {
    return new Map();
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

const [assetFiles, staticReferences, sourceManifest] = await Promise.all([
  walk(artRoot),
  collectStaticReferences(),
  loadSourceManifest(),
]);

const shippedPaths = new Set(assetFiles.map(toRuntimePath));
const declaredPaths = new Set([...staticReferences.keys(), ...sourceManifest.keys()]);
const missingDeclared = [...declaredPaths].filter((runtimePath) => !shippedPaths.has(runtimePath)).sort();

const inspectedFiles = await Promise.all(assetFiles.map(async (filePath) => ({
  filePath,
  runtimePath: toRuntimePath(filePath),
  metadata: await stat(filePath),
  inspection: await inspectFile(filePath),
})));

const duplicateCounts = inspectedFiles.reduce((counts, entry) => {
  counts.set(entry.inspection.sha256, (counts.get(entry.inspection.sha256) ?? 0) + 1);
  return counts;
}, new Map());

const entries = inspectedFiles.map(({ filePath, runtimePath, metadata, inspection }) => {
  const sourceRecord = sourceManifest.get(runtimePath);
  const identity = getCatalogIdentity(runtimePath);
  const duplicateCount = duplicateCounts.get(inspection.sha256) ?? 1;
  const quality = evaluateQuality({
    ...identity,
    runtimePath,
    dimensions: inspection.dimensions,
    bytes: metadata.size,
    sourceRecord,
    duplicateCount,
  });

  return {
    id: makeId(runtimePath),
    ...identity,
    runtimePath,
    shipped: true,
    representation: path.extname(filePath).slice(1).toLowerCase(),
    provenance: inferProvenance(runtimePath, sourceRecord),
    sourceRecordId: sourceRecord?.id ?? null,
    originalSource: sourceRecord?.source ?? null,
    bytes: metadata.size,
    sha256: inspection.sha256,
    width: inspection.dimensions?.width ?? null,
    height: inspection.dimensions?.height ?? null,
    alpha: inspection.dimensions?.alpha ?? null,
    duplicateCount,
    quality,
    staticallyReferenced: staticReferences.has(runtimePath),
    referenceOwners: staticReferences.get(runtimePath) ?? [],
  };
});

entries.sort((left, right) => left.runtimePath.localeCompare(right.runtimePath));

const provenanceCounts = entries.reduce((counts, entry) => {
  counts[entry.provenance] = (counts[entry.provenance] ?? 0) + 1;
  return counts;
}, {});

const categoryCounts = entries.reduce((counts, entry) => {
  counts[entry.category] = (counts[entry.category] ?? 0) + 1;
  return counts;
}, {});

const qualityCounts = entries.reduce((counts, entry) => {
  counts[entry.quality.status] = (counts[entry.quality.status] ?? 0) + 1;
  return counts;
}, { pass: 0, warn: 0, fail: 0 });

const report = {
  schema: 'raonjena.asset-ledger',
  version: 1,
  generatedAt: new Date().toISOString(),
  rules: {
    shipped: 'public/art 아래에 실제 파일이 존재한다.',
    declared: '소스·문서·출처표에 정적 파일 경로가 기록되어 있다.',
    staticReference: '동적 템플릿 경로는 제외한 정적 문자열 참조다.',
    provenance: '명시 출처가 없는 항목은 경로 규칙으로 분류한 추정값이다.',
  },
  summary: {
    shipped: entries.length,
    declared: declaredPaths.size,
    missingDeclared: missingDeclared.length,
    sourceManifestRecords: sourceManifest.size,
    staticallyReferenced: entries.filter((entry) => entry.staticallyReferenced).length,
    totalBytes: entries.reduce((total, entry) => total + entry.bytes, 0),
    provenance: provenanceCounts,
    categories: categoryCounts,
    quality: qualityCounts,
  },
  missingDeclared: missingDeclared.map((runtimePath) => ({
    runtimePath,
    referenceOwners: staticReferences.get(runtimePath) ?? [],
    sourceRecordId: sourceManifest.get(runtimePath)?.id ?? null,
  })),
  entries,
};

const publicReport = {
  ...report,
  entries: report.entries.map((entry) => ({
    ...entry,
    originalSource: null,
  })),
};

const markdown = [
  '# 라온제나 자산 원장',
  '',
  `- 생성 시각: ${report.generatedAt}`,
  `- 실제 배포 자산: ${report.summary.shipped}개`,
  `- 정적 선언 자산: ${report.summary.declared}개`,
  `- 선언됐지만 누락된 자산: ${report.summary.missingDeclared}개`,
  `- 총 용량: ${formatBytes(report.summary.totalBytes)}`,
  `- 품질 통과: ${qualityCounts.pass}개`,
  `- 검토 필요: ${qualityCounts.warn}개`,
  `- 교체 권장: ${qualityCounts.fail}개`,
  '',
  '## 출처 분류',
  '',
  '| 분류 | 수량 |',
  '|---|---:|',
  ...Object.entries(provenanceCounts)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([provenance, count]) => `| ${provenance} | ${count} |`),
  '',
  '## 품질 상태',
  '',
  '| 상태 | 수량 |',
  '|---|---:|',
  `| 통과 | ${qualityCounts.pass} |`,
  `| 검토 | ${qualityCounts.warn} |`,
  `| 교체 권장 | ${qualityCounts.fail} |`,
  '',
  '## 선언됐지만 누락된 자산',
  '',
  ...(missingDeclared.length
    ? missingDeclared.map((runtimePath) => `- \`${runtimePath}\``)
    : ['- 없음']),
  '',
  '## 검수 원칙',
  '',
  '- 실제 파일과 미래 계약 경로를 같은 것으로 표시하지 않는다.',
  '- 생성 2D, 제공 원본, 프로젝트 자산을 구분한다.',
  '- 동적 경로는 정적 참조 수치에 포함하지 않으며 실제 배포 파일 수로 별도 검증한다.',
  '- 상세 항목과 SHA-256은 `ledger.json`에서 확인한다.',
  '',
].join('\n');

await mkdir(outputDirectory, { recursive: true });
await mkdir(publicCatalogDirectory, { recursive: true });
await Promise.all([
  writeFile(path.join(outputDirectory, 'ledger.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
  writeFile(path.join(outputDirectory, 'ledger.md'), markdown, 'utf8'),
  writeFile(path.join(publicCatalogDirectory, 'asset-catalog.json'), `${JSON.stringify(publicReport, null, 2)}\n`, 'utf8'),
]);

console.log(
  `asset-ledger shipped=${report.summary.shipped} declared=${report.summary.declared} `
  + `missing=${report.summary.missingDeclared} quality=${qualityCounts.pass}/${qualityCounts.warn}/${qualityCounts.fail} `
  + `size=${formatBytes(report.summary.totalBytes)}`,
);

if (checkMode && missingDeclared.length > 0) {
  process.exitCode = 1;
}

if (qualityCheckMode && qualityCounts.fail > 0) {
  process.exitCode = 1;
}
