import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const projectRoot = process.cwd();
const artifactRoot = path.join(projectRoot, 'artifacts', '3d');
const nodeExecutable = process.execPath;

function run(script, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(nodeExecutable, [script, ...args], {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => {
      const result = { script, code, stdout: stdout.trim(), stderr: stderr.trim() };
      if (code === 0) resolve(result);
      else reject(Object.assign(new Error(`${script} failed`), { result }));
    });
  });
}

await mkdir(artifactRoot, { recursive: true });
const executions = [];
for (const [script, args] of [
  ['tools/3d/generate-procedural-glb.mjs', []],
  ['tools/3d/generate-model-production-catalog.mjs', []],
  ['tools/3d/model-quality-audit.mjs', ['--check']],
  ['tools/3d/character-fidelity-audit.mjs', []],
]) {
  executions.push(await run(script, args));
}

const [runtimeCatalog, productionCatalog, qualityReport, fidelityReport] = await Promise.all([
  readFile('public/data/model-runtime-catalog.json', 'utf8').then(JSON.parse),
  readFile('public/data/model-production-catalog.json', 'utf8').then(JSON.parse),
  readFile('artifacts/3d/model-quality-report.json', 'utf8').then(JSON.parse),
  readFile('artifacts/3d/character-fidelity-report.json', 'utf8').then(JSON.parse),
]);

const crossChecks = [
  {
    id: 'runtime-production-count',
    pass: runtimeCatalog.models.length === productionCatalog.characters.length,
    actual: `${runtimeCatalog.models.length}/${productionCatalog.characters.length}`,
  },
  {
    id: 'minimum-character-coverage',
    pass: productionCatalog.summary.characters >= 48,
    actual: productionCatalog.summary.characters,
  },
  {
    id: 'twenty-variation-coverage',
    pass: productionCatalog.characters.every((character) => character.references.variationCount >= 20),
    actual: Math.min(...productionCatalog.characters.map((character) => character.references.variationCount)),
  },
  {
    id: 'glb-binary-integrity',
    pass: qualityReport.summary.fail === 0,
    actual: qualityReport.summary,
  },
  {
    id: 'production-gates-defined',
    pass: productionCatalog.characters.every((character) => character.gates.length >= 7),
    actual: Math.min(...productionCatalog.characters.map((character) => character.gates.length)),
  },
  {
    id: 'fidelity-report-covers-catalog',
    pass: fidelityReport.summary.total === runtimeCatalog.models.length,
    actual: `${fidelityReport.summary.total}/${runtimeCatalog.models.length}`,
  },
];
const failedChecks = crossChecks.filter((check) => !check.pass);
const result = {
  schema: 'raonjena.3d-production-harness',
  version: 1,
  generatedAt: new Date().toISOString(),
  status: failedChecks.length ? 'fail' : 'pass',
  executions,
  crossChecks,
};
await writeFile(path.join(artifactRoot, 'production-harness-report.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(`3D production harness: ${result.status.toUpperCase()} (${crossChecks.length - failedChecks.length}/${crossChecks.length})`);
for (const check of crossChecks) console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.id}`);
if (failedChecks.length) process.exitCode = 1;
