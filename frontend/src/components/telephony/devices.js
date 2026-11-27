import * as THREE from 'three';

export function makeDevice(kind) {
  const group = new THREE.Group();
  const casing = new THREE.MeshStandardMaterial({ color: '#355170', roughness: .46, metalness: .35 });
  const dark = new THREE.MeshStandardMaterial({ color: '#15263a', roughness: .6 });
  const silver = new THREE.MeshStandardMaterial({ color: '#809bb1', roughness: .4, metalness: .7 });
  const teal = new THREE.MeshStandardMaterial({ color: '#60e2d0', emissive: '#166154', emissiveIntensity: .6 });
  const amber = new THREE.MeshStandardMaterial({ color: '#ffbd65', emissive: '#995317', emissiveIntensity: .35 });
  const box = (w, h, d, material, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); return mesh;
  };
  const handset = () => {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-.56, .5, -.55), new THREE.Vector3(-.66, .62, 0), new THREE.Vector3(-.56, .5, .55)]);
    const receiver = new THREE.Mesh(new THREE.TubeGeometry(curve, 18, .13, 8, false), dark); receiver.castShadow = true; group.add(receiver);
    box(.35, .18, .34, dark, -.56, .5, -.55); box(.35, .18, .34, dark, -.56, .5, .55);
  };
  if (['phone', 'analog'].includes(kind)) {
    box(1.4, .25, 1.6, casing, 0, .24);
    if (kind === 'phone') {
      const display = box(.75, .09, .46, teal, .2, .48, -.35); display.rotation.x = -.35;
    } else box(.7, .03, .22, silver, .2, .4, -.45);
    for (let i = 0; i < 12; i++) box(.14, .06, .12, i === 11 ? amber : silver, (i % 3) * .22, .4, Math.floor(i / 3) * .2 - .02);
    handset();
  } else if (kind === 'server') {
    box(1.4, 1.85, 1.05, dark, 0, .99);
    for (let i = 0; i < 4; i++) {
      box(1.25, .36, .03, casing, 0, .34 + i * .42, .55);
      box(.08, .07, .04, teal, .44, .34 + i * .42, .58);
      for (let j = 0; j < 4; j++) box(.1, .025, .04, silver, -.42 + j * .17, .34 + i * .42, .58);
    }
    box(.11, 2, .12, silver, -.73, 1, .55); box(.11, 2, .12, silver, .73, 1, .55);
  } else if (kind === 'switch' || kind === 'gateway' || kind === 'ata' || kind === 'fxo-gateway') {
    box(kind === 'fxo-gateway' ? 2.2 : kind === 'switch' ? 2 : 1.3, .43, .9, casing, 0, .35);
    const ports = kind === 'switch' ? 8 : kind === 'fxo-gateway' ? 5 : 2;
    for (let i = 0; i < ports; i++) {
      const x = (i - (ports - 1) / 2) * (ports > 2 ? .22 : .45);
      box(.16, .14, .06, dark, x, .32, .48);
      box(.07, .025, .07, (kind === 'ata' && i === 1 || kind === 'fxo-gateway' && i<4) ? amber : teal, x, .47, .48);
    }
    if (kind === 'gateway') {
      box(.05, .85, .05, dark, -.45, .8, -.2); box(.05, .85, .05, dark, .45, .8, -.2);
    }
  } else if (kind === 'agent') {
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(.65, 1), new THREE.MeshStandardMaterial({ color: '#a485ef', roughness: .23, metalness: .5 }));
    core.position.y = 1; core.castShadow = true; group.add(core);
    const orbit = new THREE.Mesh(new THREE.TorusGeometry(.9, .035, 8, 64), teal); orbit.position.y = 1; orbit.rotation.x = .65; group.add(orbit);
    box(1.6, .14, 1.6, dark, 0, .14);
  } else {
    [-.5, 0, .5].forEach((x, i) => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(i === 1 ? .64 : .45, 24, 16), silver);
      mesh.position.set(x, i === 1 ? 1.05 : .85, 0); mesh.castShadow = true; group.add(mesh);
    });
  }
  return group;
}
