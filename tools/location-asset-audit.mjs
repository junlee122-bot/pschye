import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';

const outputDirectory = path.resolve('artifacts', 'location-assets');
const server = await createServer({
  appType: 'custom',
  server: { middlewareMode: true, hmr: false },
});

function resolvePublicAsset(assetPath) {
  return path.resolve('public', assetPath.replace(/^\/+/, ''));
}

async function inspectAsset(assetPath) {
  try {
    const assetStat = await stat(resolvePublicAsset(assetPath));
    return { path: assetPath, exists: true, bytes: assetStat.size };
  } catch {
    return { path: assetPath, exists: false, bytes: 0 };
  }
}

try {
  const locationModule = await server.ssrLoadModule('/src/data/locations.ts');
  const categoryRows = [];
  const locationRows = [];
  const inspectedPaths = new Set();

  for (const category of locationModule.worldLocationCategories) {
    const locations = locationModule.worldLocations.filter((entry) => entry.category === category.id);
    categoryRows.push({
      id: category.id,
      label: category.label,
      locations: locations.length,
      cover: category.cover,
    });
    inspectedPaths.add(category.cover);
  }

  for (const location of locationModule.worldLocations) {
    const assets = location.visuals.flatMap((visual) => [
      visual.thumbnail,
      ...Object.values(visual.variants),
      ...visual.beats,
    ]);
    assets.forEach((asset) => inspectedPaths.add(asset));
    locationRows.push({
      id: location.id,
      name: location.name,
      category: location.categoryLabel,
      episodes: location.episodeCount,
      scenes: location.sceneCount,
      visuals: location.visualCount,
      firstTime: location.firstTime,
    });
  }

  const inspectedAssets = await Promise.all(Array.from(inspectedPaths).map(inspectAsset));
  const missingAssets = inspectedAssets.filter((asset) => !asset.exists);
  const totalBytes = inspectedAssets.reduce((total, asset) => total + asset.bytes, 0);
  const report = {
    generatedAt: new Date().toISOString(),
    locations: locationModule.worldLocationCount,
    storyVisualReferences: locationModule.worldLocationVisualCount,
    uniqueAssetFiles: inspectedAssets.length,
    totalBytes,
    missingAssetCount: missingAssets.length,
    missingAssets,
    categories: categoryRows,
    locationInventory: locationRows,
  };
  const markdown = [
    '# 프시케 장소 비주얼 에셋 감사 보고서',
    '',
    `- 고유 장소: **${report.locations}곳**`,
    `- 스토리 장소 비주얼 참조: **${report.storyVisualReferences}개**`,
    `- 검사한 고유 파일: **${report.uniqueAssetFiles}개**`,
    `- 총 용량: **${(report.totalBytes / 1024 / 1024).toFixed(2)} MiB**`,
    `- 누락 파일: **${report.missingAssetCount}개**`,
    '',
    '## 권역별 커버리지',
    '',
    '| 권역 | 장소 | 대표 아트 |',
    '|---|---:|---|',
    ...report.categories.map((entry) => `| ${entry.label} | ${entry.locations} | \`${entry.cover}\` |`),
    '',
    '## 전체 장소 목록',
    '',
    '| 번호 | 장소 | 권역 | 에피소드 | 장면 | 비주얼 |',
    '|---:|---|---|---:|---:|---:|',
    ...report.locationInventory.map((entry, index) => (
      `| ${index + 1} | ${entry.name} | ${entry.category} | ${entry.episodes} | ${entry.scenes} | ${entry.visuals} |`
    )),
    '',
    missingAssets.length > 0
      ? `## 누락\n\n${missingAssets.map((asset) => `- \`${asset.path}\``).join('\n')}`
      : '## 판정\n\n모든 장소 비주얼과 권역 대표 아트가 실제 파일로 존재합니다.',
    '',
  ].join('\n');

  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(path.join(outputDirectory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
    writeFile(path.join(outputDirectory, 'report.md'), markdown, 'utf8'),
  ]);

  console.log(markdown);
  if (missingAssets.length > 0) process.exitCode = 1;
} finally {
  await server.close();
}
