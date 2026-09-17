import assert from 'node:assert/strict';
import { create, origin, clean } from './native-boundary-common.mjs';
const s = await create('storage-failure', 'native-capital-before-choice-storage.json');
try {
  await s.page.goto(origin + '/?section=campaign');
  await s.page.locator('.origin-choice').first().waitFor();
  const initial = clean(await s.profile());
  await s.page.evaluate(() => {
    const originals = { setItem: Storage.prototype.setItem, put: IDBObjectStore.prototype.put };
    window.__boundaryFault = { local: true, idb: false, counts: { local: 0, idb: 0 }, originals };
    Storage.prototype.setItem = function(key, value) { const f = window.__boundaryFault; if (f.local && key.startsWith('raonjena-campaign-v10-slot-')) { f.counts.local++; throw new DOMException('Boundary test: LocalStorage write rejected', 'QuotaExceededError'); } return originals.setItem.call(this, key, value); };
    IDBObjectStore.prototype.put = function(...args) { const f = window.__boundaryFault; if (f.idb && this.name === 'campaign-slots') { f.counts.idb++; throw new DOMException('Boundary test: IndexedDB write rejected', 'QuotaExceededError'); } return originals.put.apply(this, args); };
  });
  await s.page.keyboard.press('2');
  await s.page.waitForFunction(() => !!document.querySelector('.origin-choice.selected'));
  await s.page.waitForTimeout(400);
  const localOld = clean(await s.profile());
  const backupChosen = (await s.backup()).profile;
  assert.deepEqual(localOld, initial);
  assert.ok(backupChosen.originStory.choices['capital-gate']);
  assert.equal(await s.page.getByText('최근 진행을 저장하지 못했습니다', { exact: true }).count(), 0);
  s.record('local-only-failure-idb-fallback', { initial, localOld, backupChosen, faultCounts: await s.page.evaluate(() => window.__boundaryFault.counts), alertAbsent: true });
  await s.page.evaluate(() => { window.__boundaryFault.idb = true; });
  await s.page.locator('.origin-advance').click();
  await s.page.getByText('최근 진행을 저장하지 못했습니다', { exact: true }).waitFor();
  const heading = await s.page.locator('.origin-title h1, .origin-content h1, h1').first().innerText();
  assert.deepEqual((await s.backup()).profile, backupChosen);
  assert.deepEqual(clean(await s.profile()), initial);
  s.record('both-fail-banner', { heading, banner: await s.page.getByRole('alert').innerText(), lastDurableBackupUnchanged: true, localUnchanged: true, faultCounts: await s.page.evaluate(() => window.__boundaryFault.counts) });
  await s.page.setViewportSize({ width: 320, height: 844 });
  s.record('failure-banner-320', await s.metrics()); await s.snap('failure-banner-320');
  await s.page.evaluate(() => { const f = window.__boundaryFault; f.local = false; f.idb = false; Storage.prototype.setItem = f.originals.setItem; IDBObjectStore.prototype.put = f.originals.put; });
  await s.page.getByRole('button', { name: '다시 저장', exact: true }).click();
  await s.page.getByText('최근 진행을 저장하지 못했습니다', { exact: true }).waitFor({ state: 'hidden' });
  const saved = clean(await s.profile());
  assert.notEqual(saved.originStory.currentSceneId, initial.originStory.currentSceneId);
  assert.deepEqual((await s.backup()).profile, saved);
  await s.page.reload();
  await s.page.locator('h1').waitFor();
  assert.deepEqual(clean(await s.profile()), saved);
  s.record('retry-save-reload', { saved, bothStoresEqual: true, reloadEqual: true, failureInjection: 'Storage.setItem and IDBObjectStore.put prototype wrappers in an isolated context; no physical disk exhaustion', originalApisRestored: true });
} catch (error) { await s.finish(error); process.exitCode = 1; }
finally { if (s.browser.isConnected()) await s.finish(); }
