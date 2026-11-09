/* Scroll-driven 3D globe timeline. Story content comes from js/data.js. */
import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { buildGlobe, ll2v, arcPoints } from './globe.js';

const { stops, travels } = window.JOURNEY;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = () => matchMedia('(max-width: 760px)').matches;

/* ---------- Build the chapter + travel sections ---------- */
const story = document.getElementById('story');
const outro = story.querySelector('.outro');
const steps = [{ el: story.querySelector('.hero'), type: 'hero', segs: 0, stop: -1 }];
stops.forEach((s, i) => {
  if (i > 0) {
    const t = travels[i - 1] || {};
    const sec = document.createElement('section');
    sec.className = 'step travel';
    sec.style.setProperty('--c', s.color);
    sec.innerHTML =
      `<div class="travel-inner">
         <span class="travel-when">${t.when || ''}</span>
         <p class="travel-text">${t.text || ''}</p>
         <span class="travel-route">${stops[i - 1].place} &rarr; ${s.place}</span>
       </div>`;
    story.insertBefore(sec, outro);
    steps.push({ el: sec, type: 'travel', i, segs: i, stop: i - 1 });
  }
  const sec = document.createElement('section');
  sec.className = 'step chapter';
  sec.id = s.id;
  sec.style.setProperty('--c', s.color);
  sec.innerHTML =
    `<article class="card">
       <div class="card-num">${s.num}</div>
       <p class="card-years">${s.years}</p>
       <h2>${s.place}</h2>
       <p class="card-where">${s.where}</p>
       <p class="card-blurb">${s.blurb}</p>
       <button class="btn" type="button" data-stop="${i}">See highlights <span aria-hidden="true">&rarr;</span></button>
     </article>`;
  story.insertBefore(sec, outro);
  steps.push({ el: sec, type: 'stop', i, segs: i, stop: i });
});
steps.push({ el: outro, type: 'outro', segs: stops.length - 1, stop: stops.length - 1 });

/* ---------- Progress rail ---------- */
const rail = document.getElementById('rail');
const railLinks = stops.map((s) => {
  const a = document.createElement('a');
  a.href = '#' + s.id;
  a.style.setProperty('--c', s.color);
  a.innerHTML = `<span class="dot"></span><span class="rail-label">${s.place}</span>`;
  rail.appendChild(a);
  return a;
});

/* ---------- Three.js scene ---------- */
const canvas = document.getElementById('globe');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.0005, 100);
scene.add(new THREE.AmbientLight(0xfff3e0, 1.6));
const sun = new THREE.DirectionalLight(0xffe2b8, 1.5);
scene.add(sun);

const globe = await buildGlobe({ radius: 1, dotStep: 0.7 });
scene.add(globe.group);
document.body.classList.add('globe-ready');

// pins
const pins = stops.map((s) => {
  const g = new THREE.Group();
  const p = ll2v(s.coords[0], s.coords[1], 1.0035);
  g.position.copy(p);
  g.lookAt(p.clone().multiplyScalar(2));
  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: s.color }));
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.5, 2.1, 40), new THREE.MeshBasicMaterial({ color: s.color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
  g.add(head, ring);
  scene.add(g);
  return { g, head, ring, dir: p.clone().normalize() };
});

// route arcs (fat lines, revealed as you scroll)
const arcs = stops.slice(1).map((s, i) => {
  const pts = arcPoints(stops[i].coords, s.coords, 1, 80);
  const geo = new LineGeometry();
  geo.setPositions(pts.flatMap((v) => [v.x, v.y, v.z]));
  const mat = new LineMaterial({ color: new THREE.Color(s.color).getHex(), linewidth: 3.5, transparent: true, depthTest: true });
  const line = new Line2(geo, mat);
  line.computeLineDistances();
  geo.instanceCount = 0;
  scene.add(line);
  return { line, geo, mat, n: pts.length - 1, shown: 0, target: 0 };
});

// HTML labels that follow the pins
const labelLayer = document.getElementById('globe-labels');
const labels = stops.map((s) => {
  const el = document.createElement('div');
  el.className = 'globe-label';
  el.style.setProperty('--c', s.color);
  el.innerHTML = `<b>${s.num}</b>${s.place}`;
  labelLayer.appendChild(el);
  return el;
});

/* ---------- Camera ---------- */
const cam = { dir: ll2v(32, -96, 1).normalize(), alt: isMobile() ? 5.2 : 3.9, offX: 0, offY: -0.27 };
const goal = { dir: cam.dir.clone(), alt: cam.alt, offX: 0, offY: 0 };
let heroLon = -96, current = -1, lastT = performance.now();

function midDir(list) {
  const v = new THREE.Vector3();
  list.forEach((c) => v.add(ll2v(c[0], c[1], 1)));
  return v.normalize();
}
function setGoal(step) {
  const side = step.type !== 'hero';
  goal.offX = side && !isMobile() ? -0.2 : 0;
  goal.offY = side && isMobile() ? 0.2 : 0;
  if (step.type === 'hero') { goal.alt = isMobile() ? 5.2 : 3.9; goal.offY = -0.27; }
  else if (step.type === 'stop') {
    const s = stops[step.i];
    goal.dir.copy(ll2v(s.coords[0], s.coords[1], 1).normalize());
    goal.alt = (s.alt ?? 0.12) * (isMobile() ? 1.6 : 1);
  } else if (step.type === 'travel') {
    const a = stops[step.i - 1].coords, b = stops[step.i].coords;
    goal.dir.copy(midDir([a, b]));
    const ang = ll2v(a[0], a[1]).angleTo(ll2v(b[0], b[1]));
    goal.alt = Math.max(0.16, ang * 2.1 + 0.08) * (isMobile() ? 1.5 : 1);
  } else {
    goal.dir.copy(midDir(stops.map((s) => s.coords)));
    goal.alt = isMobile() ? 0.75 : 0.5;
  }
}

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  arcs.forEach((a) => a.mat.resolution.set(w, h));
}
addEventListener('resize', resize);
resize();

const tmp = new THREE.Vector3();
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  const k = reduceMotion ? 1 : 1 - Math.pow(0.045, dt);   // smooth, frame-rate independent

  if (steps[current]?.type === 'hero' || current < 0) {
    if (!reduceMotion) heroLon += dt * 5;
    goal.dir.copy(ll2v(26, heroLon, 1).normalize());
  }
  cam.dir.lerp(goal.dir, k).normalize();
  // zoom out a little while travelling a long way, so the move reads as a flight
  const travelBoost = Math.min(1.2, cam.dir.angleTo(goal.dir) * 3);
  cam.alt += (goal.alt * (1 + travelBoost) - cam.alt) * k;
  cam.offX += (goal.offX - cam.offX) * k;
  cam.offY += (goal.offY - cam.offY) * k;

  camera.position.copy(cam.dir).multiplyScalar(1 + cam.alt);
  camera.up.set(0, 1, 0);
  camera.lookAt(0, 0, 0);
  const w = innerWidth, h = innerHeight;
  camera.setViewOffset(w, h, cam.offX * w, cam.offY * h, w, h);
  sun.position.copy(camera.position).add(tmp.set(-2, 2, 0)).normalize().multiplyScalar(5);

  globe.setDotSize(renderer.getPixelRatio() * Math.min(5, Math.max(1.6, 1.5 / Math.sqrt(cam.alt))));

  // pin size stays readable at any zoom
  const pinScale = Math.max(0.0006, cam.alt * 0.0065);
  pins.forEach((p, i) => {
    p.g.scale.setScalar(pinScale);
    const active = steps[current]?.type === 'stop' && steps[current].i === i;
    const pulse = active && !reduceMotion ? 1 + 0.6 * ((now / 1400) % 1) : 1;
    p.ring.scale.setScalar(pulse);
    p.ring.material.opacity = active ? 0.9 * (1 - ((now / 1400) % 1) * 0.8) : 0.55;
  });

  // reveal arcs
  arcs.forEach((a) => {
    a.shown += (a.target - a.shown) * (reduceMotion ? 1 : 1 - Math.pow(0.12, dt));
    a.geo.instanceCount = Math.round(a.shown * a.n);
  });

  // labels
  const camDir = tmp.copy(camera.position).normalize();
  labels.forEach((el, i) => {
    const p = pins[i];
    const facing = p.dir.dot(camDir);
    const v = p.g.position.clone().project(camera);
    const show = facing > 0.25 && cam.alt < 1.1 && v.z < 1;
    el.classList.toggle('show', show);
    if (show) el.style.transform = `translate(${(v.x + 1) / 2 * w}px, ${(1 - v.y) / 2 * h}px)`;
    el.classList.toggle('active', steps[current]?.stop === i && steps[current]?.type !== 'hero');
  });

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* ---------- Scroll steps ---------- */
function activate(idx) {
  if (idx === current || idx < 0) return;
  current = idx;
  const step = steps[idx];
  steps.forEach((s, k) => s.el.classList.toggle('is-active', k === idx));
  railLinks.forEach((a, k) => {
    a.classList.toggle('visited', k <= step.stop);
    a.classList.toggle('current', k === step.stop && step.type !== 'outro');
  });
  rail.classList.toggle('show', step.type !== 'hero');
  arcs.forEach((a, k) => { a.target = k < step.segs ? 1 : 0; if (k >= step.segs) a.shown = Math.min(a.shown, 0); });
  setGoal(step);
}
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) activate(steps.findIndex((s) => s.el === e.target)); });
}, { rootMargin: '-45% 0px -54% 0px' });
steps.forEach((s) => io.observe(s.el));
activate(0);

/* ---------- Highlights drawer ---------- */
const drawer = document.getElementById('drawer');
const drawerBody = document.getElementById('drawer-body');
const backdrop = document.getElementById('drawer-backdrop');
const closeBtn = drawer.querySelector('.drawer-close');
let lastFocus = null;
drawer.inert = true;

function openDrawer(i) {
  const s = stops[i];
  drawer.style.setProperty('--c', s.color);
  drawerBody.innerHTML =
    `<div class="card-num">${s.num}</div>
     <p class="card-years">${s.years} &middot; ${s.where}</p>
     <h2 id="drawer-title">${s.place}</h2>
     ${s.intro ? `<p class="drawer-intro">${s.intro}</p>` : ''}
     <ul class="hl-list">
       ${s.highlights.map((h) => `
         <li class="hl">
           ${h.date ? `<div class="hl-date">${h.date}</div>` : ''}
           <h3>${h.title}</h3>
           <p>${h.text}</p>
           ${h.image ? `<img src="${h.image}" alt="${h.alt || h.title}" loading="lazy">` : ''}
           ${h.link ? `<a href="${h.link}" target="_blank" rel="noopener">Learn more &rarr;</a>` : ''}
         </li>`).join('')}
     </ul>`;
  lastFocus = document.activeElement;
  drawer.inert = false;
  document.body.classList.add('drawer-open');
  drawer.scrollTop = 0;
  closeBtn.focus({ preventScroll: true });
}
function closeDrawer() {
  document.body.classList.remove('drawer-open');
  drawer.inert = true;
  if (lastFocus) lastFocus.focus({ preventScroll: true });
}
story.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-stop]');
  if (btn) openDrawer(+btn.dataset.stop);
});
closeBtn.addEventListener('click', closeDrawer);
backdrop.addEventListener('click', closeDrawer);
addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('drawer-open')) closeDrawer(); });
