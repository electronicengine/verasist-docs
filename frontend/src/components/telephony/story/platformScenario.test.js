import {TextEncoder} from 'util';
import {scenarioFor,N,detailFor} from './scenarios';
import {localizePhase,localizeDetail} from './english';
import {setupHints} from './setupHints';
import {buildPacketModel} from './packetModel';
global.TextEncoder=TextEncoder;

test('platform resolution is tenant/config scoped and pins a definition; raw speech never traverses configuration records',()=>{
 for(const mode of ['pipeline','realtime','live']){
  const s=scenarioFor('mechanism','201','phones','sip','normal','fixed','mobile',mode),phase=key=>s.phases.find(p=>p.key===key);
  expect(s.network).toBeUndefined();expect(s.modelMode).toBe(mode);
  expect(s.topology.nodeKinds[N.speaker]).toBe('software-speaker');
  expect(new Set([N.org,N.phoneConfig,N.did,N.workflow,N.run].map(id=>s.topology.nodeKinds[id])).size).toBe(5);
  for(const id of [N.orgDb,N.configDb,N.numberDb])expect(s.topology.nodeKinds[id]).toBe('software-database');
  for(const id of s.topology.nodeIds)if(id!==N.vera)expect(s.topology.nodeKinds[id]).not.toMatch(/cloud|server|gateway/);
  expect(phase('platform-inbound').path).toEqual([N.speaker,N.vera]);
  expect(phase('platform-return').path).toEqual([N.output,N.vera,N.speaker]);
  for(const id of [N.pbx,N.switch,N.router,N.ata,N.analog,N.ip201,N.ip202])expect(s.topology.nodeIds).not.toContain(id);
  expect(phase('platform-config').code).toContain('config-7');expect(phase('platform-number').code).toContain('workflow-42');expect(phase('platform-run').code).toContain('definition-9');
  expect(JSON.parse(phase('platform-models').code).precedence).toEqual(['workflow model_configuration_v2_override','organization model configuration']);
  for(const p of s.phases){
   for(const route of [p.path,p.audio?.incoming||[],p.audio?.outgoing||[]])for(let i=0;i<route.length;i++){
    expect(s.topology.nodeIds).toContain(route[i]);if(i)expect(s.topology.connections.some(w=>(w.a===route[i-1]&&w.b===route[i])||(w.b===route[i-1]&&w.a===route[i]))).toBe(true);
   }
   for(const route of [p.audio?.incoming||[],p.audio?.outgoing||[]])for(const id of [N.org,N.phoneConfig,N.did,N.workflow,N.run,N.models,N.engine,N.aux,N.llm])expect(route).not.toContain(id);
   for(const lang of ['tr','en']){
    const localized=localizePhase(p,s,lang),detail=localizeDetail(detailFor(s,p),s,p,lang,id=>s.labels[lang][id]);
    expect(localized.title.length).toBeGreaterThan(5);expect(detail.code).toBe(p.code);expect(buildPacketModel(detail,p,lang).layers.length).toBeGreaterThan(0);expect(setupHints(s,p,lang).items.length).toBeGreaterThan(0);
    if(!p.setup)expect(setupHints(s,p,lang).items.flatMap(item=>[item.where,...item.steps]).join(' ')).not.toMatch(/\bSIP\b|\bACK\b|\bARI\b|\bPBX\b|bridge|trunk/);
   }
  }
  const conversation=phase('platform-conversation').audio;
  expect(conversation.incoming).toEqual(mode==='pipeline'?[N.speaker,N.vera,N.input,N.stt]:[N.speaker,N.vera,N.input,N.voice]);
  expect(conversation.outgoing).toEqual(mode==='pipeline'?[N.tts,N.output,N.vera,N.speaker]:[N.voice,N.output,N.vera,N.speaker]);
  if(mode==='pipeline')expect(phase('platform-text').path).toEqual([N.stt,N.llm]);else for(const id of [N.stt,N.tts])expect(s.topology.nodeIds).not.toContain(id);
  expect(s.phases.at(-1).audio).toBeUndefined();expect(s.phases.at(-1).final).toBe(true);
 }
});
