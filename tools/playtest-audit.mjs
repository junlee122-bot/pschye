import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';

const phase = process.argv[2] ?? 'current';
const requestedRuns = Number(process.argv[3] ?? 240);
const campaignRuns = Number.isFinite(requestedRuns) && requestedRuns >= 200
  ? Math.floor(requestedRuns)
  : 240;
const outputDirectory = path.resolve('artifacts', 'playtest-200');

const server = await createServer({
  appType: 'custom',
  server: { middlewareMode: true, hmr: false },
});

try {
  const auditModule = await server.ssrLoadModule('/src/game/playtestAudit.ts');
  const result = auditModule.runPlaytestAudit(campaignRuns);
  const markdown = auditModule.renderPlaytestAuditMarkdown(result, phase);
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(
      path.join(outputDirectory, `${phase}.json`),
      `${JSON.stringify(result, null, 2)}\n`,
      'utf8',
    ),
    writeFile(path.join(outputDirectory, `${phase}.md`), markdown, 'utf8'),
  ]);
  console.log(markdown);
} finally {
  await server.close();
}
