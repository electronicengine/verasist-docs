// Expand logical telephony links into their office LAN/WAN transport path.
// Public analog/mobile forwarding has no office IP network and stays unchanged.
export function withOfficeNetwork(scenario,{N,nodes,connections}) {
 if(scenario.networkManaged)return scenario;
 if(['public-line','mechanism'].includes(scenario.id))return scenario;
 const S=N.switch,R=N.router,P=N.pbx;
 const hosted=scenario.id==='registration'&&scenario.registrationMode==='phones';
 const direct=scenario.id==='direct';
 const external=id=>[N.operator,N.vera].includes(id);
 const expandPair=(a,b)=>{
  if((direct||hosted)&&((a===S&&(direct?b===N.operator:b===P))||(b===S&&(direct?a===N.operator:a===P))))return [a,R,b];
  if(!direct&&!hosted&&((a===P&&external(b))||(b===P&&external(a))))return a===P?[a,S,R,b]:[a,R,S,b];
  return [a,b];
 };
 const path=route=>route.length<2?route:[route[0],...route.slice(1).flatMap((b,i)=>expandPair(route[i],b).slice(1))];
 const topology=original=>{
  const nodeIds=[...new Set([...original.nodeIds,R])];
  const wires=original.connections.flatMap(w=>{
   const route=expandPair(w.a,w.b);
   return route.slice(1).map((b,i)=>route.length===2?w:{a:route[i],b,type:[route[i],b].includes(S)?'ethernet':'sip',title:[route[i],b].includes(S)?'LAN · Ethernet':'WAN · SIP / RTP',description:[route[i],b].includes(S)?'Kurum LAN bağlantısı; yerel IP trafiği. Switch SIP hedefi seçmez ve NAT yapmaz.':'Router/firewall üzerinden dış IP erişimi. SIP kontrolü ve RTP sesi ayrı port/akışlardır; NAT eşlemesi ve dönüş erişimi sağlanmalıdır.'});
  });
  return {...original,nodeIds,nodeKinds:{...original.nodeKinds,[S]:'switch',[R]:'gateway'},connections:wires.filter((w,i)=>wires.findIndex(v=>(v.a===w.a&&v.b===w.b)||(v.a===w.b&&v.b===w.a))===i)};
 };
 const defaultNodes=nodes.filter(n=>!n.platformOnly&&!n.publicOnly&&!n.forwardOnly&&!n.networkOnly&&(!n.internal||scenario.id==='mechanism')&&(n.id!==N.vera||scenario.id!=='pbx')&&(scenario.id!=='registration'||![N.caller,N.operator].includes(n.id))).map(n=>n.id);
 const defaultWires=connections.filter(w=>defaultNodes.includes(w.a)&&defaultNodes.includes(w.b));
 const original=scenario.topology||{nodeIds:defaultNodes,connections:defaultWires};
 const top=original.stages?{...original,stages:Object.fromEntries(Object.entries(original.stages).map(([key,t])=>[key,topology(t)]))}:topology(original);
 const descriptions={tr:{...scenario.descriptions?.tr,[R]:'Kurumun LAN ile WAN sınırı: yönlendirme, firewall ve bu örnekte NAT burada yapılır. Switch ayrı cihazdır. Modem/ONT erişim sonlandırması bu nesneyle birlikte sadeleştirilmiştir; NAT yalnız router işlevindedir. Operatörün özel erişiminde veya genel IP’li kurulumda NAT olmayabilir.',[S]:'Ethernet switch kurum içindeki telefonları, ATA’yı, yerel santrali ve router LAN portunu bağlar. NAT veya çağrı yönlendirmesi yapmaz.'},en:{...scenario.descriptions?.en,[R]:'The office LAN/WAN boundary performs routing, firewalling and, in this example, NAT. The switch is separate. Modem/ONT access termination is grouped with this object for simplicity; NAT belongs to the router function. Private carrier access or public-address deployments may not use NAT.',[S]:'The Ethernet switch connects office phones, ATA, local PBX and the router LAN port. It performs neither NAT nor call routing.'}};
 return {...scenario,network:{router:R,hosted,direct},labels:{tr:{...scenario.labels?.tr,[S]:'Ethernet switch',[R]:'Modem / router · NAT'},en:{...scenario.labels?.en,[S]:'Ethernet switch',[R]:'Modem / router · NAT'}},descriptions,topology:top,phases:scenario.phases.map(phase=>({...phase,path:path(phase.path),audio:phase.audio?{...phase.audio,incoming:path(phase.audio.incoming),outgoing:path(phase.audio.outgoing)}:undefined,networkCrossing:[phase.path,phase.audio?.incoming||[],phase.audio?.outgoing||[]].some(route=>path(route).includes(R))}))};
}
