import { TextEncoder } from 'util';
import { scenarioFor, N, detailFor } from './scenarios';
global.TextEncoder = TextEncoder;

test('normal PBX media connects caller to the selected extension without Verasist', () => {
  for (const target of ['201', '202', '301']) {
    const scenario = scenarioFor('pbx', target), final = scenario.phases.at(-1);
    expect(final.audio.incoming[0]).toBe(N.caller);
    expect(final.audio.incoming.at(-1)).toBe(scenario.target.node);
    expect(final.audio.incoming).not.toContain(N.vera);
    expect(final.audio.outgoing).toEqual([...final.audio.incoming].reverse());
  }
});
test('AI reception speaks first, then holds caller until the human answers', () => {
  const scenario = scenarioFor('reception');
  const greet = scenario.phases.find(phase => phase.title === 'YZ ilk karşılamayı yapar');
  expect(greet.audio.outgoing).toEqual([N.vera, N.router, N.switch, N.pbx, N.switch, N.router, N.operator, N.caller]);
  expect(greet.audio.incoming).toEqual([]);
  const ringing = scenario.phases.find(phase => phase.message === '180 Ringing');
  expect(ringing.audio.incoming.at(-1)).toBe(N.vera);
  expect(ringing.audio.incoming).not.toContain(N.ip201);
  const final = scenario.phases.at(-1);
  expect(final.audio.incoming).toEqual([N.caller, N.operator, N.router, N.switch, N.pbx, N.switch, N.router, N.vera, N.router, N.switch, N.pbx, N.switch, N.ip201]);
});
test('analog setup carries SIP to ATA and electrical ringing/off-hook to the phone', () => {
  const scenario = scenarioFor('reception', '301');
  const request = scenario.phases.find(phase => phase.message === 'INVITE · 301');
  expect(request.path.at(-1)).toBe(N.ata);
  const ringing = scenario.phases.find(phase => phase.message === 'Analog zil sinyali');
  expect(ringing.path).toEqual([N.ata, N.analog]);
  expect(ringing.type).toBe('analog');
});
test('extension 700 transfer separates REFER acceptance, target answer, NOTIFY and BYE', () => {
  const scenario = scenarioFor('extension');
  const refer = scenario.phases.find(phase => phase.message.startsWith('REFER'));
  expect(detailFor(scenario, refer).code).toContain('Refer-To: <sip:700@pbx.example.invalid>');
  const accepted = scenario.phases.find(phase => phase.message.startsWith('202'));
  expect(detailFor(scenario, accepted).code).toContain('CSeq: 1 REFER');
  const notify = scenario.phases.find(phase => phase.message.startsWith('NOTIFY'));
  expect(detailFor(scenario, notify).code).toContain('Content-Type: message/sipfrag;version=2.0');
  const notifyReply = scenario.phases.find(phase => phase.message === '200 OK · NOTIFY cevabı');
  expect(detailFor(scenario, notifyReply).code).toContain('CSeq: 2 NOTIFY');
  expect(scenario.phases.at(-1).audio.incoming).toEqual([N.caller, N.operator, N.router, N.switch, N.pbx, N.switch, N.router, N.vera]);
  expect(scenario.phases.at(-1).audio.incoming).not.toContain(N.ip201);
});
test('SIP sample body length matches encoded bytes and all stories end with continuous media', () => {
  for (const id of ['pbx', 'reception', 'extension']) {
    const scenario = scenarioFor(id);
    expect(scenario.phases.at(-1).final).toBe(true);
    expect(scenario.phases.at(-1).type).toBe('media');
    for (const phase of scenario.phases.filter(phase => phase.type === 'sip')) {
      const [headers, body] = detailFor(scenario, phase).code.split('\r\n\r\n');
      expect(Number(headers.match(/Content-Length: (\d+)/)[1])).toBe(new TextEncoder().encode(body).length);
    }
  }
});


test('phone registrations terminate at the provisioned institutional registrar and never start RTP', () => {
  const story = scenarioFor('registration', '201', 'phones');
  const request = story.phases.find(p => p.message === 'REGISTER · 201');
  expect(request.path).toEqual([N.ip201, N.switch, N.router, N.pbx]);
  expect(story.phases.every(p => !p.audio)).toBe(true);
  expect(story.phases.map(p => p.text).join(' ')).toContain('mevcut bulut trunk ekranı bu hesapları açmaz');
  expect(story.phases.filter(p => p.message.includes('401'))).toHaveLength(1);
  expect(story.phases.some(p => p.message.includes('ACK'))).toBe(false);
});
test('current trunk REGISTER is outbound from Verasist, distinct from inbound IP matching', () => {
  const story = scenarioFor('registration', '201', 'pbx');
  const request = story.phases.find(p => p.message === 'REGISTER · Verasist → santral');
  expect(request.path).toEqual([N.vera, N.router, N.switch, N.pbx]);
  expect(story.phases.find(p => p.message.startsWith('200 OK')).path).toEqual([N.pbx, N.switch, N.router, N.vera]);
  expect(story.phases.every(p => !p.audio)).toBe(true);
  expect(detailFor(story, request).code).toContain('CSeq: 1 REGISTER');
  expect(story.phases.map(p => p.text).join(' ')).toContain('yalnızca register seçeneğini açmak yeterli değildir');
});


test('operator-only phone call comes first; Verasist is added later without changing phone registration', () => {
  const story=scenarioFor('direct'),stages=story.topology.stages;
  expect(stages.operator.nodeIds).toEqual([N.caller,N.operator,N.switch,N.ip201,N.ip202,N.router]);
  expect(stages.verasist.nodeIds).toEqual([...stages.operator.nodeIds.filter(id=>id!==N.router),N.vera,N.router]);
  for(const stage of Object.values(stages)) {
    expect(stage.nodeIds).not.toContain(N.pbx);expect(stage.nodeIds).not.toContain(N.ai);expect(stage.nodeIds).not.toContain(N.media);
    expect(stage.connections.some(c=>c.a===N.operator&&c.b===N.router)).toBe(true);
  }
  const transition=story.phases.findIndex(p=>p.stage==='verasist');expect(transition).toBe(14);
  for(const p of story.phases.slice(0,transition)) {expect(p.path).not.toContain(N.vera);expect(p.audio?.incoming||[]).not.toContain(N.vera);}
  const reg=story.phases.find(p=>p.message==='REGISTER + Authorization');
  expect(reg.path).toEqual([N.ip201,N.switch,N.router,N.operator]);expect(reg.audio).toBeUndefined();
  expect(reg.code).toContain('REGISTER sip:operator.example.invalid');
  const before=story.phases[11];expect(before.audio.incoming).toEqual([N.caller,N.operator,N.router,N.switch,N.ip201]);
  expect(before.audio.outgoing).toEqual([...before.audio.incoming].reverse());
  const ringing=story.phases[24];expect(ringing.audio.incoming).toEqual([N.caller,N.operator,N.vera]);
  expect(ringing.audio.incoming).not.toContain(N.ip201);
  const after=story.phases[27];expect(after.audio.incoming).toEqual([N.caller,N.operator,N.vera,N.operator,N.router,N.switch,N.ip202]);
  expect(after.audio.incoming).not.toContain(N.ip201);
  expect(story.phases[23].path).toEqual([N.operator,N.router,N.switch,N.ip202]);
  expect(story.phases[23].code).toContain('office-a-202@198.51.100.24:62002');
  expect(story.phases[23].code).not.toContain('office-a-201');
  expect(after.audio.outgoing).toEqual([...after.audio.incoming].reverse());
  expect(story.phases[22].code).toContain('INVITE sip:12025550201@operator.example.invalid');
  expect(story.phases[22].code).not.toContain('INVITE sip:12025550101');
  expect(story.phases.at(-1).final).toBe(true);expect(story.phases.at(-1).audio).toBeUndefined();
});
