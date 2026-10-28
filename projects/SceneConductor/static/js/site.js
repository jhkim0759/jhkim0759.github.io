/* Don't Ask Agents to Do Everything — project page behaviour */
(() => {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const getJSON = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(url); return r.json(); });

  /* ── top bar: scrolled state, reading progress, active chapter, mobile menu ── */
  const topbar = $('#topbar'), prog = $('#progress');
  const onScroll = () => {
    const y = window.scrollY;
    topbar.classList.toggle('scrolled', y > 40);
    const h = document.documentElement.scrollHeight - window.innerHeight;
    prog.style.setProperty('--k', h > 0 ? Math.min(y / h, 1).toFixed(4) : 0);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  const links = $$('#chapters a');
  const secObs = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      links.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  links.forEach((a) => { const s = $(a.getAttribute('href')); if (s) secObs.observe(s); });
  const menuBtn = $('#menuBtn'), chapters = $('#chapters');
  menuBtn.addEventListener('click', () => {
    const open = chapters.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', open);
  });
  links.forEach((a) => a.addEventListener('click', () => { chapters.classList.remove('open'); menuBtn.setAttribute('aria-expanded', false); }));

  /* ── reveal on scroll ── */
  const revObs = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); revObs.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px' });
  $$('.reveal').forEach((el) => (reduce ? el.classList.add('in') : revObs.observe(el)));

  /* ── videos: pause when off-screen, play toggles ── */
  const autoVids = new Set();
  const vidObs = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const v = e.target;
      if (e.isIntersecting && !v.dataset.userPaused) { v.play().catch(() => {}); } else if (!e.isIntersecting) { v.pause(); }
    });
  }, { threshold: 0.25 });
  const watch = (v) => { if (!autoVids.has(v)) { autoVids.add(v); vidObs.observe(v); } };
  watch($('#teaserVideo'));
  $$('.play-toggle').forEach((b) => {
    const v = document.getElementById(b.dataset.video);
    const sync = () => { b.textContent = v.paused ? '▶ Play' : '❚❚ Pause'; };
    b.addEventListener('click', () => {
      if (v.paused) { delete v.dataset.userPaused; v.play(); } else { v.dataset.userPaused = '1'; v.pause(); }
    });
    v.addEventListener('play', sync); v.addEventListener('pause', sync);
  });
  if (reduce) { const t = $('#teaserVideo'); t.removeAttribute('autoplay'); t.dataset.userPaused = '1'; t.pause(); }

  /* ── BibTeX copy ── */
  $('#copyBib').addEventListener('click', async (ev) => {
    const b = ev.currentTarget;
    const lab = $('span', b);
    try { await navigator.clipboard.writeText($('#bibtex').textContent); lab.textContent = 'Copied'; b.classList.add('done'); }
    catch (e) { lab.textContent = 'Select & copy'; }
    setTimeout(() => { lab.textContent = 'Copy'; b.classList.remove('done'); }, 1600);
  });

  /* ── title: "Everything" is a proposed candidate that the agent rejects ── */
  const cand = $('#titleCand');
  if (cand) {
    const go = () => cand.classList.add('go');
    if (reduce) go(); else (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => setTimeout(go, 150));
  }

  const ROBOT = 'static/img/icons/robot.webp';
  const SCENES = 'static/img/scenes/';

  /* ═════════════ decision explorer ═════════════ */
  getJSON('static/data/decisions.json').then((D) => {
    const [W, H] = D.photo_size;
    const svg = $('#exSvg'), label = $('#exLabel'), list = $('#exList'), detail = $('#exDetail');
    const CT = D.crop_top || 0;            // top band framed out (340175: pendant lamps, as in the paper's Fig. 1)
    if (CT > 0) {
      $('#exCanvas').style.aspectRatio = `${W} / ${H * (1 - CT)}`;
      Object.assign($('#exInner').style, { position: 'absolute', left: '0', width: '100%', top: `${-CT / (1 - CT) * 100}%`, height: `${100 / (1 - CT)}%` });
    }
    const img2 = $('#exImg2');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const base = SCENES + 'coco-340175/';
    let stage = 1, cur = 0, view = 'photo';
    const st = D.stats;
    const nw = (t) => `<span class="nw">${t}</span>`;   // wrap only between counts
    const statsHTML = {
      1: `<b>${st.raw_masks}</b> raw masks → <b>${st.objects}</b> objects<br>applied: ${[`${st.merges_applied}/${st.merge_pairs} merges`, `${st.deletes_applied}/${st.delete_candidates} deletions`, `${st.mesh_groups_accepted}/${st.mesh_groups_proposed} same-model groups`].map(nw).join(' · ')}`,
      3: `confirmed: ${[`<b>${st.relations_confirmed}/${st.relations_proposed}</b> groups (1 → group editor)`, `${st.ops_approved}/${st.ops_proposed} ops`].map(nw).join(' · ')}`,
    };
    // view buttons: enable stills if present
    const viewBtns = $$('#exView button');
    const stillOK = {};
    ['s2', 's3'].forEach((s) => {
      const im = new Image();
      im.onload = () => { stillOK[s] = true; };
      im.onerror = () => { stillOK[s] = false; const b = viewBtns.find((x) => x.dataset.view === s); b.disabled = true; b.title = 'render pending'; };
      im.src = base + s + '.webp';
    });
    const setView = (v) => {
      if (v !== 'photo' && stillOK[v] === false) v = 'photo';
      view = v;
      viewBtns.forEach((b) => b.setAttribute('aria-pressed', b.dataset.view === v));
      if (v === 'photo') { img2.style.opacity = 0; }
      else { img2.src = base + v + '.webp'; img2.style.opacity = 1; }
    };
    viewBtns.forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));

    const items = () => D.items.filter((it) => it.stage === stage);
    const shape = (set, id) => (D.masks[set] || {})[String(id)];

    function bbox(set, ids) {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      ids.forEach((i) => { const m = shape(set, i); if (m && m.box) { x0 = Math.min(x0, m.box[0]); y0 = Math.min(y0, m.box[1]); x1 = Math.max(x1, m.box[2]); y1 = Math.max(y1, m.box[3]); } });
      return [x0, y0, x1, y1];
    }

    function draw() {
      const it = items()[cur];
      if (!it) return;
      const set = it.set;
      const all = set === 'raw' ? D.all_raw : D.all_final;
      const members = it.ids;
      const acc = new Set((it.accepted || []).flat());
      const anchor = it.anchor;
      const dAll = Object.values(all).join(' ');
      const dMem = members.map((i) => (shape(set, i) || {}).d || '').join(' ');
      const dAnc = anchor ? (shape(set, anchor) || {}).d || '' : '';
      const sw = (W / 640) * 1.0;
      let s = `<defs><mask id="exm"><rect width="${W}" height="${H}" fill="#fff"/><path d="${dMem} ${dAnc}" fill="#000"/></mask></defs>`;
      s += `<path d="${dAll}" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="${0.8 * sw}"/>`;
      s += `<rect width="${W}" height="${H}" fill="rgba(22,22,21,.52)" mask="url(#exm)"/>`;
      if (dAnc) s += `<path d="${dAnc}" fill="rgba(255,255,255,.08)" stroke="#fff" stroke-width="${1.6 * sw}"/>`;
      members.forEach((i) => {
        const m = shape(set, i); if (!m) return;
        const ok = acc.has(i);
        if (it.accepted && it.accepted.length && ok) s += `<path d="${m.d}" fill="rgba(31,138,91,.22)" stroke="#1f8a5b" stroke-width="${2.6 * sw}"/>`;
        else s += `<path d="${m.d}" fill="rgba(44,85,214,.18)" stroke="#2c55d6" stroke-width="${2.2 * sw}" stroke-dasharray="${5 * sw} ${3.5 * sw}"/>`;
      });
      svg.innerHTML = s;
      const [x0, y0, x1] = bbox(set, members.concat(anchor ? [anchor] : []));
      const cx = Math.min(Math.max((x0 + x1) / 2 / W, 0.14), 0.86), ty = Math.max(y0 / H, CT + 0.1, 0.12);
      label.style.left = (cx * 100) + '%';
      label.style.top = (ty * 100 - 1.2) + '%';
      const mk = it.verdict === 'ok' ? '<span class="mark ok">✓</span>' : '<span class="mark no">✕</span>';
      label.innerHTML = `<span class="q">${esc(it.q)}</span><span class="stamp"><img src="${ROBOT}" alt="">${mk}</span>`;
      // detail
      const vb = it.verdict === 'ok' ? '<span class="badge ok">accepted</span>' : '<span class="badge no">rejected</span>';
      let outcome = '';
      if (it.kind === 'merge') outcome = it.verdict === 'ok' ? `${members.length} masks merged into one object` : 'kept as separate objects';
      if (it.kind === 'same') {
        const subs = (it.accepted || []).map((g) => '{' + g.join(', ') + '}').join(' and ');
        outcome = it.verdict === 'ok' ? 'one shared mesh for all members'
          : subs ? `rejected as one model; only ${subs} share a mesh (green)` : 'each instance keeps its own mesh';
      }
      if (it.kind === 'relation') outcome = it.verdict === 'ok' ? (it.island ? 'confirmed → rearranged by the group editor' : 'confirmed') : 'not applied';
      if (it.kind === 'op') outcome = it.verdict === 'ok' ? 'applied; the pose is computed geometrically' : 'not applied';
      // full-width strip under the image: title | geometry | reviewer (+ target) | outcome
      detail.innerHTML = `<div class="ex-drow">
        <div class="ex-dhead"><span class="ex-dtitle">${esc(it.title)}</span>${vb}</div>
        <div class="ex-dcol"><span class="k">Geometry</span><span>${esc(it.geometry)}</span></div>
        <div class="ex-dcol rev"><span class="k">Reviewer</span>${it.reason ? `<blockquote>“${esc(it.reason)}”</blockquote>` : `<span class="muted">${esc(it.note || 'no reason recorded')}</span>`}
          ${it.arrangement ? `<span class="k">Target</span><blockquote>“${esc(it.arrangement)}”</blockquote>` : ''}</div>
        <div class="ex-dcol"><span class="k">Outcome</span><span>${esc(outcome)}</span></div></div>
        <div class="src">ids ${members.join(', ')}${anchor ? ' · anchor ' + anchor : ''} · ${esc(it.src)}</div>`;
      $$('.ex-item', list).forEach((b, k) => b.setAttribute('aria-current', k === cur));
      $('#exCount').textContent = `${cur + 1} / ${items().length}`;
    }

    function renderList() {
      $('#exStats').innerHTML = statsHTML[stage];
      list.innerHTML = items().map((it, k) => `<li><button type="button" class="ex-item" data-k="${k}">
          <span class="q">${esc(it.q)}</span><span class="t">${esc(it.title)}</span>
          <span class="mark ${it.verdict}">${it.verdict === 'ok' ? '✓' : '✕'}</span></button></li>`).join('');
      $$('.ex-item', list).forEach((b) => b.addEventListener('click', () => { cur = +b.dataset.k; draw(); }));
      cur = 0;
      setView(stage === 3 && stillOK.s2 !== false ? 's2' : 'photo');
      draw();
    }
    $$('#exTabs button').forEach((b) => b.addEventListener('click', () => {
      stage = +b.dataset.stage;
      $$('#exTabs button').forEach((x) => x.setAttribute('aria-pressed', x === b));
      renderList();
    }));
    $('#exCanvas').addEventListener('click', () => { cur = (cur + 1) % items().length; draw(); });
    renderList();
  }).catch((e) => { $('#explorer').innerHTML = '<p class="muted">Decision data could not be loaded.</p>'; console.warn(e); });

  /* ═════════════ stage compare (photo ↔ our render from the photo camera) + gallery ═════════════ */
  const thumbHTML = (g) => `<button type="button" class="thumb" data-key="${g.key}" title="${esc(g.name)} · ${esc(g.dataset)}"><img src="${SCENES}${g.key}/thumb.webp" alt="${esc(g.name)}" loading="lazy"></button>`;
  getJSON('static/data/gallery.json').then((G) => {
    /* compare */
    const withStills = G.filter((g) => ['s1', 's2', 's3'].every((s) => g.stills.includes(s)));
    const cmp = $('#cmp'), A = $('#cmpA'), B = $('#cmpB'), handle = $('#cmpHandle');
    const NOTES = {
      1: '<b>Stage 1</b> · objects only: SAM3D meshes for the refined masks, posed jointly by our layout predictor in one floor-aligned frame.',
      2: '<b>Stage 2</b> · the scene at metric scale inside a room fitted to the walls of the point map, with surface colors and lighting read by the inspector.',
      3: '<b>Stage 3</b> · reviewed candidates applied (supports, walls, identical instances), groups rearranged by the group editor, then deterministic physical finalization.',
    };
    if (withStills.length && cmp) {
      let cur = withStills[0], stage = 3, intro = null;
      const setX = (p) => { p = Math.min(Math.max(p, 0), 100); cmp.style.setProperty('--x', p.toFixed(2) + '%'); handle.setAttribute('aria-valuenow', Math.round(p)); };
      const load = () => {
        const pre = cur.crop_top ? 'scrub_' : '';
        // cap the height for square / portrait photos: width follows the photo's aspect, centred
        const [pw, ph] = cur.photo_size, ar = pw / (ph * (1 - (cur.crop_top || 0)));
        cmp.style.maxWidth = `min(100%, calc(min(78vh, 760px) * ${ar.toFixed(4)}))`;
        A.src = SCENES + cur.key + '/' + pre + 'photo.webp';
        B.src = SCENES + cur.key + '/' + pre + 's' + stage + '.webp';
        $('#cmpBadge').textContent = 'Ours · Stage ' + stage;
        $('#cmpNote').innerHTML = NOTES[stage];
        $('#cmpName').textContent = cur.name + ' · ' + cur.dataset;
        $$('#cmpTabs .cmp-tab').forEach((b) => b.setAttribute('aria-pressed', +b.dataset.stage === stage));
        $$('#cmpScenes .thumb').forEach((b) => b.setAttribute('aria-current', b.dataset.key === cur.key));
      };
      $('#cmpScenes').innerHTML = withStills.map(thumbHTML).join('');
      $$('#cmpScenes .thumb').forEach((b) => b.addEventListener('click', () => { cur = withStills.find((g) => g.key === b.dataset.key); load(); }));
      $$('#cmpTabs .cmp-tab').forEach((b) => b.addEventListener('click', () => { stage = +b.dataset.stage; load(); }));
      const stopIntro = () => { if (intro) { cancelAnimationFrame(intro); intro = null; } };
      const fromEvent = (e) => { const r = cmp.getBoundingClientRect(); return (e.clientX - r.left) / r.width * 100; };
      let drag = false;
      cmp.addEventListener('pointerdown', (e) => { drag = true; stopIntro(); try { cmp.setPointerCapture(e.pointerId); } catch (_) {} setX(fromEvent(e)); });
      cmp.addEventListener('pointermove', (e) => { if (drag) setX(fromEvent(e)); });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => cmp.addEventListener(t, () => { drag = false; }));
      handle.addEventListener('keydown', (e) => {
        const v = +handle.getAttribute('aria-valuenow');
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { stopIntro(); setX(v + (e.key === 'ArrowLeft' ? -5 : 5)); e.preventDefault(); }
      });
      // one gentle sweep the first time the comparison scrolls into view, to show it can be dragged
      if (!reduce) {
        const io = new IntersectionObserver((en) => {
          if (!en[0].isIntersecting) return;
          io.disconnect();
          const t0 = performance.now(), D = 2200;
          const step = (t) => {
            const k = Math.min((t - t0) / D, 1);
            setX(50 + 30 * Math.sin(k * Math.PI * 2) * (1 - k * 0.15) * (k < 1 ? 1 : 0));
            intro = k < 1 ? requestAnimationFrame(step) : null;
          };
          intro = requestAnimationFrame(step);
        }, { threshold: 0.6 });
        io.observe(cmp);
      }
      setX(50); load();
    } else if ($('#compare')) {
      $('#compare').innerHTML = '<p class="muted">Stage renders are being prepared.</p>';
    }

    /* gallery */
    // the paper's Fig. 3 cells (f3_*), rows in the figure's order
    const PANELS = [['f3_photo', 'Input'], ['f3_sam3d', 'SAM3D'], ['f3_viga', 'VIGA'], ['f3_rest3d', 'REST3D'], ['f3_car', 'Code-as-Room'], ['f3_ours', 'Ours']];
    const grid = $('#galGrid');
    grid.innerHTML = PANELS.map(([k, n]) => `<figure class="gal-cell ${k}"><div class="im"><img alt="${esc(n)}" loading="lazy"></div><figcaption>${esc(n)}</figcaption></figure>`).join('');
    const cells = $$('.gal-cell', grid);
    const GC = G.filter((g) => g.fig3 != null).sort((a, b) => a.fig3 - b.fig3);
    const show = (g) => {
      cells.forEach((c, i) => { const k = PANELS[i][0]; $('img', c).src = SCENES + g.key + '/' + k + '.webp'; });
      $$('#galScenes .thumb').forEach((b) => b.setAttribute('aria-current', b.dataset.key === g.key));
      $('#galName').textContent = g.name + ' · ' + g.dataset;
    };
    $('#galScenes').innerHTML = GC.map(thumbHTML).join('');
    $$('#galScenes .thumb').forEach((b) => b.addEventListener('click', () => show(GC.find((g) => g.key === b.dataset.key))));
    show(GC[0]);
  }).catch((e) => console.warn(e));

  /* ═════════════ interactive 3D viewer (model-viewer, loaded on demand) ═════════════ */
  getJSON('static/data/viewer.json').then((VW) => {
    if (!VW.length) throw new Error('no scenes');
    const tabs = $('#viewerTabs'), stageEl = $('#viewerStage'), loadBtn = $('#viewerLoad');
    let cur = VW[0], mv = null;
    const ensureLib = () => new Promise((res) => {
      if (window.customElements && customElements.get('model-viewer')) return res();
      const sc = document.createElement('script'); sc.type = 'module';
      sc.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js';
      sc.onload = () => customElements.whenDefined('model-viewer').then(res); document.head.appendChild(sc);
    });
    const select = (v) => {
      cur = v;
      $$('button', tabs).forEach((b) => b.setAttribute('aria-pressed', b.dataset.key === v.key));
      $('#viewerPhoto').src = v.photo; $('#viewerPoster').src = v.poster;
      if (mv) { mv.src = v.glb; }
      loadBtn.textContent = `Load interactive scene (${v.mb} MB)`;
    };
    tabs.innerHTML = VW.map((v) => `<button type="button" data-key="${v.key}" aria-pressed="false">${esc(v.name)}</button>`).join('');
    $$('button', tabs).forEach((b) => b.addEventListener('click', () => select(VW.find((v) => v.key === b.dataset.key))));
    select(cur);
    loadBtn.addEventListener('click', async () => {
      loadBtn.textContent = 'Loading…'; loadBtn.disabled = true;
      await ensureLib();
      mv = document.createElement('model-viewer');
      Object.entries({ 'camera-controls': '', 'touch-action': 'pan-y', 'shadow-intensity': '0.8', 'exposure': '1.05', 'environment-image': 'neutral',
        'camera-orbit': '30deg 58deg 80%', 'field-of-view': '28deg', 'interaction-prompt': 'none', 'auto-rotate': '', 'rotation-per-second': '6deg', 'alt': 'Interactive 3D scene' })
        .forEach(([k, v]) => mv.setAttribute(k, v));
      mv.src = cur.glb;
      mv.addEventListener('load', () => { $('#viewerPoster').style.opacity = 0; loadBtn.remove(); });
      mv.addEventListener('error', () => { loadBtn.textContent = 'Could not load the scene'; });
      stageEl.appendChild(mv);
    });
  }).catch(() => { const v = $('#viewer'); if (v) { v.previousElementSibling.remove(); v.remove(); } });

  /* ═════════════ orbit loops ═════════════ */
  getJSON('static/data/loops.json').then((L) => {
    const box = $('#loops');
    box.innerHTML = L.map((l) => `<figure class="loop"><div class="frame">
        <video muted loop playsinline preload="none" poster="${l.poster}"><source src="${l.video}" type="video/mp4"></video>
        <img class="inset" src="${l.photo}" alt="input photo" loading="lazy"></div>
        <figcaption>${esc(l.name)} · ${esc(l.dataset)}</figcaption></figure>`).join('');
    $$('video', box).forEach(watch);
  }).catch(() => { const s = $('#loops'); if (s) s.previousElementSibling.remove(), s.remove(); });
})();
