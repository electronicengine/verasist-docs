import {TextEncoder} from 'util';
import {scenarioFor,tabs,N} from './scenarios';
global.TextEncoder=TextEncoder;

test('every illustrated LAN/WAN hop has a visible network link; public analog/mobile has no office router',()=>{
 for(const tab of tabs)for(const target of ['201','202','301'])for(const registration of ['phones','pbx'])for(const mode of ['sip','forward']){
  for(const pbxMode of tab.id==='pbx'?['normal','sip-number']:['normal']){
   const s=scenarioFor(tab.id,target,registration,mode,pbxMode);
   if(['public-line','mechanism'].includes(tab.id)){expect(s.network).toBeUndefined();expect(s.topology.nodeIds).not.toContain(N.router);continue;}
   const topologies=s.topology.stages?Object.values(s.topology.stages):[s.topology];
   for(const topology of topologies){expect(topology.nodeIds).toContain(N.router);expect(topology.nodeKinds[N.switch]).toBe('switch');expect(topology.nodeKinds[N.router]).toBe('gateway');}
   for(const phase of s.phases){
    const topology=s.topology.stages?s.topology.stages[phase.stage]:s.topology;
    for(const route of [phase.path,phase.audio?.incoming||[],phase.audio?.outgoing||[]])for(let i=0;i<route.length;i++){
     expect(topology.nodeIds).toContain(route[i]);
     if(i)expect(topology.connections.some(w=>(w.a===route[i-1]&&w.b===route[i])||(w.b===route[i-1]&&w.a===route[i]))).toBe(true);
    }
   }
  }
 }
});
test('local PBX ringing stays on LAN; external call and audio include router; cloud AI leg bypasses office NAT',()=>{
 const pbx=scenarioFor('pbx');expect(pbx.phases.find(p=>p.message==='INVITE · 201').path).toEqual([N.pbx,N.switch,N.ip201]);
 expect(pbx.phases.find(p=>p.message==='INVITE · 201').networkCrossing).toBe(false);
 expect(pbx.phases.at(-1).audio.incoming).toEqual([N.caller,N.operator,N.router,N.switch,N.pbx,N.switch,N.ip201]);
 const s=scenarioFor('pbx','201','phones','sip','sip-number');
 expect(s.phases.find(p=>p.key==='number-conversation').networkCrossing).toBe(false);
 expect(s.phases.find(p=>p.key==='number-bridge').audio.incoming).toContain(N.router);
});
