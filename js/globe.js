/* A warm "vintage paper" globe: cream sphere, dotted land, coastlines, US state lines,
   graticule, and a soft glow. Used on the journey page and on the desk. */
import * as THREE from 'three';
import { geoEquirectangular, geoPath } from 'd3-geo';
import { feature, mesh } from 'topojson-client';

const DEG = Math.PI / 180;
let dataPromise = null;
function loadData() {
  dataPromise ||= Promise.all([
    fetch('assets/data/land-110m.json').then((r) => r.json()),
    fetch('assets/data/states-10m.json').then((r) => r.json())
  ]);
  return dataPromise;
}

/** lat/lon (degrees) -> point on a sphere of radius r. Americas face +z. */
export function ll2v(lat, lon, r = 1) {
  const phi = (90 - lat) * DEG, th = (lon + 180) * DEG;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
}

function lineSegments(lines, r, color, opacity = 1) {
  const pos = [];
  const maxStep = 1.2 * DEG;
  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      const a = ll2v(line[i - 1][1], line[i - 1][0], r), b = ll2v(line[i][1], line[i][0], r);
      const ang = a.angleTo(b);
      if (ang > 0.6) continue;                       // skip seam jumps
      const n = Math.max(1, Math.ceil(ang / maxStep));
      let prev = a;
      for (let k = 1; k <= n; k++) {
        const p = a.clone().lerp(b, k / n).setLength(r);
        pos.push(prev.x, prev.y, prev.z, p.x, p.y, p.z);
        prev = p;
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity }));
}

function dotTexture() {
  // soft-edged round dot so points don't shimmer or look jagged
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 30);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.62, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export const GLOBE_COLORS = {
  ocean: '#F2E3C2', land: '#E2CA9A', dots: '#7E5A2C', coast: '#5A3E1E', grid: '#B89A66', states: '#A88A5A', visited: '#C8431C', glow: '#F5C27A'
};

/**
 * @param {object} o  radius, dotStep (deg), states (bool), glow (bool), colors
 * @returns group, setDotSize(px), point(lat, lon, height)
 */
export async function buildGlobe(o = {}) {
  const radius = o.radius ?? 1;
  const dotStep = o.dotStep ?? 0.5;
  const C = Object.assign({}, GLOBE_COLORS, o.colors || {});
  const [world, us] = await loadData();
  const land = feature(world, world.objects.land);
  const group = new THREE.Group();

  // ocean / paper sphere with a soft tan land fill under the dots
  const fill = document.createElement('canvas'); fill.width = 4096; fill.height = 2048;
  const fctx = fill.getContext('2d');
  fctx.fillStyle = C.ocean; fctx.fillRect(0, 0, fill.width, fill.height);
  const fproj = geoEquirectangular().scale(fill.width / (2 * Math.PI)).translate([fill.width / 2, fill.height / 2]).precision(0.1);
  fctx.beginPath(); geoPath(fproj, fctx)(land); fctx.fillStyle = C.land; fctx.fill();
  const fillTex = new THREE.CanvasTexture(fill);
  fillTex.colorSpace = THREE.SRGBColorSpace;
  fillTex.anisotropy = 8;
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 128, 96),
    new THREE.MeshStandardMaterial({ map: fillTex, roughness: 0.95, metalness: 0 })
  );
  sphere.name = 'globe-sphere';
  group.add(sphere);

  // graticule every 15 degrees
  const grat = [];
  for (let lon = -180; lon < 180; lon += 15) { const l = []; for (let lat = -80; lat <= 80; lat += 2) l.push([lon, lat]); grat.push(l); }
  for (let lat = -75; lat <= 75; lat += 15) { const l = []; for (let lon = -180; lon <= 180; lon += 2) l.push([lon, lat]); grat.push(l); }
  group.add(lineSegments(grat, radius * 1.001, C.grid, 0.45));

  // coastlines
  group.add(lineSegments(mesh(world, world.objects.land).coordinates, radius * 1.0025, C.coast));

  // US states (internal borders faint, Iowa + Texas highlighted)
  if (o.states !== false) {
    group.add(lineSegments(mesh(us, us.objects.states, (a, b) => a !== b).coordinates, radius * 1.002, C.states, 0.7));
    const visited = feature(us, us.objects.states).features.filter((f) => f.id === '19' || f.id === '48');
    const rings = [];
    visited.forEach((f) => {
      const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      polys.forEach((p) => rings.push(...p));
    });
    group.add(lineSegments(rings, radius * 1.003, C.visited));
  }

  // dotted land, sampled from a land mask
  const W = 2048, H = 1024;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const proj = geoEquirectangular().scale(W / (2 * Math.PI)).translate([W / 2, H / 2]).precision(0.1);
  ctx.beginPath(); geoPath(proj, ctx)(land); ctx.fillStyle = '#fff'; ctx.fill();
  const px = ctx.getImageData(0, 0, W, H).data;
  const dots = [];
  let row = 0;
  for (let lat = -84; lat <= 84; lat += dotStep, row++) {
    const step = dotStep / Math.max(Math.cos(lat * DEG), 0.12);
    for (let lon = -180 + (row % 2) * step / 2; lon < 180; lon += step) {   // offset rows: hex-like pattern
      const x = Math.floor((lon + 180) / 360 * W), y = Math.floor((90 - lat) / 180 * H);
      if (px[(y * W + x) * 4] > 127) { const v = ll2v(lat, lon, radius * 1.0015); dots.push(v.x, v.y, v.z); }
    }
  }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.Float32BufferAttribute(dots, 3));
  const dotMat = new THREE.PointsMaterial({
    color: C.dots, size: 2, sizeAttenuation: false, map: dotTexture(), transparent: true, depthWrite: false
  });
  group.add(new THREE.Points(dg, dotMat));

  // soft warm glow around the edge
  if (o.glow !== false) {
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.12, 64, 48),
      new THREE.ShaderMaterial({
        uniforms: { c: { value: new THREE.Color(C.glow) } },
        vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: 'uniform vec3 c; varying vec3 vN; void main(){ float i = pow(0.62 - dot(vN, vec3(0.0,0.0,1.0)), 3.0); gl_FragColor = vec4(c, 1.0) * i; }',
        side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false
      })
    );
    group.add(glow);
  }

  return {
    group, sphere, radius,
    setDotSize: (s) => { dotMat.size = s; },
    point: (lat, lon, h = 0) => ll2v(lat, lon, radius * (1 + h))
  };
}

/** Arc between two lat/lon points, raised off the surface. Returns array of Vector3. */
export function arcPoints(a, b, radius = 1, n = 64) {
  const va = ll2v(a[0], a[1], 1), vb = ll2v(b[0], b[1], 1);
  const ang = va.angleTo(vb);
  const lift = Math.max(0.006, ang * 0.32);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const s = Math.sin(ang);
    const v = s < 1e-6 ? va.clone() : va.clone().multiplyScalar(Math.sin((1 - t) * ang) / s).add(vb.clone().multiplyScalar(Math.sin(t * ang) / s));
    pts.push(v.normalize().multiplyScalar(radius * (1 + lift * Math.sin(Math.PI * t) + 0.003)));
  }
  return pts;
}
