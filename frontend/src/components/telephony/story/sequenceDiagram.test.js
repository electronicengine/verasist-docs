import {TextEncoder} from 'util';
import {scenarioFor,tabs,N} from './scenarios';
import {sequenceModel,sequenceSource,mermaidText} from './sequenceDiagram';
global.TextEncoder=TextEncoder;
const allEvents=model=>model.blocks.flatMap(b=>b.groups.flatMap(g=>g.events));

test('every scenario/mode has matching numbered messages, valid participants and both audio directions',()=>{
 const cases=tabs.flatMap(t=>[scenarioFor(t.id),...(t.id==='direct'?[scenarioFor(t.id,'201','phones','forward')]:[]),...(t.id==='registration'?[scenarioFor(t.id,'201','pbx')]:[]),...(t.id==='pbx'?[scenarioFor(t.id,'301','phones','sip','sip-number'),scenarioFor(t.id,'301')]:[]),...(t.id==='mechanism'?['realtime','live'].map(m=>scenarioFor(t.id,'201','phones','sip','normal','fixed','mobile',m)):[])]);
 for(const s of cases)for(const lang of ['tr','en']){
  const model=sequenceModel(s,lang),ids=model.participants.map(p=>p.id),source=sequenceSource(model,lang);
  expect(model.blocks.length).toBe(s.phases.length);expect(source.startsWith('sequenceDiagram')).toBe(true);expect(source).not.toMatch(/Pundefined|Pnull/);
  for(const event of allEvents(model)){
   expect(ids).toContain(event.from);expect(ids).toContain(event.to);
   if(event.kind==='sip'){expect([N.router,N.switch]).not.toContain(event.from);expect([N.router,N.switch]).not.toContain(event.to);}
  }
  for(let i=0;i<s.phases.length;i++){
   const selected=sequenceModel(s,lang,i);expect(selected.blocks).toHaveLength(i+1);expect(selected.blocks.at(-1).index).toBe(i);
   const audio=allEvents({...selected,blocks:[selected.blocks.at(-1)]}).filter(e=>e.kind==='audio'),p=s.phases[i];
   expect(audio.length).toBe(Math.max(0,(p.audio?.incoming.length||0)-1)+Math.max(0,(p.audio?.outgoing.length||0)-1));
  }
 }
});
test('SIP responses retain their CSeq method, and routers are only a transport note for signaling',()=>{
 const s=scenarioFor('direct'),i=s.phases.findIndex(p=>p.message==='200 OK · REGISTER');
 const model=sequenceModel(s,'en',i),events=allEvents(model);
 expect(events.some(e=>e.kind==='sip'&&e.label==='200 OK (REGISTER)'&&e.response)).toBe(true);
 expect(model.blocks.at(-1).transportNote).toMatch(/NAT/);
 const raw=sequenceSource(model,'en');expect(raw).toContain('->>');expect(raw).not.toMatch(/-->>|-\)/);
});
test('public/mobile and inter-carrier paths do not pretend handsets or public access send SIP packets',()=>{
 for(const s of [scenarioFor('public-line'),scenarioFor('public-line','201','phones','sip','normal','fixed','fixed'),scenarioFor('direct','201','phones','forward')]){
  for(const e of allEvents(sequenceModel(s,'en')))if(e.kind==='sip'){
   expect([e.from,e.to]).not.toContain(N.staffMobile);expect([e.from,e.to]).not.toContain(N.staffFixed);
   expect([e.from,e.to].sort()).not.toEqual([N.operator,N.provider].sort());
  }
 }
});
test('platform transcript/context is distinct from audio, and parallel control/audio is explicit',()=>{
 const s=scenarioFor('mechanism'),i=s.phases.findIndex(p=>p.key==='platform-text'),m=sequenceModel(s,'en',i);
 expect(allEvents(m).some(e=>e.kind==='context'&&e.from===N.stt&&e.to===N.llm)).toBe(true);
 expect(allEvents(m).filter(e=>e.kind==='audio').some(e=>[N.org,N.llm,N.workflow].includes(e.to))).toBe(false);
 expect(sequenceSource(m,'en')).toContain('par Control / data');expect(sequenceSource(m,'en')).toContain('and Incoming audio');
});
test('Mermaid labels cannot inject new statements or raw markup',()=>{
 const text=mermaidText('A;\nparticipant Fake<script>"&#');
 expect(text).not.toMatch(/[\r\n<>"&]/);expect(text).toContain('#59;');expect(text).not.toContain('\nparticipant');
});

test('message diagrams omit step panels and show tenant lookup request and response arrows',()=>{
 const s=scenarioFor('mechanism'),source=sequenceSource(sequenceModel(s,'en',3),'en',3);
 expect(source).not.toContain('Note over');expect(source).toContain('Query: tenant');expect(source).toContain('Matching record');
 expect(source).toContain(`P${N.org}->>P${N.orgDb}`);expect(source).toContain(`P${N.orgDb}->>P${N.org}`);
});
