import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const projectRoot = process.cwd();
const reportRoot = path.join(projectRoot, 'artifacts', '3d');
const iterations = Number.parseInt(process.argv.find((argument) => argument.startsWith('--iterations='))?.split('=')[1] ?? '3', 10);
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
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${script} failed (${code})\n${stdout}\n${stderr}`));
    });
  });
}

await mkdir(reportRoot, { recursive: true });
const history = [];

for (let iteration = 1; iteration <= iterations; iteration += 1) {
  const generation = await run('tools/3d/generate-procedural-glb.mjs');
  let audit = { stdout: 'quality harness pending', stderr: '' };
  try {
    audit = await run('tools/3d/model-quality-audit.mjs');
  } catch (error) {
    audit = { stdout: '', stderr: error.message };
  }

  let catalog = null;
  try {
    catalog = JSON.parse(await readFile('public/data/model-runtime-catalog.json', 'utf8'));
  } catch {
    catalog = { models: [] };
  }

  const snapshot = {
    iteration,
    generatedAt: new Date().toISOString(),
    generationLog: generation.stdout.trim(),
    auditLog: audit.stdout.trim(),
    auditError: audit.stderr.trim(),
    models: catalog.models.map((model) => ({
      id: model.id,
      bytes: model.bytes,
      meshes: model.meshes,
      triangles: model.triangles,
      status: model.status,
    })),
  };
  history.push(snapshot);
  await writeFile(
    path.join(reportRoot, `refinement-${String(iteration).padStart(2, '0')}.json`),
    `${JSON.stringify(snapshot, null, 2)}\n`,
    'utf8',
  );
}

await writeFile(
  path.join(reportRoot, 'refinement-history.json'),
  `${JSON.stringify({
    schema: 'raonjena.model-refinement-history',
    version: 1,
    iterations: history,
  }, null, 2)}\n`,
  'utf8',
);

console.log(`completed ${history.length} model refinement iterations`);
