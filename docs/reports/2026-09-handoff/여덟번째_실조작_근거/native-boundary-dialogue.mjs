import assert from 'node:assert/strict';
import { create, origin, clean } from './native-boundary-common.mjs';
const s = await create('dialogue');
try {
  await s.page.goto(origin + '/?section=campaign');
  await s.page.locator('.village-interact-prompt').waitFor();
  const prompt = await s.page.locator('.village-interact-prompt').boundingBox();
  await s.page.touchscreen.tap(prompt.x + prompt.width / 2, prompt.y + prompt.height / 2);
  await s.page.getByRole('dialog').waitFor();
  const before = await s.xy();
  await s.page.keyboard.down('ArrowRight');
  await s.page.waitForTimeout(350);
  await s.page.keyboard.up('ArrowRight');
  const down = await s.page.getByRole('button', { name: '아래로 이동', exact: true }).boundingBox();
  await s.page.touchscreen.tap(down.x + down.width / 2, down.y + down.height / 2);
  await s.page.waitForTimeout(850);
  const after = await s.xy();
  assert.deepEqual(after, before);
  s.record('dialogue-blocks-keyboard-and-touch', { before, after, dialog: await s.page.getByRole('dialog').innerText(), method: 'trusted touchscreen taps at observed bounds; keyboard ArrowRight held 350ms' });
  await s.page.setViewportSize({ width: 320, height: 844 });
  s.record('dialogue-320', { metrics: await s.metrics() }); await s.snap('dialogue-320');
  await s.page.keyboard.press('Escape');
  // One actual step proves the final stationary position differs from the imported checkpoint.
  await s.page.getByRole('button', { name: '오른쪽으로 이동', exact: true }).press('Enter');
  const finalXY = await s.xy();
  await s.page.getByRole('button', { name: '타이틀', exact: true }).click();
  await s.page.locator('.title-save-slots').waitFor();
  const saved = clean(await s.profile());
  s.record('title-320', { metrics: await s.metrics(), saved }); await s.snap('title-320');
  await s.page.reload();
  await s.page.locator('.title-save-slots').waitFor();
  const beforeResume = clean(await s.profile());
  const primary = s.page.locator('.title-actions .primary-action');
  await primary.click();
  await s.page.locator('.village-engine canvas').waitFor();
  await s.page.waitForTimeout(500);
  const resumed = await s.xy();
  assert.deepEqual(resumed, finalXY);
  assert.deepEqual(beforeResume, saved);
  assert.deepEqual(clean(await s.profile()), saved);
  s.record('last-step-title-reload-resume', { finalXY, resumed, wholeProfileEqual: true, metrics: await s.metrics() });
  await s.snap('village-320');
} catch (error) { await s.finish(error); process.exitCode = 1; }
finally { if (s.browser.isConnected()) await s.finish(); }
