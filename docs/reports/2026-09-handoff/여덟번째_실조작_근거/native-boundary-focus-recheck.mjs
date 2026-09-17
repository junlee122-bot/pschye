import assert from 'node:assert/strict';
import { create, origin, clean } from './native-boundary-common.mjs';
const cases = [
  { name: 'focus-field', file: 'native-field-mid-storage.json', form: 'field-exam', state: p => p.originStory.fieldExam, plans: [['left','right'],['left','right']], result: 'return', confirm: '모두와 함께 철수' },
  { name: 'focus-petal', file: 'native-sixteen-petals-before-choice-storage.json', form: 'petal-training', choose: true, start: '궤적 수련 시작', state: p => p.originStory.petalTraining, plans: Array.from({ length: 6 }, () => ['balance']), result: 'review', confirm: '마루 앞에서 수련 마무리' },
  { name: 'focus-captain', file: 'native-captain-trials-mid-storage.json', form: 'captain-trial', state: p => p.originStory.captainTrials['captain-trials'], plans: [['sidestep'],['counter'],['parry'],['counter']], result: 'resolved', confirm: '검을 거두고 승부 확인' },
];
for (const c of cases) {
  const s = await create(c.name, c.file);
  const focus = () => s.page.evaluate(() => ({ tag: document.activeElement?.tagName, name: document.activeElement?.name, value: document.activeElement?.value, disabled: document.activeElement?.disabled, checked: document.activeElement?.checked, text: document.activeElement?.tagName === 'SECTION' ? document.activeElement.textContent : undefined }));
  try {
    await s.page.goto(origin + '/?section=campaign');
    await s.page.locator('h1').waitFor();
    const scriptEntries = await s.page.locator('script[src]').evaluateAll(scripts => scripts.map(el => el.getAttribute('src')));
    assert.ok(scriptEntries.some(src => src.includes('index-DEx4xGQm.js')));
    s.record('post-fix-build', { baseCommit: 'bbcf10eed6a359fc54d37b16caa9f533b939dcf5', changes: 'FieldExamEncounter, PetalTrainingEncounter, CaptainTrialEncounter focus fixes; root rebuilt production', scriptEntries });
    if (c.choose) {
      await s.page.keyboard.press('2');
      await s.page.getByRole('button', { name: c.start, exact: false }).waitFor();
      assert.equal((await focus()).tag, 'H1');
      await s.page.keyboard.press('Tab');
      assert.equal((await focus()).tag, 'BUTTON');
      await s.page.keyboard.press('Enter');
    }
    await s.page.locator('form').waitFor();
    await s.page.setViewportSize({ width: 320, height: 844 });
    assert.equal((await focus()).tag, 'H1');
    await s.page.keyboard.press('Tab');
    for (const [index, plan] of c.plans.entries()) {
      const before = clean(await s.profile());
      const beforeState = c.state(before);
      assert.equal((await focus()).tag, 'INPUT');
      assert.equal(await s.page.locator('form input:not(:disabled)').first().evaluate(el => el === document.activeElement), true);
      for (const [actorIndex, value] of plan.entries()) {
        if (actorIndex > 0) await s.page.keyboard.press('Tab');
        assert.equal((await focus()).tag, 'INPUT');
        for (let arrow = 0; (await focus()).value !== value && arrow < 6; arrow++) await s.page.keyboard.press('ArrowRight');
        assert.equal((await focus()).value, value);
        if (!(await focus()).checked) await s.page.keyboard.press('Space');
      }
      assert.equal(c.state(clean(await s.profile())).turn, beforeState.turn);
      await s.page.keyboard.press('Tab');
      assert.equal((await focus()).tag, 'BUTTON');
      assert.equal((await focus()).disabled, false);
      await s.page.keyboard.press('Enter');
      await s.page.waitForTimeout(80);
      const after = c.state(clean(await s.profile()));
      assert.equal(after.turn, beforeState.turn + 1);
      if (after.phase === 'active') {
        assert.equal(await s.page.locator('form input:not(:disabled)').first().evaluate(el => el === document.activeElement), true);
        assert.equal(await s.page.locator('form input:checked').count(), 0);
      } else assert.equal((await focus()).tag, 'SECTION');
      s.record('keyboard-turn-' + (index + 1), { before: beforeState, after, focus: await focus(), noProgrammaticFocus: true, selectionDidNotAdvance: true });
      if (index === 0) { s.record('focus-320', await s.metrics()); await s.snap('next-command-320'); }
    }
    assert.equal(c.state(clean(await s.profile())).phase, c.result);
    await s.page.keyboard.press('Tab');
    assert.equal((await focus()).tag, 'BUTTON');
    assert.equal(await s.page.getByRole('button', { name: c.confirm, exact: false }).evaluate(el => el === document.activeElement), true);
    await s.page.keyboard.press('Enter');
    assert.equal(c.state(clean(await s.profile())).phase, 'complete');
    assert.equal((await focus()).tag, 'SECTION');
    s.record('keyboard-result-confirmation', { phase: 'complete', focus: await focus(), profile: clean(await s.profile()) });
  } catch (error) { await s.finish(error); process.exitCode = 1; break; }
  finally { if (s.browser.isConnected()) await s.finish(); }
}
