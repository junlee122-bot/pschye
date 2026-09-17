import assert from 'node:assert/strict';
import { create, origin, clean } from './native-boundary-common.mjs';
const s = await create('keyboard', 'native-capital-before-choice-storage.json');
try {
  await s.page.goto(origin + '/?section=campaign');
  await s.page.locator('.origin-choice').first().waitFor();
  const initial = clean(await s.profile());
  const active = () => s.page.evaluate(() => ({ tag: document.activeElement?.tagName, text: document.activeElement?.textContent, connected: document.activeElement?.isConnected, disabled: document.activeElement?.disabled }));
  assert.equal((await active()).tag, 'H1');
  await s.page.evaluate(() => { window.__boundaryKeys = []; document.addEventListener('keydown', e => window.__boundaryKeys.push({ key: e.key, repeat: e.repeat, ctrl: e.ctrlKey, alt: e.altKey, meta: e.metaKey, target: e.target.tagName, trusted: e.isTrusted })); });
  await s.page.keyboard.down('Control');
  await s.page.keyboard.down('2');
  await s.page.keyboard.up('Control');
  await s.page.keyboard.down('2');
  await s.page.keyboard.up('2');
  assert.deepEqual(clean(await s.profile()), initial);
  s.record('modified-and-repeated-numbers-ignored', { keys: await s.page.evaluate(() => window.__boundaryKeys), profileUnchanged: true, focus: await active() });
  await s.page.keyboard.press('Tab');
  assert.equal((await active()).tag, 'BUTTON');
  await s.page.keyboard.press('2');
  assert.deepEqual(clean(await s.profile()), initial);
  s.record('number-on-choice-button-ignored', { focus: await active(), profileUnchanged: true });
  // Reload restores the product's own heading focus; no direct DOM focus or profile mutation.
  await s.page.reload();
  await s.page.locator('.origin-choice').first().waitFor();
  assert.equal((await active()).tag, 'H1');
  await s.page.keyboard.press('2');
  await s.page.locator('.origin-choice.selected').waitFor();
  const chosen = clean(await s.profile());
  assert.equal(chosen.originStory.choices['capital-gate'], 'identify-poison');
  await s.page.keyboard.press('Enter');
  await s.page.waitForFunction(() => document.querySelector('.origin-heading h1')?.textContent === '검보다 먼저 열린 감각');
  assert.equal((await active()).tag, 'H1');
  const advanced = clean(await s.profile());
  assert.equal(advanced.originStory.currentSceneId, 'aptitude-exam');
  assert.equal(advanced.originStory.completedSceneIds.length, initial.originStory.completedSceneIds.length + 1);
  s.record('plain-number-enter-advances-once', { chosen, advanced, focus: await active() });
  await s.page.keyboard.press('2');
  await s.page.locator('.origin-choice.selected').waitFor();
  // Tab through visible enabled controls until the product's next-scene button owns focus.
  for (let n = 0; n < 10; n++) { if (await s.page.locator('.origin-advance').evaluate(el => el === document.activeElement)) break; await s.page.keyboard.press('Tab'); }
  assert.equal(await s.page.locator('.origin-advance').evaluate(el => el === document.activeElement), true);
  await s.page.keyboard.press('Enter');
  await s.page.getByRole('heading', { name: '이기는 조와 돌아오는 조', exact: true }).waitFor();
  const formReady = clean(await s.profile());
  assert.equal(formReady.originStory.currentSceneId, 'field-exam');
  assert.equal(formReady.originStory.completedSceneIds.length, initial.originStory.completedSceneIds.length + 2);
  assert.equal(formReady.originStory.choices['field-exam'], undefined);
  s.record('next-button-enter-no-double-advance', { profile: formReady, focus: await active() });
  // Actual title button, then background keys: hidden story listeners must no longer run.
  await s.page.getByRole('button', { name: /타이틀/ }).click();
  await s.page.locator('.title-save-slots').waitFor();
  const titleBefore = clean(await s.profile());
  await s.page.keyboard.press('2');
  await s.page.keyboard.press('Enter');
  assert.deepEqual(clean(await s.profile()), titleBefore);
  s.record('hidden-story-keys-do-not-mutate', { profileUnchanged: true, url: s.page.url() });
} catch (error) { await s.finish(error); process.exitCode = 1; }
finally { if (s.browser.isConnected()) await s.finish(); }
