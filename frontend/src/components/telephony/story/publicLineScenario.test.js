import {TextEncoder} from 'util';
import {scenarioFor,N,detailFor} from './scenarios';
import {localizePhase,localizeDetail} from './english';
import {setupHints} from './setupHints';
import {buildPacketModel} from './packetModel';
global.TextEncoder=TextEncoder;

test('fixed/mobile forwarding needs no office PBX, ATA or phone registration and keeps staff on a separate number',()=>{
 for(const line of ['fixed','mobile'])for(const staff of ['fixed','mobile']){
  const s=scenarioFor('public-line','201','phones','sip','normal',line,staff),phase=key=>s.phases.find(p=>p.key===key);
  const T=staff==='fixed'?N.staffFixed:N.staffMobile;
  expect(s.topology.nodeIds).not.toEqual(expect.arrayContaining([N.pbx]));
  for(const id of [N.pbx,N.ata,N.switch,N.ip201,N.ip202])expect(s.topology.nodeIds).not.toContain(id);
  expect(s.topology.nodeKinds[N.officeLine]).toBe(line==='fixed'?'analog':'caller');
  expect(phase('line-original-audio').audio.incoming).toEqual([N.caller,N.operator,N.officeLine]);
  expect(phase('line-conversation').audio.incoming).toEqual([N.caller,N.operator,N.provider,N.vera]);
  const answer=s.phases.findIndex(p=>p.key==='line-staff-answer');
  for(const p of s.phases.slice(3,answer+1))if(p.audio)expect(p.audio.incoming).not.toContain(T);
  const bridge=phase('line-bridge').audio;
  expect(bridge.incoming).toEqual([N.caller,N.operator,N.provider,N.vera,N.provider,N.operator,T]);
  expect(bridge.outgoing).toEqual([...bridge.incoming].reverse());
  expect(phase('line-invite').code).toMatch(/^INVITE sip:\+12025550301@/);
  expect(phase('line-dial').code).toMatch(/^INVITE sip:\+12025550201@/);
  expect(setupHints(s,phase('line-staff'),'en').items[0].steps.join(' ')).toMatch(/single forwarded number/);
  for(const p of s.phases){
   for(const id of p.path)expect(s.topology.nodeIds).toContain(id);
   for(const route of [p.path,p.audio?.incoming||[],p.audio?.outgoing||[]])for(let i=1;i<route.length;i++)expect(s.topology.connections.some(w=>(w.a===route[i-1]&&w.b===route[i])||(w.b===route[i-1]&&w.a===route[i]))).toBe(true);
   const en=localizePhase(p,s,'en');expect(en.title+en.text).not.toMatch(/[çğıöşüÇĞİÖŞÜ]/);
   const detail=localizeDetail(detailFor(s,p),s,p,'en',id=>s.labels.en[id]||String(id));
   expect(buildPacketModel(detail,p,'en').layers.length).toBeGreaterThan(0);
   if(/^SIP\/2.0|^(INVITE|ACK|BYE) sip:/.test(p.code)){
    const [head,body]=p.code.split('\r\n\r\n');expect(Number(head.match(/Content-Length: (\d+)/)[1])).toBe(new TextEncoder().encode(body).length);
    expect(p.code).not.toContain('REGISTER');
   }
  }
  expect(buildPacketModel(detailFor(s,phase('line-invite')),phase('line-invite')).kind).toBe('sip');
  expect(buildPacketModel(detailFor(s,phase('line-bridge')),phase('line-bridge')).kind).toBe('rtp');
  expect(phase('line-end').audio).toBeUndefined();
 }
});
