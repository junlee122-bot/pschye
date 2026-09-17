const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('<LOCAL_USER_HOME>/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base = '<LOCAL_WORKSPACE>/work';
if (fs.existsSync(`${base}/native-alternatives-river-result.json`)) {
  fs.copyFileSync(`${base}/native-alternatives-river-result.json`, `${base}/native-alternatives-river-previous-${Date.now()}.json`);
}
const report = { startedAt: new Date().toISOString(), origin: 'http://127.0.0.1:4409/', seed: 'native-river-incident-before-choice-storage.json', seedBoundary: 'First two prologue scenes were completed through the root agent UI; every alternative choice and subsequent rescue action below is native browser input.', paths: [], errors: [] };
const save = () => fs.writeFileSync(`${base}/native-alternatives-river-result.json`, JSON.stringify(report, null, 2));
const storageKey = 'raonjena-campaign-v10-slot-1';
async function profile(page) { return page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey); }
async function phase(page, expected) { await page.waitForFunction(([key, phase]) => JSON.parse(localStorage.getItem(key))?.originStory.villageRescue?.phase === phase, [storageKey, expected]); }
async function mark(page, run, label) {
  const p = await profile(page);
  const item = { label, sceneId: p.originStory.currentSceneId, rescue: p.originStory.villageRescue, score: p.originStory.selectionScore, paths: p.raonPath, flags: p.originStory.flags, bonds: p.bondLevels, kazrin: p.world.npcMemories.kazrin, position: p.world.village };
  run.steps.push(item); save(); console.log(JSON.stringify({path:run.path,label,phase:item.rescue?.phase,turn:item.rescue?.turn,hp:item.rescue?.hp,position:item.position}));
  return p;
}
async function action(page, key) {
  const before = (await profile(page)).originStory.villageRescue;
  const target=key==='q'?page.locator('.rescue-guard'):key==='e'?page.locator('.rescue-primary'):page.getByRole('button',{name:key==='ArrowRight'?'오른쪽으로 이동':'왼쪽으로 이동',exact:true});
  await target.press('Enter');
  await page.waitForFunction(([storageKey, turn]) => JSON.parse(localStorage.getItem(storageKey))?.originStory.villageRescue?.turn === turn, [storageKey, before.turn + 1]);
}
async function resume(page) {
  await page.locator('.title-actions .primary-action').press('Enter');
  await page.locator('.village-interact-prompt').waitFor({state:'visible'});
  await page.locator('.village-interact-prompt').press('Enter');
  await page.locator('.village-dialogue-panel').waitFor({state:'visible'});
}
async function runPath(browser, path) {
  const context = await browser.newContext({ storageState: `${base}/${report.seed}`, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const run = { path, steps: [], errors: [], screenshots: [], completed:false };
  report.paths.push(run); save();
  page.on('pageerror', error => {run.errors.push({kind:'pageerror',message:error.message});save();});
  page.on('console', msg => {if(['error','warning'].includes(msg.type())){run.errors.push({kind:msg.type(),message:msg.text()});save();}});
  try {
    await page.goto(report.origin, {waitUntil:'domcontentloaded'});
    await resume(page);
    const start = await mark(page,run,'before alternative choice');
    assert.equal(start.originStory.choices['river-incident'], undefined);
    await page.locator(`.village-choice-list button.${path}`).press('Enter');
    await phase(page,'ready');
    const ready = await mark(page,run,'choice recorded, result still pending');
    assert.equal(ready.originStory.flags.length,start.originStory.flags.length);
    await page.locator('.village-choice-result button').press('Enter');
    await phase(page,'active');
    for(let turn=0;turn<24;turn++) await action(page,'q');
    await phase(page,'failed');
    const failed = await mark(page,run,'24 real guard inputs caused a timeout');
    assert.equal(failed.originStory.villageRescue.hp,5);
    assert.equal(failed.originStory.selectionScore,ready.originStory.selectionScore);
    assert.deepEqual(failed.originStory.flags,ready.originStory.flags);
    const shot = `${base}/native-alternatives-river-${path}-failed.png`;
    await page.screenshot({path:shot,fullPage:true,animations:'disabled'});run.screenshots.push(shot);save();
    await page.locator('.rescue-failure .rescue-primary').press('Enter');
    await phase(page,'active');
    const retried = await mark(page,run,'native retry preserved choice and rewards');
    assert.equal(retried.originStory.villageRescue.attempt,2);
    assert.equal(retried.originStory.villageRescue.turn,0);
    assert.equal(retried.originStory.selectionScore,ready.originStory.selectionScore);
    const route = path === 'compassion' ? ['ArrowRight','ArrowRight','ArrowRight','e','e','e','ArrowLeft','ArrowLeft','ArrowLeft'] : ['ArrowRight','ArrowRight','e','e','e','ArrowLeft','ArrowLeft'];
    for(let index=0;index<route.length;index++) {
      await action(page,route[index]);
      await mark(page,run,`successful retry action ${index+1}: ${route[index]}`);
    }
    await phase(page,'return');
    const returned = await mark(page,run,'rescued and withdrew through real controls; village return pending');
    assert.equal(returned.originStory.villageRescue.progress,3);
    assert.deepEqual(returned.originStory.flags,ready.originStory.flags);
    await page.locator('.village-mobile-controls').waitFor({state:'visible'});
    const afterShot = `${base}/native-alternatives-river-${path}-return.png`;
    await page.screenshot({path:afterShot,fullPage:true,animations:'disabled'});run.screenshots.push(afterShot);
    await context.storageState({path:`${base}/native-alternatives-river-${path}-return-storage.json`,indexedDB:true});
    const startXY=await page.locator('.village-minimap').evaluate(el=>({x:parseFloat(el.style.getPropertyValue('--village-player-x'))*12.8,y:parseFloat(el.style.getPropertyValue('--village-player-y'))*7.2}));
    const blocks=[[142,76,300,230],[12,392,255,192],[410,432,233,184],[756,136,184,157],[1002,48,192,170],[968,470,312,250],[720,681,560,39]];
    const dirs=[['위로 이동',0,-28],['왼쪽으로 이동',-28,0],['아래로 이동',0,28],['오른쪽으로 이동',28,0]];
    const key=p=>Math.round(p.x*100)+','+Math.round(p.y*100);
    const queue=[{...startXY,steps:[]}],seen=new Set([key(startXY)]);let walk;
    for(let i=0;i<queue.length;i++){
      const n=queue[i];if(Math.hypot(n.x-478,n.y-348)<75){walk=n.steps;break;}
      for(const [label,dx,dy] of dirs){const p={x:n.x+dx,y:n.y+dy};if(p.x<28||p.x>1252||p.y<42||p.y>694||blocks.some(([x,y,w,h])=>p.x>=x&&p.x<x+w&&p.y>=y&&p.y<y+h)||seen.has(key(p)))continue;seen.add(key(p));queue.push({...p,steps:[...n.steps,label]});}
    }
    assert.ok(walk,'walkable route to Kazrin');
    for(const label of walk)await page.getByRole('button',{name:label,exact:true}).press('Enter');
    await page.locator('.village-interact-prompt').press('Enter');
    await page.getByRole('button',{name:'무사 귀환 확인',exact:true}).press('Enter');
    await phase(page,'complete');
    const complete=await mark(page,run,'Kazrin confirmed return through real dialogue');
    assert.equal(complete.originStory.flags.length,ready.originStory.flags.length+1);
    assert.equal(complete.originStory.selectionScore,ready.originStory.selectionScore);
    await page.getByRole('button',{name:'일주일 뒤 · 선발 공고일',exact:true}).press('Enter');
    await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).originStory.currentSceneId==='recruiters-arrive',storageKey);
    const advanced=await mark(page,run,'advanced to recruiters without additional choice rewards');
    assert.ok(advanced.originStory.completedSceneIds.includes('river-incident'));
    run.completed = true; save();
  } catch(error) {
    run.errors.push({kind:'script',message:error.stack});save();
    try {await page.screenshot({path:`${base}/native-alternatives-river-${path}-error.png`,fullPage:true});} catch {}
    console.error(error.stack);
  } finally {await context.close();}
}
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'<LOCAL_PROGRAM_FILES> (x86)/Microsoft/Edge/Application/msedge.exe',args:['--disk-cache-size=1048576','--media-cache-size=1048576']});report.browser=browser.version();
  try { for(const path of ['compassion','resolve']) await runPath(browser,path); }
  finally {await browser.close();report.finishedAt=new Date().toISOString();save();if(report.paths.some(run=>!run.completed))process.exitCode=1;}
})().catch(error=>{report.errors.push(error.stack);save();console.error(error.stack);process.exitCode=1;});
