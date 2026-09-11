import { access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const projectRoot = process.cwd();

function parseArguments(argv) {
  const options = {
    characters: ['hadori', 'kazrin'],
    resolution: 160,
    force: false,
  };
  for (const argument of argv.slice(2)) {
    if (argument === '--force') options.force = true;
    else if (argument.startsWith('--character=')) {
      options.characters = argument
        .slice('--character='.length)
        .split(/[,\s]+/)
        .filter(Boolean);
    } else if (argument.startsWith('--resolution=')) {
      options.resolution = Number(argument.slice('--resolution='.length));
    }
  }
  if (!Number.isInteger(options.resolution) || options.resolution < 128 || options.resolution > 256) {
    throw new Error('Batch TripoSR resolution must be between 128 and 256.');
  }
  return options;
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function run(command, argumentsList) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, argumentsList, {
      cwd: projectRoot,
      env: process.env,
      stdio: 'inherit',
      windowsHide: true,
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${path.basename(command)} exited with code ${code}`));
    });
  });
}

async function main() {
  const options = parseArguments(process.argv);
  const pythonPath = path.join(
    projectRoot,
    'artifacts',
    '3d',
    'triposr-runtime',
    '.venv',
    'Scripts',
    'python.exe',
  );
  const sourceRoot = path.join(projectRoot, '.tmp', 'TripoSR-official');
  if (!await fileExists(pythonPath) || !await fileExists(sourceRoot)) {
    throw new Error('The local TripoSR runtime is not installed.');
  }
  for (const characterId of options.characters) {
    const inputPath = path.join(
      projectRoot,
      'artifacts',
      '3d',
      'hitem3d-inputs',
      characterId,
      'front.jpg',
    );
    if (!await fileExists(inputPath)) {
      throw new Error(`Prepare the front input first: ${characterId}`);
    }
  }

  const pythonArguments = [
    path.join(projectRoot, 'tools', '3d', 'triposr-local-batch.py'),
    '--source-root',
    sourceRoot,
    '--project-root',
    projectRoot,
    '--characters',
    options.characters.join(','),
    '--resolution',
    String(options.resolution),
    '--chunk-size',
    '2048',
  ];
  if (options.force) pythonArguments.push('--force');
  await run(pythonPath, pythonArguments);

  for (const characterId of options.characters) {
    await run(process.execPath, [
      path.join(projectRoot, 'tools', '3d', 'triposr-client.mjs'),
      'generate',
      `--character=${characterId}`,
    ]);
  }
}

await main();
