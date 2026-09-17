import assert from 'node:assert/strict';
export default async(s)=>{
 s.waitProfile=async(predicate)=>{for(let i=0;i<100;i++){const p=await s.profile();if(predicate(p))return p;await new Promise(r=>setTimeout(r,50));}throw Error('Saved state condition not met');};
 s.choose=async(scene,selector)=>{
  assert.equal((await s.profile()).originStory.currentSceneId,scene);
  await s.checkpoint(scene+'-before-choice');
  await s.page.locator(selector).click();
  const p=await s.waitProfile(p=>Boolean(p.originStory.choices[scene]));
  s.log('choose-'+scene,{choice:p.originStory.choices[scene],score:p.originStory.selectionScore,path:p.raonPath,memories:p.world.npcMemories});
 };
 await s.page.locator('.village-interact-prompt').press('Enter');
 await s.choose('village-dawn','.village-choice-list button.insight');
 await s.page.getByRole('button',{name:'다음 목표',exact:true}).click();
 await s.waitProfile(p=>p.originStory.currentSceneId==='windmill-trouble');
 await s.moveTo(744,366);
 await s.page.locator('.village-interact-prompt').press('Enter');
 await s.choose('windmill-trouble','.village-choice-list button.insight');
 await s.page.getByRole('button',{name:'다음 목표',exact:true}).click();
 await s.waitProfile(p=>p.originStory.currentSceneId==='river-incident');
 await s.moveTo(932,548);
 await s.page.locator('.village-interact-prompt').press('Enter');
 await s.choose('river-incident','.village-choice-list button.insight');
 await s.page.getByRole('button',{name:'수로 구출 시작',exact:true}).click();
 await s.page.locator('.rescue-board').waitFor();
 await s.checkpoint('rescue-ready');
 return {text:await s.page.locator('body').innerText(),rescue:(await s.profile()).originStory.villageRescue,errors:s.errors};
};
