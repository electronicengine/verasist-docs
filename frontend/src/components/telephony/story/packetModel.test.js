import {TextEncoder} from 'util';
import {scenarioFor, detailFor} from './scenarios';
import {buildPacketModel} from './packetModel';
import {explainField} from './packetFields';
import {localizeDetail} from './english';
global.TextEncoder=TextEncoder;
const make=(story,phase)=>buildPacketModel(detailFor(story,phase),phase,'tr');
test('REGISTER is control data, authentication parameters stay separate and no SDP is invented',()=>{
  const story=scenarioFor('direct'),phase=story.phases.find(p=>p.message==='REGISTER + Authorization');
  const model=make(story,phase);
  expect(model.kind).toBe('sip');
  expect(model.layers.map(l=>l.id)).toEqual(['sip-start','sip-headers','sip-auth']);
  expect(model.layers.find(l=>l.id==='sip-auth').fields.find(f=>f.name==='username').value).toBe('office-a-201');
  const seq=model.layers.find(l=>l.id==='sip-headers').fields.find(f=>f.name==='CSeq');
  expect(seq.value).toBe('2 REGISTER');expect(explainField(seq,'en')).toContain('REGISTER');expect(model.empty).toBe(true);
});
test('INVITE exposes original headers and the SDP media address/port without treating them as IP headers',()=>{
  const story=scenarioFor('pbx'),phase=story.phases[1],model=make(story,phase);
  const sdp=model.layers.find(l=>l.id==='sdp');expect(sdp.fields.find(f=>f.name==='m=').value).toBe('audio 10000 RTP/AVP 0');
  expect(sdp.fields.find(f=>f.name==='a=').info).toBe('sdp-rtpmap');
  expect(model.layers.find(l=>l.id==='sip-headers').fields.find(f=>f.name==='Call-ID').value).toContain('office-leg');
  expect(model.layers.some(l=>l.id==='ip-header')).toBe(false);
});
test('NOTIFY outer CSeq and inner SIPfrag result are different fields',()=>{
  const story=scenarioFor('extension'),phase=story.phases.find(p=>p.message.startsWith('NOTIFY')),model=make(story,phase);
  expect(model.layers.find(l=>l.id==='sip-headers').fields.find(f=>f.name==='CSeq').value).toBe('2 NOTIFY');
  const result=model.layers.find(l=>l.id==='sipfrag').fields[0];expect(result.value).toBe('200 OK');
  expect(explainField(result,'en')).toContain('not the response to NOTIFY');
});
test('RTP sequence/timestamp and WebSocket raw audio are represented without invented frame headers',()=>{
  const story=scenarioFor('mechanism');
  const rtpStory=scenarioFor('pbx');const rtp=make(rtpStory,rtpStory.phases.at(-1));
  expect(rtp.kind).toBe('rtp');
  const conversation=scenarioFor('pbx');const speech=make(conversation,conversation.phases.at(-1));
  expect(speech.notes.join(' ')).toContain('ACK');
  expect(speech.layers.at(-1).fields.some(f=>f.value.includes('ACK'))).toBe(false);expect(rtp.layers[0].fields.find(f=>f.name==='Sequence').bits).toBe('16 bit');
  const ws=buildPacketModel({code:'WebSocket: binary raw audio\nPayload: PCMU / 8000 Hz'},{type:'engine',message:'Raw audio'},'tr');
  expect(ws.kind).toBe('websocket');expect(ws.layers.map(l=>l.id)).toEqual(['ws-message','ws-audio']);
  expect(ws.layers.flatMap(l=>l.fields).some(f=>f.info==='sequence')).toBe(false);
  const event=make(story,story.phases.find(p=>p.key==='platform-run'));
  expect(event.kind).toBe('event');expect(event.layers[0].fields.find(f=>f.name==='workflow_run_id').value).toBe('run-123');
});
test('analog examples have no SIP/RTP headers and every field has bilingual explanations',()=>{
  const story=scenarioFor('pbx','301'),phase=story.phases.find(p=>p.type==='analog');expect(make(story,phase).kind).toBe('analog');
  for(const id of ['pbx','registration','reception','extension','direct','mechanism']) {
    const s=scenarioFor(id,'301');
    for(const p of s.phases) for(const lang of ['tr','en']) {
      const detail=localizeDetail(detailFor(s,p),s,p,lang,id=>String(id));
      const model=buildPacketModel(detail,p,lang);
      expect(model.layers.length).toBeGreaterThan(0);
      for(const layer of model.layers) for(const f of layer.fields) {
        expect(explainField(f,lang).length).toBeGreaterThan(40);
        if(lang==='en') expect(explainField(f,lang)).not.toMatch(/[çğıöşüÇĞİÖŞÜ]/);
      }
    }
  }
});
