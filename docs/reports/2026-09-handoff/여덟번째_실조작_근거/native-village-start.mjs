import assert from 'node:assert/strict';
export default async (s) => {
 s.profile = async (slot=1) => s.page.evaluate(slot => JSON.parse(localStorage.getItem('raonjena-campaign-v10-slot-'+slot)),slot);
 s.checkpoint = async name => {
  const p = await s.profile();
  s.fs.writeFileSync(s.work+'/native-'+name+'-profile.json',JSON.stringify(p,null,2));
  await s.context.storageState({path:s.work+'/native-'+name+'-storage.json',indexedDB:true});
  s.log('checkpoint-'+name,{scene:p.originStory.currentSceneId,completed:p.originStory.completedSceneIds,score:p.originStory.score,world:p.world.village});
  return p;
 };
 await s.page.getByRole('button',{name:'변방 마을에서 시작',exact:true}).click();
 await s.page.locator('.village-engine canvas').waitFor();
 await s.page.setViewportSize({width:390,height:844});
 await s.page.getByRole('button',{name:'위로 이동',exact:true}).waitFor({state:'visible'});
 s.log('village-start',{profile:await s.profile(),shot:await s.snap('village-start-390')});
 s.moveTo = async (tx,ty,radius=75) => {
  const readXY = () => s.page.locator('.village-minimap').evaluate(el => ({x:parseFloat(el.style.getPropertyValue('--village-player-x'))*12.8,y:parseFloat(el.style.getPropertyValue('--village-player-y'))*7.2}));
  const start=await readXY();
  const blocks=[[142,76,300,230],[12,392,255,192],[410,432,233,184],[756,136,184,157],[1002,48,192,170],[968,470,312,250],[720,681,560,39]];
  const dirs=[['위로 이동',0,-28],['왼쪽으로 이동',-28,0],['아래로 이동',0,28],['오른쪽으로 이동',28,0]];
  const key=p=>Math.round(p.x*100)+','+Math.round(p.y*100);
  const queue=[{...start,steps:[]}],seen=new Set([key(start)]);
  let route;
  for(let i=0;i<queue.length;i++){
   const n=queue[i]; if(Math.hypot(n.x-tx,n.y-ty)<radius){route=n.steps;break;}
   for(const [label,dx,dy] of dirs){const p={x:n.x+dx,y:n.y+dy};if(p.x<28||p.x>1252||p.y<42||p.y>694||blocks.some(([x,y,w,h])=>p.x>=x&&p.x<x+w&&p.y>=y&&p.y<y+h)||seen.has(key(p)))continue;seen.add(key(p));queue.push({...p,steps:[...n.steps,label]});}
  }
  assert.ok(route,'walkable route');
  for(const label of route){await s.page.getByRole('button',{name:label,exact:true}).press('Enter');}
  await s.page.locator('.village-interact-prompt').waitFor({state:'visible'});
  const end=await readXY();
  s.log('native-move',{start,target:{x:tx,y:ty},end,inputs:route});
  return end;
 };
 await s.moveTo(810,346);
 await s.checkpoint('village-near-kazrin');
 await s.page.locator('.village-interact-prompt').click();
 await s.page.getByRole('dialog').waitFor();
 return {profile:(await s.profile()).originStory,dialog:await s.page.getByRole('dialog').innerText(),errors:s.errors};
};
