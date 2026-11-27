import {TextEncoder} from 'util';
import {scenarioFor,N,nodeLabel,detailFor} from './scenarios';
import {localizePhase,localizeDetail,translate} from './english';
import {sequenceModel,sequenceSource} from './sequenceDiagram';
import {setupHints} from './setupHints';
global.TextEncoder=TextEncoder;
const story=(method,location)=>scenarioFor('direct','201','phones',method,'normal','fixed','mobile','pipeline','cloud',location);
test('six phone-only combinations retain first reception, actual message code, both audio directions and bilingual setup',()=>{
 for(const method of ['hosted','sip','forward'])for(const location of ['local','cloud']){
  const s=story(method,location),tops=s.topology.stages?Object.values(s.topology.stages):[s.topology];
  for(const t of tops){expect(t.nodeIds).toContain(N.ip201);expect(t.nodeIds).toContain(N.ip202);expect(t.nodeIds).not.toContain(N.pbx);expect(t.nodeIds).not.toContain(N.ai);}
  for(const p of s.phases){const t=s.topology.stages?s.topology.stages[p.stage]:s.topology;
   for(const route of [p.path,p.audio?.incoming||[],p.audio?.outgoing||[]]){for(const id of route)expect(t.nodeIds).toContain(id);for(let i=1;i<route.length;i++)expect(t.connections.some(w=>w.a===route[i-1]&&w.b===route[i]||w.b===route[i-1]&&w.a===route[i])).toBe(true);}
   expect(detailFor(s,p).code).toBe(p.code);
   for(const lang of ['tr','en']){expect(setupHints(s,p,lang).items.length).toBeGreaterThan(0);expect(localizePhase(p,s,lang).title).toBeTruthy();if(lang==='en'){const d=localizeDetail(detailFor(s,p),s,p,lang,id=>s.labels.en[id]||translate(nodeLabel(id,s.id,s.directMode),lang));expect(d.route+d.code).not.toMatch(/[çğıöşüÇĞİÖŞÜ]/);}}
  }
  expect(s.phases.some(p=>p.audio?.incoming.includes(N.vera))).toBe(true);expect(s.phases.some(p=>p.audio?.incoming.includes(N.ip202)&&p.audio.outgoing.length>1)).toBe(true);
  expect(s.phases.at(-1).audio).toBeUndefined();expect(s.phases.at(-1).final).toBe(true);
  for(const lang of ['tr','en'])expect(sequenceSource(sequenceModel(s,lang),lang)).not.toMatch(/Pundefined|Note over/);
 }
});
test('hosted phones register at Verasist, then the answered Contact is bridged without a staff DID',()=>{
 for(const location of ['local','cloud']){
  const s=story('hosted',location),request=s.phases.find(p=>p.key==='phone-register-202');
  expect(request.path).toEqual(location==='local'?[N.ip202,N.switch,N.control]:[N.ip202,N.switch,N.router,N.control]);
  expect(request.code).toMatch(/^REGISTER/);expect(request.code).toContain('Contact: <sip:202@192.0.2.22:5060>');expect(request.code).toContain('Expires: 300');expect(s.phases.find(p=>p.key==='phone-challenge-202').code).toContain('WWW-Authenticate');
  expect(s.phases.find(p=>p.key==='phone-transfer').code).toMatch(/^INVITE sip:202@/);
  const bridge=s.phases.find(p=>p.key==='phone-bridge');expect(bridge.audio.incoming).not.toContain(N.vera);expect(bridge.audio.incoming.at(-1)).toBe(N.ip202);expect(bridge.bridgeAt).toBe(N.control);
  expect(s.notice).toContain('mevcut SIP trunk formu bunu otomatik sağlamaz');
 }
});
test('existing direct SIP and number forwarding stay provider-owned while local delivery enters office router and switch',()=>{
 for(const method of ['sip','forward']){
  const cloud=story(method,'cloud'),local=story(method,'local'),peer=method==='sip'?N.operator:N.provider;
  const call=s=>s.phases.find(p=>p.stage==='verasist'&&p.path[0]===peer&&p.path.at(-1)===N.vera&&/^INVITE/.test(p.code));
  expect(call(cloud).path).toEqual([peer,N.vera]);expect(call(local).path).toEqual([peer,N.router,N.switch,N.vera]);
  const staff=local.phases.find(p=>p.audio?.incoming.includes(N.vera)&&p.audio.incoming.includes(N.ip202));expect(staff.audio.incoming).not.toContain(N.ip201);
  expect(local.phases.some(p=>p.stage==='operator')).toBe(true);for(const p of local.phases.filter(p=>/^RTP\b/.test(p.code||'')))expect(p.signal).toBe(false);
 }
});
