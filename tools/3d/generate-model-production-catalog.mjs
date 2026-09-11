import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const artRoot = path.join(projectRoot, 'public', 'art', 'characters');
const outputPath = path.join(projectRoot, 'public', 'data', 'model-production-catalog.json');
const runtimeCatalog = JSON.parse(
  await readFile(path.join(projectRoot, 'public', 'data', 'model-runtime-catalog.json'), 'utf8'),
);

const stageLabels = {
  '01-origin': '선택받기 이전',
  '02-call': '소집',
  '03-candidate': '입단 후보',
  '04-induction': '프시케 입단',
  '05-drill': '기초 훈련',
  '06-first-mission': '첫 임무',
  '07-field': '현장 활동',
  '08-bond': '유대',
  '09-formal': '정복',
  '10-covert': '은밀 작전',
  '11-winter': '동계 장비',
  '12-wounded': '부상',
  '13-resolve': '결의',
  '14-signature': '고유 체능',
  '15-great-war': '대전쟁',
  '16-extreme': '체능의 극의',
  '17-aftermath': '대전쟁 직후',
  '18-reconstruction': '재건기',
  '19-present': '현재',
  '20-legacy': '유산',
};

const topPriority = new Set([
  'raon', 'hadori', 'kazrin', 'kain', 'leo', 'chris',
  'haechan', 'lami', 'jinhwon', 'ann', 'maru', 'garam', 'nabi-nia',
]);
const secondPriority = new Set([
  'kangrim', 'luka', 'kitty', 'mire', 'spinoza', 'crowd', 'kampta', 'adeline',
]);

const characters = [];
for (const runtime of runtimeCatalog.models) {
  const folder = path.join(artRoot, runtime.characterId);
  const files = await readdir(folder);
  const variations = files
    .filter((file) => /^\d{2}-.*\.webp$/i.test(file))
    .sort((left, right) => left.localeCompare(right))
    .map((file) => {
      const stageId = file.replace(/\.webp$/i, '');
      const critical3dStage = ['01-origin', '04-induction', '07-field', '15-great-war', '19-present'].includes(stageId);
      return {
        id: stageId,
        label: stageLabels[stageId] ?? stageId,
        referencePath: `/art/characters/${runtime.characterId}/${file}`,
        referenceStatus: 'ready',
        modelTarget: critical3dStage ? 'authored-variant' : 'shared-base-with-modular-costume',
        modelStatus: stageId === '04-induction' ? 'procedural-maquette-ready' : 'planned',
      };
    });

  characters.push({
    id: runtime.characterId,
    name: runtime.characterName,
    priority: topPriority.has(runtime.characterId) ? 'P0' : secondPriority.has(runtime.characterId) ? 'P1' : 'P2',
    ownership: 'Raonjena original character pipeline',
    artDirection: 'original Korean dark-fantasy anime action RPG; cel-PBR with inked silhouette accents',
    currentModel: runtime.runtimePath,
    currentTier: runtime.productionTier,
    references: {
      contactSheet: `/art/characters/${runtime.characterId}/contact-sheet.webp`,
      thumbnail: `/art/characters/${runtime.characterId}/thumb.webp`,
      variationCount: variations.length,
      variations,
    },
    productionTargets: {
      lod0Triangles: { min: 55_000, max: 95_000 },
      lod1Ratio: 0.55,
      lod2Ratio: 0.22,
      textureSets: ['body 2048', 'face 2048', 'hair 2048', 'equipment 2048'],
      rig: 'humanoid-78 + weapon sockets + cloth proxy',
      face: 'ARKit-compatible core 52 shapes, stylized corrective set',
      animationMinimum: [
        'idle-neutral', 'idle-personality', 'walk', 'run', 'sprint', 'turn',
        'dodge', 'hit-light', 'hit-heavy', 'down', 'revive', 'interaction',
        'basic-chain', 'charged', 'skill', 'signature', 'ultimate',
      ],
    },
    gates: [
      'concept silhouette approval',
      'orthographic proportion review',
      'topology deformation review',
      'material and outline review',
      'rig stress poses',
      'combat readability at gameplay camera',
      'mobile LOD and memory validation',
    ],
  });
}

const report = {
  schema: 'raonjena.model-production-catalog',
  version: 1,
  generatedAt: new Date().toISOString(),
  summary: {
    characters: characters.length,
    referenceVariations: characters.reduce((sum, character) => sum + character.references.variationCount, 0),
    runtimeMaquettes: runtimeCatalog.models.length,
    p0: characters.filter((character) => character.priority === 'P0').length,
    p1: characters.filter((character) => character.priority === 'P1').length,
    p2: characters.filter((character) => character.priority === 'P2').length,
  },
  characters,
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(
  `production catalog: ${report.summary.characters} characters / `
  + `${report.summary.referenceVariations} references / ${report.summary.runtimeMaquettes} maquettes`,
);
