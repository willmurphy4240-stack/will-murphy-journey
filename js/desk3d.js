/* The desk island: a 3D desk floating in warm darkness. Drag to spin it around,
   click an object and the camera flies in to open that section. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildGlobe, arcPoints } from './globe.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isPhone = () => innerWidth < 760;
const stage = document.getElementById('stage');
const canvas = document.getElementById('scene');
const shell = document.getElementById('panel-shell');
const panels = [...shell.querySelectorAll('.panel')];
const card = shell.querySelector('.panel-card');
const backBtn = shell.querySelector('.panel-back');
const tagEls = [...document.querySelectorAll('.tag3d')];
let mode = 'explore';            // explore | focus | leaving
let current = null;

/* =====================================================================
   Panels (work even if 3D can't start)
   ===================================================================== */
function showPanel(id) {
  panels.forEach((p) => { p.hidden = p.dataset.panel !== id; });
  const panel = panels.find((p) => p.dataset.panel === id);
  card.removeAttribute('aria-labelledby');
  card.setAttribute('aria-label', panel.querySelector('h2').textContent);
  shell.hidden = false;
  card.scrollTop = 0;
  history.replaceState(null, '', '#' + id);
  setTimeout(() => { shell.classList.add('show'); backBtn.focus({ preventScroll: true }); }, reduce ? 0 : 520);
}
function hidePanel() {
  shell.classList.remove('show');
  history.replaceState(null, '', location.pathname);
  setTimeout(() => { if (mode === 'explore') shell.hidden = true; }, reduce ? 0 : 400);
}
shell.querySelectorAll('.tabs').forEach((tabs) => {
  const buttons = [...tabs.querySelectorAll('[role="tab"]')];
  const body = tabs.nextElementSibling;
  const select = (btn) => {
    buttons.forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
    body.querySelectorAll('[data-tabpanel]').forEach((s) => { s.hidden = s.dataset.tabpanel !== btn.dataset.tab; });
  };
  buttons.forEach((b, i) => {
    b.addEventListener('click', () => select(b));
    b.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (d) { const n = buttons[(i + d + buttons.length) % buttons.length]; n.focus(); select(n); }
    });
  });
});
const raceEl = document.getElementById('race-days');
if (raceEl) raceEl.textContent = Math.max(0, Math.ceil((new Date(2027, 10, 1) - new Date()) / 86400000));

let hintTimer = setTimeout(hideHint, 10000);
function hideHint() { clearTimeout(hintTimer); document.body.classList.add('hint-off'); }

/* =====================================================================
   3D scene
   ===================================================================== */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
} catch (err) {
  document.body.classList.add('no-webgl');
}

const W = () => innerWidth, H = () => innerHeight;
let api = null;   // { open, close } once the scene exists

if (renderer) {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, W() / H(), 0.1, 200);
  const HOME = () => ({
    pos: isPhone() ? new THREE.Vector3(0, 25, 37) : new THREE.Vector3(0, 11.5, 20),
    target: new THREE.Vector3(0, isPhone() ? 1.4 : 0.9, 0.4)
  });
  camera.position.copy(HOME().pos);

  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(HOME().target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = false;
  controls.minDistance = 9;
  controls.maxDistance = 46;
  controls.minPolarAngle = 0.45;
  controls.maxPolarAngle = 1.22;
  controls.rotateSpeed = 0.7;
  controls.autoRotate = !reduce;
  controls.autoRotateSpeed = 0.45;
  let idleTimer;
  controls.addEventListener('start', () => { controls.autoRotate = false; hideHint(); clearTimeout(idleTimer); });
  controls.addEventListener('end', () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { if (mode === 'explore' && !reduce) controls.autoRotate = true; }, 15000);
  });

  /* ---------- lights ---------- */
  scene.add(new THREE.HemisphereLight(0xffe9c8, 0x2a1508, 1.1));
  const key = new THREE.DirectionalLight(0xffe2b5, 1.7);
  key.position.set(6, 13, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
  key.shadow.bias = -0.0004;
  key.shadow.radius = 4;
  scene.add(key);

  /* ---------- helpers ---------- */
  const std = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.8, metalness: 0 }, o));
  const tex = (w, h, draw) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  };
  const put = (o, p) => { if (p.position) o.position.copy(p.position); if (p.rotation) o.rotation.copy(p.rotation); return o; };
  const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  // a box whose top face shows a texture (BoxGeometry faces: +x, -x, +y, -y, +z, -z)
  const topBox = (w, h, d, color, map) => {
    const side = std(color);
    return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, std(0xffffff, { map }), side, side, side]);
  };
  const SERIF = '"Fraunces", Georgia, serif', SANS = '"DM Sans", Arial, sans-serif';
  await Promise.race([
    Promise.all([document.fonts.load(`800 60px ${SERIF}`), document.fonts.load(`italic 600 40px ${SERIF}`), document.fonts.load(`700 30px ${SANS}`)]),
    new Promise((r) => setTimeout(r, 2500))
  ]);

  const island = new THREE.Group();
  scene.add(island);
  const clickable = {};   // id -> { group, anchor }
  function register(id, group, anchor) {
    group.traverse((m) => { if (m.isMesh) m.userData.id = id; });
    group.userData.baseY = group.position.y;
    clickable[id] = { group, anchor, lift: 0 };
    island.add(group);
  }
  const at = (x, z, ry = 0) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; return g; };

  /* ---------- the desk ---------- */
  const wood = new THREE.TextureLoader().load('assets/wood.svg');
  wood.colorSpace = THREE.SRGBColorSpace;
  wood.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const desk = new THREE.Mesh(
    new THREE.CylinderGeometry(7, 6.85, 0.5, 120),
    [std(0x6e4826, { roughness: 0.7 }), std(0xffffff, { map: wood, roughness: 0.62 }), std(0x3a2414)]
  );
  desk.position.y = -0.25;
  desk.receiveShadow = true;
  island.add(desk);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(7.0, 0.05, 8, 160), std(0xb8912e, { metalness: 0.7, roughness: 0.35 }));
  lip.rotation.x = Math.PI / 2;
  island.add(lip);
  // soft shadow under the floating desk
  const under = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshBasicMaterial({
      transparent: true, depthWrite: false,
      map: tex(256, 256, (g, w, h) => {
        const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
        r.addColorStop(0, 'rgba(10,5,2,.55)'); r.addColorStop(1, 'rgba(10,5,2,0)');
        g.fillStyle = r; g.fillRect(0, 0, w, h);
      })
    })
  );
  under.rotation.x = -Math.PI / 2;
  under.position.y = -2.2;
  scene.add(under);

  /* ---------- 1. Globe on a stand (The Journey) ---------- */
  const globeObj = at(0, -1.6);
  globeObj.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.05, 0.24, 48), std(0x4a2e18, { roughness: 0.5 })), { position: new THREE.Vector3(0, 0.12, 0) }));
  const brass = std(0xb8912e, { metalness: 0.75, roughness: 0.32 });
  globeObj.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.55, 16), brass), { position: new THREE.Vector3(0, 0.5, 0) }));
  const tilt = new THREE.Group();
  tilt.position.y = 2.32;
  tilt.rotation.z = 23.4 * Math.PI / 180;
  globeObj.add(tilt);
  const meridian = new THREE.Mesh(new THREE.TorusGeometry(1.66, 0.045, 10, 80, Math.PI), brass);
  meridian.rotation.z = Math.PI / 2;
  tilt.add(meridian);
  const deskGlobe = await buildGlobe({ radius: 1.5, dotStep: 1.25, glow: false });
  deskGlobe.setDotSize(1.7 * renderer.getPixelRatio());
  deskGlobe.sphere.castShadow = true;
  const route = [[41.85, -91.56], [30.39, -97.86], [31.55, -97.11], [29.76, -95.37]];
  for (let i = 1; i < route.length; i++) {
    const pts = arcPoints(route[i - 1], route[i], 1.5, 40);
    deskGlobe.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xc8431c })));
  }
  deskGlobe.group.rotation.y = -0.4;
  tilt.add(deskGlobe.group);
  register('journey', globeObj, new THREE.Vector3(0, 4.35, -1.6));

  /* ---------- 2. Deal folders (Experience) ---------- */
  const folders = at(-4.0, 0.9, 0.35);
  ['#CCA25D', '#D8B26C', '#E6C47F'].forEach((c, i) => {
    const f = new THREE.Group();
    f.position.set(-0.06 * (2 - i), 0.03 + i * 0.065, -0.04 * (2 - i));
    f.rotation.y = (i - 2) * 0.07;
    f.add(box(2.4, 0.05, 1.7, std(c)));
    f.add(put(box(0.72, 0.05, 0.26, std(c)), { position: new THREE.Vector3(-0.8 + i * 0.8, 0, -0.96) }));
    folders.add(f);
  });
  const sticker = new THREE.Mesh(
    new THREE.PlaneGeometry(2.3, 1.6),
    new THREE.MeshStandardMaterial({
      transparent: true, roughness: 0.9,
      map: tex(1024, 712, (g, w, h) => {
        g.fillStyle = '#FBF6EA'; g.fillRect(150, 150, 724, 210);
        g.fillStyle = '#2A2622'; g.font = `800 92px ${SERIF}`; g.textAlign = 'center'; g.fillText('DEAL FILES', 512, 278);
        g.fillStyle = '#5E554B'; g.font = `700 38px ${SANS}`; g.fillText('2025 – 2027', 512, 336);
        g.save(); g.translate(790, 545); g.rotate(-0.25);
        g.strokeStyle = 'rgba(184,52,27,.85)'; g.lineWidth = 10; g.beginPath(); g.arc(0, 0, 105, 0, Math.PI * 2); g.stroke();
        g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 84, 0, Math.PI * 2); g.stroke();
        g.fillStyle = 'rgba(184,52,27,.85)'; g.font = `700 34px ${SANS}`; g.fillText('REVIEWED', 0, 6); g.font = `700 26px ${SANS}`; g.fillText('W.M.', 0, 44);
        g.restore();
      })
    })
  );
  sticker.rotation.x = -Math.PI / 2;
  sticker.position.y = 0.03 + 2 * 0.065 + 0.027;
  folders.add(sticker);
  register('experience', folders, new THREE.Vector3(-4.0, 0.95, 0.9));

  /* ---------- 3. Notebook (Field Notes) ---------- */
  const notebook = at(4.1, 0.6, -0.4);
  notebook.add(put(box(1.48, 0.24, 1.98, std(0xf1e8d4)), { position: new THREE.Vector3(0.02, 0.14, 0) }));
  notebook.add(put(box(1.56, 0.035, 2.06, std(0x6b3f24)), { position: new THREE.Vector3(0, 0.018, 0) }));
  const coverTex = tex(780, 1030, (g, w, h) => {
    g.fillStyle = '#6B3F24'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#57311B'; g.fillRect(0, 0, 70, h);
    g.fillStyle = '#D2AE73'; g.textAlign = 'center';
    g.font = `700 82px ${SERIF}`; g.fillText('FIELD', w / 2 + 20, 380); g.fillText('NOTES', w / 2 + 20, 470);
    g.fillRect(w / 2 - 170, 510, 380, 3);
    g.font = `italic 600 46px ${SERIF}`; g.fillText('W. Murphy', w / 2 + 20, 585);
  });
  notebook.add(put(topBox(1.56, 0.035, 2.06, 0x6b3f24, coverTex), { position: new THREE.Vector3(0, 0.275, 0) }));
  notebook.add(put(box(0.07, 0.31, 2.08, std(0x2a1a10)), { position: new THREE.Vector3(0.5, 0.15, 0) }));
  notebook.add(put(box(0.1, 0.01, 0.55, std(0xc8431c)), { position: new THREE.Vector3(0.25, 0.01, 1.25) }));
  register('notes', notebook, new THREE.Vector3(4.1, 1.0, 0.6));

  /* ---------- 4. Envelope + business card (Contact) ---------- */
  const envelope = at(1.9, 3.35, 0.22);
  const cardTex = tex(600, 360, (g, w, h) => {
    g.fillStyle = '#FFFDF8'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2A2622'; g.font = `700 64px ${SERIF}`; g.fillText('Will Murphy', 50, 150);
    g.fillStyle = '#5E554B'; g.font = `700 30px ${SANS}`; g.fillText('FINANCE · BAYLOR', 52, 205);
    g.fillStyle = '#C8431C'; g.fillRect(52, 240, 180, 10);
  });
  envelope.add(put(topBox(1.0, 0.02, 0.6, 0xfffdf8, cardTex), { position: new THREE.Vector3(-0.95, 0.012, 0.62), rotation: new THREE.Euler(0, 0.35, 0) }));
  const envTex = tex(1050, 676, (g, w, h) => {
    g.fillStyle = '#F3E9D8'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#D2C2A4'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(w / 2, h * 0.58); g.lineTo(w, 0); g.stroke();
    g.beginPath(); g.moveTo(0, h); g.lineTo(w * 0.4, h * 0.5); g.moveTo(w, h); g.lineTo(w * 0.6, h * 0.5); g.stroke();
    g.fillStyle = '#2860C4'; g.fillRect(w - 170, 40, 120, 150);
    g.strokeStyle = '#FBF6EA'; g.setLineDash([10, 8]); g.lineWidth = 6; g.strokeRect(w - 160, 50, 100, 130);
  });
  envelope.add(put(topBox(2.1, 0.04, 1.35, 0xf3e9d8, envTex), { position: new THREE.Vector3(0, 0.035, 0) }));
  const sealTex = tex(256, 256, (g) => {
    g.fillStyle = '#B8341B'; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = '#8E2512'; g.lineWidth = 12; g.beginPath(); g.arc(128, 128, 88, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#F3C9B8'; g.font = `800 120px ${SERIF}`; g.textAlign = 'center'; g.fillText('W', 128, 170);
  });
  const sealMat = std(0xb8341b, { roughness: 0.45 });
  const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.25, 0.07, 40), [sealMat, std(0xffffff, { map: sealTex, roughness: 0.45 }), sealMat]);
  seal.position.set(0, 0.09, 0.09);
  envelope.add(seal);
  register('contact', envelope, new THREE.Vector3(1.9, 0.85, 3.35));

  /* ---------- 5. Race bib + kettlebell (Training) ---------- */
  const training = at(-1.9, 3.45, -0.12);
  const bibTex = tex(950, 650, (g, w, h) => {
    g.fillStyle = '#FFFDF8'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#C8431C'; g.fillRect(0, 0, w, 150);
    g.fillStyle = '#fff'; g.font = `700 58px ${SANS}`; g.textAlign = 'center'; g.fillText('RACE DAY · DALLAS', w / 2, 98);
    g.fillStyle = '#2A2622'; g.font = `800 300px ${SERIF}`; g.fillText('2027', w / 2, 455);
    g.fillStyle = '#5E554B'; g.font = `700 44px ${SANS}`; g.fillText('N O V E M B E R', w / 2, 560);
    g.strokeStyle = '#A7ADB3'; g.lineWidth = 8;
    [[50, 200], [w - 50, 200], [50, h - 50], [w - 50, h - 50]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 18, 0, Math.PI * 2); g.stroke(); });
  });
  training.add(put(topBox(1.9, 0.02, 1.3, 0xfffdf8, bibTex), { position: new THREE.Vector3(0, 0.012, 0) }));
  const iron = std(0x2b2b2b, { metalness: 0.55, roughness: 0.45 });
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.42, 40, 28), iron);
  bell.scale.y = 0.92; bell.position.set(1.5, 0.39, -0.55);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.07, 14, 36, Math.PI), iron);
  handle.position.set(1.5, 0.74, -0.55);
  training.add(bell, handle);
  register('training', training, new THREE.Vector3(-1.4, 1.25, 3.2));

  /* ---------- 6. Tray of interests ---------- */
  const tray = at(4.3, 3.05, 0);
  tray.add(put(new THREE.Mesh(new THREE.CylinderGeometry(1.08, 0.96, 0.13, 56), std(0xe7d8bd, { roughness: 0.45 })), { position: new THREE.Vector3(0, 0.065, 0) }));
  tray.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.92, 0.02, 56), std(0xefe3cb, { roughness: 0.45 })), { position: new THREE.Vector3(0, 0.13, 0) }));
  tray.add(put(new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 24), std(0xffffff, { roughness: 0.35 })), { position: new THREE.Vector3(-0.5, 0.34, 0.15) }));
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 20), std(0x7a3e1e, { roughness: 0.65 }));
  ball.scale.set(1, 0.62, 0.62); ball.position.set(0.2, 0.33, -0.25); ball.rotation.y = 0.6;
  const laces = box(0.22, 0.02, 0.04, std(0xffffff));
  laces.position.set(0, 0.3, 0); ball.add(laces);
  tray.add(ball);
  const skiTex = tex(330, 230, (g, w, h) => {
    g.fillStyle = '#2860C4'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#FBF6EA'; g.fillRect(24, 28, 100, 140);
    g.fillStyle = '#fff'; g.font = `700 64px ${SANS}`; g.textAlign = 'center'; g.fillText('SKI', 225, 125);
  });
  tray.add(put(topBox(0.56, 0.02, 0.39, 0x2860c4, skiTex), { position: new THREE.Vector3(0.38, 0.15, 0.5), rotation: new THREE.Euler(0, -0.3, 0) }));
  register('interests', tray, new THREE.Vector3(4.3, 1.0, 3.05));

  /* ---------- 7. Passport + boarding pass (Travel) ---------- */
  const travel = at(-3.7, -2.5, 0.5);
  const passTex = tex(900, 375, (g, w, h) => {
    g.fillStyle = '#FBF6EA'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#0E7C72'; g.fillRect(w - 210, 0, 210, h);
    g.fillStyle = '#5E554B'; g.font = `700 34px ${SANS}`; g.fillText('BOARDING PASS', 40, 80);
    g.fillStyle = '#2A2622'; g.font = `700 78px ${SERIF}`; g.fillText('Next stop', 40, 190);
    g.fillStyle = '#2A2622'; for (let x = 40; x < 400; x += 14) g.fillRect(x, 250, (x * 7) % 3 + 3, 70);
  });
  travel.add(put(topBox(1.8, 0.015, 0.75, 0xfbf6ea, passTex), { position: new THREE.Vector3(0.45, 0.008, 0.45), rotation: new THREE.Euler(0, -0.45, 0) }));
  const ppTex = tex(480, 650, (g, w, h) => {
    g.fillStyle = '#1F3A5C'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(212,175,55,.5)'; g.lineWidth = 4; g.strokeRect(26, 26, w - 52, h - 52);
    g.strokeStyle = '#D4AF37'; g.lineWidth = 8;
    g.beginPath(); g.arc(w / 2, 270, 100, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.ellipse(w / 2, 270, 40, 100, 0, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(w / 2 - 100, 270); g.lineTo(w / 2 + 100, 270); g.stroke();
    g.fillStyle = '#D4AF37'; g.font = `700 54px ${SERIF}`; g.textAlign = 'center'; g.fillText('PASSPORT', w / 2, 500);
  });
  travel.add(put(topBox(0.95, 0.07, 1.3, 0x1f3a5c, ppTex), { position: new THREE.Vector3(0, 0.05, 0) }));
  register('travel', travel, new THREE.Vector3(-3.7, 0.85, -2.5));

  /* ---------- 8. Framed certificate (Recognition) ---------- */
  const award = at(3.5, -2.6, -0.55);
  const frameGrp = new THREE.Group();
  frameGrp.position.set(0, 0.95, 0);
  frameGrp.rotation.x = -0.2;
  frameGrp.add(box(1.45, 1.85, 0.1, std(0x5b3a21, { roughness: 0.5 })));
  const certTex = tex(600, 800, (g, w, h) => {
    g.fillStyle = '#FBF6EA'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#B8912E'; g.lineWidth = 6; g.strokeRect(30, 30, w - 60, h - 60); g.lineWidth = 2; g.strokeRect(44, 44, w - 88, h - 88);
    g.textAlign = 'center'; g.fillStyle = '#5E554B'; g.font = `italic 600 40px ${SERIF}`; g.fillText('with honors', w / 2, 170);
    g.fillStyle = '#2A2622'; g.font = `800 66px ${SERIF}`; g.fillText("DEAN'S LIST", w / 2, 260);
    g.fillStyle = '#D6CBB5'; [320, 360, 400, 440].forEach((y, i) => g.fillRect(w / 2 - (200 - i * 25), y, 2 * (200 - i * 25), 8));
    g.fillStyle = '#C8431C'; g.beginPath(); g.moveTo(w / 2 - 50, 600); g.lineTo(w / 2 - 80, 720); g.lineTo(w / 2 - 20, 690); g.lineTo(w / 2, 600); g.fill();
    g.beginPath(); g.moveTo(w / 2 + 50, 600); g.lineTo(w / 2 + 80, 720); g.lineTo(w / 2 + 20, 690); g.lineTo(w / 2, 600); g.fill();
    const gr = g.createLinearGradient(w / 2 - 70, 520, w / 2 + 70, 660); gr.addColorStop(0, '#F2D77E'); gr.addColorStop(1, '#B8912E');
    g.fillStyle = gr; g.beginPath(); g.arc(w / 2, 590, 72, 0, Math.PI * 2); g.fill();
  });
  const cert = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.65), std(0xffffff, { map: certTex, roughness: 0.9 }));
  cert.position.z = 0.051;
  frameGrp.add(cert);
  const leg = box(0.08, 1.3, 0.08, std(0x5b3a21));
  leg.position.set(0, 0.62, -0.42); leg.rotation.x = 0.42;
  award.add(frameGrp, leg);
  register('recognition', award, new THREE.Vector3(3.5, 2.25, -2.6));

  /* ---------- decor ---------- */
  // desk lamp with a warm spotlight
  const lamp = at(5.55, -0.7, 0);
  const dark = std(0x2a2622, { metalness: 0.5, roughness: 0.4 });
  lamp.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.12, 32), dark), { position: new THREE.Vector3(0, 0.06, 0) }));
  lamp.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.7, 12), dark), { position: new THREE.Vector3(0, 1.4, 0) }));
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 12), dark);
  arm.rotation.z = Math.PI / 2; arm.position.set(-0.6, 2.72, 0);
  lamp.add(arm);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.65, 32, 1, true), std(0x0e7c72, { side: THREE.DoubleSide, roughness: 0.5 }));
  shade.position.set(-1.25, 2.5, 0);
  lamp.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffe0a8 }));
  bulb.position.set(-1.25, 2.25, 0);
  lamp.add(bulb);
  island.add(lamp);
  const spot = new THREE.SpotLight(0xffc27a, 70, 16, 0.85, 0.65, 1.6);
  spot.position.set(5.55 - 1.25, 2.3, -0.7);
  spot.target.position.set(1.5, 0, 0.6);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0006;
  scene.add(spot, spot.target);

  // coffee mug
  const mug = at(-1.35, 0.85);
  mug.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.33, 0.75, 32), std(0xefe8dc, { roughness: 0.4 })), { position: new THREE.Vector3(0, 0.375, 0) }));
  mug.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.02, 32), std(0x4a2a16, { roughness: 0.2 })), { position: new THREE.Vector3(0, 0.7, 0) }));
  mug.add(put(new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.055, 12, 24), std(0xefe8dc, { roughness: 0.4 })), { position: new THREE.Vector3(0.4, 0.4, 0) }));
  island.add(mug);

  // potted plant
  const plant = at(-2.5, -4.25);
  plant.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.4, 0.75, 28), std(0xb5603c)), { position: new THREE.Vector3(0, 0.375, 0) }));
  plant.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.03, 28), std(0x4a3020)), { position: new THREE.Vector3(0, 0.72, 0) }));
  const leafMat = std(0x5e8c4e, { roughness: 0.6 }), leafMat2 = std(0x7faf68, { roughness: 0.6 });
  for (let i = 0; i < 9; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), i % 2 ? leafMat : leafMat2);
    const a = i / 9 * Math.PI * 2;
    leaf.scale.set(1, 3.4, 0.55);
    leaf.position.set(Math.cos(a) * 0.22, 1.18 + (i % 3) * 0.08, Math.sin(a) * 0.22);
    leaf.rotation.set(Math.sin(a) * 0.55, -a, -Math.cos(a) * 0.55);
    plant.add(leaf);
  }
  island.add(plant);

  // pen
  const pen = at(2.9, 1.55, 0.9);
  const penBody = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 16), std(0x1f2a36, { roughness: 0.3, metalness: 0.3 }));
  penBody.rotation.z = Math.PI / 2; penBody.position.y = 0.05;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 16), brass);
  tip.rotation.z = Math.PI / 2; tip.position.set(0.73, 0.05, 0);
  pen.add(penBody, tip);
  island.add(pen);

  island.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  desk.castShadow = false;
  bulb.castShadow = false;
  deskGlobe.group.traverse((m) => { if (m.isMesh) m.receiveShadow = false; });

  document.body.classList.add('scene-ready');

  /* ---------- interaction ---------- */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const hits = Object.values(clickable).flatMap((c) => { const a = []; c.group.traverse((m) => m.isMesh && a.push(m)); return a; });
  let hovered = null, down = null;
  function pick(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(hits, false)[0];
    return hit ? hit.object.userData.id : null;
  }
  canvas.addEventListener('pointermove', (e) => {
    if (mode !== 'explore' || e.pointerType !== 'mouse') return;
    hovered = pick(e);
    canvas.style.cursor = hovered ? 'pointer' : 'grab';
    tagEls.forEach((t) => t.classList.toggle('hot', t.dataset.open === hovered));
  });
  canvas.addEventListener('pointerleave', () => { hovered = null; tagEls.forEach((t) => t.classList.remove('hot')); });
  canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6;
    down = null;
    if (moved) return;
    if (mode === 'explore') { const id = pick(e); if (id) open(id); }
    else if (mode === 'focus') close();
  });

  /* ---------- camera flights ---------- */
  const view = { offX: 0, offY: 0 };
  let tween = null, saved = null;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  function fly(toPos, toTarget, toOff, ms, done) {
    tween = {
      t0: performance.now(), ms: reduce ? 1 : ms, done,
      p0: camera.position.clone(), p1: toPos, q0: controls.target.clone(), q1: toTarget,
      o0: { ...view }, o1: toOff
    };
  }
  function focusPose(id, closeness = 1) {
    const g = clickable[id].group;
    const b = new THREE.Box3().setFromObject(g);
    const center = b.getCenter(new THREE.Vector3());
    const radius = b.getSize(new THREE.Vector3()).length() / 2;
    const dir = camera.position.clone().sub(controls.target).normalize().lerp(new THREE.Vector3(0, 1, 0), 0.3).normalize();
    const fit = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2));
    const dist = fit * (isPhone() ? 1.45 : 1.2) * closeness;
    return { pos: center.clone().add(dir.multiplyScalar(dist)), target: center };
  }
  function open(id) {
    if (mode !== 'explore' || !clickable[id]) return;
    hideHint();
    current = id;
    controls.enabled = false;
    controls.autoRotate = false;
    saved = { pos: camera.position.clone(), target: controls.target.clone() };
    tagEls.forEach((t) => t.classList.remove('hot'));
    if (id === 'journey') {
      mode = 'leaving';
      document.body.classList.add('leaving', 'focused');
      const p = focusPose(id, 0.45);
      fly(p.pos, p.target, { offX: 0, offY: 0 }, 1300);
      setTimeout(() => { location.href = 'journey.html'; }, reduce ? 0 : 1150);
      return;
    }
    mode = 'focus';
    document.body.classList.add('focused');
    const p = focusPose(id);
    fly(p.pos, p.target, isPhone() ? { offX: 0, offY: 0.2 } : { offX: 0.22, offY: 0 }, 1100);
    showPanel(id);
  }
  function close() {
    if (mode !== 'focus') return;
    mode = 'returning';
    document.body.classList.remove('focused');
    hidePanel();
    fly(saved.pos, saved.target, { offX: 0, offY: 0 }, 1000, () => {
      mode = 'explore'; controls.enabled = true; shell.hidden = true;
      const t = tagEls.find((x) => x.dataset.open === current); current = null;
      if (t) t.focus({ preventScroll: true });
    });
  }
  api = { open, close };

  /* ---------- floating tags ---------- */
  const v = new THREE.Vector3();
  function placeTags() {
    tagEls.forEach((el) => {
      const c = clickable[el.dataset.open];
      v.copy(c.anchor); v.y += c.group.position.y - c.group.userData.baseY;
      v.project(camera);
      const visible = v.z < 1 && mode === 'explore';
      el.classList.toggle('show', visible);
      el.style.transform = `translate(-50%, -50%) translate(${(v.x + 1) / 2 * W()}px, ${(1 - v.y) / 2 * H()}px)`;
    });
  }

  /* ---------- loop ---------- */
  function resize() {
    renderer.setSize(W(), H(), false);
    camera.aspect = W() / H();
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!reduce) deskGlobe.group.rotation.y += dt * 0.25;

    for (const [id, c] of Object.entries(clickable)) {
      const want = (id === hovered && mode === 'explore') ? 0.14 : 0;
      c.lift += (want - c.lift) * Math.min(1, dt * 10);
      c.group.position.y = c.group.userData.baseY + c.lift;
    }

    if (tween) {
      const t = Math.min(1, (now - tween.t0) / tween.ms), e = ease(t);
      camera.position.lerpVectors(tween.p0, tween.p1, e);
      controls.target.lerpVectors(tween.q0, tween.q1, e);
      view.offX = tween.o0.offX + (tween.o1.offX - tween.o0.offX) * e;
      view.offY = tween.o0.offY + (tween.o1.offY - tween.o0.offY) * e;
      camera.lookAt(controls.target);
      if (t >= 1) { const d = tween.done; tween = null; if (d) d(); }
    }
    if (mode === 'explore' && !tween) controls.update();
    camera.setViewOffset(W(), H(), view.offX * W(), view.offY * H(), W(), H());

    placeTags();
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    document.body.classList.remove('leaving', 'focused');
    mode = 'explore'; controls.enabled = true; tween = null;
    camera.position.copy(saved ? saved.pos : HOME().pos);
    controls.target.copy(saved ? saved.target : HOME().target);
  });
}

/* ---------- wiring that works with or without 3D ---------- */
tagEls.forEach((t) => t.addEventListener('click', () => {
  if (api) api.open(t.dataset.open);
  else if (t.dataset.open === 'journey') location.href = 'journey.html';
  else { mode = 'focus'; document.body.classList.add('focused'); showPanel(t.dataset.open); }
}));
backBtn.addEventListener('click', () => {
  if (api) api.close();
  else { mode = 'explore'; document.body.classList.remove('focused'); hidePanel(); }
});
addEventListener('keydown', (e) => { if (e.key === 'Escape' && mode === 'focus') backBtn.click(); });

const fromHash = location.hash.slice(1);
if (fromHash && fromHash !== 'journey' && panels.some((p) => p.dataset.panel === fromHash)) {
  setTimeout(() => (api ? api.open(fromHash) : tagEls.find((t) => t.dataset.open === fromHash)?.click()), 300);
}
