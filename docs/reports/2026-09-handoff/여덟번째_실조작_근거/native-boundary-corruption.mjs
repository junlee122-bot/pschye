import assert from 'node:assert/strict';
import { create, origin, clean, key } from './native-boundary-common.mjs';
const s = await create('corruption', 'native-capital-before-choice-storage.json');
try {
  await s.page.goto(origin + '/');
  await s.page.locator('.title-save-slots').waitFor();
  const initial = clean(await s.profile());
  const corruption = '{"boundary-test": invalid JSON';
  await s.page.evaluate(({ key, corruption }) => localStorage.setItem(key + '1', corruption), { key, corruption });
  await s.page.reload();
  await s.page.locator('.title-save-slots').waitFor();
  assert.deepEqual(clean(await s.profile()), initial);
  assert.deepEqual((await s.backup()).profile, initial);
  s.record('local-corruption-recovers-from-idb', { initial, exactProfileRestored: true, source: 'normal UI checkpoint mirrored in actual IndexedDB; only isolated context local slot record was corrupted' });
  await s.page.evaluate(async ({ key, corruption }) => {
    localStorage.setItem(key + '1', corruption);
    await new Promise((resolve, reject) => { const open = indexedDB.open('raonjena-saves', 1); open.onerror = () => reject(open.error); open.onsuccess = () => { const db = open.result; const tx = db.transaction('campaign-slots', 'readwrite'); tx.objectStore('campaign-slots').delete(1); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => { db.close(); reject(tx.error); }; }; });
  }, { key, corruption });
  await s.page.reload();
  await s.page.getByText('슬롯 1의 기록을 확인해 주세요', { exact: true }).waitFor();
  const blocked = await s.page.locator('.save-recovery').innerText();
  assert.equal(await s.page.evaluate(key => localStorage.getItem(key + '1'), key), corruption);
  assert.equal(await s.backup(), null);
  await s.page.getByRole('button', { name: '다시 읽기', exact: true }).click();
  await s.page.getByText('슬롯 1의 기록을 확인해 주세요', { exact: true }).waitFor();
  assert.equal(await s.page.evaluate(key => localStorage.getItem(key + '1'), key), corruption);
  s.record('corrupt-no-backup-blocks-without-overwrite', { blocked, corruption, retryReadStillBlocked: true, localPreserved: true, backupAbsent: true });
  await s.page.setViewportSize({ width: 320, height: 844 });
  s.record('recovery-320', await s.metrics()); await s.snap('recovery-320');
  await s.page.getByRole('button', { name: '슬롯 2 선택', exact: true }).click();
  await s.page.locator('.title-save-grid button.active').filter({ hasText: 'SLOT 02' }).waitFor();
  const slot2 = clean(await s.profile(2));
  assert.equal(slot2.originStory.currentSceneId, 'village-dawn');
  await s.page.getByRole('button', { name: /^SLOT 01/ }).click();
  await s.page.getByText('슬롯 1의 기록을 확인해 주세요', { exact: true }).waitFor();
  assert.deepEqual(clean(await s.profile(2)), slot2);
  assert.equal(await s.page.evaluate(key => localStorage.getItem(key + '1'), key), corruption);
  s.record('blocked-slot-other-slot-roundtrip', { slot2, otherSlotUnchanged: true, corruptSlotStillBlocked: true });
} catch (error) { await s.finish(error); process.exitCode = 1; }
finally { if (s.browser.isConnected()) await s.finish(); }
