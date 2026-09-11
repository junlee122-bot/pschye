import { access, mkdir, readFile, writeFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile('tools/world/zelda-like-readiness-manifest.json', 'utf8'));

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

const pillars = [];
for (const pillar of manifest.pillars) {
  const evidence = await Promise.all(pillar.evidence.map(async (file) => ({ file, exists: await exists(file) })));
  const available = evidence.filter((item) => item.exists).length;
  const ratio = pillar.evidence.length ? available / pillar.evidence.length : 0;
  const status = ratio === 1 ? 'prototype-ready' : ratio > 0 ? 'partial' : 'missing';
  pillars.push({
    ...pillar,
    status,
    evidence,
    earnedWeight: Number((pillar.weight * ratio).toFixed(1)),
  });
}

const score = Number(pillars.reduce((sum, pillar) => sum + pillar.earnedWeight, 0).toFixed(1));
const report = {
  schema: 'raonjena.action-adventure-readiness-report',
  version: 1,
  generatedAt: new Date().toISOString(),
  target: manifest.target,
  recommendedEngine: manifest.recommendedEngine,
  score,
  assessment: score >= 75 ? 'vertical-slice-production' : score >= 45 ? 'systems-prototype' : 'preproduction',
  verticalSlice: manifest.verticalSlice,
  pillars,
  nextCriticalPath: pillars
    .filter((pillar) => pillar.status !== 'prototype-ready')
    .sort((left, right) => right.weight - left.weight)
    .slice(0, 5)
    .map((pillar) => pillar.label),
};

const markdown = [
  '# 라온제나 3D 액션 어드벤처 준비도',
  '',
  `- 점수: ${score}/100`,
  `- 단계: ${report.assessment}`,
  `- 권장 엔진: ${report.recommendedEngine}`,
  '',
  '| 축 | 상태 | 가중치 | 획득 |',
  '|---|---|---:|---:|',
  ...pillars.map((pillar) => `| ${pillar.label} | ${pillar.status} | ${pillar.weight} | ${pillar.earnedWeight} |`),
  '',
  '## 다음 핵심 경로',
  '',
  ...report.nextCriticalPath.map((item, index) => `${index + 1}. ${item}`),
].join('\n');

await mkdir('artifacts/world', { recursive: true });
await Promise.all([
  writeFile('artifacts/world/action-adventure-readiness-report.json', `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
  writeFile('artifacts/world/action-adventure-readiness-report.md', `${markdown}\n`, 'utf8'),
  writeFile('public/data/action-adventure-readiness-report.json', `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
]);
console.log(`Action-adventure readiness: ${score}/100 (${report.assessment})`);
for (const pillar of pillars) console.log(`${pillar.status.toUpperCase().padEnd(15)} ${pillar.label}`);
