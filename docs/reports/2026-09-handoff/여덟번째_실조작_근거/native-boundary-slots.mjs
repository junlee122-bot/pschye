import assert from 'node:assert/strict';
import { create, origin, clean } from './native-boundary-common.mjs';
const s = await create('slots', 'native-capital-before-choice-storage.json');
try {
  await s.page.goto(origin + '/');
  await s.page.locator('.title-save-slots').waitFor();
  const first = clean(await s.profile(1));
  await s.page.getByRole('button', { name: /^SLOT 02/ }).click();
  await s.page.locator('.title-save-grid button.active').filter({ hasText: 'SLOT 02' }).waitFor();
  const second = clean(await s.profile(2));
  assert.equal(second.originStory.currentSceneId, 'village-dawn');
  assert.notDeepEqual(second, first);
  for (const slot of [1, 2, 1, 2]) {
    await s.page.getByRole('button', { name: new RegExp('^SLOT 0' + slot) }).click();
    await s.page.locator('.title-save-grid button.active').filter({ hasText: 'SLOT 0' + slot }).waitFor();
  }
  await s.page.waitForTimeout(900);
  assert.deepEqual(clean(await s.profile(1)), first);
  assert.deepEqual(clean(await s.profile(2)), second);
  assert.deepEqual((await s.backup(1)).profile, first);
  assert.deepEqual((await s.backup(2)).profile, second);
  s.record('rapid-slot-switch', { sequence: [2, 1, 2, 1, 2], slot1: first, slot2: second, localAndIndexedDBProfilesEqual: true, limitation: 'Actual title slot buttons; no retained callback was artificially invoked.' });
  await s.page.getByRole('button', { name: /^SLOT 01/ }).click();
  await s.page.locator('.title-save-grid button.active').filter({ hasText: 'SLOT 01' }).waitFor();
  s.page.once('dialog', async dialog => { s.record('reset-cancel-dialog', { type: dialog.type(), message: dialog.message() }); await dialog.dismiss(); });
  await s.page.getByRole('button', { name: '여정 초기화', exact: true }).click();
  assert.deepEqual(clean(await s.profile(1)), first);
  s.record('reset-cancel-preserves', { slot1Equal: true, slot2Equal: JSON.stringify(clean(await s.profile(2))) === JSON.stringify(second) });
  s.page.once('dialog', async dialog => { s.record('reset-accept-dialog', { type: dialog.type(), message: dialog.message() }); await dialog.accept(); });
  await s.page.getByRole('button', { name: '여정 초기화', exact: true }).click();
  await s.page.locator('.village-engine canvas').waitFor();
  await s.page.waitForTimeout(900);
  const reset = clean(await s.profile(1));
  assert.equal(reset.originStory.currentSceneId, 'village-dawn');
  assert.deepEqual(reset.originStory.completedSceneIds, []);
  assert.deepEqual(reset.originStory.choices, {});
  assert.equal(reset.originStory.selectionScore, 0);
  assert.equal(reset.battleAttempt, undefined);
  assert.deepEqual(clean(await s.profile(2)), second);
  await s.page.reload();
  await s.page.locator('.village-engine canvas').waitFor();
  await s.page.waitForTimeout(900);
  assert.deepEqual(clean(await s.profile(1)), reset);
  assert.deepEqual(clean(await s.profile(2)), second);
  s.record('same-slot-reset-reload', { resetProfile: reset, slot2Unchanged: true, localAndIndexedDB: { slot1: await s.backup(1), slot2: await s.backup(2) } });
} catch (error) { await s.finish(error); process.exitCode = 1; }
finally { if (s.browser.isConnected()) await s.finish(); }
