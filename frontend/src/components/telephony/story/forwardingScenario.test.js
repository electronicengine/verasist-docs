import {TextEncoder} from 'util';
import {scenarioFor,N,nodes,detailFor} from './scenarios';
import {localizePhase,translate} from './english';
import {setupHints} from './setupHints';
global.TextEncoder=TextEncoder;
test('number forwarding keeps inter-carrier access separate from SIP and phone registration',()=>{
  const s=scenarioFor('direct','201','phones','forward');
  expect(s.directMode).toBe('forward');expect(s.phases.slice(0,14)).toEqual(scenarioFor('direct').phases.slice(0,14));
  const topology=s.topology.stages.verasist;
  expect(topology.nodeIds).toContain(N.provider);
  expect(topology.nodeIds).toEqual(expect.arrayContaining([N.ip201,N.ip202]));
  expect(new Set(topology.nodeIds).size).toBe(topology.nodeIds.length);
  expect(topology.nodeIds).not.toContain(N.pbx);expect(topology.nodeIds).not.toContain(N.ai);expect(topology.nodeIds).not.toContain(N.media);
  expect(topology.connections.find(w=>w.a===N.operator && w.b===N.provider).type).toBe('access');
  expect(topology.connections.some(w=>w.a===N.operator && w.b===N.vera)).toBe(false);
  const pick=k=>s.phases.find(p=>p.key===k);
  expect(pick('forward-greet').audio.incoming).toEqual([N.caller,N.operator,N.provider,N.vera]);
  expect(pick('forward-bridge').audio.incoming).toEqual([N.caller,N.operator,N.provider,N.vera,N.provider,N.operator,N.router,N.switch,N.ip202]);
  expect(pick('forward-bridge').audio.outgoing).toEqual([...pick('forward-bridge').audio.incoming].reverse());
  expect(pick('forward-ring').audio.incoming).not.toContain(N.ip202);
  expect(pick('forward-ring').path).toEqual([N.operator,N.router,N.switch,N.ip202]);
  expect(pick('forward-ring').code).toContain('office-a-202@198.51.100.24:62002');
  expect(pick('forward-bridge').audio.incoming).not.toContain(N.ip201);
  expect(pick('forward-dial').code).toContain('12025550201');
  expect(pick('forward-invite').code).toContain('12025550301');
  expect(pick('forward-ack').message).toMatch(/^ACK/);expect(pick('forward-staff-ack').message).toMatch(/^ACK/);
  for(const p of s.phases) {
    const visible=s.topology.stages[p.stage].nodeIds;
    for(const id of [...p.path,...(p.audio?.incoming||[]),...(p.audio?.outgoing||[])]) {expect(nodes[id]).toBeDefined();expect(visible).toContain(id);}
    expect(localizePhase(p,s,'en').text).not.toMatch(/[çğıöşüÇĞİÖŞÜ]/);
    expect(setupHints(s,p,'en').items.length).toBeGreaterThan(0);
    expect(detailFor(s,p).code).toBeTruthy();
  }
  expect(translate('Kurum operatörü · A','en')).toBe('Office carrier · A');
  expect(setupHints(s,pick('forward-route'),'en').items[0].steps.join(' ')).toContain('unconditional');
});
