/* Scroll-driven map timeline. Content comes from js/data.js. */
(function () {
  const { stops, travels } = window.JOURNEY;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = () => window.matchMedia('(max-width: 760px)').matches;
  const US_BOUNDS = [[24.5, -124.8], [49.4, -66.9]];
  const FLY_SECONDS = reduceMotion ? 0 : 1.8;

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

  /* ---------- Map ---------- */
  const map = L.map('map', {
    zoomControl: false, scrollWheelZoom: false, dragging: false, doubleClickZoom: false,
    boxZoom: false, keyboard: false, touchZoom: false, zoomSnap: 0.25
  });
  map.fitBounds(US_BOUNDS, { animate: false });
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, USGS, NGA, EPA, USDA, NPS'
  }).addTo(map);

  const markers = stops.map((s) => L.marker(s.coords, {
    interactive: false, keyboard: false,
    icon: L.divIcon({
      className: 'pin-wrap', iconSize: [0, 0],
      html: `<div class="pin" style="--c:${s.color}">${s.num}</div><div class="pin-label">${s.place}</div>`
    })
  }).addTo(map));

  // Gentle arc between two points so the route looks hand-drawn, not ruler-straight.
  function arc(a, b, bend = 0.18, n = 48) {
    const [y1, x1] = a, [y2, x2] = b;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const cx = mx - (y2 - y1) * bend, cy = my + (x2 - x1) * bend;
    const pts = [];
    for (let k = 0; k <= n; k++) {
      const t = k / n, u = 1 - t;
      pts.push([u * u * y1 + 2 * u * t * cy + t * t * y2, u * u * x1 + 2 * u * t * cx + t * t * x2]);
    }
    return pts;
  }
  const segments = stops.slice(1).map((s, i) =>
    L.polyline(arc(stops[i].coords, s.coords), { color: s.color, weight: 3.5, opacity: .95, lineCap: 'round', className: 'route', interactive: false })
  );
  let segsShown = 0;
  function drawIn(seg) {
    const p = seg._path;
    if (!p || reduceMotion) return;
    const len = p.getTotalLength();
    p.style.transition = 'none';
    p.style.strokeDasharray = len;
    p.style.strokeDashoffset = len;
    p.getBoundingClientRect();
    p.style.transition = 'stroke-dashoffset 1.4s ease-in-out';
    p.style.strokeDashoffset = '0';
    p.addEventListener('transitionend', () => { p.style.cssText = ''; }, { once: true });
  }
  function setSegments(n, animate) {
    while (segsShown > n) segments[--segsShown].remove();
    while (segsShown < n) { const seg = segments[segsShown++]; seg.addTo(map); if (animate) drawIn(seg); }
  }

  /* ---------- Camera moves ---------- */
  function padding() {
    if (isMobile()) return { paddingTopLeft: [40, 90], paddingBottomRight: [40, Math.round(window.innerHeight * 0.5)] };
    return { paddingTopLeft: [Math.min(560, Math.round(window.innerWidth * 0.44)), 100], paddingBottomRight: [90, 70] };
  }
  // Shift the camera so the pin sits beside the card instead of under it.
  function offsetCenter(latlng, zoom) {
    const shift = isMobile() ? L.point(0, window.innerHeight * 0.2) : L.point(-Math.min(270, window.innerWidth * 0.2), 0);
    return map.unproject(map.project(latlng, zoom).add(shift), zoom);
  }
  function move(step, animate) {
    const opts = { animate: animate && !reduceMotion, duration: FLY_SECONDS };
    const fly = opts.animate;
    if (step.type === 'hero') {
      fly ? map.flyToBounds(US_BOUNDS, opts) : map.fitBounds(US_BOUNDS, { animate: false });
    } else if (step.type === 'stop') {
      const s = stops[step.i];
      fly ? map.flyTo(offsetCenter(s.coords, s.zoom), s.zoom, opts) : map.setView(offsetCenter(s.coords, s.zoom), s.zoom, { animate: false });
    } else {
      const pts = step.type === 'travel' ? [stops[step.i - 1].coords, stops[step.i].coords] : stops.map((s) => s.coords);
      const o = Object.assign({}, opts, padding());
      fly ? map.flyToBounds(pts, o) : map.fitBounds(pts, Object.assign(padding(), { animate: false }));
    }
  }

  let current = -1, token = 0;
  function activate(idx) {
    if (idx === current || idx < 0) return;
    current = idx;
    const step = steps[idx];
    steps.forEach((s, k) => s.el.classList.toggle('is-active', k === idx));

    markers.forEach((m, k) => {
      const el = m.getElement();
      if (!el) return;
      el.classList.toggle('is-visited', k <= step.stop);
      el.classList.toggle('is-active', step.type === 'stop' && k === step.i);
    });
    railLinks.forEach((a, k) => {
      a.classList.toggle('visited', k <= step.stop);
      a.classList.toggle('current', k === step.stop && step.type !== 'outro');
    });
    rail.classList.toggle('show', step.type !== 'hero');

    move(step, true);
    const my = ++token;
    if (step.segs < segsShown) setSegments(step.segs, false);
    else setTimeout(() => { if (my === token) setSegments(step.segs, true); }, FLY_SECONDS * 1000 + 60);
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) activate(steps.findIndex((s) => s.el === e.target)); });
  }, { rootMargin: '-45% 0px -54% 0px' });
  steps.forEach((s) => io.observe(s.el));

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { map.invalidateSize(); if (current >= 0) move(steps[current], false); }, 200);
  });

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
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('drawer-open')) closeDrawer(); });
})();
