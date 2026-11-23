/* LongDex project page behaviour.
   One classic script without network calls, modules, workers or storage, so it runs the same from a file on disk
   and from a web server. It reads window.MEDIA (static/data/media.js) and window.CLIPS (static/data/clips.js),
   both written by the build. A slot without MEDIA stays exactly as the HTML renders it (poster and caption).
   Clip time = clip_start_s + max(0, video time - window start - lead_in_s) * speed; null timing hides the
   readout, the speed toggle, the in-frame chip, the lanes and the failure frames instead of guessing.
   Until the reader plays or seeks a slot, its poster is on screen, so the readout, chip, failure frames and
   playhead describe the poster's moment (poster_at), or stay hidden when that moment is unknown. */
(function () {
  'use strict';
  var D = document, W = window, ROOT = D.documentElement;
  var M = W.MEDIA || null;
  var CL = W.CLIPS || {};
  W.LDX = true;

  function mq(q) { try { return W.matchMedia(q).matches; } catch (x) { return false; } }
  var REDUCE = mq('(prefers-reduced-motion: reduce)');
  var SAVE = !!(navigator.connection && navigator.connection.saveData);
  var HAS_IO = 'IntersectionObserver' in W;
  var NBSP = ' ', TIMES = '×', DOT = ' · ', CHECK = '✓';
  var FRAME = 1 / 30;

  function $(s, r) { return (r || D).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); }
  function safe(name, fn) { try { fn(); } catch (x) { if (W.console && console.warn) console.warn('LongDex page, ' + name + ':', x); } }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmtS(t) { return (Math.round(t * 10) / 10).toFixed(1) + NBSP + 's'; }
  function fmtSpeed(s) { return String(Math.round(s * 100) / 100) + TIMES; }
  function copyObj(o) { var r = {}, k; for (k in o) if (Object.prototype.hasOwnProperty.call(o, k)) r[k] = o[k]; return r; }
  function el(tag, cls, text) { var n = D.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function closest(n, sel) { while (n && n.nodeType === 1) { if (n.matches && n.matches(sel)) return n; n = n.parentNode; } return null; }

  var SVG = {
    play: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4.6 2.6v10.8L13.2 8z" fill="currentColor"/></svg>',
    pause: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3.9 2.6h2.9v10.8H3.9zM9.2 2.6h2.9v10.8H9.2z" fill="currentColor"/></svg>',
    replay: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3.1 8.6A5 5 0 1 0 4.6 4.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M3.4 1.9v3.3h3.3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    fs: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    fsx: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M6 2v4H2M14 6h-4V2M10 14v-4h4M2 10h4v4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  /* ── reveal on scroll (first, so that nothing stays hidden if a later part fails) ── */
  safe('reveal', function () {
    var items = $$('.reveal');
    if (REDUCE || !HAS_IO) { items.forEach(function (n) { n.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    items.forEach(function (n) { io.observe(n); });
  });

  /* ── top bar: scrolled state, reading progress, active chapter, Contents menu ── */
  safe('topbar', function () {
    var bar = $('#topbar'), prog = $('#progress'), btn = $('#menuBtn'), nav = $('#chapters');
    var queued = false;
    function update() {
      queued = false;
      var y = W.pageYOffset || ROOT.scrollTop || 0;
      var h = ROOT.scrollHeight - W.innerHeight;
      if (bar) bar.classList.toggle('scrolled', y > 40);
      if (prog) prog.style.setProperty('--k', h > 0 ? clamp(y / h, 0, 1).toFixed(4) : '0');
    }
    W.addEventListener('scroll', function () { if (!queued) { queued = true; W.requestAnimationFrame(update); } }, { passive: true });
    W.addEventListener('resize', update);
    update();
    if (!nav) return;
    var links = $$('a[href^="#"]', nav);
    if (HAS_IO && links.length) {
      var byId = {};
      links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          var on = byId[en.target.id] || null;
          links.forEach(function (a) { a.classList.toggle('active', a === on); });
        });
      }, { rootMargin: '-40% 0px -55% 0px' });
      $$('section[id]').forEach(function (s) { io.observe(s); });
    }
    if (!btn) return;
    function setOpen(open) {
      nav.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    btn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      var open = !nav.classList.contains('open');
      setOpen(open);
      if (open && ev.detail === 0 && links[0]) links[0].focus();
    });
    nav.addEventListener('click', function (ev) { if (closest(ev.target, 'a')) setOpen(false); });
    D.addEventListener('click', function (ev) { if (nav.classList.contains('open') && !nav.contains(ev.target)) setOpen(false); });
    D.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && nav.classList.contains('open')) { setOpen(false); btn.focus(); }
      /* Tab past the last link (or back past the button) leaves the menu: close the dropdown so it does not
         cover the page; checked after the browser has moved the focus */
      if (ev.key === 'Tab' && nav.classList.contains('open')) {
        setTimeout(function () {
          var a = D.activeElement;
          if (nav.classList.contains('open') && !(a && (a === btn || nav.contains(a)))) setOpen(false);
        }, 0);
      }
    });
  });

  /* ═════════════ players ═════════════ */
  var players = [];
  var probed = {};
  var CAN_FS = !!(ROOT.requestFullscreen || ROOT.webkitRequestFullscreen ||
    (W.HTMLVideoElement && HTMLVideoElement.prototype.webkitEnterFullscreen));

  function pauseOthers(p) {
    players.forEach(function (q) {
      if (q !== p && !q.isHero && q.v && !q.v.paused) { try { q.v.pause(); } catch (x) { /* ignore */ } }
    });
  }

  function Player(fig) {
    var p = this;
    p.fig = fig;
    p.kind = fig.getAttribute('data-kind') || 'take';
    p.isHero = p.kind === 'loop';
    p.isFilm = p.kind === 'film';
    p.box = $('.player', fig);
    p.media = $('.media', fig);
    p.zoom = $('.zoom', fig);
    p.poster = $('img.poster', fig);
    p.over = $('.overlays', fig);
    // overlays sit above the zoom target, so labels and frames keep their size in focus mode
    if (p.over && p.zoom && p.over.parentNode === p.zoom) p.media.insertBefore(p.over, p.zoom.nextSibling);
    p.still = $('.chip.still', fig);
    p.bar = $('.pbar', fig);
    p.btn = $('.pb-play', fig);
    p.scrub = $('.pb-scrub', fig);
    p.timeEl = $('.pb-time', fig);
    p.speedSeg = $('.pb-speed', fig);
    p.focusSeg = $('.pb-focus', fig);
    p.fsBtn = $('.pb-fs', fig);
    p.lanesEl = $('.lanes', fig);
    p.handSeg = $('.hand-switch', fig);
    p.cap = $('figcaption', fig);
    p.e = null; p.base = null; p.v = null; p.hand = null;
    p.near = !HAS_IO; p.focus = -1; p.real = false; p.ended = false; p.userPaused = false; p.live = false;
    p.tileEls = []; p.frames = []; p.chipEl = null; p.phEl = null; p.legendEl = null;
    p.pending = null; p.onTick = null; p.onLoad = null;
    if (p.scrub) {
      p.track = el('span', 'pb-track');
      p.fill = el('span', 'pb-fill');
      p.scrub.parentNode.insertBefore(p.track, p.scrub);
      p.track.appendChild(p.fill);
      p.track.appendChild(p.scrub);
    }
    if (p.fsBtn) { p.fsBtn.innerHTML = SVG.fs; if (!CAN_FS) p.fsBtn.hidden = true; }
    p.wire();
    fig.__ldx = p;
    players.push(p);
  }

  Player.prototype.wire = function () {
    var p = this;
    if (p.btn) p.btn.addEventListener('click', function () { p.toggle(); });
    if (p.scrub) {
      p.scrub.addEventListener('input', function () { p.seekFrac(+p.scrub.value / 1000); });
      p.scrub.addEventListener('pointerdown', function () { p.dragging = true; });
      p.scrub.addEventListener('pointerup', function () { p.dragging = false; });
      p.scrub.addEventListener('change', function () { p.dragging = false; });
      p.scrub.addEventListener('keydown', function (ev) { p.onScrubKey(ev); });
    }
    if (p.speedSeg) p.speedSeg.addEventListener('click', function (ev) {
      var b = closest(ev.target, 'button');
      if (b) p.setReal(b.getAttribute('data-real') === '1');
    });
    if (p.focusSeg) p.focusSeg.addEventListener('click', function (ev) {
      var b = closest(ev.target, 'button[data-i]');
      if (b) p.setFocus(+b.getAttribute('data-i'));
    });
    if (p.fsBtn) p.fsBtn.addEventListener('click', function () { p.toggleFs(); });
    if (p.handSeg) p.handSeg.addEventListener('click', function (ev) {
      var b = closest(ev.target, 'button[data-hand]');
      if (b) p.switchHand(b.getAttribute('data-hand'));
    });
    if (p.media && !p.isFilm) p.media.addEventListener('click', function (ev) {
      if (closest(ev.target, '.play-disc') || closest(ev.target, '.slide-btn')) return;
      if (p.playable) p.toggle();
    });
    if (p.box && !p.isHero && !p.isFilm) p.box.addEventListener('keydown', function (ev) { p.onKey(ev); });
    if (p.lanesEl) p.lanesEl.addEventListener('click', function (ev) {
      var tr = closest(ev.target, '.ln-track');
      if (!tr || !p.timing) return;
      var r = tr.getBoundingClientRect(), sp = p.laneSpan();
      if (sp) p.seekClip(sp[0] + clamp((ev.clientX - r.left) / r.width, 0, 1) * (sp[1] - sp[0]));
    });
  };

  /* entry: a MEDIA slot (or the film); o.play starts playback (user gesture), o.keep keeps speed and focus */
  Player.prototype.load = function (e, o) {
    o = o || {};
    var p = this, fig = p.fig;
    p.detach();
    if (e && e.kind === 'switch' && e.hands) {
      p.base = e;
      var keys = Object.keys(e.hands);
      if (!p.hand || !e.hands[p.hand]) p.hand = keys[0];
      var m = copyObj(e), he = e.hands[p.hand], k;
      for (k in he) if (k !== 'label' && he[k] != null) m[k] = he[k];
      e = m;
    } else {
      p.base = null;
    }
    p.e = e;
    p.ended = false;
    p.live = false;
    p.vt = null;
    p.playable = !!(e && (e.state === 'file' || e.state === 'window') && e.src);
    p.timing = !!(p.playable && e.speed != null && e.speed > 0 && e.clip_start_s != null);
    fig.setAttribute('data-state', e ? e.state : 'still');
    if (e && e.id && !p.isFilm && !p.isHero) fig.setAttribute('data-slot', e.id);
    if (e && e.poster && p.poster && p.poster.getAttribute('src') !== e.poster) p.poster.setAttribute('src', e.poster);
    if (e && e.poster_alt && p.poster) p.poster.setAttribute('alt', e.poster_alt);
    if (e && e.aria && p.box) p.box.setAttribute('aria-label', e.aria);
    if (e && e.w && e.h && p.media) {
      p.media.style.aspectRatio = e.w + '/' + e.h;
      if (p.box) p.box.style.setProperty('--ar', (e.w / e.h).toFixed(4));
    }
    fig.classList.remove('started', 'is-error', 'has-native');
    fig.classList.toggle('playable', p.playable);
    fig.classList.toggle('no-play', !p.playable);
    var err = $('.slot-error', fig);
    if (err) err.parentNode.removeChild(err);
    if (p.still) p.still.hidden = p.playable;
    var tiles = (e && e.tiles) || [];
    if (p.bar) p.bar.hidden = !(p.playable || (tiles.length > 1 && p.focusSeg));
    p.buildTiles();
    p.buildFocus();
    p.setupSpeed();
    p.buildLanes();
    p.buildLegend();
    p.buildHands();
    p.buildObjects();
    p.btnState = null;
    p.pickCaption();
    p.updateUI();
    if (p.onLoad) p.onLoad(e);
    if (p.playable && (p.near || o.play)) p.attach();
    if (o.play && p.playable) p.play();
    if (!p.playable) p.probe();
  };

  Player.prototype.detach = function () {
    var v = this.v;
    if (!v) return;
    try { v.pause(); } catch (x) { /* ignore */ }
    v.removeAttribute('src');
    try { v.load(); } catch (x) { /* ignore */ }
    if (v.parentNode) v.parentNode.removeChild(v);
    this.v = null;
    this.looping = false;
  };

  Player.prototype.attach = function () {
    var p = this, e = p.e;
    if (!p.playable || p.v || !p.zoom) return;
    var v = D.createElement('video');
    v.setAttribute('playsinline', '');
    v.setAttribute('webkit-playsinline', '');
    v.preload = 'metadata';
    var sound = !!(e.has_audio && (p.isFilm || e.family === 'method'));
    v.muted = !sound;
    if (!sound) v.setAttribute('muted', '');
    if (e.aria) v.setAttribute('aria-label', e.aria);
    if (p.isFilm) {
      v.controls = true;
      if (e.poster) v.poster = e.poster;
      p.fig.classList.add('has-native');
    } else {
      v.setAttribute('tabindex', '-1');
      v.disablePictureInPicture = true;
    }
    if (p.isHero && !e.window) v.loop = true;
    p.v = v;
    p.bindVideo(v);
    v.src = e.src;
    p.zoom.insertBefore(v, p.zoom.firstChild);
  };

  Player.prototype.bindVideo = function (v) {
    var p = this;
    function mine() { return p.v === v; }
    v.addEventListener('loadedmetadata', function () {
      if (!mine()) return;
      var w = p.e.window, pd = p.pending;
      p.pending = null;
      if (pd && pd.clip != null && p.timing) p.setTime(p.videoT(pd.clip));
      else if (pd && pd.video != null) p.setTime(pd.video);
      else if (w) p.setTime(w['in']);
      p.applyRate();
      p.buildLanes();
      p.buildObjects();
      p.updateUI();
      if (p.onMeta) p.onMeta(v);
      if (pd && pd.play) p.play();
    });
    v.addEventListener('play', function () { if (mine()) p.onPlay(); });
    v.addEventListener('playing', function () { if (mine()) { p.live = true; p.fig.classList.add('started'); p.updateUI(); } });
    v.addEventListener('pause', function () { if (mine()) p.updateUI(); });
    v.addEventListener('ended', function () { if (mine()) { p.ended = true; p.updateUI(); } });
    v.addEventListener('timeupdate', function () { if (mine()) p.check(); });
    v.addEventListener('seeked', function () { if (mine()) { if (p.live) p.fig.classList.add('started'); p.updateUI(); } });
    v.addEventListener('error', function () { if (mine()) p.fail(); });
  };

  Player.prototype.onPlay = function () {
    var p = this, v = p.v, w = p.e && p.e.window;
    if (w && (v.currentTime < w['in'] - 0.05 || v.currentTime >= w.out - FRAME - 0.01)) p.setTime(w['in']);
    p.ended = false;
    if (!p.isHero) pauseOthers(p);
    p.updateUI();
    if (!p.looping) p.loop();
  };

  Player.prototype.loop = function () {
    var p = this, v = p.v;
    if (!v || v.paused) { p.looping = false; return; }
    p.looping = true;
    p.check();
    if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(function () { if (p.v === v) p.loop(); else p.looping = false; });
    else W.requestAnimationFrame(function () { if (p.v === v) p.loop(); else p.looping = false; });
  };

  /* keeps a window inside [in, out]: the hero loops, every other player stops on the last frame */
  Player.prototype.check = function () {
    var p = this, v = p.v, w = p.e && p.e.window;
    if (v && w && !v.seeking && v.readyState > 0) {
      var end = w.out - FRAME;
      if (v.currentTime >= end - 0.005) {
        if (p.isHero) p.setTime(w['in']);
        else if (!v.paused) { v.pause(); p.setTime(end); p.ended = true; }
      } else if (v.currentTime < w['in'] - 0.25) {
        p.setTime(w['in']);
      }
    }
    p.updateUI();
  };

  Player.prototype.setTime = function (t) {
    var v = this.v;
    if (!v) return;
    try { v.currentTime = Math.max(0, t); } catch (x) { /* ignore */ }
  };

  Player.prototype.play = function () {
    var p = this;
    if (!p.playable) return;
    p.live = true;
    if (!p.v) p.attach();
    var v = p.v;
    if (!v) return;
    if (v.readyState < 1) { p.pending = p.pending || {}; p.pending.play = true; }
    var r = v.play();
    if (r && r['catch']) r['catch'](function () { /* autoplay refusal or interrupted load */ });
  };

  Player.prototype.toggle = function () {
    var p = this, v = p.v;
    if (!p.playable) return;
    if (!v || v.paused) { p.userPaused = false; p.play(); p.dropDisc(); }
    else { p.userPaused = true; v.pause(); }
  };

  Player.prototype.fail = function () {
    var p = this, fig = p.fig;
    p.detach();
    p.playable = false;
    p.timing = false;
    fig.classList.remove('started', 'playable', 'has-native');
    fig.classList.add('is-error', 'no-play');
    fig.setAttribute('data-state', 'still');
    if (p.still) p.still.hidden = false;
    if (p.bar) p.bar.hidden = !((p.e && p.e.tiles && p.e.tiles.length > 1) && p.focusSeg);
    if (p.lanesEl) { p.lanesEl.hidden = true; p.lanesEl.innerHTML = ''; }
    p.dropDisc();
    if (p.pill) p.pill.hidden = true;
    p.buildTiles();
    p.buildLegend();
    p.pickCaption();
    var msg = fig.getAttribute('data-l-error');
    if (msg && !$('.slot-error', fig) && p.box) {
      var n = el('p', 'slot-error', msg);
      p.box.parentNode.insertBefore(n, p.box.nextSibling);
    }
  };

  /* ── time ── */
  Player.prototype.range = function () {
    var e = this.e, v = this.v;
    if (!e) return null;
    if (e.window) return [e.window['in'], e.window.out];
    if (v && isFinite(v.duration) && v.duration > 0) return [0, v.duration];
    return null;
  };
  Player.prototype.clipLen = function () {
    var e = this.e;
    if (!this.timing) return null;
    if (e.clip_len_s != null) return e.clip_len_s;
    var r = this.range();
    return r ? Math.max(0, r[1] - r[0] - (e.lead_in_s || 0)) * e.speed : null;
  };
  /* the clip's full length in clip seconds: the axis of the readout total and of the lanes */
  Player.prototype.total = function () {
    var e = this.e, c = e && e.clip_id ? CL[e.clip_id] : null;
    if (c && c.duration_s) return c.duration_s;
    var len = this.clipLen();
    return len != null ? e.clip_start_s + len : null;
  };
  /* the clip-time span that the video shows: the axis of the lanes */
  Player.prototype.laneSpan = function () {
    var e = this.e;
    if (!this.timing) return null;
    var a = e.clip_start_s, r = this.range(), tot = this.total(), b = null;
    if (r) b = a + Math.max(0, r[1] - r[0] - (e.lead_in_s || 0)) * e.speed;
    if (b == null || (tot != null && b > tot)) b = tot;
    return b != null && b > a ? [a, b] : null;
  };
  Player.prototype.clipT = function (t) {
    var e = this.e;
    if (!this.timing) return null;
    t = Math.floor(t / FRAME + 0.001) * FRAME;          // the frame on screen, not a time between two frames
    var w = e.window;
    var ct = e.clip_start_s + Math.max(0, t - (w ? w['in'] : 0) - (e.lead_in_s || 0)) * e.speed;
    var tot = this.total();
    if (tot != null) ct = Math.min(ct, tot);
    return Math.max(e.clip_start_s, ct);
  };
  Player.prototype.videoT = function (ct) {
    var e = this.e, w = e.window;
    return (w ? w['in'] : 0) + (e.lead_in_s || 0) + (ct - e.clip_start_s) / e.speed;
  };
  Player.prototype.seekVideo = function (t) {
    var p = this;
    if (!p.playable) return;
    p.live = true;
    if (!p.v) p.attach();
    var r = p.range();
    if (r) t = clamp(t, r[0], p.e.window ? r[1] - FRAME : r[1]);
    p.ended = false;
    if (!p.v || p.v.readyState < 1) { p.pending = p.pending || {}; p.pending.video = t; return; }
    p.setTime(t);
    p.updateUI();
  };
  Player.prototype.seekFrac = function (f) {
    var r = this.range();
    if (r) this.seekVideo(r[0] + clamp(f, 0, 1) * (r[1] - r[0]));
  };
  Player.prototype.seekClip = function (ct) {
    if (!this.timing) return;
    var e = this.e, tot = this.total();
    ct = clamp(ct, e.clip_start_s, tot != null ? tot : ct);
    this.seekVideo(this.videoT(ct));
  };
  Player.prototype.step = function (d) {
    var p = this;
    if (!p.playable) return;
    if (!p.v) p.attach();
    var v = p.v;
    if (!v) return;
    var cur = p.shownT();
    if (cur == null) cur = v.readyState > 0 ? v.currentTime : (p.range() ? p.range()[0] : 0);
    if (p.timing) p.seekClip(p.clipT(cur) + d);
    else p.seekVideo(cur + d);
  };
  /* video time of the frame on screen: the poster's moment until the reader plays or seeks (null if unknown) */
  Player.prototype.shownT = function () {
    var p = this, v = p.v, e = p.e;
    if (!e) return null;
    if (!p.live && !p.isFilm) return e.poster_at != null ? e.poster_at : null;
    if (v) return v.currentTime;
    var r = p.range();
    return r ? r[0] : 0;
  };
  /* scrubber keys: arrows step 2 s of clip time (as on the player), Page keys 10 s, Home and End the window ends */
  Player.prototype.onScrubKey = function (ev) {
    var p = this, k = ev.key;
    if (ev.altKey || ev.ctrlKey || ev.metaKey || !p.playable) return;
    var r = p.range();
    if (k === 'ArrowLeft' || k === 'ArrowDown') p.step(-2);
    else if (k === 'ArrowRight' || k === 'ArrowUp') p.step(2);
    else if (k === 'PageDown') p.step(-10);
    else if (k === 'PageUp') p.step(10);
    else if (k === 'Home' && r) p.seekVideo(r[0]);
    else if (k === 'End' && r) p.seekVideo(r[1]);
    else return;
    ev.preventDefault();
    ev.stopPropagation();
  };

  /* ── speed ── */
  Player.prototype.setupSpeed = function () {
    var p = this, seg = p.speedSeg, e = p.e;
    if (!seg) return;
    var ok = !!(p.timing && e.speed > 1.01);
    seg.hidden = !ok;
    p.speedOK = ok;
    if (!ok) { p.real = false; return; }
    var bs = $$('button', seg);
    if (bs[0]) { bs[0].textContent = fmtSpeed(e.speed); bs[0].setAttribute('data-real', '0'); }
    if (bs[1]) bs[1].setAttribute('data-real', '1');
    p.setReal(p.real);
  };
  Player.prototype.setReal = function (on) {
    var p = this;
    if (!p.speedOK) on = false;
    p.real = !!on;
    $$('button', p.speedSeg || D.createElement('div')).forEach(function (b) {
      b.setAttribute('aria-pressed', (b.getAttribute('data-real') === '1') === p.real ? 'true' : 'false');
    });
    p.applyRate();
    p.updateUI();
  };
  Player.prototype.applyRate = function () {
    var p = this, v = p.v;
    if (!v) return;
    var r = p.real && p.speedOK ? 1 / p.e.speed : 1;
    try { v.defaultPlaybackRate = r; v.playbackRate = r; } catch (x) { /* ignore */ }
  };

  /* ── tiles: labels, failure frames and the in-frame chip ── */
  function placeTile(d, t) {
    d.style.left = (t.x * 100) + '%';
    d.style.top = (t.y * 100) + '%';
    d.style.width = (t.w * 100) + '%';
    d.style.height = (t.h * 100) + '%';
  }
  Player.prototype.buildTiles = function () {
    var p = this, e = p.e, over = p.over;
    p.tileEls = []; p.frames = []; p.chipEl = null;
    if (!over) return;
    over.innerHTML = '';
    if (!e) return;
    var tiles = e.tiles || [];
    var b = e.burned || null;
    var labels = !(b && b.labels);
    var frames = p.playable && p.timing && !(b && b.failbox);
    var hands = e.family === 'hands';
    tiles.forEach(function (t) {
      var d = el('div', 'tile');
      placeTile(d, t);
      if (labels && t.label) {
        var lb = el('span', 'tile-label', t.label);
        if (t.sub && !hands) lb.appendChild(el('span', 'tl-sub', t.sub));
        d.appendChild(lb);
      }
      if (frames && t.sr === 'fail' && t.fail_at_s != null) {
        var f = el('div', 'tile-fr');
        f.innerHTML = '<svg class="tile-frame" aria-hidden="true" focusable="false"><rect class="u" x="0" y="0" width="100%" height="100%"/><rect class="d" x="0" y="0" width="100%" height="100%"/></svg>';
        f.hidden = true;
        d.insertBefore(f, d.firstChild);
        p.frames.push({ el: f, at: t.fail_at_s });
      }
      over.appendChild(d);
      p.tileEls.push(d);
    });
    /* in-frame chip, top right: clock and speed when the clock is not burned in, the speed alone when only it is missing */
    var wantClock = !!(b && b.clock === false && p.timing);
    var wantSpeed = !!(b && b.clock === true && b.speed === false && e.speed > 0);
    if (p.playable && (wantClock || wantSpeed)) {
      p.chipEl = el('span', 'frame-chip');
      over.appendChild(p.chipEl);
    }
  };

  /* caption tail that follows the slot data: a clause about speed, clock or inset only when the data confirm it
     (the build writes the matching tail for the default slot; the same rule as cap_level in the build) */
  Player.prototype.pickCaption = function () {
    var p = this, e = p.e, n = $('.cap-var', p.fig);
    var rest = n && $('.cap-rest', n);
    if (!rest) return;
    var b = (e && e.burned) || {};
    var sp2 = !!(p.playable && e && e.speed != null && Math.abs(e.speed - 2) < 0.01);
    var clock = sp2 && (b.clock === true || p.timing);
    var ok = { base: true, still: !p.playable, play: !!p.playable, clock: clock, inset: clock && b.ref_inset === 'top-left' };
    var pick = null;
    ['base', 'still', 'play', 'clock', 'inset'].forEach(function (k) {
      if (ok[k] && n.hasAttribute('data-cap-' + k)) pick = n.getAttribute('data-cap-' + k);
    });
    if (pick != null && rest.textContent !== pick) rest.textContent = pick;
  };

  Player.prototype.buildLegend = function () {
    var p = this, e = p.e, fig = p.fig;
    var text = fig.getAttribute('data-l-legend');
    if (!text || !p.cap) return;
    var tiles = (e && e.tiles) || [];
    var anyFail = tiles.some(function (t) { return t.sr === 'fail'; });
    var drawn = p.frames.length > 0 || !!(p.playable && e && e.burned && e.burned.failbox && anyFail);
    if (drawn && !p.legendEl) {
      p.legendEl = el('p', 'legend-fail', text);
      p.cap.insertBefore(p.legendEl, p.cap.firstChild);
    }
    if (p.legendEl) p.legendEl.hidden = !drawn;
  };

  /* ── focus: one tile fills the frame ── */
  Player.prototype.buildFocus = function () {
    var p = this, seg = p.focusSeg, e = p.e;
    if (!seg) return;
    var tiles = (e && e.tiles) || [];
    if (tiles.length < 2) { seg.hidden = true; seg.innerHTML = ''; p.setFocus(-1, true); return; }
    var html = '<button type="button" data-i="-1" aria-pressed="true" aria-keyshortcuts="0">' + esc(seg.getAttribute('data-l-all')) + '</button>';
    tiles.forEach(function (t, i) {
      html += '<button type="button" data-i="' + i + '" aria-pressed="false" aria-keyshortcuts="' + (i + 1) + '">' + esc(t.label) + '</button>';
    });
    seg.innerHTML = html;
    seg.hidden = false;
    p.setFocus(p.focus < tiles.length ? p.focus : -1, true);
  };
  Player.prototype.setFocus = function (i, instant) {
    var p = this, tiles = (p.e && p.e.tiles) || [], z = p.zoom;
    if (i >= tiles.length) return;
    p.focus = i;
    if (z) {
      if (instant || REDUCE) z.style.transition = 'none';
      if (i < 0) z.style.transform = '';
      else {
        var t = tiles[i];
        z.style.transform = 'scale(' + (1 / t.w).toFixed(5) + ',' + (1 / t.h).toFixed(5) + ') translate(' + (-t.x * 100).toFixed(4) + '%,' + (-t.y * 100).toFixed(4) + '%)';
      }
      if (instant || REDUCE) { void z.offsetWidth; z.style.transition = ''; }
    }
    p.tileEls.forEach(function (d, k) {
      if (i < 0) { placeTile(d, tiles[k]); d.hidden = false; }
      else if (k === i) { placeTile(d, { x: 0, y: 0, w: 1, h: 1 }); d.hidden = false; }
      else d.hidden = true;
    });
    if (p.focusSeg) $$('button', p.focusSeg).forEach(function (b) {
      b.setAttribute('aria-pressed', +b.getAttribute('data-i') === i ? 'true' : 'false');
    });
    p.fig.classList.toggle('focused', i >= 0);
    if (!instant && !REDUCE) {
      p.fig.classList.add('zooming');
      clearTimeout(p.zt);
      p.zt = setTimeout(function () { p.fig.classList.remove('zooming'); }, 270);
    }
  };

  /* ── lanes (compare): outcome per tile in clip time, from the fail times of the same rollout ── */
  Player.prototype.buildLanes = function () {
    var p = this, e = p.e, box = p.lanesEl;
    if (!box) return;
    box.innerHTML = '';
    box.hidden = true;
    p.phEl = null;
    if (!e || !p.playable || !p.timing || !e.tiles) return;
    var scored = e.tiles.filter(function (t) { return t.scored; });
    if (!scored.length || !scored.every(function (t) { return t.sr === 'fail' || t.sr === 'pass'; }) ||
        !scored.some(function (t) { return t.sr === 'fail'; })) return;
    var span = p.laneSpan();
    if (!span) return;
    p.span = span;
    var L = { ref: box.getAttribute('data-l-ref') || '', pass: box.getAttribute('data-l-pass') || '', fail: box.getAttribute('data-l-fail') || '' };
    e.tiles.forEach(function (t, i) {
      var row = el('div', 'lane');
      row.setAttribute('data-key', t.key || String(i));
      var label = el('span', 'ln-label', t.label);
      var track = el('div', 'ln-track' + (t.scored ? '' : ' ref'));
      var status = el('span', 'ln-status');
      var said;
      if (!t.scored) {
        track.appendChild(el('span', 'ln-base'));
        status.textContent = said = L.ref;
      } else if (t.sr === 'fail' && t.fail_at_s != null) {
        var f = clamp((t.fail_at_s - span[0]) / (span[1] - span[0]), 0, 1);
        var ok = el('span', 'ln-ok');
        ok.style.right = 'auto';
        ok.style.width = (f * 100) + '%';
        track.appendChild(ok);
        var dash = el('span', 'ln-dash');
        dash.style.left = (f * 100) + '%';
        dash.innerHTML = '<svg width="100%" height="2" aria-hidden="true" focusable="false" style="overflow:visible;display:block"><line x1="0" y1="1" x2="100%" y2="1"/></svg>';
        track.appendChild(dash);
        var tick = el('span', 'ln-tick' + (f > 0.92 ? ' at-end' : (f < 0.06 ? ' at-start' : '')));
        tick.style.left = (f * 100) + '%';
        tick.appendChild(el('b', null, fmtS(t.fail_at_s)));
        track.appendChild(tick);
        status.className = 'ln-status fail';
        status.textContent = said = L.fail + ' ' + fmtS(t.fail_at_s);
      } else {
        track.appendChild(el('span', 'ln-base'));
        track.appendChild(el('span', 'ln-pass', CHECK));
        status.className = 'ln-status pass';
        status.appendChild(el('span', 'ok', CHECK));
        status.appendChild(D.createTextNode(L.pass));
        said = L.pass;
      }
      track.setAttribute('role', 'img');
      track.setAttribute('aria-label', t.label + ', ' + said);
      label.style.gridRow = track.style.gridRow = status.style.gridRow = String(i + 1);
      row.appendChild(label);
      row.appendChild(track);
      row.appendChild(status);
      box.appendChild(row);
    });
    var ph = el('div', 'ln-ph');
    ph.style.gridRow = '1 / span ' + e.tiles.length;
    ph.setAttribute('aria-hidden', 'true');
    p.phEl = el('span');
    ph.appendChild(p.phEl);
    box.appendChild(ph);
    box.hidden = false;
  };

  /* ── object chapter strip (sidecar chapters, clip seconds): neutral segments under the scrubber ── */
  Player.prototype.buildObjects = function () {
    var p = this, e = p.e;
    if (p.objEl && p.objEl.parentNode) p.objEl.parentNode.removeChild(p.objEl);
    p.objEl = null;
    if (!p.track || !p.playable || !p.timing || !e.chapters || !e.chapters.length) return;
    var r = p.range();
    if (!r || !(r[1] > r[0])) return;
    var box = el('span', 'pb-objects');
    e.chapters.forEach(function (c) {
      if (c.t0 == null || c.t1 == null) return;
      var a = clamp((p.videoT(c.t0) - r[0]) / (r[1] - r[0]), 0, 1), b = clamp((p.videoT(c.t1) - r[0]) / (r[1] - r[0]), 0, 1);
      if (b - a < 0.002) return;
      var s = el('span', 'pb-obj');
      s.style.left = (a * 100) + '%';
      s.style.width = (b - a) * 100 + '%';
      s.title = c.label + DOT + fmtS(c.t0) + '\u2013' + fmtS(c.t1);
      s.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); p.seekClip(c.t0); });
      box.appendChild(s);
    });
    if (!box.firstChild) return;
    p.track.appendChild(box);
    p.track.classList.add('has-objects');
    p.objEl = box;
  };

  /* ── hands: a switcher between single takes that keeps the clip time ── */
  Player.prototype.buildHands = function () {
    var p = this, seg = p.handSeg;
    if (!seg) return;
    var b = p.base;
    if (!b || !b.hands) { seg.hidden = true; return; }
    seg.hidden = false;
    $$('button[data-hand]', seg).forEach(function (x) {
      var h = x.getAttribute('data-hand');
      x.hidden = !b.hands[h];
      x.setAttribute('aria-pressed', h === p.hand ? 'true' : 'false');
    });
  };
  Player.prototype.switchHand = function (h) {
    var p = this, b = p.base;
    if (!b || !b.hands || !b.hands[h] || h === p.hand) return;
    var v = p.v, wasPlaying = !!(v && !v.paused);
    var pend = { play: wasPlaying };
    if (v && v.readyState > 0) {
      if (p.timing) pend.clip = p.clipT(v.currentTime);
      else pend.video = v.currentTime;
    }
    var keepFocus = p.focus, wasLive = p.live;
    p.hand = h;
    p.load(b, { keep: true });
    p.focus = keepFocus;
    p.live = wasLive;                 // the reader is watching: show the new hand at the same moment, not its poster
    if (p.playable) {
      if (pend.clip != null && !p.timing) { pend.video = null; }
      p.pending = pend;
      if (!p.v) p.attach();
    }
  };

  /* ── visible state ── */
  Player.prototype.updateUI = function () {
    var p = this, v = p.v, e = p.e;
    if (!e) return;
    if (p.btn) {
      var st = (!v || v.paused) ? (p.ended ? 'replay' : 'play') : 'pause';
      if (p.btnState !== st) {
        p.btnState = st;
        p.btn.innerHTML = SVG[st];
        p.btn.setAttribute('aria-label', p.btn.getAttribute('data-l-' + st) || st);
      }
    }
    var r = p.range();
    var shown = p.shownT();                       // null: the poster's moment is unknown, so draw no clock on it
    var cur = shown != null ? shown : (r ? r[0] : 0);
    if (p.scrub) {
      var f = r && r[1] > r[0] ? clamp((cur - r[0]) / (r[1] - r[0]), 0, 1) : 0;
      if (p.ended && e.window) f = 1;
      if (!p.dragging) p.scrub.value = String(Math.round(f * 1000));
      if (p.track) p.track.style.setProperty('--p', f.toFixed(4));
    }
    var ct = shown != null ? p.clipT(cur) : null, tot = p.timing ? p.total() : null;
    if (p.scrub && r && r[1] > r[0]) {
      var tpl = p.scrub.getAttribute('data-l-value') || '{t} / {total}';
      var vt = ct != null && tot != null ? tpl.replace('{t}', fmtS(ct)).replace('{total}', fmtS(tot)) :
        tpl.replace('{t}', fmtS(Math.max(0, cur - r[0]))).replace('{total}', fmtS(r[1] - r[0]));
      if (vt !== p.vt) { p.vt = vt; p.scrub.setAttribute('aria-valuetext', vt); }
    }
    if (p.timeEl) {
      if (ct != null) {
        var txt = fmtS(ct) + (tot != null ? ' / ' + fmtS(tot) : '');
        if (p.timeEl.textContent !== txt) p.timeEl.textContent = txt;
        p.timeEl.hidden = false;
      } else p.timeEl.hidden = true;
    }
    if (p.chipEl) {
      var b = e.burned || {}, sp = e.speed > 0 ? (p.real ? '1' + TIMES : fmtSpeed(e.speed)) : '';
      var chip = b.clock === false ? (ct != null ? fmtS(ct) + (sp ? DOT + sp : '') : '') : sp;
      if (p.chipEl.textContent !== chip) p.chipEl.textContent = chip;
      p.chipEl.hidden = !chip;
    }
    for (var i = 0; i < p.frames.length; i++) {
      var on = ct != null && ct >= p.frames[i].at;
      if (p.frames[i].el.hidden === on) p.frames[i].el.hidden = !on;
    }
    if (p.phEl && p.span) {
      p.phEl.style.visibility = ct == null ? 'hidden' : '';
      p.phEl.style.setProperty('--t', clamp(((ct == null ? p.span[0] : ct) - p.span[0]) / (p.span[1] - p.span[0]), 0, 1).toFixed(4));
    }
    if (p.pill) {
      var playing = !!(v && !v.paused);
      var lab = playing ? p.pill.getAttribute('data-l-pause') : p.pill.getAttribute('data-l-play');
      var key = playing ? 'pause' : 'play';
      if (p.pillState !== key) {
        p.pillState = key;
        p.pill.innerHTML = SVG[key] + '<span>' + esc(lab) + '</span>';
      }
    }
    if (p.onTick) p.onTick(cur);
  };

  /* ── full screen and keys ── */
  Player.prototype.toggleFs = function () {
    var p = this, box = p.box;
    var cur = D.fullscreenElement || D.webkitFullscreenElement;
    if (cur) { (D.exitFullscreen || D.webkitExitFullscreen).call(D); return; }
    var req = box && (box.requestFullscreen || box.webkitRequestFullscreen);
    if (req) {
      var r = req.call(box);
      if (r && r['catch']) r['catch'](function () { /* refused */ });
    } else if (p.v && p.v.webkitEnterFullscreen) {
      p.v.webkitEnterFullscreen();
    }
  };
  Player.prototype.onKey = function (ev) {
    var p = this;
    if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
    var t = ev.target, tag = t && t.tagName, k = ev.key;
    if (tag === 'BUTTON' && (k === ' ' || k === 'Enter')) return;
    if (tag === 'INPUT' && /^(ArrowLeft|ArrowRight|ArrowUp|ArrowDown|Home|End|PageUp|PageDown)$/.test(k)) return;
    var done = true;
    if (k === ' ' || k === 'Spacebar' || k === 'k' || k === 'K') { if (p.playable) p.toggle(); else done = false; }
    else if (k === 'ArrowLeft' || k === 'ArrowRight') { if (p.playable) p.step(k === 'ArrowLeft' ? -2 : 2); else done = false; }
    else if (k === 's' || k === 'S') { if (p.speedOK) p.setReal(!p.real); else done = false; }
    else if (k === 'f' || k === 'F') { if (p.playable && CAN_FS) p.toggleFs(); else done = false; }
    else if (k === 'Escape') { if (p.focus >= 0) p.setFocus(-1); else done = false; }
    else if (/^[0-4]$/.test(k) && p.tileEls.length > 1) {
      var i = +k - 1;
      if (i < p.tileEls.length) p.setFocus(i); else done = false;
    } else done = false;
    if (done) ev.preventDefault();
  };

  function onFsChange() {
    var cur = D.fullscreenElement || D.webkitFullscreenElement;
    players.forEach(function (q) {
      if (!q.fsBtn) return;
      var on = !!cur && cur === q.box;
      q.fsBtn.innerHTML = on ? SVG.fsx : SVG.fs;
      q.fsBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  D.addEventListener('fullscreenchange', onFsChange);
  D.addEventListener('webkitfullscreenchange', onFsChange);

  /* ── play disc (hero under reduced motion or data saver) ── */
  Player.prototype.dropDisc = function () {
    if (this.disc && this.disc.parentNode) this.disc.parentNode.removeChild(this.disc);
    this.disc = null;
  };

  /* ── runtime probe for a late file (public build only): a still slot becomes a file with unknown timing ── */
  Player.prototype.probe = function () {
    var p = this, e = p.e;
    if (!M || M.probe !== true || !e || e.state !== 'still' || !e.expect || !p.near) return;
    if (probed[e.expect]) return;
    probed[e.expect] = true;
    var t = D.createElement('video');
    t.preload = 'metadata';
    t.muted = true;
    t.addEventListener('loadedmetadata', function () {
      var n = copyObj(e);
      n.state = 'file';
      n.src = e.expect;
      n.w = t.videoWidth || e.w;
      n.h = t.videoHeight || e.h;
      n.speed = n.lead_in_s = n.clip_start_s = n.clip_len_s = null;
      n.burned = null;
      n.chapters = null;
      if (n.tiles) n.tiles = n.tiles.map(function (x) { var y = copyObj(x); y.sr = null; y.fail_at_s = null; return y; });
      if (M.slots && e.id && M.slots[e.id] === e) M.slots[e.id] = n;
      if (M.film === e) M.film = n;
      if (p.e === e) p.load(n);
      t.removeAttribute('src');
    });
    t.addEventListener('error', function () { t.removeAttribute('src'); });
    t.src = e.expect;
  };

  /* ── build every slot and attach sources lazily, one viewport ahead ── */
  var filmP = null, heroP = null, theaterP = null;
  safe('players', function () {
    if (!M) return;
    var near = HAS_IO ? new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var p = en.target.__ldx;
        if (!p) return;
        p.near = en.isIntersecting;
        if (p.near) { p.attach(); p.probe(); }
      });
    }, { rootMargin: '100% 0px' }) : null;
    $$('figure.slot[data-slot]').forEach(function (fig) {
      var id = fig.getAttribute('data-slot');
      var e = null;
      if (id === 'film') {
        if (M.film) { e = copyObj(M.film); e.id = 'film'; e.kind = 'film'; e.family = 'film'; e.poster_alt = null; }
      } else if (M.slots && M.slots[id]) {
        e = M.slots[id];
      }
      if (!e || e.state === 'hidden') return;
      var p = new Player(fig);
      if (p.isFilm) filmP = p;
      if (p.isHero) heroP = p;
      if (closest(fig, '#theater')) theaterP = p;
      p.load(e);
      if (near) near.observe(fig);
    });
  });

  /* ── hero loop: muted autoplay while at least a quarter is visible, Pause pill, play disc ── */
  safe('hero', function () {
    var p = heroP;
    if (!p) return;
    var pill = $('.hero-foot .play-toggle');
    var auto = !REDUCE && !SAVE;
    var ready = false;
    function setup() {
      if (ready || !p.playable) return;
      ready = true;
      if (pill) {
        p.pill = pill;
        pill.hidden = false;
        pill.addEventListener('click', function () { p.toggle(); });
      }
      p.attach();
      if (!auto && p.media) {
        var disc = el('button', 'play-disc');
        disc.type = 'button';
        disc.setAttribute('aria-label', p.fig.getAttribute('data-l-play') || 'Play');
        disc.innerHTML = SVG.play;
        disc.addEventListener('click', function (ev) { ev.stopPropagation(); p.userPaused = false; p.play(); p.dropDisc(); });
        p.media.appendChild(disc);
        p.disc = disc;
        p.userPaused = true;
      }
      p.pillState = null;
      p.updateUI();
      if (!HAS_IO) { if (auto) p.play(); return; }
      var io = new IntersectionObserver(function (entries) {
        var en = entries[entries.length - 1];
        var vis = en.isIntersecting && en.intersectionRatio >= 0.25;
        if (vis) { if (!p.userPaused) p.play(); }
        else if (p.v && !p.v.paused) p.v.pause();
      }, { threshold: [0, 0.25, 0.5] });
      io.observe(p.fig);
    }
    /* a loop found later by the runtime probe gets the same treatment */
    p.onLoad = function () { if (p.playable) setTimeout(setup, 0); };
    setup();
  });

  /* ── 02 film: chapter buttons, timeline, keys [ and ] ── */
  safe('film', function () {
    var p = filmP;
    var card = $('.film-card');
    $$('[data-action="play-film"]').forEach(function (a) {
      a.addEventListener('click', function () { if (p && p.playable) { p.near = true; p.play(); } });
    });
    if (!p || !card) return;
    var chaps = $$('.chapters-row .chap', card);
    var segs = $$('.film-timeline .ft-seg', card);
    var tl = $('.film-timeline', card);
    var list = (M.film && M.film.chapters) || [];
    var starts = chaps.map(function (b) { return parseFloat(b.getAttribute('data-t')) || 0; });
    if (!starts.length) starts = segs.map(function (s) { return parseFloat(s.getAttribute('data-t')) || 0; });
    function ends(i) {
      if (list[i] && list[i].t1 != null) return list[i].t1;
      if (i + 1 < starts.length) return starts[i + 1];
      return (p.v && isFinite(p.v.duration)) ? p.v.duration : (M.film.duration_s || starts[i] + 1);
    }
    var curIdx = -1;
    p.onTick = function (t) {
      if (!starts.length) return;
      var c = 0;
      for (var i = 0; i < starts.length; i++) if (t >= starts[i] - 0.05) c = i;
      if (c !== curIdx) {
        curIdx = c;
        chaps.forEach(function (b, i) { b.setAttribute('aria-current', i === c ? 'true' : 'false'); });
        segs.forEach(function (s, i) { s.classList.toggle('cur', i === c); });
      }
      segs.forEach(function (s, i) {
        var a = starts[i], b = ends(i);
        var f = t <= a ? 0 : (t >= b ? 1 : (t - a) / Math.max(0.01, b - a));
        s.style.setProperty('--p', f.toFixed(4));
      });
    };
    p.onTick(0);
    chaps.forEach(function (b, i) {
      b.addEventListener('click', function () { p.seekVideo(starts[i]); p.play(); });
    });
    if (tl) tl.addEventListener('click', function (ev) {
      var s = closest(ev.target, '.ft-seg');
      if (!s) return;
      var i = segs.indexOf(s), r = s.getBoundingClientRect();
      var a = starts[i], b = ends(i);
      p.seekVideo(a + clamp((ev.clientX - r.left) / r.width, 0, 1) * (b - a));
    });
    card.addEventListener('keydown', function (ev) {
      if ((ev.key !== '[' && ev.key !== ']') || !starts.length) return;
      var c = Math.max(0, curIdx);
      var n = clamp(c + (ev.key === ']' ? 1 : -1), 0, starts.length - 1);
      p.seekVideo(starts[n]);
      ev.preventDefault();
    });
    /* chapters as a native text track, for the browser's own chapter menu */
    p.onMeta = function (v) {
      if (p.trackAdded || !list.length || !v.addTextTrack || !W.VTTCue) return;
      p.trackAdded = true;
      try {
        var row = $('.chapters-row', card);
        var tr = v.addTextTrack('chapters', (row && row.getAttribute('aria-label')) || 'Chapters', 'en');
        list.forEach(function (c, i) {
          var a = c.t0, b = c.t1 != null ? c.t1 : (i + 1 < list.length ? list[i + 1].t0 : v.duration);
          if (isFinite(b) && b > a) tr.addCue(new W.VTTCue(a, b, c.label));
        });
        tr.mode = 'hidden';
      } catch (x) { /* optional */ }
    };
    /* a film found by the runtime probe has no chapters: the pending list goes away */
    p.onLoad = function (e) {
      var pend = $('.chapters-row.pending', card);
      if (pend && e && (e.state === 'file' || e.state === 'window')) pend.hidden = true;
    };
  });

  /* ── 04 results: gallery theater, filter, 20-clip strip ── */
  safe('theater', function () {
    var th = $('#theater');
    if (!th) return;
    var side = $('.th-side', th);
    var cards = $$('.gcard[data-clip]');
    var squares = $$('button.sq[data-clip]');
    var curId = null;
    var cur = $('.gcard[aria-current="true"]');
    if (cur) curId = cur.getAttribute('data-clip');
    function mark(id) {
      cards.forEach(function (c) { c.setAttribute('aria-current', c.getAttribute('data-clip') === id ? 'true' : 'false'); });
      squares.forEach(function (s) {
        if (s.getAttribute('data-clip') === id) s.setAttribute('aria-current', 'true'); else s.removeAttribute('aria-current');
      });
    }
    function sideFill(card, e) {
      if (!side || !card) return;
      var map = { title: 'data-title', dataset: 'data-dataset', length: 'data-length', objects: 'data-objects',
        hand: 'data-hand', successes: 'data-successes', phrase: 'data-phrase', tag: 'data-tag' };
      Object.keys(map).forEach(function (k) {
        var n = $('[data-field="' + k + '"]', side);
        if (!n) return;
        n.textContent = card.getAttribute(map[k]) || '';
        if (k === 'tag') n.hidden = !n.textContent;
      });
      var prov = $('.th-prov', side), extra = $('.th-extra', side);
      var pv = e && e.provenance ? e.provenance : '';
      if (pv) { if (!prov) { prov = el('p', 'th-prov mono'); side.appendChild(prov); } prov.textContent = pv; prov.hidden = false; }
      else if (prov) prov.hidden = true;
      var xs = !!(e && e.extra_seed === true);
      if (xs) {
        if (!extra) { extra = el('p', 'th-extra'); side.appendChild(extra); }
        extra.textContent = side.getAttribute('data-l-extra-seed') || '';
        extra.hidden = false;
      } else if (extra) extra.hidden = true;
    }
    function inView() {
      var r = th.getBoundingClientRect(), vh = W.innerHeight || ROOT.clientHeight;
      var vis = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      if (vis < Math.min(r.height, vh) / 2) {
        th.scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth', block: r.height < vh - 80 ? 'center' : 'start' });
      }
    }
    function select(id, scroll) {
      var card = $('.gcard[data-clip="' + id + '"]');
      var e = M && M.slots ? M.slots['gallery:' + id] : null;
      if (!e && card) {
        var im = $('img', card);
        e = { id: 'gallery:' + id, family: 'gallery', clip_id: id, kind: 'take', state: 'still',
          poster: im ? im.getAttribute('src') : null, poster_alt: card.getAttribute('aria-label'),
          aria: card.getAttribute('aria-label'), w: 16, h: 9 };
      }
      curId = id;
      mark(id);
      sideFill(card, e);
      if (theaterP && e) {
        if (theaterP.e === e) { if (theaterP.playable) theaterP.play(); }
        else theaterP.load(e, { play: true, keep: true });
      } else if (e) {
        var fig = $('figure.slot', th), img = fig && $('img.poster', fig);
        if (img && e.poster) { img.src = e.poster; img.alt = e.poster_alt || ''; }
      }
      if (scroll) inView();
    }
    cards.forEach(function (c) { c.addEventListener('click', function () { select(c.getAttribute('data-clip'), true); }); });
    squares.forEach(function (s) { s.addEventListener('click', function () { select(s.getAttribute('data-clip'), true); }); });
    if (curId) mark(curId);
    var count = $('.filter-count');
    $$('.seg.filter button[data-filter]').forEach(function (b, _, all) {
      b.addEventListener('click', function () {
        var f = b.getAttribute('data-filter'), n = 0;
        all.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        cards.forEach(function (c) {
          var show = f === 'all' || c.getAttribute('data-dataset') === f;
          c.hidden = !show;
          if (show) n++;
        });
        if (count) count.textContent = (count.getAttribute('data-l-showing') || '').replace('{n}', String(n));
      });
    });
  });

  /* ── comparison viewers: the picker (and, in a slide viewer, the arrows) swaps the clip and keeps speed and focus.
     A viewer with data-autoplay="0" only shows the chosen clip, and the reader presses play ── */
  safe('picker', function () {
    $$('.compare-viewer').forEach(function (v) {
      var fig = $('figure.slot', v), p = fig && fig.__ldx;
      var thumbs = $$('.picker .thumb[data-slot]', v);
      var prev = $('.slide-btn.prev', v), next = $('.slide-btn.next', v), count = $('.slide-count', v);
      var picker = $('.picker', v);
      var auto = v.getAttribute('data-autoplay') !== '0';
      if (!p || thumbs.length < 2) {
        if (prev) prev.hidden = true;
        if (next) next.hidden = true;
        if (count) count.hidden = true;
        return;
      }
      function current() {
        for (var i = 0; i < thumbs.length; i++) if (thumbs[i].getAttribute('aria-current') === 'true') return i;
        return 0;
      }
      function show(i) {
        i = (i + thumbs.length) % thumbs.length;
        var t = thumbs[i], id = t.getAttribute('data-slot'), e = M.slots ? M.slots[id] : null;
        if (!e) return;
        thumbs.forEach(function (x) { x.setAttribute('aria-current', x === t ? 'true' : 'false'); });
        if (count) count.textContent = (count.getAttribute('data-l-count') || '').replace('{i}', String(i + 1)).replace('{n}', String(thumbs.length));
        if (picker && picker.scrollWidth > picker.clientWidth + 2) {
          picker.scrollLeft = t.offsetLeft - picker.offsetLeft - (picker.clientWidth - t.offsetWidth) / 2;
        }
        if (p.e === e) {
          if (auto && p.playable) { p.seekVideo(p.range() ? p.range()[0] : 0); p.play(); }
          return;
        }
        p.load(e, { play: auto, keep: true });
        if (!auto && p.playable) p.attach();
      }
      thumbs.forEach(function (t, i) { t.addEventListener('click', function () { show(i); }); });
      if (prev) prev.addEventListener('click', function (ev) { ev.stopPropagation(); show(current() - 1); });
      if (next) next.addEventListener('click', function (ev) { ev.stopPropagation(); show(current() + 1); });
    });
  });

  /* ── sideways scrollers (tables, clip picker): a one-line hint under a box whose content is wider than the box,
     so a column cut at the edge reads as more to scroll, not as a broken table (no fade, colour stays for data) ── */
  safe('scrollhints', function () {
    var main = $('#main');
    var label = main && main.getAttribute('data-l-scroll');
    if (!label) return;
    var boxes = $$('.table-wrap, .picker');
    function check() {
      boxes.forEach(function (b) {
        var shown = b.offsetParent !== null && b.clientWidth > 0;
        var over = shown && b.scrollWidth > b.clientWidth + 2;
        b.classList.toggle('is-scrollable', over);
        var h = b.__hint;
        if (over && !h) {
          h = el('p', 'scroll-hint sx mono', label);
          h.setAttribute('aria-hidden', 'true');
          b.parentNode.insertBefore(h, b.nextSibling);
          b.__hint = h;
        }
        if (h) h.hidden = !over;
      });
    }
    var queued = false;
    function later() { if (!queued) { queued = true; W.requestAnimationFrame(function () { queued = false; check(); }); } }
    W.addEventListener('resize', later);
    W.addEventListener('load', later);
    $$('details').forEach(function (d) { d.addEventListener('toggle', later); });
    if (D.fonts && D.fonts.ready) D.fonts.ready.then(later, function () { /* ignore */ });
    check();
  });

  /* ── citation (public): copy BibTeX ── */
  safe('bibtex', function () {
    var b = $('#copyBib'), pre = $('#bibtex');
    if (!b || !pre) return;
    var lab = $('span', b), base = lab ? lab.textContent : '', done = b.getAttribute('data-l-done') || base, tm = null;
    function ok() {
      if (lab) lab.textContent = done;
      b.classList.add('done');
      clearTimeout(tm);
      tm = setTimeout(function () { if (lab) lab.textContent = base; b.classList.remove('done'); }, 1800);
    }
    function select() {
      try { var r = D.createRange(); r.selectNodeContents(pre); var s = W.getSelection(); s.removeAllRanges(); s.addRange(r); } catch (x) { /* ignore */ }
    }
    b.addEventListener('click', function () {
      var text = pre.textContent;
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, select);
      else { select(); try { if (D.execCommand('copy')) ok(); } catch (x) { /* ignore */ } }
    });
  });
})();
