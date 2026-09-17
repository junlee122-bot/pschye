import assert from 'node:assert/strict';
import { create, origin, clean } from './native-boundary-common.mjs';
const s = await create('resume');
try {
  await s.page.goto(origin + '/?section=campaign');
  await s.page.locator('.village-interact-prompt').waitFor();
  await s.page.setViewportSize({ width: 320, height: 844 });
  await s.page.locator('.village-interact-prompt').press('Enter');
  await s.page.getByRole('dialog').waitFor();
  const dialog = s.page.getByRole('dialog');
  s.record('dialogue-scroll-container', await dialog.evaluate(el => ({ clientHeight: el.clientHeight, scrollHeight: el.scrollHeight, overflowY: getComputedStyle(el).overflowY, descendantScroll: [...el.querySelectorAll('*')].filter(n => n.scrollHeight > n.clientHeight + 2 && ['auto','scroll'].includes(getComputedStyle(n).overflowY)).map(n => ({ class: n.className, client: n.clientHeight, scroll: n.scrollHeight })) })));
  await s.page.mouse.move(200, 650); await s.page.mouse.wheel(0, 1300);
  await s.page.waitForTimeout(300);
  s.record('dialogue-bottom-320', { metrics: await s.metrics(), text: await dialog.innerText() });
  await s.snap('dialogue-bottom-320');
  await s.page.keyboard.press('Escape');
  const before = await s.xy();
  await s.page.getByRole('button', { name: '오른쪽으로 이동', exact: true }).press('Enter');
  const finalXY = await s.xy();
  assert.notDeepEqual(finalXY, before);
  await s.page.getByRole('button', { name: '타이틀', exact: true }).click();
  await s.page.locator('.title-save-slots').waitFor();
  const saved = clean(await s.profile());
  await s.page.reload();
  await s.page.locator('.title-save-slots').waitFor();
  assert.deepEqual(clean(await s.profile()), saved);
  await s.page.locator('.title-actions .primary-action').click();
  await s.page.locator('.village-interact-prompt').waitFor();
  const resumed = await s.xy();
  assert.deepEqual(resumed, finalXY);
  assert.deepEqual(clean(await s.profile()), saved);
  s.record('last-step-title-reload-resume', { before, finalXY, resumed, wholeProfileEqual: true, saved, metrics: await s.metrics() });
  await s.snap('village-320');
} catch (error) { await s.finish(error); process.exitCode = 1; }
finally { if (s.browser.isConnected()) await s.finish(); }
