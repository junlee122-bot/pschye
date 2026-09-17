import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('<LOCAL_USER_HOME>/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const work = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:([A-Z]:))/, '$1'));
const dir = decodeURIComponent(work);
const four = process.argv.includes('--four');
const fixed = process.argv.includes('--fixed');
const storagePath = path.join(dir, four ? 'native-first-mission-prepared-storage.json' : 'native-first-mode-select-storage.json');
const origin = JSON.parse(fs.readFileSync(storagePath, 'utf8')).origins[0].origin;
const log = { scope: `Actual ${four ? 'four' : 'six'}-person tactical UI from root-played prologue storage`, fixedBuild: fixed, origin, actions: [], errors: [], checks: {} };
let browser;
const record = (label, data = {}) => { log.actions.push({ at: new Date().toISOString(), label, ...data }); console.log(JSON.stringify({ label, ...data })); };
const outputName = name => four ? name.replace('native-battle-', 'native-battle-four-').replace('four-six-', 'four-') : fixed ? name.replace('native-battle-', 'native-battle-fixed-') : name;
const write = (name, data) => fs.writeFileSync(path.join(dir, outputName(name)), JSON.stringify(data, null, 2));
try {
  browser = await chromium.launch({ executablePath: '<LOCAL_PROGRAM_FILES> (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--disk-cache-size=1048576'] });
  log.browser = browser.version();
  const context = await browser.newContext({ storageState: storagePath, viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on('pageerror', error => log.errors.push({ kind: 'pageerror', at: new Date().toISOString(), message: error.message, stack: error.stack, afterAction: log.actions.at(-1)?.label }));
  page.on('console', msg => { if (msg.type() === 'error') log.errors.push({ kind: 'console', message: msg.text() }); });
  const profile = () => page.evaluate(() => JSON.parse(localStorage.getItem('raonjena-campaign-v10-slot-1')));
  const battleDigest = p => JSON.stringify(p.battleAttempt?.battle);
  const changed = async previous => page.waitForFunction(old => JSON.stringify(JSON.parse(localStorage.getItem('raonjena-campaign-v10-slot-1')).battleAttempt?.battle) !== old, battleDigest(previous), { timeout: 8000 });
  const summary = p => ({ id: p.battleAttempt?.id, round: p.battleAttempt?.battle.round, cp: p.battleAttempt?.battle.commandPoints, outcome: p.battleAttempt?.battle.outcome, objective: p.battleAttempt?.battle.carriageHp, morale: p.battleAttempt?.battle.morale, enemyHp: p.battleAttempt?.battle.enemies.map(e => [e.id, e.hp]), settled: p.battleAttempt?.settled });
  let targetOffset = 0;
  const canvasTarget = async (x, y) => { const box = await page.locator('.phaser-battlefield-canvas canvas').boundingBox(); assert(box); await page.mouse.click(box.x + box.width * (x - targetOffset / 1280), box.y + box.height * (y - targetOffset / 720), { delay: 100 }); };
  const input = async (label, operation) => { const before = await profile(); await operation(); await changed(before); const after = await profile(); record(label, summary(after)); return after; };
  const saveShot = name => page.screenshot({ path: path.join(dir, outputName(`native-battle-${name}.png`)), fullPage: false });
  await page.goto(`${origin}/?section=campaign`, { waitUntil: 'networkidle' });
  log.scriptSources = await page.locator('script[src]').evaluateAll(elements => elements.map(element => element.src));
  if (four) {
    await page.locator('.narrative-stage-rail button').filter({ hasText: '전술 준비' }).click();
    for (const name of ['카인', '레오']) await page.locator('.story-companion-strip button').filter({ hasText: name }).click();
    await page.locator('.story-launch-button').click();
  } else await page.locator('.battle-resume-primary').click();
  await page.locator('.combat-mode-card.tactical').click();
  if (await page.locator('.battle-tutorial-start').isVisible()) await page.locator('.battle-tutorial-start').click();
  await page.locator('.engine-status-badge span.online').waitFor();
  const initial = await profile();
  assert.equal(initial.battleAttempt.heroes.length, four ? 4 : 6);
  if (four) {
    const six = JSON.parse(fs.readFileSync(path.join(dir, 'native-battle-six-start-profile.json'), 'utf8'));
    for (const hero of initial.battleAttempt.heroes) assert.deepEqual(hero, six.battleAttempt.heroes.find(h => h.id === hero.id));
    assert.deepEqual(initial.heroProgress, six.heroProgress);
    log.checks.fourAndSixIdenticalGrowthAndCommonHeroStats = true;
  }
  if (fixed) {
    await page.keyboard.press(four ? '4' : '6');
    await page.waitForTimeout(700);
    const raon = initial.battleAttempt.heroes.find(h => h.id === 'raon');
    await canvasTarget(raon.position.x / 100, raon.position.y / 100);
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('raonjena-campaign-v10-slot-1')).battleAttempt?.tactical?.selectedHeroId === 'raon');
    log.checks.heroCanvasCenterResponds = true;
  }
  write('native-battle-six-start-profile.json', initial);
  await saveShot('six-start');
  const revealed = await input('R: Chris reveals hidden sniper', () => page.keyboard.press('r'));
  assert(revealed.battleAttempt.battle.enemies.find(e => e.id === 'sky-sniper').revealed);
  assert(revealed.battleAttempt.battle.heroes.find(h => h.id === 'chris').acted);
  await page.keyboard.press('2');
  await page.locator('.skill-console button').filter({ hasText: '16꽃잎' }).click();
  await page.waitForTimeout(500);
  const beforeCanvas = await profile();
  await canvasTarget(.77, .20);
  await page.waitForTimeout(600);
  if (battleDigest(await profile()) === battleDigest(beforeCanvas)) {
    log.checks.visibleCanvasCenterResponds = false;
    assert.equal(fixed, false, 'Fixed production must accept the visible enemy center');
    record('Visible sniper center did not fire after settled rendering; trying visible upper-left quadrant');
    await saveShot('canvas-center-miss');
    targetOffset = 20;
    await canvasTarget(.77, .20);
    await changed(beforeCanvas);
  } else log.checks.visibleCanvasCenterResponds = true;
  const witnessed = await profile();
  record('Raon 16 petals: actual canvas target hit', { ...summary(witnessed), pointerOffsetLogicalPixels: targetOffset });
  assert(witnessed.battleAttempt.battle.revelationTriggered);
  write('native-battle-before-resume-profile.json', witnessed);
  await saveShot('witness');
  await page.getByRole('button', { name: '저장하고 나가기', exact: true }).click();
  await page.locator('.battle-resume-primary').waitFor();
  const suspended = await profile();
  write('native-battle-suspended-profile.json', suspended);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.battle-resume-primary').click();
  await page.locator('.phaser-battlefield-canvas canvas').waitFor();
  const resumed = await profile();
  assert.equal(resumed.battleAttempt.id, witnessed.battleAttempt.id);
  assert.deepEqual(resumed.battleAttempt.battle, witnessed.battleAttempt.battle);
  assert.deepEqual(resumed.battleAttempt.tactical, suspended.battleAttempt.tactical);
  log.checks.midBattleReloadExact = true;
  const undone = await input('Undo after restored two-action history', () => page.locator('.battle-undo').click());
  assert.deepEqual(undone.battleAttempt.battle, revealed.battleAttempt.battle);
  log.checks.undoRestoresEarlierBattle = true;
  await page.keyboard.press('2');
  await page.locator('.skill-console button').filter({ hasText: '16꽃잎' }).click();
  await page.waitForTimeout(500);
  await input('Repeat witnessed canvas attack after undo', () => canvasTarget(.77, .20));
  const autoBattle = async () => { for (let step = 0; step < 60; step += 1) {
    const p = await profile(), a = p.battleAttempt, b = a.battle;
    if (b.outcome !== 'active') break;
    if (b.morale >= 100 && !b.finisherUsed) await input('Team finisher UI', () => page.locator('.morale-console button').click());
    else if (b.commandPoints > 0 && await page.locator('.tactical-recommendation').isVisible()) {
      const label = await page.locator('.tactical-recommendation strong').innerText();
      await input(`Recommendation: ${label}`, () => page.locator('.tactical-recommendation').click());
    } else {
      const available = a.heroes.find(h => b.heroes.some(unit => unit.id === h.id && unit.hp > 0 && !unit.acted) && h.skills.some(s => s.kind === 'guard' || s.kind === 'area'));
      if (b.commandPoints > 0 && available) {
        await page.keyboard.press(String(a.heroes.indexOf(available) + 1));
        const skill = available.skills.find(s => s.kind === 'guard' || s.kind === 'area');
        await input(`Remaining real skill: ${available.name}/${skill.name}`, () => page.locator('.skill-console button').filter({ hasText: skill.name }).click());
      } else await input('End turn UI', () => page.locator('.end-turn-button').click());
    }
  } };
  await autoBattle();
  await page.locator('.outcome-card.victory').waitFor({ timeout: 5000 });
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('raonjena-campaign-v10-slot-1')).battleAttempt?.settled === true);
  const settled = await profile();
  assert.equal(settled.battleAttempt.battle.outcome, 'victory');
  assert(settled.unlockedRecords.includes('witness-grey-bridge-escort'));
  for (const [key, delta] of Object.entries({ day: 3, supplies: 90, intel: 30, relics: 1, renown: 45 })) assert.equal(settled[key], initial[key] + delta);
  for (const hero of settled.battleAttempt.heroes) assert.equal(settled.heroProgress[hero.id].xp, initial.heroProgress[hero.id].xp + 70);
  if (four) for (const id of ['kain', 'leo']) assert.deepEqual(settled.heroProgress[id], initial.heroProgress[id]);
  log.checks.firstClearRewards = true;
  log.checks.witnessFromCanvasHit = true;
  write('native-battle-six-victory-profile.json', settled);
  await context.storageState({ path: path.join(dir, outputName('native-battle-six-victory-storage.json')) });
  await saveShot('six-victory');
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.battle-resume-primary').click();
  await page.locator('.outcome-card.victory').waitFor();
  const resultAgain = await profile();
  const stableKeys = ['day', 'supplies', 'intel', 'relics', 'renown', 'heroProgress', 'completedMissions', 'missionGrades', 'unlockedRecords'];
  for (const key of stableKeys) assert.deepEqual(resultAgain[key], settled[key]);
  await page.locator('.outcome-card button.primary').click();
  await page.locator('.raon-journey-page').waitFor();
  const exited = await profile();
  for (const key of stableKeys) assert.deepEqual(exited[key], settled[key]);
  assert.equal(exited.battleAttempt, undefined);
  log.checks.resultReloadAndExitNoDuplicateRewards = true;
  if (four) {
    await page.locator('.story-chapter-rail button').filter({ hasText: '회색 교각 호송' }).click();
    await page.locator('.narrative-stage-rail button').filter({ hasText: '전술 준비' }).click();
    await page.locator('.story-launch-button').click();
    await page.locator('.combat-mode-card.tactical').click();
    await page.locator('.phaser-battlefield-canvas canvas').waitFor();
    const replayStart = await profile();
    assert.notEqual(replayStart.battleAttempt.id, settled.battleAttempt.id);
    await autoBattle();
    await page.locator('.outcome-card.victory').waitFor();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('raonjena-campaign-v10-slot-1')).battleAttempt?.settled === true);
    const replayed = await profile();
    for (const key of ['day', 'supplies', 'intel', 'relics', 'renown', 'heroProgress', 'completedMissions', 'unlockedRecords']) assert.deepEqual(replayed[key], settled[key]);
    log.checks.actualReplayVictoryNoSecondRewards = true;
    record('Actual new-deployment replay victory without second rewards', summary(replayed));
    write('native-battle-replay-victory-profile.json', replayed);
    await saveShot('replay-victory');
  }
  record(`${four ? 'Four' : 'Six'}-person UI victory, reload and settlement complete`, summary(settled));
  log.final = summary(settled);
  if (fixed) assert.deepEqual(log.errors, [], 'Fixed native run must have no runtime errors');
  log.status = 'passed';
} catch (error) {
  log.status = 'failed'; log.failure = { message: error.message, stack: error.stack };
  console.error(error);
  if (browser) { const page = browser.contexts()[0]?.pages()[0]; if (page) { try { await page.screenshot({ path: path.join(dir, outputName('native-battle-tactical-failure.png')) }); write('native-battle-tactical-failure-profile.json', await page.evaluate(() => JSON.parse(localStorage.getItem('raonjena-campaign-v10-slot-1')))); } catch {} } }
  process.exitCode = 1;
} finally {
  write('native-battle-tactical-results.json', log);
  if (browser) await browser.close();
}
