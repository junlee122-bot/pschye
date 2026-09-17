import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve('work');
for (const name of ['mobile','dialogue','resume','keyboard','slots','reset','storage-failure','corruption','field']) {
  const j = JSON.parse(fs.readFileSync(path.join(root, 'native-boundary-' + name + '.json'), 'utf8'));
  const width = [];
  for (const step of j.steps) {
    const m = step.data?.metrics ?? (step.data?.document && step.data);
    if (m) width.push({ at: step.label, viewport: m.viewport.width, document: m.document, body: m.body, overflowButtons: m.buttons.filter(b => b.x < -1 || b.x + b.width > m.viewport.width + 1).map(b => ({ name: b.name, x: b.x, width: b.width })) });
  }
  console.log(JSON.stringify({ name, browser: j.browserVersion, steps: j.steps.map(s => s.label), logs: j.logs, requests: j.requests, width, screenshots: j.screenshots }));
}
