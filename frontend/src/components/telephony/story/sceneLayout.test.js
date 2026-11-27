import {TextEncoder} from 'util';
import {scenarioFor,tabs} from './scenarios';
import {layoutScene,routePoints} from './sceneLayout';
global.TextEncoder=TextEncoder;
const equal=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])<1e-7;
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const on=(p,a,b)=>Math.abs(cross(a,b,p))<1e-7&&p[0]>=Math.min(a[0],b[0])-1e-7&&p[0]<=Math.max(a[0],b[0])+1e-7&&p[1]>=Math.min(a[1],b[1])-1e-7&&p[1]<=Math.max(a[1],b[1])+1e-7;
const intersects=(a,b,c,d)=>cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0||on(a,c,d)||on(b,c,d)||on(c,a,b)||on(d,a,b);

test('home layouts have no cable crossings, node overlaps or cables through unrelated nodes in either orientation',()=>{
 const cases=tabs.flatMap(tab=>tab.id==='mechanism'?['pipeline','realtime','live'].map(mode=>scenarioFor(tab.id,'201','phones','sip','normal','fixed','mobile',mode)):[scenarioFor(tab.id),...(tab.id==='direct'?[scenarioFor('direct','201','phones','forward')]:[]),...(tab.id==='registration'?[scenarioFor(tab.id,'201','pbx')]:[]),...(tab.id==='pbx'?[scenarioFor(tab.id,'201','phones','sip','sip-number')]:[])]);
 cases.push(...['local-sip','remote-sip','vpn-sip','ari'].flatMap(mode=>['local','cloud'].map(location=>scenarioFor('pbx','201','phones','sip',mode,'fixed','mobile','pipeline',location))));
 cases.push(...['hosted','sip','forward'].flatMap(method=>['local','cloud'].map(location=>scenarioFor('direct','201','phones',method,'normal','fixed','mobile','pipeline','cloud',location))));
 cases.push(...['301','302','303'].map(target=>scenarioFor('public-line','201','phones','sip','normal','fxo','mobile','pipeline','cloud','cloud',target)));
 for(const s of cases)for(const top of s.topology.stages?Object.values(s.topology.stages):[s.topology])for(const mobile of [false,true]){
  const layout=layoutScene(top,{mobile});
  for(const a of top.nodeIds)for(const b of top.nodeIds)if(a!==b)expect(equal(layout.positions[a],layout.positions[b])).toBe(false);
  const routes=top.connections.map(w=>({...w,points:routePoints(layout,w.a,w.b)}));
  for(const route of routes)for(let k=1;k<route.points.length;k++)for(const id of top.nodeIds)if(![route.a,route.b].includes(id))expect(on(layout.positions[id],route.points[k-1],route.points[k])).toBe(false);
  for(let i=0;i<routes.length;i++)for(let j=i+1;j<routes.length;j++){
   const a=routes[i],b=routes[j],common=[a.a,a.b].find(id=>[b.a,b.b].includes(id));
   for(let k=1;k<a.points.length;k++)for(let l=1;l<b.points.length;l++){
    const p=a.points[k-1],q=a.points[k],r=b.points[l-1],t=b.points[l];
    if(common!==undefined&&[p,q].some(v=>equal(v,layout.positions[common]))&&[r,t].some(v=>equal(v,layout.positions[common])))continue;
    if(intersects(p,q,r,t))throw new Error(`${s.id}/${s.modelMode||s.directMode||''} ${mobile?'mobile':'desktop'}: ${a.a}-${a.b} crosses ${b.a}-${b.b}`);
   }
  }
 }
});
