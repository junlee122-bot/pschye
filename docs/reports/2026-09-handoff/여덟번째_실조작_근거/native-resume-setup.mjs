import assert from 'node:assert/strict';
export default async(s)=>{
 s.profile=async(slot=1)=>s.page.evaluate(slot=>JSON.parse(localStorage.getItem('raonjena-campaign-v10-slot-'+slot)),slot);
 s.waitProfile=async(predicate)=>{for(let i=0;i<100;i++){const p=await s.profile();if(predicate(p))return p;await new Promise(r=>setTimeout(r,50));}throw Error('Saved state condition not met');};
 s.checkpoint=async(name)=>{const p=await s.profile();s.fs.writeFileSync(s.work+'/native-'+name+'-profile.json',JSON.stringify(p,null,2));await s.context.storageState({path:s.work+'/native-'+name+'-storage.json',indexedDB:true});s.log('checkpoint-'+name,{scene:p.originStory.currentSceneId,completed:p.originStory.completedSceneIds,score:p.originStory.selectionScore});return p;};
 s.choose=async(scene,selector)=>{assert.equal((await s.profile()).originStory.currentSceneId,scene);await s.checkpoint(scene+'-before-choice');await s.page.locator(selector).click();const p=await s.waitProfile(p=>Boolean(p.originStory.choices[scene]));s.log('choose-'+scene,{choice:p.originStory.choices[scene],score:p.originStory.selectionScore,path:p.raonPath,memories:p.world.npcMemories});};
 await s.page.goto('http://127.0.0.1:4409/',{waitUntil:'networkidle'});
 await s.page.locator('.primary-action').click();
 await s.page.locator('.petal-training-primary[type="submit"]').waitFor();
 assert.deepEqual((await s.profile()).originStory,JSON.parse(s.fs.readFileSync(s.work+'/native-emergency-profile.json','utf8')).originStory);
 s.log('environment-recovery',{checkpoint:'native-emergency-storage.json',recoveredSameSavedOrigin:true,traceEnabled:false,parallelBrowsers:false});
 return {scene:(await s.profile()).originStory.currentSceneId,errors:s.errors};
};
