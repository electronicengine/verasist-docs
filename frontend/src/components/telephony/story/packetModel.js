import {pc} from './packetFields';
const SIP=/^(?:SIP\/2\.0\s+\d{3}|(?:INVITE|REGISTER|ACK|BYE|OPTIONS|CANCEL|REFER|NOTIFY)\s+\S+\s+SIP\/2\.0)/;
const authNames=new Set(['authorization','proxy-authorization','www-authenticate','proxy-authenticate']);
const ref={sip:'https://datatracker.ietf.org/doc/html/rfc3261',rtp:'https://www.rfc-editor.org/rfc/rfc3550.html',sdp:'https://www.rfc-editor.org/rfc/rfc8866.html',ws:'https://www.rfc-editor.org/rfc/rfc6455.html'};
const field=(name,value,info,extra={})=>({name,value:String(value),info:info || name.toLowerCase(),...extra});
const lines=text=>text.split(/\r?\n/).filter(line=>line.trim());
function entries(text, lang, info) {
  return lines(text).map((line,i)=>{
    const colon=line.indexOf(':');
    return colon>0 ? field(line.slice(0,colon).trim(),line.slice(colon+1).trim(),info) : field(`${pc('step',lang)} ${i+1}`,line,info || 'config');
  });
}
function sdpFields(body) {
  return lines(body).map(line=>{
    const m=line.match(/^([a-z])=(.*)$/);
    if(!m) return field('SDP',line,'config');
    const [,name,value]=m;
    let info='sdp-'+name;
    if(name==='a') info=value.startsWith('rtpmap:')?'sdp-rtpmap':/^(sendrecv|sendonly|recvonly|inactive)$/.test(value)?'sdp-direction':'sdp-attribute';
    return field(name+'=',value,info,{separator:'',reference:ref.sdp});
  });
}
function jsonFields(obj,prefix='') {
  return Object.entries(obj).flatMap(([key,value])=>{
    const name=prefix?`${prefix}.${key}`:key;
    if(value && !Array.isArray(value) && typeof value==='object') return jsonFields(value,name);
    return [field(name,typeof value==='object'?JSON.stringify(value):value,name)];
  });
}
export function buildPacketModel(detail, phase, lang='tr') {
  const code=String(detail.code || '').trim();
  const layer=(id,copyKey,tone,fields,reference)=>({id,title:pc(copyKey,lang),tone,fields,reference});
  if(phase.type==='analog') return {kind:'analog',layers:[layer('analog','analog','amber',entries(code,lang,'analog'))]};
  if(phase.type==='access' || phase.type==='guide') return {kind:'access',layers:[layer('access','access','neutral',entries(code,lang,'config'))]};
  if(SIP.test(code)) {
    const parts=code.split(/\r?\n\r?\n/), head=parts.shift(), body=parts.join('\n\n');
    const rows=head.split(/\r?\n/), first=rows.shift();
    const response=first.match(/^(SIP\/2\.0)\s+(\d{3})\s*(.*)$/);
    const start=response ? [field(pc('version',lang),response[1],'version'),field(pc('status',lang),response[2],'status'),field(pc('reason',lang),response[3],'reason')] : (()=>{const [method,uri,version]=first.split(/\s+/);return [field(pc('method',lang),method,'method'),field(pc('uri',lang),uri,'uri'),field(pc('version',lang),version,'version')];})();
    const headers=[];
    for(const row of rows) {
      if(/^\s/.test(row) && headers.length) {headers.at(-1).value+=' '+row.trim();continue;}
      const colon=row.indexOf(':');if(colon>0) headers.push(field(row.slice(0,colon),row.slice(colon+1).trim(),row.slice(0,colon).toLowerCase()==='proxy-authorization'?'authorization':row.slice(0,colon).toLowerCase()==='proxy-authenticate'?'www-authenticate':undefined));
    }
    const auth=headers.filter(f=>authNames.has(f.name.toLowerCase()));
    const regular=headers.filter(f=>!authNames.has(f.name.toLowerCase()));
    const layers=[layer('sip-start','start','blue',start,ref.sip),layer('sip-headers','headers','violet',regular,ref.sip)];
    if(auth.length) {
      const authFields=auth.flatMap(f=>{
        const params=[...f.value.matchAll(/([\w-]+)=(?:"([^"]*)"|([^,\s]+))/g)].map(m=>field(m[1],m[2]??m[3],m[1].toLowerCase()));
        return [f,...params];
      });
      layers.push(layer('sip-auth','auth','amber',authFields,ref.sip));
    }
    const contentType=headers.find(f=>f.name.toLowerCase()==='content-type')?.value || '';
    if(body) layers.push(contentType.includes('application/sdp') || /^v=0/.test(body) ? layer('sdp','body','teal',sdpFields(body),ref.sdp) : contentType.includes('message/sipfrag') ? layer('sipfrag','fragment','teal',[field('SIP/2.0',body.trim().replace(/^SIP\/2\.0\s*/,''),'inner-status')],ref.sip) : layer('body','bodyOther','teal',entries(body,lang,'config')));
    return {kind:'sip',layers,empty:!body};
  }
  if(/^RTP v\d/.test(code)) {
    const version=code.match(/^RTP v(\d+)/)?.[1],pt=code.match(/PT=(\d+)/)?.[1];
    const fields=[];
    if(version) fields.push(field(pc('version',lang),version,'rtp-version',{bits:'2 bit'}));
    if(pt) fields.push(field('PT',pt,'pt',{bits:'7 bit'}));
    const payload=[],notes=[];
    for(const line of lines(code).slice(1)) {
      const m=line.match(/^(Sequence|Timestamp|SSRC):\s*(.*)$/i);
      if(m) fields.push(field(m[1],m[2],m[1].toLowerCase(),{bits:m[1].toLowerCase()==='sequence'?'16 bit':'32 bit'}));
      else if (/\bACK\b/.test(line)) notes.push(line);
      else payload.push(field(pc('step',lang),line,'payload'));
    }
    return {kind:'rtp',notes,layers:[layer('rtp-header','rtp','blue',fields,ref.rtp),layer('rtp-payload','payload','teal',payload,ref.rtp)]};
  }
  // JSON events are control data, not audio frames, even though both can use WebSocket.
  if(code.startsWith('{')) {
    let obj,rest='';
    try {obj=JSON.parse(code);} catch {try {const [first,...tail]=code.split('\n');obj=JSON.parse(first);rest=tail.join('\n');} catch { /* Some examples are abbreviated operations. */ }}
    if(obj && typeof obj==='object') {
      const layers=[layer('event','event','violet',jsonFields(obj))];
      if(rest) layers.push(layer('event-note','concept','neutral',entries(rest,lang,'config')));
      return {kind:'event',layers};
    }
  }
  if(!phase.audio && /^(ARI|Bridge)/.test(phase.message)) return {kind:'concept',layers:[layer('operation','concept','neutral',entries(code,lang,'config'))]};
  if(/WebSocket.*(?:binary|raw)|binary.*(?:WebSocket|raw)/is.test(code)) {
    return {kind:'websocket',layers:[layer('ws-message','ws','blue',[field(lang==='en'?'Message type':'Mesaj türü','binary','ws-type')],ref.ws),layer('ws-audio','raw','teal',entries(code,lang,'raw-audio').filter(f=>f.name.toLowerCase()!=='websocket').map(f=>({...f,info:/size|boyu|boyut/i.test(f.name)?'ws-size':f.info})),ref.ws)]};
  }
  return {kind:'concept',layers:[layer('operation','concept','neutral',entries(code,lang,'config'))]};
}
