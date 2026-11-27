import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { translate, localizePhase } from './english';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {makeSoftwareObject} from './softwareObjects';
import {layoutScene,routePoints,edgeKey} from './sceneLayout';
import { makeDevice } from '../devices';
import { nodes, connections, N, nodeLabel as rawNodeLabel } from './scenarios';

const project = (v, camera) => { const point = v.clone().project(camera); return { left: `${(point.x + 1) * 50}%`, top: `${(1 - point.y) * 50}%` }; };
function curveFor(path, layout, lift = .32) {
  const curve = new THREE.CurvePath(); curve.hopMap=[];
  path.slice(1).forEach((to, i) => {
    const points=routePoints(layout,path[i],to);
    points.slice(1).forEach((end,j)=>{
      const start=points[j],a=new THREE.Vector3(start[0],lift,start[1]),b=new THREE.Vector3(end[0],lift,end[1]);
      const midpoint=a.clone().lerp(b,.5);midpoint.y+=.2;
      if(lift>.2){const tangent=b.clone().sub(a);midpoint.add(new THREE.Vector3(tangent.z,0,-tangent.x).normalize().multiplyScalar(.09));}
      curve.add(new THREE.QuadraticBezierCurve3(a,midpoint,b));curve.hopMap.push(i);
    });
  });
  return curve;
}
function callerDevice() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(.85, 1.6, .16), new THREE.MeshStandardMaterial({ color: '#34443d' })); body.position.y = .9; group.add(body);
  const screen = new THREE.Mesh(new THREE.BoxGeometry(.68, 1.23, .02), new THREE.MeshStandardMaterial({ color: '#b4d9ca' })); screen.position.set(0, .98, .1); group.add(screen);
  return group;
}
function sketchedDevice(kind, dark) {
  const group = kind === 'caller' ? callerDevice() : makeDevice(kind);
  group.traverse(object => {
    if (!object.isMesh) return;
    const old = object.material, hex = old.color?.getHexString();
    let color = ['60e2d0', '6fdbed', 'a485ef'].includes(hex) ? '#8aa9ee' : ['15263a'].includes(hex) ? dark ? '#263148' : '#35415b' : hex === 'ffbd65' ? '#d6ad59' : dark ? '#65718b' : '#d1d9ea';
    if (kind === 'caller') color = object.position.z > 0 ? '#b4d9ca' : '#36453e';
    object.material = new THREE.MeshStandardMaterial({ color, roughness: .92, metalness: 0 }); object.castShadow = true; object.receiveShadow = true;
    object.geometry.computeBoundingBox();
    const size = new THREE.Vector3(); object.geometry.boundingBox.getSize(size);
    if (size.x > .35 && size.y > .1) object.add(new THREE.LineSegments(new THREE.EdgesGeometry(object.geometry, 35), new THREE.LineBasicMaterial({ color: '#415149', transparent: true, opacity: .55 })));
    old.dispose();
  });
  return group;
}
export default function StoryStage({ scenario, stepIndex, progress, playing, onInspect, resetKey, theme, lang }) {
  const t = value => translate(value, lang);
  const nodeLabel = (id, scenarioId) => scenario.labels?.[lang]?.[id] || t(rawNodeLabel(id,scenarioId,scenario.directMode));
  const host = useRef(null), home = useRef(() => {});
  const current = useRef({ stepIndex, progress, playing, onInspect }); current.current = { stepIndex, progress, playing, onInspect };
  const [mobile, setMobile] = useState(() => window.innerWidth < 650);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [regions,setRegions]=useState([]);
  const [labels, setLabels] = useState([]), [bubble, setBubble] = useState(null), [failed, setFailed] = useState(false);
  useEffect(() => { home.current(); }, [resetKey]);
  useEffect(() => {
    const el = host.current; let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true }); } catch { setFailed(true); return; }
    const dark = theme === 'dark';
    const paper = dark ? '#172620' : '#f7f5ed';
    setFailed(false); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8)); renderer.setClearColor(paper);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', t('Döndürülebilir 3B santral animasyonu'));
    const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-10, 10, 7, -7, .1, 100);
    camera.position.set(0, mobile ? 23 : 15, mobile ? 18 : 17);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enablePan = false; controls.enableDamping = false; controls.target.set(0, 0, mobile ? .5 : 0);
    controls.minPolarAngle = .35; controls.maxPolarAngle = 1.3; controls.minZoom = .65; controls.maxZoom = 2.5; controls.update(); controls.saveState();
    scene.add(new THREE.HemisphereLight('#ffffff', '#c2ccdf', 2));
    const sun = new THREE.DirectionalLight('#fff9e5', 1.8); sun.position.set(-6, 18, 10); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14 }); sun.shadow.bias = -.001; scene.add(sun);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), new THREE.MeshStandardMaterial({ color: paper, roughness: 1 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -.06; floor.receiveShadow = true; scene.add(floor);
    const grid = new THREE.GridHelper(50, 50, dark ? '#344b40' : '#dbe1d1', dark ? '#293c32' : '#e7e9dd'); grid.position.y = -.05; scene.add(grid);
    const layout=layoutScene(scenario.topology,{mobile});
    const regionSpecs=scenario.topology.regions?.[mobile?'mobile':'desktop']||[];
    if(regionSpecs.length){grid.material.transparent=true;grid.material.opacity=.18;}
    for(const region of regionSpecs){
      const [x1,z1,x2,z2]=region.bounds;
      const plate=new THREE.Mesh(new THREE.PlaneGeometry(x2-x1,z2-z1),new THREE.MeshBasicMaterial({color:dark?'#8aa9ee':'#486bca',transparent:true,opacity:.045,depthWrite:false}));plate.rotation.x=-Math.PI/2;plate.position.set((x1+x2)/2,-.025,(z1+z2)/2);scene.add(plate);
      const border=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([[x1,z1],[x2,z1],[x2,z2],[x1,z2]].map(([x,z])=>new THREE.Vector3(x,.015,z))),new THREE.LineBasicMaterial({color:dark?'#667c9f':'#a4b4ce',transparent:true,opacity:.6}));scene.add(border);
    }
    const position=id=>{const [x,z]=layout.positions[id];return new THREE.Vector3(x,0,z);};
    const visibleNodes = scenario.topology ? nodes.filter(node => scenario.topology.nodeIds.includes(node.id)) : nodes.filter(node => !node.publicOnly && !node.forwardOnly && (!node.internal || scenario.id === 'mechanism') && (node.id !== N.vera || scenario.id !== 'pbx') && (scenario.id !== 'registration' || ![N.caller, N.operator].includes(node.id)));
    let alive = true; const textures = [];
    const actorGroups = visibleNodes.map(node => {
      const kind=scenario.topology?.nodeKinds?.[node.id] || node.kind;
      const group = kind === 'agent' ? new THREE.Group() : kind.startsWith('software-') ? makeSoftwareObject(kind,dark) : sketchedDevice(kind, dark); group.position.copy(position(node.id));
      if (node.kind === 'agent') {
        const base = new THREE.Mesh(new THREE.CylinderGeometry(.82, .92, .18, 32), new THREE.MeshStandardMaterial({ color: dark ? '#263148' : '#ccd7ec' })); base.position.y = .12; base.receiveShadow = true; group.add(base);
        const texture = new THREE.TextureLoader().load('/logo.png', () => { if (alive) { dirty = true; } }); texture.colorSpace = THREE.SRGBColorSpace; textures.push(texture);
        const logo = scenario.id==='mechanism' ? new THREE.Mesh(new THREE.PlaneGeometry(1.25,1.6),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,side:THREE.DoubleSide})) : new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false })); logo.position.y = scenario.id==='mechanism'?.24:1.1; if(scenario.id==='mechanism')logo.rotation.x=-Math.PI/2;else logo.scale.set(1.25, 1.6, 1); group.add(logo); logo.userData.node = node.id;
      }
      group.traverse(object => { if (object.isMesh) object.userData.node = node.id; }); scene.add(group); return group;
    });
    const sceneConnections = scenario.topology?.connections || connections.filter(wire => (scenario.id === 'mechanism' || wire.a < 9 && wire.b < 9) && (wire.b !== N.vera || scenario.id !== 'pbx') && (scenario.id !== 'registration' || ![wire.a, wire.b].some(id => [N.caller, N.operator].includes(id))));
    const wires = sceneConnections.map((wire, i) => {
      const curve = curveFor([wire.a, wire.b], layout, .1);
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 30, wire.type==='vpn'?.09:['control','ari-media'].includes(wire.type)?.045:.018, 6, false), new THREE.MeshBasicMaterial({ color: wire.type==='control'?(dark?'#c29df7':'#7c4cba'):wire.type==='ari-media'?(dark?'#66d8b8':'#187e6a'):wire.type==='vpn'?'#8aa9ee':wire.type === 'analog' ? '#a18861' : '#9ba99b',transparent:Boolean(scenario.connectionModel||scenario.fxoModel)||wire.type==='platform',opacity:wire.type==='platform'?.2:1 })); scene.add(mesh);
      const hit = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, .18, 6, false), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); hit.userData.wire = i; scene.add(hit); return { wire, hit, mesh };
    });
    const flows = scenario.phases.map(phase => {
      if (phase.path.some(id=>!layout.positions[id]) || phase.signal===false || phase.path.length < 2 || ['media', 'guide'].includes(phase.type)) return null;
      const curve = curveFor(phase.path, layout, .43), group = new THREE.Group();
      const color = scenario.connectionModel==='ari'&&phase.path.includes(N.ariControl)?(dark?'#c29df7':'#7c4cba'):scenario.connectionModel==='ari'&&phase.path.includes(N.ariMedia)?(dark?'#66d8b8':'#187e6a'):phase.type === 'analog' ? '#b47c2d' : phase.type === 'access' ? '#8a775a' : dark ? '#80b8ee' : '#3c6aa0';
      group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 70, .04, 6, false), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .65 })));
      const packet = new THREE.Mesh(phase.type === 'analog' ? new THREE.TorusGeometry(.13, .035, 6, 16) : new THREE.BoxGeometry(.22, .18, .3), new THREE.MeshBasicMaterial({ color })); group.add(packet); const companions=phase.key==='platform-conversation'?Array.from({length:5},()=>{const copy=packet.clone();group.add(copy);return copy;}):[]; group.visible = false; scene.add(group); return { curve, group, packet, companions };
    });
    const bridgeRing=new THREE.Mesh(new THREE.TorusGeometry(1.15,.065,8,48),new THREE.MeshBasicMaterial({color:dark?'#efad72':'#bd7337',transparent:true,opacity:.85}));bridgeRing.rotation.x=-Math.PI/2;bridgeRing.visible=false;scene.add(bridgeRing);
    const audioGroup = new THREE.Group(); scene.add(audioGroup); let audio = [], audioKey = '', elapsed = 0, lastTime = 0;
    const disposeGroup = group => group.traverse(object => { object.geometry?.dispose(); const materials = Array.isArray(object.material) ? object.material : [object.material]; materials.filter(Boolean).forEach(material => material.dispose()); });
    const rebuildAudio = spec => {
      audio.forEach(path => { path.cube.dispose(); path.ring.dispose(); }); disposeGroup(audioGroup); audioGroup.clear(); audio = []; elapsed = 0;
      if (!spec) return;
      [['incoming', spec.incoming, dark ? '#66d8b8' : '#187e6a'], ['outgoing', spec.outgoing, dark ? '#efad72' : '#bd7337']].forEach(([id, route, color], index) => {
        if (!route?.length || route.length < 2 || route.some(id=>!layout.positions[id])) return;
        const curve = curveFor(route, layout, index === 0 ? .62 : .95), group = new THREE.Group(); audioGroup.add(group);
        group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 100, .035, 6, false), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .8 })));
        curve.curves.forEach(segment => group.add(new THREE.ArrowHelper(segment.getTangent(.65).normalize(), segment.getPoint(.65), .3, color, .18, .11)));
        const cube = new THREE.BoxGeometry(.19, .14, .26), ring = new THREE.TorusGeometry(.13, .03, 6, 16);
        const packets = Array.from({ length: 7 }, () => { const packet = new THREE.Mesh(cube, new THREE.MeshBasicMaterial({ color })); group.add(packet); return packet; });
        audio.push({ id, route, curve, packets, cube, ring });
      });
    };
    let paletteApplied = false;
    const applyDocumentPalette = () => {
      if (document.documentElement.classList.contains('dark') !== dark) return;
      const style = getComputedStyle(document.documentElement);
      const color = key => new THREE.Color(`hsl(${style.getPropertyValue(key).trim().split(/\s+/).join(',')})`);
      const background = color('--background');
      renderer.setClearColor(background); floor.material.color.copy(background);
      const border = color('--border');
      const colors = grid.geometry.getAttribute('color');
      for (let i=0;i<colors.count;i++) colors.setXYZ(i,border.r,border.g,border.b);
      colors.needsUpdate = true;
      paletteApplied = true;
    };
    let dirty = true, lastStep = -1, lastProgress = -1, lastOverlay = 0;
    const fit = () => {
      camera.zoom = 1; camera.updateMatrixWorld();
      const fitPoints=[...visibleNodes.map(node=>position(node.id)),...regionSpecs.flatMap(region=>{const [x1,z1,x2,z2]=region.bounds;return [new THREE.Vector3(x1,0,z1),new THREE.Vector3(x2,0,z2)];}),...Object.values(layout.edges||{}).flat().map(([x,z])=>new THREE.Vector3(x,0,z))];
      const points = fitPoints.flatMap(p => { return [-1.1, 1.1].flatMap(x => [-.2, 2.8].flatMap(y => [-1.1, 1.1].map(z => new THREE.Vector3(p.x + x, y, p.z + z)))); }).map(p => p.applyMatrix4(camera.matrixWorldInverse));
      const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x)), minY = Math.min(...points.map(p => p.y)), maxY = Math.max(...points.map(p => p.y));
      const aspect = el.clientWidth / Math.max(1, el.clientHeight), halfY = Math.max((maxY - minY) / 2 + .65, ((maxX - minX) / 2 + .6) / aspect);
      const centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2;
      camera.left = centerX - halfY * aspect; camera.right = centerX + halfY * aspect; camera.top = centerY + halfY; camera.bottom = centerY - halfY; camera.updateProjectionMatrix(); dirty = true;
    };
    home.current = () => { controls.reset(); fit(); };
    const changed = () => { dirty = true; }; controls.addEventListener('change', changed);
    const resize = () => { if (!el.clientWidth || !el.clientHeight) return; if ((el.clientWidth < 650) !== mobile) { setMobile(el.clientWidth < 650); return; } renderer.setSize(el.clientWidth, el.clientHeight, false); fit(); };
    const observer = new ResizeObserver(resize); observer.observe(el); resize();
    const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(); let down;
    const onDown = e => { down = [e.clientX, e.clientY]; };
    const onUp = e => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
      const bounds = renderer.domElement.getBoundingClientRect(); pointer.set((e.clientX - bounds.left) / bounds.width * 2 - 1, -(e.clientY - bounds.top) / bounds.height * 2 + 1); raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects([...actorGroups, ...wires.map(wire => wire.hit)], true);
      const picked = hits.find(hit => hit.object.userData.node !== undefined || hit.object.userData.wire !== undefined);
      if (!picked) return;
      const data = picked.object.userData;
      if (data.node !== undefined) current.current.onInspect({ kind: 'node', id: data.node });
      else if (data.wire !== undefined) current.current.onInspect({ kind: 'wire', wire: wires[data.wire].wire });
    };
    const onMove = event => {
      if (event.pointerType === 'touch') return;
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const picked = raycaster.intersectObjects(actorGroups, true).find(hit => hit.object.userData.node !== undefined);
      setHoveredNode(picked ? picked.object.userData.node : null);
    };
    const onLeave = () => setHoveredNode(null);
    renderer.domElement.addEventListener('pointermove', onMove); renderer.domElement.addEventListener('pointerleave', onLeave);
    renderer.domElement.addEventListener('pointerdown', onDown); renderer.domElement.addEventListener('pointerup', onUp);
    const lost = event => { event.preventDefault(); renderer.setAnimationLoop(null); setFailed(true); }; renderer.domElement.addEventListener('webglcontextlost', lost);
    renderer.setAnimationLoop(time => {
      if (!paletteApplied) { applyDocumentPalette(); dirty = true; }
      const state = current.current, phase = scenario.phases[state.stepIndex];
      if(!phase)return;
      const dt = Math.min((time - (lastTime || time)) / 1000, .1); lastTime = time;
      if (document.hidden) return;
      const key = JSON.stringify(phase.audio || null);
      if (audioKey !== key) { audioKey = key; rebuildAudio(phase.audio); dirty = true; }
      if (!dirty && lastStep === state.stepIndex && lastProgress === state.progress && !(state.playing && audio.length)) return;
      dirty = false; lastStep = state.stepIndex; lastProgress = state.progress;
      if (state.playing) elapsed += dt;
      if(scenario.id==='mechanism'||scenario.connectionModel||scenario.fxoModel){const active=new Set();for(const route of [phase.path,phase.audio?.incoming||[],phase.audio?.outgoing||[]])route.slice(1).forEach((to,i)=>active.add(edgeKey(route[i],to)));for(const {wire,mesh} of wires)mesh.material.opacity=active.has(edgeKey(wire.a,wire.b))?.6:.14;}
      bridgeRing.visible=phase.bridgeAt!==undefined;if(bridgeRing.visible){bridgeRing.position.copy(position(phase.bridgeAt));bridgeRing.position.y=.25;bridgeRing.scale.setScalar(1+Math.sin(elapsed*3)*.05);}
      flows.forEach((flow, i) => { if (!flow) return; flow.group.visible = i === state.stepIndex; if (flow.group.visible) { const t = scenario.phases[i].key==='platform-conversation' ? (elapsed*.16)%1 : Math.min(state.progress / .68, 1); flow.packet.position.copy(flow.curve.getPointAt(t)); flow.packet.position.y += .08; flow.companions.forEach((copy,j)=>copy.position.copy(flow.curve.getPointAt((t+(j+1)/6)%1))); const tangent = flow.curve.getTangentAt(t); flow.packet.rotation.y = Math.atan2(tangent.x, tangent.z); } });
      audio.forEach(path => path.packets.forEach((packet, i) => {
        const t = (elapsed / 3 + i / 7) % 1;
        const segment=Math.max(0,path.curve.getCurveLengths().findIndex(length=>length>=t*path.curve.getLength()));
        const routeHop=path.curve.hopMap[segment]||0;
        const a = path.route[routeHop], b = path.route[routeHop + 1];
        packet.geometry = sceneConnections.some(wire=>wire.type==='analog'&&((wire.a===a&&wire.b===b)||(wire.a===b&&wire.b===a))) ? path.ring : path.cube;
        packet.position.copy(path.curve.getPointAt(t)); packet.position.y += .08;
        const tangent = path.curve.getTangentAt(t); packet.rotation.y = Math.atan2(tangent.x, tangent.z);
      }));
      camera.updateMatrixWorld();
      if (time - lastOverlay > 60 || !state.playing) {
        lastOverlay = time;
        setRegions(regionSpecs.map(region=>{const [x,z]=region.labelAt;return {label:region.label[lang],...project(new THREE.Vector3(x,.05,z),camera)};}));
        setLabels(visibleNodes.map(node => { const p = position(node.id), kind = scenario.topology?.nodeKinds?.[node.id] || node.kind; p.y = kind.startsWith('software-') ? .65 : kind === 'server' ? 1.05 : kind === 'caller' ? .95 : kind === 'cloud' ? .9 : kind === 'agent' ? 1.05 : .34; if(kind.startsWith('software-')&&kind!=='software-speaker')p.z-=.18; const fullName = nodeLabel(node.id, scenario.id); return { id: node.id, kind, fullName, inactive:phase.agentDetached&&node.id===N.ariMedia, name: scenario.labels?.[lang]?.[node.id] || (node.id === N.caller ? (lang === 'en' ? 'Caller' : 'Arayan') : node.id === N.operator ? (scenario.directMode === 'forward' ? (lang === 'en' ? 'Carrier A' : 'Operatör A') : (lang === 'en' ? 'Operator' : 'Operatör')) : node.id === N.provider ? (lang === 'en' ? 'Carrier B' : 'Operatör B') : node.id === N.pbx ? (lang === 'en' ? 'Office PBX' : 'Santral') : fullName.replace(/^Verasist · /, '')), ...project(p, camera) }; }));
        const active = flows[state.stepIndex];
        if (active) { const p = active.curve.getPointAt(Math.min(state.progress / .68, 1)); p.y += .8; setBubble({ ...project(p, camera), message: localizePhase(phase, scenario, lang).message }); } else setBubble(null);
      }
      el.dataset.audioFrame = String(Math.round(elapsed * 1000)); el.dataset.audioPaths = JSON.stringify(audio.map(path => ({ id: path.id, route: path.route })));
      el.dataset.signalPath=JSON.stringify(phase.signal===false?[]:phase.path);el.dataset.bridgeAt=phase.bridgeAt===undefined?'':String(phase.bridgeAt);el.dataset.agentDetached=String(Boolean(phase.agentDetached));
      el.dataset.stage = phase.stage || ''; el.dataset.view = camera.position.toArray().map(n => n.toFixed(2)).join(','); el.dataset.step = String(state.stepIndex);
      renderer.render(scene, camera);
    });
    return () => {
      alive = false; textures.forEach(texture => texture.dispose());
      observer.disconnect(); renderer.domElement.removeEventListener('pointermove', onMove); renderer.domElement.removeEventListener('pointerleave', onLeave); controls.removeEventListener('change', changed); controls.dispose(); renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener('pointerdown', onDown); renderer.domElement.removeEventListener('pointerup', onUp); renderer.domElement.removeEventListener('webglcontextlost', lost);
      audio.forEach(path => { path.cube.dispose(); path.ring.dispose(); }); scene.traverse(object => { object.geometry?.dispose(); const materials = Array.isArray(object.material) ? object.material : [object.material]; materials.filter(Boolean).forEach(material => material.dispose()); }); sun.shadow.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario, mobile, theme, lang]);
  return <div className="story-stage" data-testid="story-stage">
    <div className="story-webgl" ref={host} data-testid="story-canvas" />
    {!failed && <><div className="story-region-labels" aria-hidden="true">{regions.filter(region=>region.label).map(region=><span key={region.label} style={{left:region.left,top:region.top}}>{region.label}</span>)}</div><div className="story-node-labels">{labels.map(label => <button type="button" key={label.id} data-kind={label.kind} data-inactive={label.inactive||undefined} data-hovered={hoveredNode === label.id} aria-label={label.fullName} title={label.fullName} style={{ left: `clamp(var(--label-edge, 45px), ${label.left}, calc(100% - var(--label-edge, 45px)))`, top: label.top }} onClick={() => onInspect({ kind: 'node', id: label.id })}><span className="story-label-compact">{label.name}</span><span className="story-label-full">{label.fullName}</span></button>)}</div>{bubble && <button type="button" className="story-message" style={{ left: `clamp(90px, ${bubble.left}, calc(100% - 90px))`, top: bubble.top }} onClick={() => onInspect({ kind: 'step' })}>{bubble.message}</button>}</>}
    {failed && <div className="story-webgl-error"><strong>{t('3B görünüm açılamadı.')}</strong><p>{t('Adım açıklamaları ve ayrıntılar kullanılabilir. WebGL destekleyen bir tarayıcıda tekrar deneyin.')}</p></div>}
  </div>;
}
