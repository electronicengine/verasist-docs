import {TextEncoder} from 'util';
import {scenarioFor,N,nodeLabel,detailFor} from './scenarios';
import {localizePhase,localizeDetail,translate} from './english';
import {sequenceModel,sequenceSource} from './sequenceDiagram';
import {setupHints} from './setupHints';
global.TextEncoder=TextEncoder;
const story=target=>scenarioFor('public-line','201','phones','sip','normal','fxo','mobile','pipeline','cloud','cloud',target);
test('FXO converts the existing analog line and reaches Verasist on VPN without a new carrier trunk',()=>{
 for(const target of ['301','302','303']){
  const s=story(target),phase=key=>s.phases.find(p=>p.key===key),top=s.topology;
  expect(top.nodeIds).toContain(N.fxo);expect(top.nodeIds).toContain(N.vpn);expect(top.nodeIds).not.toContain(N.provider);expect(top.nodeIds).not.toContain(N.pbx);for(const absent of [N.switch,N.ip201,N.ip202,N.ata])expect(top.nodeIds).not.toContain(absent);expect(top.nodeIds).toEqual(expect.arrayContaining([N.analog301,N.analog302,N.analog]));
  expect(phase('fxo-invite').path).toEqual([N.fxo,N.router,N.vpn,N.control]);
  expect(phase('fxo-ring').path).toEqual([N.operator,N.officeLine,N.fxo]);expect(phase('fxo-ring').code).not.toMatch(/INVITE|RTP/);
  expect(phase('fxo-vpn').code).toContain('192.168.50.0/24');expect(phase('fxo-vpn').code).toContain('10.88.0.1/32');expect(phase('fxo-vpn').code).toContain('PersistentKeepalive');
  expect(phase('fxo-invite').code).toContain('m=audio 12000 ');expect(phase('fxo-transfer').code).toContain('m=audio '+(13000+2*(Number(target)-300))+' ');expect(phase('fxo-transfer').path[0]).toBe(N.control);expect(phase('fxo-transfer').path.at(-1)).toBe(N.fxo);expect(phase('fxo-transfer').path).not.toContain(N.operator);expect(phase('fxo-fxs-ring').path).toEqual([N.fxo,{301:N.analog301,302:N.analog302,303:N.analog}[target]]);
  const bridge=phase('fxo-bridge');expect(bridge.audio.incoming).not.toContain(N.vera);expect(bridge.audio.incoming).toContain(N.fxo);expect(bridge.audio.incoming.at(-1)).toBe({301:N.analog301,302:N.analog302,303:N.analog}[target]);
  expect(phase('fxo-line-bye').path).toEqual([...phase('fxo-invite').path].reverse());expect(s.phases.at(-1).final).toBe(true);expect(s.phases.at(-1).audio).toBeUndefined();
  for(const p of s.phases){
   for(const route of [p.path,p.audio?.incoming||[],p.audio?.outgoing||[]]){for(const id of route)expect(top.nodeIds).toContain(id);for(let i=1;i<route.length;i++)expect(top.connections.some(w=>w.a===route[i-1]&&w.b===route[i]||w.b===route[i-1]&&w.a===route[i])).toBe(true);}
   expect(detailFor(s,p).code).toBe(p.code);for(const lang of ['tr','en']){expect(setupHints(s,p,lang).items.length).toBeGreaterThan(0);expect(localizePhase(p,s,lang).title).toBeTruthy();if(lang==='en'){const d=localizeDetail(detailFor(s,p),s,p,lang,id=>s.labels.en[id]||translate(nodeLabel(id,s.id),lang));expect(d.route+d.code).not.toMatch(/[çğıöşüÇĞİÖŞÜ]/);}}
   if(p.type==='sip'){const [head,body]=p.code.split('\r\n\r\n');expect(Number(head.match(/Content-Length: (\d+)/)[1])).toBe(new TextEncoder().encode(body).length);}
  }
  for(const lang of ['tr','en']){const model=sequenceModel(s,lang);expect(sequenceSource(model,lang)).not.toMatch(/Pundefined|Note over/);for(const e of model.blocks.flatMap(b=>b.groups.flatMap(g=>g.events)).filter(e=>e.kind==='sip'))expect([e.from,e.to]).not.toContain(N.vpn);}
 }
});
