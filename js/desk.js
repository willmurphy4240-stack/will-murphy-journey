/* The desk: a camera you can pan around, and objects that zoom in to open a panel. */
(function () {
  const VB = { w: 1600, h: 1000 };                       // size of the SVG scene
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  const stage = document.getElementById('stage');
  const world = document.getElementById('world');
  const shell = document.getElementById('panel-shell');
  const panels = [...shell.querySelectorAll('.panel')];
  const backBtn = shell.querySelector('.panel-back');
  const objs = [...document.querySelectorAll('.obj')];

  const vw = () => stage.clientWidth;
  const vh = () => stage.clientHeight;
  const isPhone = () => vw() < 760;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  let S = 1;                                  // screen px per scene unit at zoom 1
  const cam = { x: 800, y: 520, z: 1 };       // what is rendered
  const target = { x: 800, y: 520, z: 1 };    // where the camera is heading
  const base = { x: 800, y: 520 };            // where the visitor has panned to
  const look = { x: 0, y: 0 };                // gentle "look toward the mouse" offset
  let mode = 'explore';                       // 'explore' | 'focus' | 'leaving'
  let raf = 0, current = null;

  /* ---------- camera ---------- */
  function layout() {
    S = Math.max(vw() * 1.12 / VB.w, vh() * 1.12 / VB.h);
    world.style.width = VB.w * S + 'px';
    world.style.height = VB.h * S + 'px';
    world.style.setProperty('--ww', VB.w * S + 'px');
    world.style.setProperty('--wh', VB.h * S + 'px');
    if (mode === 'explore') { exploreTarget(); Object.assign(cam, target); render(); }
    else if (mode === 'focus' && current) { focusOn(current, true); }
  }
  function exploreTarget() {
    const hw = vw() / 2 / S, hh = vh() / 2 / S;
    base.x = clamp(base.x, hw, VB.w - hw);
    base.y = clamp(base.y, hh, VB.h - hh);
    target.x = clamp(base.x + look.x, hw, VB.w - hw);
    target.y = clamp(base.y + look.y, hh, VB.h - hh);
    target.z = 1;
    kick();
  }
  function render() {
    world.style.transform =
      `translate3d(${vw() / 2}px, ${vh() / 2}px, 0) scale(${cam.z}) translate3d(${-cam.x * S}px, ${-cam.y * S}px, 0)`;
  }
  function tick() {
    const k = reduce ? 1 : 0.11;
    cam.x += (target.x - cam.x) * k;
    cam.y += (target.y - cam.y) * k;
    cam.z += (target.z - cam.z) * k;
    const done = Math.abs(target.x - cam.x) + Math.abs(target.y - cam.y) < 0.05 && Math.abs(target.z - cam.z) < 0.0005;
    if (done) Object.assign(cam, target);
    render();
    raf = done ? 0 : requestAnimationFrame(tick);
  }
  function kick() { if (!raf) raf = requestAnimationFrame(tick); }

  // Convert an element's on-screen box to scene units (using the camera as currently rendered).
  function sceneBox(el) {
    const r = el.getBoundingClientRect(), s = stage.getBoundingClientRect();
    const toScene = (px, py) => ({
      x: cam.x + (px - s.left - vw() / 2) / (S * cam.z),
      y: cam.y + (py - s.top - vh() / 2) / (S * cam.z)
    });
    const a = toScene(r.left, r.top), b = toScene(r.right, r.bottom);
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, w: b.x - a.x, h: b.y - a.y };
  }

  /* ---------- looking around: drag, wheel, mouse, keys ---------- */
  let drag = null, moved = false;
  stage.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    moved = false;
    if (mode === 'explore') drag = { x: e.clientX, y: e.clientY, bx: base.x, by: base.y };
  });
  window.addEventListener('pointermove', (e) => {
    if (mode !== 'explore') return;
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!moved && Math.hypot(dx, dy) > 6) { moved = true; stage.classList.add('dragging'); hideHint(); }
      if (moved) { base.x = drag.bx - dx / S; base.y = drag.by - dy / S; exploreTarget(); }
    } else if (finePointer && e.pointerType === 'mouse') {
      look.x = (e.clientX / vw() - 0.5) * (vw() / S) * 0.16;
      look.y = (e.clientY / vh() - 0.5) * (vh() / S) * 0.16;
      exploreTarget();
    }
  });
  const endDrag = () => { drag = null; stage.classList.remove('dragging'); };
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (mode !== 'explore') return;
    const unit = e.deltaMode === 1 ? 30 : 1;
    base.x += (e.shiftKey ? e.deltaY : e.deltaX) * unit / S;
    base.y += (e.shiftKey ? 0 : e.deltaY) * unit / S;
    exploreTarget(); hideHint();
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mode === 'focus') { close(); return; }
    if (mode !== 'explore') return;
    const step = 90 / S, keys = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (keys[e.key] && !e.target.closest('.panel-card')) {
      base.x += keys[e.key][0]; base.y += keys[e.key][1]; exploreTarget(); hideHint();
    }
  });

  let hintTimer = setTimeout(hideHint, 9000);
  function hideHint() { clearTimeout(hintTimer); document.body.classList.add('hint-off'); }

  /* ---------- opening objects ---------- */
  objs.forEach((o) => {
    o.addEventListener('click', (e) => {
      if (moved) { moved = false; return; }
      e.stopPropagation();
      if (mode === 'explore') open(o);
    });
    o.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && mode === 'explore') { e.preventDefault(); open(o); }
    });
  });
  // Clicking the desk while zoomed in goes back out.
  stage.addEventListener('click', () => { if (mode === 'focus' && !moved) close(); });

  function focusOn(o, instant) {
    const r = sceneBox(o.querySelector('.obj-body'));
    let z, x = r.x, y = r.y;
    if (isPhone()) {
      z = Math.min(vw() * 0.78 / (r.w * S), vh() * 0.26 / (r.h * S));
      y = r.y + (vh() / 2 - vh() * 0.18) / (S * z);       // object sits above the bottom sheet
    } else {
      z = Math.min(vw() * 0.34 / (r.w * S), vh() * 0.58 / (r.h * S));
      x = r.x + (vw() / 2 - vw() * 0.26) / (S * z);       // object sits left of the panel
    }
    Object.assign(target, { x, y, z });
    if (instant) { Object.assign(cam, target); render(); } else kick();
  }

  function open(o) {
    const id = o.dataset.open;
    current = o; hideHint();
    objs.forEach((x) => x.classList.toggle('is-open', x === o));

    if (id === 'journey') {
      // Dive into the map, then hand off to the map timeline page.
      mode = 'leaving';
      const r = sceneBox(o.querySelector('.obj-body'));
      Object.assign(target, { x: r.x, y: r.y, z: Math.max(vw() / (r.w * S), vh() / (r.h * S)) * 1.25 });
      kick();
      document.body.classList.add('leaving');
      setTimeout(() => { location.href = 'journey.html'; }, reduce ? 0 : 950);
      return;
    }

    mode = 'focus';
    stage.classList.add('focused');
    document.body.classList.add('focused');
    focusOn(o);
    panels.forEach((p) => { p.hidden = p.dataset.panel !== id; });
    const panel = panels.find((p) => p.dataset.panel === id);
    shell.querySelector('.panel-card').setAttribute('aria-labelledby', '');
    shell.querySelector('.panel-card').setAttribute('aria-label', panel.querySelector('h2').textContent);
    shell.hidden = false;
    shell.querySelector('.panel-card').scrollTop = 0;
    history.replaceState(null, '', '#' + id);
    setTimeout(() => {
      shell.classList.add('show');
      backBtn.focus({ preventScroll: true });
    }, reduce ? 0 : 380);
  }

  function close() {
    if (mode !== 'focus') return;
    mode = 'explore';
    shell.classList.remove('show');
    stage.classList.remove('focused');
    document.body.classList.remove('focused');
    objs.forEach((x) => x.classList.remove('is-open'));
    history.replaceState(null, '', location.pathname);
    exploreTarget();
    const last = current; current = null;
    setTimeout(() => { if (mode === 'explore') shell.hidden = true; }, reduce ? 0 : 400);
    if (last) last.focus({ preventScroll: true });
  }
  backBtn.addEventListener('click', close);

  /* ---------- Experience tabs ---------- */
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

  /* ---------- Race countdown ---------- */
  const days = Math.ceil((new Date(2027, 10, 1) - new Date()) / 86400000);
  const raceEl = document.getElementById('race-days');
  if (raceEl) raceEl.textContent = days > 0 ? days : '0';

  /* ---------- start ---------- */
  window.addEventListener('resize', layout);
  window.addEventListener('pageshow', (e) => {            // coming back with the browser Back button
    if (e.persisted) { document.body.classList.remove('leaving'); mode = 'explore'; current = null; exploreTarget(); }
  });
  layout();
  const fromHash = location.hash.slice(1);
  const linked = objs.find((o) => o.dataset.open === fromHash && fromHash !== 'journey');
  if (linked) requestAnimationFrame(() => open(linked));
})();
