import assert from 'node:assert/strict';
export default async(s)=>{
 const original=JSON.parse(s.fs.readFileSync(s.work+'/native-village-near-kazrin-profile.json','utf8'));
 const initial=await s.profile();
 assert.equal(initial.originStory.currentSceneId,'sixteen-petals');
 assert.equal(initial.originStory.petalTraining.phase,'active');
 for(let turn=initial.originStory.petalTraining.turn+1;turn<=6;turn++){
  await s.page.locator('input[name="petal-training-action"][value="balance"]').check();
  await s.page.locator('.petal-training-primary[type="submit"]').click();
  const p=await s.waitProfile(p=>p.originStory.petalTraining.turn===turn);
  assert.equal(p.originStory.petalTraining.phase,turn===6?'review':'active');
  s.log('petal-native-action',{state:p.originStory.petalTraining});
 }
 await s.checkpoint('petal-review');
 await s.page.locator('.petal-training-primary').click();
 await s.waitProfile(p=>p.originStory.petalTraining.phase==='complete');
 await s.page.locator('.petal-training-primary').click();
 await s.waitProfile(p=>p.originStory.currentSceneId==='captain-trials');
 for(const [scene,actions] of [
  ['captain-trials',['parry','counter','sidestep','counter','parry','counter']],
  ['kazrin-duel',['sidestep','parry','counter','sidestep','parry','counter','sidestep','parry','counter']]
 ]){
  await s.choose(scene,'.origin-choice.insight');
  await s.page.locator('.captain-trial-primary').click();
  for(let i=0;i<actions.length;i++){
   await s.page.locator('input[name="captain-trial-action"][value="'+actions[i]+'"]').check();
   await s.page.locator('.captain-trial-primary[type="submit"]').click();
   const p=await s.waitProfile(p=>p.originStory.captainTrials?.[scene]?.turn===i+1);
   assert.equal(p.originStory.captainTrials[scene].phase,i===actions.length-1?'resolved':'active');
   s.log('trial-native-action',{scene,action:actions[i],state:p.originStory.captainTrials[scene]});
   if(i===1)await s.checkpoint(scene+'-mid');
  }
  await s.checkpoint(scene+'-resolved');
  await s.page.locator('.captain-trial-primary').click();
  await s.waitProfile(p=>p.originStory.captainTrials[scene].phase==='complete');
  await s.checkpoint(scene+'-complete');
  await s.page.locator('.captain-trial-primary').click();
  await s.waitProfile(p=>p.originStory.currentSceneId!==scene);
 }
 assert.equal((await s.profile()).originStory.currentSceneId,'hadori-wall');
 await s.checkpoint('hadori-ready');
 await s.page.getByRole('button',{name:'하도리 앞에 서기',exact:true}).click();
 await s.page.getByRole('button',{name:'첫 발을 내딛기',exact:true}).click();
 await s.waitProfile(p=>p.originStory.captainTrials?.['hadori-wall']?.phase==='resolved');
 assert.equal((await s.profile()).originStory.captainTrials['hadori-wall'].turn,1);
 assert.equal((await s.profile()).originStory.captainTrials['hadori-wall'].poise,0);
 await s.checkpoint('hadori-resolved');
 s.log('hadori-native-defeat',{shot:await s.snap('hadori-resolved')});
 await s.page.getByRole('button',{name:'의무동에서 눈뜨기',exact:true}).click();
 await s.waitProfile(p=>p.originStory.captainTrials['hadori-wall'].phase==='complete');
 await s.choose('hadori-wall','.origin-choice.insight');
 await s.page.locator('.origin-advance').click();
 await s.waitProfile(p=>p.originStory.currentSceneId==='seventh-oath');
 await s.choose('seventh-oath','.origin-choice.insight');
 await s.page.locator('.origin-advance').click();
 const inducted=await s.waitProfile(p=>p.originStory.completed);
 assert.equal(inducted.originStory.completedSceneIds.length,15);
 assert.equal(Object.keys(inducted.originStory.choices).length,15);
 assert.deepEqual(inducted.heroProgress,original.heroProgress);
 for(const k of ['day','supplies','intel','relics','renown'])assert.equal(inducted[k],original[k]);
 assert.ok(inducted.unlockedRecords.includes('psyche-generation-07'));
 await s.checkpoint('inducted');
 s.log('native-origin-complete',{originallyFresh:true,resumedActualStorageAfterDiskFailure:true,completedScenes:15,allStance:'insight',noGraduationStatInflation:true,shot:await s.snap('inducted')});
 await s.page.locator('.conversation-next:visible').click();
 await s.page.locator('.stage-navigation-row button.stage-next-button:visible').click();
 await s.page.locator('.story-choice-card.choice-insight:visible').click();
 await s.page.locator('.raon-choice-section .stage-next-button:visible').click();
 await s.checkpoint('first-mission-prepared');
 await s.page.locator('.story-launch-button:visible').click();
 await s.page.locator('#combat-mode-title').waitFor();
 const launched=await s.waitProfile(p=>p.battleAttempt?.mode==='select');
 assert.equal(launched.battleAttempt.heroes.length,6);
 await s.checkpoint('first-mode-select');
 return {originCompleted:true,scenes:15,modeSelect:true,heroes:6,errors:s.errors};
};
