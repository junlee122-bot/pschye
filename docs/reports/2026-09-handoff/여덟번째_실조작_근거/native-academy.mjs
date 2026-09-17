import assert from 'node:assert/strict';
export default async(s)=>{
 for(const scene of ['capital-gate','aptitude-exam']){
  await s.choose(scene,'.origin-choice.insight');
  await s.page.locator('.origin-advance').click();
  await s.waitProfile(p=>p.originStory.currentSceneId!==scene);
 }
 await s.choose('field-exam','.origin-choice.insight');
 await s.page.locator('.field-exam-primary').click();
 for(let turn=1;turn<=3;turn++){
  await s.page.locator('input[name="field-exam-raon"][value="left"]').check();
  await s.page.locator('input[name="field-exam-leo"][value="right"]').check();
  await s.page.locator('.field-exam-primary[type="submit"]').click();
  const p=await s.waitProfile(p=>p.originStory.fieldExam.turn===turn);
  assert.equal(p.originStory.fieldExam.phase,turn===3?'return':'active');
  s.log('field-native-action',{state:p.originStory.fieldExam});
  if(turn===1)await s.checkpoint('field-mid');
 }
 await s.checkpoint('field-return');
 await s.page.locator('.field-exam-primary').click();
 await s.waitProfile(p=>p.originStory.fieldExam.phase==='complete');
 await s.checkpoint('field-complete');
 await s.page.locator('.field-exam-primary').click();
 await s.waitProfile(p=>p.originStory.currentSceneId==='suspended-candidate');
 for(const scene of ['suspended-candidate','maru-door']){
  await s.choose(scene,'.origin-choice.insight');
  await s.page.locator('.origin-advance').click();
  await s.waitProfile(p=>p.originStory.currentSceneId!==scene);
 }
 await s.choose('sixteen-petals','.origin-choice.insight');
 await s.page.locator('.petal-training-primary').click();
 for(let turn=1;turn<=6;turn++){
  await s.page.locator('input[name="petal-training-action"][value="balance"]').check();
  await s.page.locator('.petal-training-primary[type="submit"]').click();
  const p=await s.waitProfile(p=>p.originStory.petalTraining.turn===turn);
  assert.equal(p.originStory.petalTraining.phase,turn===6?'review':'active');
  s.log('petal-native-action',{state:p.originStory.petalTraining});
  if(turn===2)await s.checkpoint('petal-mid');
 }
 await s.checkpoint('petal-review');
 s.log('petal-native-review',{shot:await s.snap('petal-review')});
 await s.page.locator('.petal-training-primary').click();
 await s.waitProfile(p=>p.originStory.petalTraining.phase==='complete');
 await s.page.locator('.petal-training-primary').click();
 await s.waitProfile(p=>p.originStory.currentSceneId==='captain-trials');
 await s.checkpoint('captain-trials-before-choice');
 return {scene:(await s.profile()).originStory.currentSceneId,errors:s.errors};
};
