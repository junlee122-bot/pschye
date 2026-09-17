import assert from 'node:assert/strict';
import { create, origin, clean } from './native-boundary-common.mjs';
const s = await create('reset', 'native-capital-before-choice-storage.json');
try {
  await s.page.goto(origin + '/'); await s.page.locator('.title-save-slots').waitFor();
  await s.page.getByRole('button', { name: /^SLOT 02/ }).click();
  await s.page.locator('.title-save-grid button.active').filter({ hasText: 'SLOT 02' }).waitFor();
  const second = clean(await s.profile(2));
  await s.page.getByRole('button', { name: /^SLOT 01/ }).click();
  await s.page.locator('.title-save-grid button.active').filter({ hasText: 'SLOT 01' }).waitFor();
  const first = clean(await s.profile(1));
  s.page.once('dialog', dialog => dialog.accept());
  await s.page.getByRole('button', { name: '여정 초기화', exact: true }).click();
  await s.page.getByRole('button', { name: '변방 마을에서 시작', exact: true }).waitFor();
  await s.page.waitForTimeout(300);
  const reset = clean(await s.profile(1));
  assert.equal(reset.originStory.currentSceneId, 'village-dawn');
  assert.deepEqual(reset.originStory.completedSceneIds, []);
  assert.deepEqual(reset.originStory.choices, {});
  assert.equal(reset.originStory.selectionScore, 0);
  assert.equal(reset.battleAttempt, undefined);
  assert.notDeepEqual(reset, first);
  assert.deepEqual(clean(await s.profile(2)), second);
  await s.page.reload(); await s.page.locator('.title-save-slots').waitFor();
  await s.page.waitForTimeout(900);
  assert.deepEqual(clean(await s.profile(1)), reset);
  assert.deepEqual(clean(await s.profile(2)), second);
  assert.deepEqual((await s.backup(1)).profile, reset);
  assert.deepEqual((await s.backup(2)).profile, second);
  s.record('same-slot-reset-title-reload', { before: first, reset, otherSlot: second, bothStoresEqual: true, reloadEqual: true, correction: 'Earlier script expected a village canvas; resetCampaign intentionally stays on the title screen.' });
} catch (error) { await s.finish(error); process.exitCode = 1; }
finally { if (s.browser.isConnected()) await s.finish(); }
