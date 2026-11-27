import * as THREE from 'three';

// Software notation only: records, transforms, inference and a human boundary.
export function makeSoftwareObject(kind,dark) {
 const g=new THREE.Group();
 const mat=color=>new THREE.MeshStandardMaterial({color,roughness:.86,metalness:0});
 const base=mat(dark?'#27344a':'#e1e8f4'),face=mat(dark?'#35475f':'#f6f8fc');
 const blue=mat(dark?'#8aa9ee':'#486bca'),ink=mat(dark?'#c3d2ed':'#607594');
 const input=mat(dark?'#80bcae':'#4a8c80'),output=mat(dark?'#d9b078':'#ad7c3e');
 const add=(geometry,material,x=0,y=0,z=0)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;};
 const box=(w,h,d,m,x=0,y=0,z=0)=>add(new THREE.BoxGeometry(w,h,d),m,x,y,z);
 const polygon=(points,m,depth=.16,y=.36)=>{
  const shape=new THREE.Shape();points.forEach(([x,z],i)=>i?shape.lineTo(x,z):shape.moveTo(x,z));shape.closePath();
  const geo=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:.055,bevelThickness:.035,bevelSegments:2,steps:1});
  const mesh=add(geo,m,0,y,0);mesh.rotation.x=-Math.PI/2;return mesh;
 };
 const card=(m=face,y=.36)=>polygon([[-.9,-.58],[.9,-.58],[.9,.58],[-.9,.58]],m,.13,y);
 const wave=(x,z,m)=>{for(let i=0;i<5;i++)box(.075,.055,[.2,.4,.6,.4,.2][i],m,x+(i-2)*.13,.59,z);};
 const text=(x,z,m)=>{for(let i=0;i<3;i++)box(.5-i*.07,.055,.055,m,x,.59,z+(i-1)*.17);};
 if(kind==='software-speaker'){
  add(new THREE.CylinderGeometry(.37,.49,.72,24),base,0,.55);
  add(new THREE.SphereGeometry(.27,24,16),ink,0,1.25);
  const mic=add(new THREE.CapsuleGeometry(.07,.23,4,10),blue,.53,.87,.04);mic.rotation.z=-.3;
  box(.05,.4,.05,ink,.48,.55,.04);
  for(const radius of [.32,.5]){
   const arc=new THREE.EllipseCurve(.53,1.02,radius,radius*.8,-.55,.55,false,0);
   const points=arc.getPoints(20).map(p=>new THREE.Vector3(p.x,p.y,.07));
   g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:blue.color})));
  }
 }else if(kind==='software-vpn'){
  polygon([[-.7,-.5],[.7,-.5],[.6,.3],[0,.8],[-.6,.3]],base,.2,.3);
  const ring=add(new THREE.TorusGeometry(.25,.05,8,24),blue,0,.58,-.08);ring.rotation.x=Math.PI/2;box(.5,.08,.33,blue,0,.6,.25);
 }else if(kind==='software-database'){
  for(const y of [.24,.47,.70])add(new THREE.CylinderGeometry(.7,.7,.2,32),y===.47?blue:base,0,y);
 }else if(['software-org','software-config','software-number','software-workflow','software-run'].includes(kind)){
  card(base,.22);card(face,.36);
  if(kind==='software-org'){
   for(const x of [-.45,0,.45]){add(new THREE.CylinderGeometry(.12,.12,.05,16),blue,x,.57,-.15);box(.23,.06,.25,ink,x,.57,.12);}
  }else if(kind==='software-config'){
   for(let i=0;i<3;i++){box(1,.05,.045,ink,0,.57,(i-1)*.24);box(.13,.09,.16,blue,(i-1)*.28,.6,(i-1)*.24);}
  }else if(kind==='software-number'){
   for(const x of [-.2,.2])box(.055,.06,.85,blue,x,.57,0);
   for(const z of [-.2,.2])box(.85,.06,.055,blue,0,.57,z);
  }else if(kind==='software-workflow'){
   box(.8,.04,.04,ink,0,.56,0);box(.04,.04,.5,ink,.4,.56,.25);
   for(const [x,z] of [[-.4,0],[.4,0],[.4,.5]])box(.23,.08,.2,blue,x,.58,z);
  }else{
   const ring=add(new THREE.TorusGeometry(.36,.045,8,32),blue,0,.57);ring.rotation.x=Math.PI/2;
   box(.04,.07,.3,ink,0,.6,-.12);box(.22,.07,.04,ink,.1,.6,0);
  }
 }else if(kind==='software-entity'){
  card(base,.22);card(face,.36);
  add(new THREE.CylinderGeometry(.1,.1,.045,20),blue,-.6,.55,.35);
  box(.65,.045,.06,ink,.1,.55,.38);box(.48,.045,.06,ink,.02,.55,.2);
 }else if(kind==='software-package'){
  card(base,.18);card(face,.32);
  for(const x of [-.5,0,.5])box(.26,.09,.27,blue,x,.55,.3);
 }else if(kind==='software-engine'){
  card();box(.26,.07,.26,blue,-.48,.56,.2);box(.26,.07,.26,blue,.48,.56,.2);box(.26,.07,.26,blue,0,.56,.45);
  box(.7,.04,.045,ink,0,.54,.2);box(.045,.04,.42,ink,0,.54,.325);
 }else if(kind==='software-stt'||kind==='software-tts'){
  polygon([[-1,-.6],[.68,-.6],[1,.6],[-.68,.6]],base,.18,.28);
  card(face,.39);const speech=kind==='software-stt';wave(speech?-.46:.46,.25,speech?input:output);text(speech?.46:-.46,.3,blue);
 }else if(kind==='software-llm'){
  add(new THREE.CylinderGeometry(.85,.85,.2,6),base,0,.37);
  add(new THREE.CylinderGeometry(.68,.68,.06,6),face,0,.51);
  for(const x of [-.3,0,.3])add(new THREE.CylinderGeometry(.055,.055,.05,12),blue,x,.58,.35);
 }else if(kind==='software-voice'){
  add(new THREE.CylinderGeometry(.83,.83,.17,40),base,0,.36);
  const ring=add(new THREE.TorusGeometry(.65,.035,6,40),blue,0,.49);ring.rotation.x=Math.PI/2;wave(0,.25,input);
 }else{
  card();const m=kind==='software-output'?output:input;
  polygon([[-.5,-.35],[.1,-.35],[.1,-.5],[.6,0],[.1,.5],[.1,.35],[-.5,.35]],m,.05,.54);
 }
 return g;
}
