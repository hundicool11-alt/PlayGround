import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

const viewport = document.querySelector('#viewport');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9bd9e8);
scene.fog = new THREE.Fog(0x9bd9e8, 35, 92);
const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.1, 180);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
viewport.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xe4f8ff, 0x6a7950, 1.55);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffedc1, 2.2);
sun.position.set(-18, 30, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -32; sun.shadow.camera.right = 32;
sun.shadow.camera.top = 35; sun.shadow.camera.bottom = -32;
sun.shadow.bias = -0.0004;
scene.add(sun);
const moonLight = new THREE.DirectionalLight(0x91b6ff, 0);
moonLight.position.set(13, 22, -15);
scene.add(moonLight);

const cubeGeo = new THREE.BoxGeometry(1, 1, 1);
const mat = (color, roughness = 1) => new THREE.MeshStandardMaterial({ color, roughness, flatShading: true });
const materials = {
  grass: mat(0x76a95b), dirt: mat(0x896044), stone: mat(0x777e7a), sand: mat(0xd9c38b),
  wood: mat(0x795334), leaves: mat(0x4c8858), darkLeaves: mat(0x39734b), flower: mat(0xf6d779),
  flowerPink: mat(0xe99c9b), mushroom: mat(0xe7765e),
};
const blocks = new Map();
const blockMeshes = [];
const blockTypes = [
  { id: 'grass', name: 'Moss grass', color: '#76a95b', cap: '#91bd70' },
  { id: 'dirt', name: 'Warm earth', color: '#896044' },
  { id: 'stone', name: 'Island stone', color: '#777e7a' },
  { id: 'wood', name: 'Driftwood', color: '#795334' },
  { id: 'leaves', name: 'Canopy', color: '#4c8858', cap: '#68a56e' },
  { id: 'sand', name: 'Soft sand', color: '#d9c38b' },
];
let selectedSlot = 0;
const keyOf = (x, y, z) => `${x},${y},${z}`;
function addBlock(x, y, z, type, options = {}) {
  x = Math.round(x); y = Math.round(y); z = Math.round(z);
  const key = keyOf(x, y, z);
  if (blocks.has(key)) return null;
  const mesh = new THREE.Mesh(cubeGeo, materials[type] || materials.grass);
  mesh.position.set(x, y, z);
  mesh.castShadow = options.castShadow ?? true;
  mesh.receiveShadow = true;
  mesh.userData = { x, y, z, type, natural: options.natural ?? false };
  scene.add(mesh); blocks.set(key, mesh); blockMeshes.push(mesh);
  return mesh;
}
function removeBlock(mesh) {
  const { x, y, z } = mesh.userData;
  blocks.delete(keyOf(x, y, z)); scene.remove(mesh);
  const i = blockMeshes.indexOf(mesh); if (i !== -1) blockMeshes.splice(i, 1);
}
function hash(x, z) {
  const n = Math.sin(x * 127.1 + z * 311.7 + 41.7) * 43758.5453;
  return n - Math.floor(n);
}
function terrainHeight(x, z) {
  const radial = Math.sqrt((x / 16.4) ** 2 + (z / 13.8) ** 2);
  const edge = 1.015 + (hash(x, z) - .5) * .11;
  if (radial > edge) return -99;
  const hills = Math.sin(x * .33) * .55 + Math.cos(z * .28) * .43 + Math.sin((x + z) * .2) * .3;
  const rim = Math.max(0, radial - .72) * 2.8;
  return Math.max(0, Math.round(2.1 + hills - rim));
}
const groundTops = new Map();
for (let x = -18; x <= 18; x++) {
  for (let z = -16; z <= 16; z++) {
    const top = terrainHeight(x, z);
    if (top < 0) continue;
    groundTops.set(`${x},${z}`, top);
    const radial = Math.sqrt((x / 16.4) ** 2 + (z / 13.8) ** 2);
    const surface = radial > .83 ? 'sand' : 'grass';
    addBlock(x, top, z, surface, { natural: true });
    for (let y = top - 1; y >= Math.max(-3, top - 3); y--) addBlock(x, y, z, y < top - 2 ? 'stone' : 'dirt', { natural: true });
  }
}
const waterMat = new THREE.MeshStandardMaterial({ color: 0x56b5c5, roughness: .34, metalness: .03, transparent: true, opacity: .88 });
const water = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), waterMat);
water.rotation.x = -Math.PI / 2; water.position.y = -.64; water.receiveShadow = true; scene.add(water);
const waterLine = new THREE.Mesh(new THREE.CircleGeometry(27, 64), new THREE.MeshBasicMaterial({ color: 0xb5e7db, transparent: true, opacity: .11, side: THREE.DoubleSide }));
waterLine.rotation.x = -Math.PI / 2; waterLine.position.y = -.61; waterLine.scale.set(1.2, .88, 1); scene.add(waterLine);

// A grove of chunky little trees gives the island a familiar voxel silhouette.
function tree(x, z, tall = 1) {
  const ground = groundTops.get(`${x},${z}`); if (ground == null) return;
  if (Math.hypot(x, z - 4) < 4.5) return;
  const trunk = 3 + Math.round(tall);
  for (let y = 1; y <= trunk; y++) addBlock(x, ground + y, z, 'wood', { natural: true });
  const crownY = ground + trunk;
  for (let dy = -1; dy <= 2; dy++) {
    const radius = dy === 2 ? 1 : (dy === -1 ? 2 : 2);
    for (let dx = -radius; dx <= radius; dx++) for (let dz = -radius; dz <= radius; dz++) {
      if (Math.abs(dx) === radius && Math.abs(dz) === radius && hash(x + dx, z + dz) < .35) continue;
      if (dy === 2 && Math.abs(dx) + Math.abs(dz) > 1) continue;
      addBlock(x + dx, crownY + dy, z + dz, hash(x + dx * 3, z + dz * 5) > .72 ? 'darkLeaves' : 'leaves', { natural: true });
    }
  }
}
[[ -9,-5,1],[-5,7,0],[-2,-8,1],[4,7,0],[8,-5,1],[11,2,0],[-11,3,0],[1,1,1]].forEach(([x,z,t]) => tree(x,z,t));
// A small dock and a few scattered garden details.
for (let z = -2; z <= 3; z++) {
  for (let x = 14; x <= 16; x++) addBlock(x, (groundTops.get(`${x},${z}`) ?? 0) + 1, z, 'wood', { natural: true });
}
for (const [x,z,type] of [[-7,-3,'flower'],[-6,-2,'flowerPink'],[3,5,'flower'],[6,-7,'mushroom'],[-12,-1,'flowerPink'],[9,6,'flower']]) {
  const y = groundTops.get(`${x},${z}`); if (y != null) {
    const deco = new THREE.Mesh(new THREE.BoxGeometry(.24,.35,.24), materials[type]);
    deco.position.set(x, y + .7, z); deco.castShadow = true; scene.add(deco);
  }
}

// Soft, blocky cloud puffs sit low on the horizon.
const cloudMat = new THREE.MeshLambertMaterial({ color: 0xf2f7e9, transparent: true, opacity: .76 });
const clouds = [];
for (let i = 0; i < 13; i++) {
  const group = new THREE.Group();
  const cx = (hash(i, 2) - .5) * 112, cz = (hash(i, 8) - .5) * 100;
  const pieces = 3 + Math.floor(hash(i, 4) * 3);
  for (let j = 0; j < pieces; j++) {
    const puff = new THREE.Mesh(new THREE.BoxGeometry(3 + hash(i,j) * 3, 1.15 + hash(j,i) * .8, 2.4), cloudMat);
    puff.position.set(j * 2.3 - pieces * 1.1, hash(i+j,5) * .5, (hash(j+3,i) - .5) * 1.2);
    group.add(puff);
  }
  group.position.set(cx, 12 + hash(i,11) * 8, cz); scene.add(group); clouds.push(group);
}
const celestialMat = new THREE.MeshBasicMaterial({ color: 0xffe6a3 });
const sunOrb = new THREE.Mesh(new THREE.SphereGeometry(2.1, 16, 12), celestialMat);
sunOrb.position.set(-28, 27, -58); scene.add(sunOrb);
const moonOrb = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 12), new THREE.MeshBasicMaterial({ color: 0xe6edff }));
moonOrb.position.set(30, 30, -52); scene.add(moonOrb);
const starPositions = [];
for (let i = 0; i < 240; i++) {
  const a = hash(i,9) * Math.PI * 2, r = 65 + hash(i,3) * 35;
  starPositions.push(Math.cos(a) * r, 18 + hash(i,7) * 55, Math.sin(a) * r - 28);
}
const starGeometry = new THREE.BufferGeometry();
starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xe6efff, size: .3, transparent: true, opacity: 0 }));
scene.add(stars);

const player = { x: 0, z: 4, y: (groundTops.get('0,4') ?? 2) + .52, vy: 0, yaw: 0, pitch: .18, grounded: true };
const eyeHeight = 1.62;
function syncCamera() {
  camera.position.set(player.x, player.y + eyeHeight, player.z);
  camera.rotation.order = 'YXZ'; camera.rotation.y = player.yaw; camera.rotation.x = player.pitch;
}
syncCamera();
const outline = new THREE.LineSegments(new THREE.EdgesGeometry(cubeGeo), new THREE.LineBasicMaterial({ color: 0xfff0ad, transparent: true, opacity: .9 }));
outline.scale.setScalar(1.012); outline.visible = false; outline.renderOrder = 5; scene.add(outline);
const raycaster = new THREE.Raycaster(); raycaster.far = 6;
let aimedBlock = null;
function updateTarget() {
  raycaster.setFromCamera(new THREE.Vector2(0,0), camera);
  const hits = raycaster.intersectObjects(blockMeshes, false);
  aimedBlock = hits.length ? hits[0] : null;
  outline.visible = !!aimedBlock;
  if (aimedBlock) outline.position.copy(aimedBlock.object.position);
  document.querySelector('#targetHint').classList.toggle('visible', !!aimedBlock && started);
}

const hotbar = document.querySelector('#hotbar');
blockTypes.forEach((type, i) => {
  const slot = document.createElement('button');
  slot.className = `slot${i === 0 ? ' selected' : ''}`; slot.title = `${i+1} · ${type.name}`;
  slot.innerHTML = `<span class="slot-number">${i+1}</span><span class="block-icon" style="--block:${type.color};--cap:${type.cap || type.color}"></span><span class="slot-name">${type.name}</span>`;
  slot.addEventListener('click', () => selectSlot(i)); hotbar.append(slot);
});
function selectSlot(index) {
  selectedSlot = (index + blockTypes.length) % blockTypes.length;
  [...hotbar.children].forEach((el,i) => el.classList.toggle('selected', i === selectedSlot));
}
let started = false, pointerLocked = false, toastTimer;
function toast(message) {
  const el = document.querySelector('#toast'); el.textContent = message; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 1700);
}

const held = new Set();
const mobileHeld = new Set();
const mobileControls = document.querySelector('#mobileControls');
const isTouch = matchMedia('(pointer: coarse)').matches;
function beginPlay() {
  started = true;
  document.querySelector('#intro').classList.add('hidden');
  if (isTouch) mobileControls.classList.add('active');
}
document.querySelector('#playBtn').addEventListener('click', beginPlay);
renderer.domElement.addEventListener('click', () => {
  if (started && !isTouch && !pointerLocked) renderer.domElement.requestPointerLock?.();
});
document.addEventListener('pointerlockchange', () => { pointerLocked = document.pointerLockElement === renderer.domElement; });
document.addEventListener('mousemove', e => {
  if (!pointerLocked || !started) return;
  player.yaw -= e.movementX * .0024;
  player.pitch = THREE.MathUtils.clamp(player.pitch - e.movementY * .0021, -1.42, 1.42);
});
document.addEventListener('keydown', e => {
  if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'Tab') { e.preventDefault(); document.exitPointerLock?.(); return; }
  if (/^Digit[1-6]$/.test(e.code)) selectSlot(Number(e.code.slice(-1)) - 1);
  if (e.code === 'Space' && !e.repeat && started && player.grounded) player.vy = 7.4;
  held.add(e.code);
});
document.addEventListener('keyup', e => held.delete(e.code));
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('mousedown', e => {
  if (!started || isTouch || !pointerLocked) return;
  if (e.button === 0) mineTarget(); else if (e.button === 2) placeBlock();
});
document.addEventListener('wheel', e => { if (started) selectSlot(selectedSlot + Math.sign(e.deltaY)); }, { passive: true });
document.addEventListener('visibilitychange', () => held.clear());

// On touchscreens, drag anywhere in the world to look and use the on-screen pad to move.
let lookTouch = null;
renderer.domElement.addEventListener('touchstart', e => {
  if (!started || !isTouch) return;
  const t = [...e.changedTouches].find(t => t.clientX > innerWidth * .32);
  if (t) lookTouch = { id: t.identifier, x: t.clientX, y: t.clientY };
}, { passive: true });
renderer.domElement.addEventListener('touchmove', e => {
  if (!lookTouch) return;
  const t = [...e.changedTouches].find(t => t.identifier === lookTouch.id); if (!t) return;
  player.yaw -= (t.clientX - lookTouch.x) * .006;
  player.pitch = THREE.MathUtils.clamp(player.pitch - (t.clientY - lookTouch.y) * .004, -1.3, 1.3);
  lookTouch.x = t.clientX; lookTouch.y = t.clientY;
}, { passive: true });
renderer.domElement.addEventListener('touchend', e => {
  if ([...e.changedTouches].some(t => t.identifier === lookTouch?.id)) lookTouch = null;
});
document.querySelectorAll('.move').forEach(button => {
  const direction = button.dataset.move;
  const down = e => { e.preventDefault(); mobileHeld.add(direction); button.classList.add('active'); button.setPointerCapture?.(e.pointerId); };
  const up = () => { mobileHeld.delete(direction); button.classList.remove('active'); };
  button.addEventListener('pointerdown', down); button.addEventListener('pointerup', up); button.addEventListener('pointercancel', up); button.addEventListener('lostpointercapture', up);
});
document.querySelector('#jumpBtn').addEventListener('pointerdown', e => { e.preventDefault(); if (player.grounded) player.vy = 7.4; });
document.querySelector('#mineBtn').addEventListener('pointerdown', e => { e.preventDefault(); mineTarget(); });
document.querySelector('#placeBtn').addEventListener('pointerdown', e => { e.preventDefault(); placeBlock(); });
function mineTarget() {
  if (!aimedBlock) return;
  const type = aimedBlock.object.userData.type;
  removeBlock(aimedBlock.object); aimedBlock = null; outline.visible = false;
  toast(`${type === 'wood' ? 'Driftwood' : type[0].toUpperCase() + type.slice(1)} gathered`);
}
function placeBlock() {
  if (!aimedBlock) return;
  const hit = aimedBlock;
  const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
  const p = hit.object.position.clone().add(normal);
  const x = Math.round(p.x), y = Math.round(p.y), z = Math.round(p.z);
  if (Math.abs(player.x - x) < .8 && Math.abs(player.z - z) < .8 && y >= player.y - .2 && y <= player.y + 1.8) {
    toast('There is no room to build there'); return;
  }
  const type = blockTypes[selectedSlot].id;
  if (addBlock(x, y, z, type)) toast(`${blockTypes[selectedSlot].name} placed`);
}
function floorAt(x, z, maxTop = Infinity) {
  const gx = Math.round(x), gz = Math.round(z);
  for (let y = 16; y >= -4; y--) {
    if (y + .5 <= maxTop && blocks.has(keyOf(gx, y, gz))) return y + .5;
  }
  return -99;
}

// The clock runs continuously; the sun, sky tint, water, and stars follow it together.
const dayLength = 210;
let cycleTime = .34;
let worldDays = 1;
const skyDay = new THREE.Color(0x9bd9e8), skyDusk = new THREE.Color(0xf0a875), skyNight = new THREE.Color(0x172b52);
const fogColor = new THREE.Color();
function updateDayNight(dt) {
  const previousCycle = cycleTime;
  cycleTime = (cycleTime + dt / dayLength) % 1;
  if (cycleTime < previousCycle) worldDays++;
  const angle = cycleTime * Math.PI * 2 - Math.PI / 2;
  const altitude = Math.sin(angle);
  const daylight = THREE.MathUtils.smoothstep(altitude, -.22, .28);
  const dusk = Math.max(0, 1 - Math.abs(altitude) * 5) * (1 - daylight * .55);
  sun.position.set(Math.cos(angle) * 45, Math.max(-8, altitude * 52), 13);
  sun.intensity = .08 + daylight * 2.25;
  moonLight.intensity = (1 - daylight) * .5;
  sunOrb.visible = altitude > -.1; moonOrb.visible = altitude < .18;
  stars.material.opacity = THREE.MathUtils.smoothstep(-altitude, .05, .6) * .9;
  hemi.intensity = .28 + daylight * 1.48;
  const sky = skyNight.clone().lerp(skyDay, daylight).lerp(skyDusk, dusk * .82);
  scene.background.copy(sky); fogColor.copy(sky).multiplyScalar(.96); scene.fog.color.copy(fogColor);
  waterMat.color.copy(new THREE.Color(0x17395c).lerp(new THREE.Color(0x56b5c5), daylight));
  const hour = Math.floor(cycleTime * 24), minute = Math.floor((cycleTime * 24 % 1) * 60);
  document.querySelector('#clock').textContent = `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
  document.querySelector('#dayNumber').textContent = String(worldDays).padStart(2,'0');
  const phase = altitude < -.15 ? 'NIGHTFALL' : altitude < .25 ? (altitude < 0 ? 'BLUE HOUR' : 'GOLDEN HOUR') : daylight > .7 ? 'ISLAND DAYLIGHT' : 'MORNING LIGHT';
  document.querySelector('#periodName').textContent = phase;
  document.querySelector('#weatherIcon').textContent = altitude < -.15 ? '☾' : dusk > .45 ? '◒' : '☀';
  document.querySelector('#weatherText').textContent = altitude < -.15 ? 'STARRY NIGHT' : 'CLEAR SKIES';
  sunOrb.position.set(Math.cos(angle) * 40, altitude * 48 + 11, -58);
  moonOrb.position.set(-Math.cos(angle) * 38, -altitude * 48 + 12, -55);
  sunOrb.material.color.set(altitude < .15 ? 0xffb67d : 0xffe6a3);
}

let lastTime = performance.now(), targetTimer = 0;
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(.05, (now - lastTime) / 1000); lastTime = now;
  updateDayNight(dt);
  const forward = (held.has('KeyW') || held.has('ArrowUp') || mobileHeld.has('forward') ? 1 : 0) - (held.has('KeyS') || held.has('ArrowDown') || mobileHeld.has('back') ? 1 : 0);
  const strafe = (held.has('KeyD') || held.has('ArrowRight') || mobileHeld.has('right') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') || mobileHeld.has('left') ? 1 : 0);
  const magnitude = Math.hypot(forward, strafe) || 1;
  const speed = (held.has('ShiftLeft') || held.has('ShiftRight') ? 7 : 4.7) * dt;
  const nextX = player.x + (Math.sin(player.yaw) * forward + Math.cos(player.yaw) * strafe) / magnitude * speed;
  const nextZ = player.z + (-Math.cos(player.yaw) * forward + Math.sin(player.yaw) * strafe) / magnitude * speed;
  const stepLimit = player.y + 1.55;
  const canStepTo = (x, z) => {
    const floor = floorAt(x, z, stepLimit);
    return floor > -50;
  };
  if (canStepTo(nextX, nextZ)) {
    player.x = nextX; player.z = nextZ;
  } else {
    // Resolve each axis independently so a blocked diagonal doesn't stop all movement.
    if (canStepTo(nextX, player.z)) player.x = nextX;
    if (canStepTo(player.x, nextZ)) player.z = nextZ;
  }
  const floor = floorAt(player.x, player.z, player.y + 1.55);
  if (player.grounded && floor > player.y && floor <= player.y + 1.05) {
    player.y = floor; player.vy = 0;
  }
  if (floor > -50 && player.vy <= 0 && player.y <= floor) {
    player.y = floor; player.vy = 0; player.grounded = true;
  } else {
    player.vy -= 19 * dt;
    player.y += player.vy * dt;
    if (floor > -50 && player.vy <= 0 && player.y <= floor) {
      player.y = floor; player.vy = 0; player.grounded = true;
    } else {
      player.grounded = false;
    }
  }
  if (player.y < -12) {
    player.x = 0; player.z = 4; player.y = (groundTops.get('0,4') ?? 2) + .52; player.vy = 0;
    toast('You found your way back to shore');
  }
  syncCamera();
  for (let i = 0; i < clouds.length; i++) {
    clouds[i].position.x += dt * (.12 + (i % 3) * .035);
    if (clouds[i].position.x > 62) clouds[i].position.x = -62;
  }
  water.position.y = -.64 + Math.sin(now * .00035) * .018;
  waterLine.scale.set(1.2 + Math.sin(now * .00025) * .018, .88 + Math.sin(now * .00025) * .02, 1);
  if (now - targetTimer > 90) { updateTarget(); targetTimer = now; }
  document.querySelector('#coords').textContent = `X ${Math.round(player.x)} · Z ${Math.round(player.z)}`;
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);
setTimeout(() => document.querySelector('#loading').classList.add('done'), 250);
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
});
document.querySelector('#fullscreenBtn').addEventListener('click', () => {
  if (!document.fullscreenElement) document.querySelector('#game').requestFullscreen?.(); else document.exitFullscreen?.();
});
let audioContext = null, ambient = null, soundOn = false;
document.querySelector('#soundBtn').addEventListener('click', async () => {
  const button = document.querySelector('#soundBtn');
  if (!soundOn) {
    try {
      audioContext ||= new AudioContext(); await audioContext.resume();
      const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 2, audioContext.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * .22;
      const source = audioContext.createBufferSource(); source.buffer = buffer; source.loop = true;
      const filter = audioContext.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 260;
      const gain = audioContext.createGain(); gain.gain.value = .055;
      source.connect(filter).connect(gain).connect(audioContext.destination); source.start(); ambient = gain; soundOn = true;
      button.title = 'Sound: on'; button.style.background = 'rgba(255,239,177,.28)'; toast('Soft island ambience on');
    } catch { toast('Audio is unavailable in this browser'); }
  } else {
    ambient?.disconnect(); soundOn = false; button.title = 'Sound: off'; button.style.background = ''; toast('Sound off');
  }
});

// Avoid accidental browser zoom/scroll gestures over the game on touch devices.
document.addEventListener('touchmove', e => { if (started) e.preventDefault(); }, { passive: false });
