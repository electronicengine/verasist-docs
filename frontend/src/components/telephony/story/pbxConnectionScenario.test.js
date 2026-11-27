import {TextEncoder} from 'util';
import {scenarioFor,N,tabs,detailFor,nodeLabel} from './scenarios';
import {sequenceModel,sequenceSource} from './sequenceDiagram';
import {localizePhase,localizeDetail,translate} from './english';
import {setupHints} from './setupHints';
global.TextEncoder=TextEncoder;
const story=(mode,target='201',location='cloud')=>scenarioFor('pbx',target,'phones','sip',mode,'fixed','mobile','pipeline',location);
test('PBX now offers five models and retired tabs are no longer exposed',()=>{
 expect(tabs.map(t=>t.id)).toEqual(['mechanism','public-line','pbx','direct']);
 for(const mode of ['local-sip','remote-sip','vpn-sip','ari','sip-number'])for(const target of ['201','202','301'])for(const location of mode==='ari'?['local','cloud']:['cloud']){
  const s=story(mode,target,location),ids=s.topology.nodeIds;
  expect(ids).toEqual(expect.arrayContaining([N.pbx,N.ip201,N.ip202,N.ata,N.analog,N.vera]));
  for(const p of s.phases){for(const route of [p.path,p.audio?.incoming||[],p.audio?.outgoing||[]])for(const id of route)expect(ids).toContain(id);
   for(const route of [p.path,p.audio?.incoming||[],p.audio?.outgoing||[]])for(let i=1;i<route.length;i++)expect(s.topology.connections.some(w=>w.a===route[i-1]&&w.b===route[i]||w.b===route[i-1]&&w.a===route[i])).toBe(true);
   for(const lang of ['tr','en']){expect(setupHints(s,p,lang).items.length).toBeGreaterThan(0);expect(localizePhase(p,s,lang).title).toBeTruthy();if(lang==='en'){const d=localizeDetail(detailFor(s,p),s,p,lang,id=>s.labels?.en?.[id]||translate(nodeLabel(id,s.id),lang));expect(d.route+d.code).not.toMatch(/[çğıöşüÇĞİÖŞÜ]/);}}
  }
  for(const lang of ['tr','en']){const model=sequenceModel(s,lang,5);expect(model.blocks).toHaveLength(6);expect(sequenceSource(model,lang)).not.toMatch(/Pundefined|Note over/);}
 }
});
test('local SIP keeps PBX-to-Verasist traffic on LAN, remote uses NAT and VPN uses a visible tunnel',()=>{
 const local=story('local-sip'),remote=story('remote-sip'),vpn=story('vpn-sip');
 expect(local.phases.find(p=>p.key==='pbx-agent-invite').path).toEqual([N.pbx,N.switch,N.control]);
 expect(remote.phases.find(p=>p.key==='pbx-agent-invite').path).toEqual([N.pbx,N.switch,N.router,N.control]);
 expect(vpn.phases.find(p=>p.key==='pbx-agent-invite').path).toEqual([N.pbx,N.switch,N.router,N.vpn,N.control]);
 expect(vpn.topology.connections.filter(w=>w.type==='vpn')).toHaveLength(2);
 expect(remote.phases[1].setup.tr[0].steps.join(' ')).toContain('CGNAT');
 for(const s of [local,remote,vpn]){
  const transfer=s.phases.find(p=>p.key==='pbx-transfer');expect(transfer.code).toMatch(/^INVITE sip:201@/);expect(transfer.path.at(-1)).toBe(N.pbx);
  const media=s.phases.find(p=>p.key==='pbx-bridge').audio.incoming;expect(media).toContain(N.control);expect(media).not.toContain(N.vera);
 }
});
test('direct ARI manages office Asterisk without our Asterisk and stops cloud media after staff answer',()=>{
 for(const location of ['local','cloud']){
  const s=story('ari','301',location);expect(s.topology.nodeIds).not.toContain(N.control);
  expect(s.phases.find(p=>p.key==='pbx-stasis').code).toContain('StasisStart');
  expect(s.phases.find(p=>p.key==='pbx-transfer').code).toContain('Local/301@from-internal');
  const bridge=s.phases.find(p=>p.key==='pbx-bridge');expect(bridge.audio.incoming).not.toContain(N.vera);expect(bridge.audio.incoming.at(-1)).toBe(N.analog);
  expect(s.phases.find(p=>p.key==='pbx-analog').path).toEqual([N.ata,N.analog]);
 }
 expect(story('ari').phases[1].setup.en[0].steps.join(' ')).toContain('outbound SIP REGISTER does not provide ARI access');
});

test('ARI control and media have distinct animated lanes and the bridge owner differs from SIP',()=>{
 for(const location of ['local','cloud']){
  const s=story('ari','201',location),control=s.phases.find(p=>p.key==='pbx-stasis'),media=s.phases.find(p=>p.key==='pbx-ai-audio');
  expect(control.path).toContain(N.ariControl);expect(control.path).not.toContain(N.ariMedia);
  expect(media.audio.incoming).toContain(N.ariMedia);expect(media.audio.incoming).not.toContain(N.ariControl);
  expect(s.topology.connections.filter(w=>w.type==='ari-media')).toHaveLength(2);expect(s.topology.connections.filter(w=>w.type==='control')).toHaveLength(2);
  const staff=s.phases.find(p=>p.key==='pbx-bridge');expect(staff.bridgeAt).toBe(N.pbx);expect(staff.agentDetached).toBe(true);expect(staff.audio.incoming).not.toContain(N.ariMedia);
  const events=sequenceModel(s,'en').blocks.flatMap(b=>b.groups.flatMap(g=>g.events));for(const e of events.filter(e=>e.kind==='context'))expect([e.from,e.to]).not.toContain(N.ariControl);
 }
 const sip=story('remote-sip'),staff=sip.phases.find(p=>p.key==='pbx-bridge');expect(staff.bridgeAt).toBe(N.control);expect(staff.audio.incoming).toContain(N.control);expect(sip.topology.nodeIds).not.toContain(N.ariMedia);
});
