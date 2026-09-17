import assert from 'node:assert/strict';
import { create, origin, clean } from './native-boundary-common.mjs';
const s = await create('field', 'native-field-mid-storage.json');
try {
  await s.page.goto(origin + '/?section=campaign');
  await s.page.locator('form .field-exam-primary').waitFor();
  const initial = clean(await s.profile());
  const active = () => s.page.evaluate(() => ({ tag: document.activeElement?.tagName, text: document.activeElement?.textContent, name: document.activeElement?.name, value: document.activeElement?.value, disabled: document.activeElement?.disabled, connected: document.activeElement?.isConnected }));
  assert.equal((await active()).tag, 'H1');
  for (let run = 0; run < 2; run++) {
    if (run === 1) await s.page.locator('input[name="field-exam-raon"][value="left"]').focus();
    else await s.page.keyboard.press('Tab');
    assert.equal((await active()).name, 'field-exam-raon');
    await s.page.keyboard.press('Space');
    await s.page.keyboard.press('Tab');
    assert.equal((await active()).name, 'field-exam-leo');
    await s.page.keyboard.press('ArrowRight');
    const beforeSubmit = clean(await s.profile());
    assert.equal(beforeSubmit.originStory.fieldExam.turn, initial.originStory.fieldExam.turn + run);
    assert.equal(await s.page.locator('input[name="field-exam-raon"][value="left"]').isChecked(), true);
    assert.equal(await s.page.locator('input[name="field-exam-leo"][value="right"]').isChecked(), true);
    await s.page.keyboard.press('Tab');
    assert.equal((await active()).tag, 'BUTTON');
    if (run === 0) { await s.page.setViewportSize({ width: 320, height: 844 }); s.record('keyboard-form-320', { metrics: await s.metrics(), beforeSubmit, focus: await active() }); await s.snap('form-320'); }
    await s.page.keyboard.press('Enter');
    await s.page.waitForTimeout(100);
    const afterSubmit = clean(await s.profile());
    assert.equal(afterSubmit.originStory.fieldExam.turn, beforeSubmit.originStory.fieldExam.turn + 1);
    s.record('keyboard-form-submit-' + (run + 1), { beforeTurn: beforeSubmit.originStory.fieldExam.turn, after: afterSubmit.originStory.fieldExam, focus: await active(), selectionDidNotAdvance: true, focusSetup: run === 1 ? 'Second turn radio focus set with locator.focus; action inputs still keyboard' : 'Product heading focus and actual Tab only' });
  }
  await s.page.getByRole('button', { name: /모두와 함께 철수/ }).waitFor();
  const returned = clean(await s.profile());
  assert.equal(returned.originStory.fieldExam.phase, 'return');
  assert.ok(!returned.originStory.flags.includes('passed-field-rescue'));
  assert.ok(!returned.originStory.completedSceneIds.includes('field-exam'));
  await s.page.getByRole('button', { name: /타이틀로/ }).click();
  await s.page.locator('.title-save-slots').waitFor(); await s.page.reload();
  await s.page.locator('.title-save-slots').waitFor();
  assert.deepEqual(clean(await s.profile()), returned);
  await s.page.locator('.title-actions .primary-action').click();
  await s.page.getByRole('button', { name: /모두와 함께 철수/ }).waitFor();
  s.record('return-reload-not-complete', { wholeProfileEqual: true, profile: returned, focus: await active() });
  await s.page.getByRole('button', { name: /모두와 함께 철수/ }).press('Enter');
  await s.page.getByRole('button', { name: /선발 12일차/ }).waitFor();
  const complete = clean(await s.profile());
  assert.equal(complete.originStory.fieldExam.phase, 'complete');
  assert.equal(complete.originStory.selectionScore, returned.originStory.selectionScore);
  assert.deepEqual(complete.bondLevels, returned.bondLevels);
  assert.equal(complete.world.npcMemories.leo.affinity, returned.world.npcMemories.leo.affinity);
  s.record('complete-confirmation-320', { profile: complete, metrics: await s.metrics(), focus: await active() }); await s.snap('complete-320');
  await s.page.getByRole('button', { name: /타이틀로/ }).click();
  await s.page.locator('.title-save-slots').waitFor(); await s.page.reload();
  await s.page.locator('.title-save-slots').waitFor();
  assert.deepEqual(clean(await s.profile()), complete);
  await s.page.locator('.title-actions .primary-action').click();
  await s.page.getByRole('button', { name: /선발 12일차/ }).waitFor();
  assert.equal(await s.page.getByRole('button', { name: /모두와 함께 철수/ }).count(), 0);
  assert.deepEqual(clean(await s.profile()), complete);
  s.record('complete-reload-no-duplicate', { wholeProfileEqual: true, completePhaseRetained: true, confirmationButtonAbsent: true });
} catch (error) { await s.finish(error); process.exitCode = 1; }
finally { if (s.browser.isConnected()) await s.finish(); }
