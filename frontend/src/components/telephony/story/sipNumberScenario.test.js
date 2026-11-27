import {TextEncoder} from 'util';
import {scenarioFor,N,detailFor} from './scenarios';
import {localizePhase,localizeDetail} from './english';
import {setupHints} from './setupHints';
global.TextEncoder=TextEncoder;

test('direct DID reception keeps PBX out of AI audio and bridges staff only after answer',()=>{
 for(const destination of ['201','202','301']){
  const s=scenarioFor('pbx',destination,'phones','sip','sip-number');
  const phase=key=>s.phases.find(p=>p.key===key);
  expect(s.topology.nodeIds).toEqual(expect.arrayContaining([N.ip201,N.ip202,N.ata,N.analog,N.vera]));
  expect(phase('number-conversation').audio.incoming).toEqual([N.caller,N.operator,N.provider,N.vera]);
  expect(phase('number-forward-config').path).toEqual([N.operator,N.forwardingRule]);expect(phase('number-forward-lookup').path).toEqual([N.operator,N.forwardingRule,N.operator]);expect(phase('number-forward-lookup').code).toContain('Deliver to office PBX: no');
  expect(phase('number-call').path).toEqual([N.caller,N.operator]);expect(phase('number-forward').path).toEqual([N.operator,N.provider]);
  expect(phase('number-trunk').code).toContain('+12025550101 → +12025550301');
  const answer=s.phases.findIndex(p=>p.key==='number-staff-answer');
  for(const p of s.phases.slice(0,answer+1)) if(p.audio) expect(p.audio.incoming).not.toContain(s.target.node);
  expect(phase('number-bridge').audio.incoming).toEqual([N.caller,N.operator,N.provider,N.vera,N.provider,N.operator,N.router,N.switch,N.pbx,...s.target.tail]);
  expect(phase('number-bridge').audio.outgoing).toEqual([...phase('number-bridge').audio.incoming].reverse());
  expect(phase('number-dial-staff').code).toContain('INVITE sip:'+({201:'+12025550201',202:'+12025550202',301:'+12025550311'}[destination])+'@');
  expect(phase('number-invite').code).toMatch(/^INVITE sip:\+12025550301@/);
  if(destination==='301')for(const p of s.phases.filter(p=>p.type==='analog')) expect(p.path.every(n=>[N.ata,N.analog].includes(n))).toBe(true);
  for(const p of s.phases){
   expect(setupHints(s,p,'en').items.length).toBeGreaterThan(0);
   expect(localizePhase(p,s,'en').title).toBe(p.en[0]);
   const detail=localizeDetail(detailFor(s,p),s,p,'en',String);
   expect(detail.code).toBeTruthy();
   if(p.type==='trunk-number')expect(detail.code).toBe(p.code);
   if(/^SIP\/2.0|^(INVITE|ACK|BYE) sip:/.test(p.code)){
    const [head,body]=p.code.split('\r\n\r\n');
    expect(Number(head.match(/Content-Length: (\d+)/)[1])).toBe(new TextEncoder().encode(body).length);
   }
  }
  expect(phase('number-invite').code.match(/Call-ID: ([^\r]+)/)[1]).not.toBe(phase('number-dial-staff').code.match(/Call-ID: ([^\r]+)/)[1]);
  expect(phase('number-customer-bye').code).toContain('CSeq: 2 BYE');
  expect(phase('number-finished').audio).toBeUndefined();
 }
});
