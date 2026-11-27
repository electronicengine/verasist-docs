import {N,detailFor,nodeLabel} from './scenarios';
import {localizePhase,translate} from './english';

// Mermaid text entities prevent labels from introducing diagram statements/HTML.
export const mermaidText=value=>String(value).replace(/[&;#<>"\r\n]/g,char=>({'&':'#38;',';':'#59;','#':'#35;','<':'#60;','>':'#62;','"':'#quot;','\r':' ','\n':' '})[char]);
const same=(a,b)=>a.length===b.length&&a.every((n,i)=>n===b[i]);
const forwarder=id=>[N.switch,N.router,N.vpn,N.ariControl,N.ariMedia].includes(id);
const pathPairs=path=>path.slice(1).map((to,i)=>({from:path[i],to}));
function messageKind(scenario,phase,lang) {
 const en=lang==='en',code=detailFor(scenario,phase).code||'',line=code.split(/\r?\n/)[0];
 const request=line.match(/^(INVITE|REGISTER|ACK|BYE|REFER|NOTIFY|OPTIONS|CANCEL)\s+/),response=line.match(/^SIP\/2.0\s+(\d{3}\s+[^\r\n]+)/);
 if(request||response){
  const method=request?.[1]||code.match(/CSeq:\s*\d+\s+(\w+)/i)?.[1]||'';
  let label=response?`${response[1]} (${method})`:method;
  if(/Content-Type:\s*application\/sdp/i.test(code))label+=' + SDP';
  if(request&&/^Authorization:/im.test(code))label+=' + Authorization';
  const target=code.match(/^(?:INVITE|REFER)\s+sip:([^@\s]+)@/)?.[1]||code.match(/Refer-To:\s*<sip:([^@>]+)@/i)?.[1];
  if(target)label+=' / '+target;
  if(method==='NOTIFY'&&/message\/sipfrag/i.test(code))label+=' / refer result';
  return {kind:'sip',label,response:Boolean(response)};
 }
 if(phase.type==='platform'){
  let data;try{data=JSON.parse(code);}catch{}
  return {kind:'context',label:data?.frame||data?.input_frame||data?.operation||data?.event||(en?'Context / configuration':'Bağlam / yapılandırma')};
 }
 if(phase.type==='analog')return {kind:'analog',label:en?'Analog line signaling':phase.message};
 if(phase.type==='access'||/(?:call|network|ring|pickup)$/.test(phase.key||''))return {kind:'access',label:en?'Carrier call / line signaling':'Şebeke çağrısı / hat sinyali'};
 return {kind:'local',label:en?'Local processing / configuration':'Yerel işlem / yapılandırma'};
}
function audioProtocol(scenario,a,b,lang) {
 const en=lang==='en';if(scenario.id==='mechanism')return en?'Audio frames':'Ses frame’leri';
 const top=scenario.topology.stages?Object.values(scenario.topology.stages):[scenario.topology];
 const wire=top.flatMap(t=>t.connections).find(w=>(w.a===a&&w.b===b)||(w.a===b&&w.b===a));
 if(scenario.connectionModel==='ari'&&wire?.type==='analog')return en?'Analog audio / RJ11':'Analog ses / RJ11';
 if(wire?.type==='vpn')return 'RTP / VPN';
 if(wire?.type==='raw')return en?'Agent audio frames':'Ajan ses frame’leri';
 if(wire?.type==='analog')return en?'Analog audio / RJ11':'Analog ses / RJ11';
 if(wire?.type==='ari-media')return en?'Agent audio / WSS':'Ajan sesi / WSS';
 if(scenario.connectionModel==='ari')return en?'Carrier RTP / LAN media':'Operatör RTP / LAN medyası';
 if(wire?.type==='access')return en?'Carrier voice access':'Operatör ses erişimi';
 return 'RTP / UDP';
}
function signalLeg(scenario,path,pair,message,lang){
 if(message.kind!=='sip')return {...pair,...message};
 const start=path.indexOf(pair.from),end=path.indexOf(pair.to,start+1);
 const tops=scenario.topology.stages?Object.values(scenario.topology.stages):[scenario.topology];
 const wires=tops.flatMap(top=>top.connections),segment=path.slice(start,end+1);
 const kinds=pathPairs(segment).map(({from,to})=>wires.find(w=>(w.a===from&&w.b===to)||(w.b===from&&w.a===to))?.type);
 if(!kinds.some(kind=>['access','analog'].includes(kind)))return {...pair,...message};
 const en=lang==='en',kind=kinds.includes('analog')?'analog':'access';
 let label=en?'Carrier / line signaling':'Şebeke / hat sinyali';
 if(message.label.startsWith('INVITE'))label=en?'Carrier call request':'Şebeke çağrı isteği';
 if(message.label.startsWith('180'))label=en?'Network ringing status':'Şebekede çalma durumu';
 if(message.label.startsWith('200')&&message.label.includes('INVITE'))label=en?'Network answer supervision':'Şebekede cevaplanma bilgisi';
 if(message.label.includes('BYE'))label=en?'Network call release':'Şebekede çağrı kapanışı';
 return {...pair,kind,label,response:message.response};
}
export function sequenceModel(scenario,lang='tr',selectedStep=null) {
 const en=lang==='en',all=selectedStep===null;
 const label=id=>scenario.labels?.[lang]?.[id]||translate(nodeLabel(id,scenario.id,scenario.directMode),lang);
 const indices=all?scenario.phases.map((_,i)=>i):scenario.phases.map((_,i)=>i).slice(0,Math.max(0,Math.min(selectedStep,scenario.phases.length-1))+1);
 const blocks=indices.map(index=>{
  const raw=scenario.phases[index],phase=localizePhase(raw,scenario,lang),message=messageKind(scenario,raw,lang),groups=[];
  const audioPaths=[raw.audio?.incoming||[],raw.audio?.outgoing||[]];
  const audioOnly=raw.type==='media'||raw.signal===false||/^RTP\b/.test(raw.code||'')||(raw.audio&&audioPaths.some(route=>same(route,raw.path))&&!['sip','context','analog','access'].includes(message.kind));
  const semantic=(raw.type==='platform'&&scenario.connectionModel!=='ari'&&!scenario.phoneModel&&!scenario.fxoModel)||raw.type==='analog'||raw.type==='access'?raw.path:raw.path.filter(id=>!forwarder(id));
  const path=semantic.length?semantic:[raw.path[0]];
  if(!audioOnly){
   const events=path.length>1&&message.kind!=='local'?pathPairs(path).map(pair=>{const event=signalLeg(scenario,raw.path,pair,message,lang);if(scenario.id==='mechanism'&&[N.orgDb,N.configDb,N.numberDb].includes(pair.to))event.label=en?'Query: tenant / connection / active DID':'Sorgu: kurum / bağlantı / aktif DID';if(scenario.id==='mechanism'&&[N.orgDb,N.configDb,N.numberDb].includes(pair.from))event.label=en?'Matching record / validated context':'Eşleşen kayıt / doğrulanmış bağlam';return event;}): [{kind:'local',from:path[0],to:path.at(-1),label:message.label}];
   groups.push({label:en?'Control / data':'Kontrol / veri',events});
  }
  for(const [key,title] of [['incoming',en?'Incoming audio':'Gelen ses'],['outgoing',en?'Return audio':'Dönen ses']]){
   const route=raw.audio?.[key]||[];
   if(route.length>1)groups.push({label:title,events:pathPairs(route).map(pair=>({...pair,kind:'audio',label:audioProtocol(scenario,pair.from,pair.to,lang)}))});
  }
  if(!groups.length)groups.push({label:en?'Local processing':'Yerel işlem',events:[{kind:'local',from:path[0],to:path.at(-1),label:phase.title}]});
  return {index,title:phase.title,route:raw.path,transportNote:!audioOnly&&message.kind==='sip'&&raw.path.some(forwarder)?raw.path.map(label).join(' → '):null,groups};
 });
 const used=new Set(blocks.flatMap(block=>block.groups.flatMap(group=>group.events.flatMap(event=>[event.from,event.to]))));
 const top=scenario.topology.stages?Object.values(scenario.topology.stages):[scenario.topology];
 const ordering=scenario.id==='mechanism'||scenario.fxoModel?top.flatMap(t=>t.nodeIds):[N.caller,N.operator,N.provider,N.router,N.switch,N.pbx,N.vera,N.ip201,N.ip202,N.ata,N.analog,N.officeLine,N.staffFixed,N.staffMobile,...top.flatMap(t=>t.nodeIds)];
 const ids=[...new Set(ordering)].filter(id=>used.has(id));
 return {all,blocks,participants:ids.map(id=>({id,label:label(id),actor:[N.caller,N.speaker,N.staffMobile].includes(id)}))};
}
export function sequenceSource(model,lang='tr',currentStep=0) {
 const lines=['sequenceDiagram','  autonumber'];
 for(const participant of model.participants)lines.push(`  ${participant.actor?'actor':'participant'} P${participant.id} as ${mermaidText(participant.label)}`);
 for(const block of model.blocks){
  block.groups.forEach((group,i)=>{
   if(block.groups.length>1)lines.push(`  ${i?'and':'par'} ${mermaidText(group.label)}`);
   for(const event of group.events){
    const from=`P${event.from}`,to=`P${event.to}`,label=mermaidText(event.label);
    lines.push(`    ${from}->>${event.kind==='local'?from:to}: ${label}`);
   }
  });
  if(block.groups.length>1)lines.push('  end');
 }
 return lines.join('\n');
}
