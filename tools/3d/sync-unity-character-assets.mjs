import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const targetRoot = path.join(projectRoot, 'unity', 'PsycheCharacterValidation', 'Assets', 'Characters', 'Raon');
const sources = [
  'public/models/characters/raon/raon-production-v2.glb',
  'public/models/characters/raon/raon-production-lod1-v2.glb',
  'public/models/characters/raon/raon-production-lod2-v2.glb',
];

await mkdir(targetRoot, { recursive: true });
const manifest = [];
for (const source of sources) {
  const absoluteSource = path.join(projectRoot, source);
  const target = path.join(targetRoot, path.basename(source));
  const data = await readFile(absoluteSource);
  await copyFile(absoluteSource, target);
  manifest.push({ source: source.replaceAll('\\', '/'), target: path.relative(projectRoot, target).replaceAll('\\', '/'), bytes: data.length });
}
await writeFile(path.join(targetRoot, 'asset-sync-manifest.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), files: manifest }, null, 2)}\n`);
console.log(`Synced ${manifest.length} Raon production GLBs into Unity validation project.`);
