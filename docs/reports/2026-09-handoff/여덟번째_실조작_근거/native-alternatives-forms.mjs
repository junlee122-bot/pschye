import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require('<LOCAL_USER_HOME>/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const work=path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
const base=decodeURIComponent(work);
const origin='http://127.0.0.1:4409/';
const report={origin,startedAt:new Date().toISOString(),source:'bbcf10e',scope:'Copies of actual UI checkpoints; all alternative choices, failures, retries and completions below are real browser inputs.',cases:[]};
const write=()=>fs.writeFileSync(base+'/native-alternatives-forms-result.json',JSON.stringify(report,null,2));
const scenarios=[
 {scene:'field-exam',prefix:'field-exam',key:'fieldExam',success:'return',routes:{compassion:[['left','right'],['brace','left'],['left','right'],['brace','right']],resolve:[['brace','left'],['left','right'],['brace','right'],['left','right']]}},
 {scene:'sixteen-petals',prefix:'petal-training',key:'petalTraining',success:'review',routes:{compassion:['trace','trace','trace','breathe','trace','trace','balance'],resolve:['trace','trace','breathe','trace','balance']}},
 {scene:'captain-trials',prefix:'captain-trial',key:'captainTrials',success:'resolved',routes:{compassion:['parry','counter','sidestep','counter','recover','recover','sidestep','counter'],resolve:['parry','counter','sidestep','counter']}},
 {scene:'kazrin-duel',prefix:'captain-trial',key:'captainTrials',success:'resolved',routes:{compassion:['sidestep','parry','counter','sidestep','recover','recover','sidestep','parry','counter','sidestep','recover','recover','sidestep','parry','counter'],resolve:['sidestep','parry','counter','sidestep','recover','recover','sidestep','parry','counter']}},
];
const browser=await chromium.launch({headless:true,executablePath:'<LOCAL_PROGRAM_FILES> (x86)/Microsoft/Edge/Application/msedge.exe',args:['--disk-cache-size=1048576','--media-cache-size=1048576']});
report.browser=browser.version();
try{
 for(const scenario of scenarios)for(const stance of ['compassion','resolve']){
  const context=await browser.newContext({storageState:base+'/native-'+scenario.scene+'-before-choice-storage.json',viewport:{width:390,height:844}});
  const page=await context.newPage();page.setDefaultTimeout(10000);
  const run={scene:scenario.scene,stance,checkpoint:'native-'+scenario.scene+'-before-choice-storage.json',steps:[],errors:[],passed:false};report.cases.push(run);
  page.on('pageerror',e=>run.errors.push(e.message));
  const profile=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('raonjena-campaign-v10-slot-1')));
  const state=p=>scenario.key==='captainTrials'?p.originStory.captainTrials?.[scenario.scene]:p.originStory[scenario.key];
  const wait=async fn=>{for(let i=0;i<100;i++){const p=await profile();if(fn(p))return p;await new Promise(r=>setTimeout(r,40));}throw Error('Saved state did not reach condition');};
  const mark=(label,p)=>{run.steps.push({label,state:state(p),score:p.originStory.selectionScore,flags:p.originStory.flags});write();};
  const primary=()=>page.locator('.'+scenario.prefix+'-primary');
  const act=async action=>{
   const before=state(await profile());
   if(scenario.key==='fieldExam'){
    await page.locator('input[name="field-exam-raon"][value="'+action[0]+'"]').check();
    await page.locator('input[name="field-exam-leo"][value="'+action[1]+'"]').check();
   }else await page.locator('input[name="'+scenario.prefix+'-action"][value="'+action+'"]').check();
   await page.locator('.'+scenario.prefix+'-primary[type="submit"]').click();
   const p=await wait(p=>state(p)?.turn===before.turn+1);mark('action '+JSON.stringify(action),p);return p;
  };
  try{
   await page.goto(origin,{waitUntil:'networkidle'});
   await page.locator('.primary-action').click();
   await page.locator('.origin-choice.'+stance).click();
   const ready=await wait(p=>state(p)?.phase==='ready');mark('chosen',ready);
   await primary().click();await wait(p=>state(p)?.phase==='active');
   for(let i=0;i<20&&state(await profile()).phase==='active';i++)await act(scenario.key==='fieldExam'?['brace','brace']:scenario.key==='petalTraining'?'trace':'recover');
   const failed=await profile();assert.equal(state(failed).phase,'failed');
   assert.equal(failed.originStory.selectionScore,ready.originStory.selectionScore);assert.deepEqual(failed.originStory.flags,ready.originStory.flags);mark('actual failure',failed);
   await primary().click();const retried=await wait(p=>state(p)?.phase==='active');assert.equal(state(retried).attempt,2);assert.equal(state(retried).turn,0);assert.deepEqual(retried.heroProgress,ready.heroProgress);assert.deepEqual(retried.bondLevels,ready.bondLevels);mark('retry without repeated rewards',retried);
   for(const action of scenario.routes[stance])await act(action);
   const result=await profile();assert.equal(state(result).phase,scenario.success);assert.deepEqual(result.originStory.flags,ready.originStory.flags);mark('pending result',result);
   await primary().click();const complete=await wait(p=>state(p)?.phase==='complete');assert.equal(complete.originStory.flags.length,ready.originStory.flags.length+1);assert.equal(complete.originStory.selectionScore,ready.originStory.selectionScore);assert.deepEqual(complete.heroProgress,ready.heroProgress);mark('confirmed once',complete);
   const shot=base+'/native-alternatives-'+scenario.scene+'-'+stance+'-complete.png';await page.screenshot({path:shot,fullPage:true});run.screenshot=shot;
   await primary().click();const advanced=await wait(p=>p.originStory.currentSceneId!==scenario.scene);assert.ok(advanced.originStory.completedSceneIds.includes(scenario.scene));mark('next scene',advanced);
   run.passed=true;write();console.log(JSON.stringify({scene:scenario.scene,stance,passed:true}));
  }catch(e){run.failure=e.stack;write();await page.screenshot({path:base+'/native-alternatives-'+scenario.scene+'-'+stance+'-error.png',fullPage:true}).catch(()=>{});throw e;}
  finally{await context.close();}
 }
}finally{await browser.close();report.finishedAt=new Date().toISOString();report.browserClosed=true;write();}
