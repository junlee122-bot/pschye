import assert from 'node:assert/strict';
export default async(s)=>{
 const route=['right','assist','right','assist','right','assist','left','left','left'];
 if(await s.page.locator('.primary-action').isVisible())await s.page.locator('.primary-action').click();
 const startTurn=(await s.profile()).originStory.villageRescue.turn;
 if(startTurn===4){assert.deepEqual((await s.profile()).originStory,JSON.parse(s.fs.readFileSync(s.work+'/native-rescue-mid-profile.json','utf8')).originStory);s.log('rescue-native-reload',{equal:true});}
 for(let i=startTurn;i<route.length;i++){
  const action=route[i];
  if(action==='assist')await s.page.locator('.rescue-primary').click();
  else await s.page.getByRole('button',{name:action==='right'?'오른쪽으로 이동':'왼쪽으로 이동',exact:true}).click();
  const p=await s.waitProfile(p=>p.originStory.villageRescue.turn===i+1);
  s.log('rescue-action',{action,state:p.originStory.villageRescue});
  if(i===3){
   const before=p.originStory;
   await s.checkpoint('rescue-mid');
   await s.page.getByRole('button',{name:'타이틀로 · 이어하기',exact:true}).click();
   await s.page.reload({waitUntil:'networkidle'});
   await s.page.locator('.primary-action').click();
   await s.page.locator('.rescue-board').waitFor();
   assert.deepEqual((await s.profile()).originStory,before);
   s.log('rescue-native-reload',{equal:true});
  }
 }
 assert.equal((await s.profile()).originStory.villageRescue.phase,'return');
 await s.page.locator('.village-engine canvas').waitFor();
 await s.moveTo(478,348);
 await s.checkpoint('rescue-return-near');
 await s.page.locator('.village-interact-prompt').press('Enter');
 await s.page.getByRole('button',{name:'무사 귀환 확인',exact:true}).click();
 const complete=await s.waitProfile(p=>p.originStory.villageRescue.phase==='complete');
 assert.equal(complete.originStory.currentSceneId,'river-incident');
 await s.checkpoint('rescue-complete');
 s.log('rescue-return-confirm',{profile:complete.originStory,shot:await s.snap('rescue-return-confirm')});
 await s.page.getByRole('button',{name:'일주일 뒤 · 선발 공고일',exact:true}).click();
 await s.waitProfile(p=>p.originStory.currentSceneId==='recruiters-arrive');
 for(const [scene,x,y] of [['recruiters-arrive',478,348],['departure-night',1052,244]]){
  await s.moveTo(x,y);
  await s.page.locator('.village-interact-prompt').press('Enter');
  await s.choose(scene,'.village-choice-list button.insight');
  await s.page.getByRole('button',{name:'다음 목표',exact:true}).click();
  await s.waitProfile(p=>p.originStory.currentSceneId!==scene);
 }
 await s.page.locator('.origin-heading h1').waitFor();
 await s.checkpoint('capital-before-choice');
 return {scene:(await s.profile()).originStory.currentSceneId,text:await s.page.locator('body').innerText(),errors:s.errors};
};
