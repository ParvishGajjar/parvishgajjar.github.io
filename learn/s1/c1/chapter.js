// How AI Works · S1·C1. The music video, the narrated chapter, and the real 784-16-16-10 network.
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const AMBER = [244, 179, 106], CYAN = [110, 231, 224], BONE = [236, 231, 220];
  const f2 = (v) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(2);
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  // ------------------------------------------------------------ video (the song and the narration never play over each other)
  const video = $('mv');
  video.addEventListener('play', () => { if (!audio.paused) audio.pause(); });

  // ------------------------------------------------------------ the chapter, narrated
  // States: idle (never played) · loading (asked to play, audio not flowing yet) · playing · paused · ended
  const audio = $('narration'), box = $('listen'), btn = $('listenBtn'), fill = $('listenFill'), bar = $('listenBar');
  const now = $('listenNow'), time = $('listenTime');
  const segEls = Array.from(document.querySelectorAll('#story > h2, #story > p, #story > span.real, #story > span.eq, #story > div.aside, #story > ul.timeline'));
  let T = null, cur = -1, follow = true, scrolledByUs = 0;
  const speeds = [1, 1.25, 1.5, 0.85];
  const setState = (st) => {
    box.dataset.play = st;
    const playingish = st === 'playing' || st === 'loading';
    $('icoPlay').hidden = playingish; $('icoPause').hidden = !playingish;
    btn.setAttribute('aria-label', playingish ? 'Pause the narration' : 'Play the narration');
    btn.setAttribute('aria-pressed', String(playingish));
    if (st === 'loading') now.textContent = 'Starting…';
    if (st === 'paused') now.textContent = 'Paused · ' + sectionName();
    if (st === 'ended') now.textContent = 'Finished · play again';
    if (st === 'playing') now.textContent = sectionName();
  };
  const sectionName = () => { const h = segEls.slice(0, Math.max(cur, 0) + 1).reverse().find((x) => x.tagName === 'H2'); return h ? h.textContent : 'What a Neuron Computes'; };
  fetch('audio/timings.json').then((r) => (r.ok ? r.json() : Promise.reject())).then((j) => {
    T = j; box.dataset.state = 'ready'; setState('idle');
    now.textContent = 'Listen to this chapter'; time.textContent = mmss(j.duration);
    segEls.forEach((el, i) => {
      el.classList.add('seekable');
      el.addEventListener('click', (e) => { if (e.target.closest('a') || getSelection().toString()) return; seekTo(T.segments[i]?.start ?? 0, true); });
    });
  }).catch(() => { box.dataset.state = 'missing'; now.textContent = 'Narration coming soon'; });
  function play() { setState('loading'); if (video && !video.paused) video.pause(); audio.play().catch(() => setState('paused')); }
  function seekTo(t, andPlay) {
    const go = () => { audio.currentTime = t; if (andPlay) play(); };
    if (audio.readyState >= 1) go(); else { audio.addEventListener('loadedmetadata', go, { once: true }); audio.preload = 'auto'; audio.load(); if (andPlay) setState('loading'); }
  }
  btn.addEventListener('click', () => { if (box.dataset.state !== 'ready') return; if (audio.paused) play(); else audio.pause(); });
  $('listenSpeed').addEventListener('click', (e) => { const i = (speeds.indexOf(audio.playbackRate) + 1) % speeds.length; audio.playbackRate = speeds[i]; e.currentTarget.textContent = speeds[i] + '×'; });
  bar.addEventListener('click', (e) => { if (!T) return; const r = bar.getBoundingClientRect(); seekTo(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * T.duration, !audio.paused); });
  bar.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') audio.currentTime += 10; if (e.key === 'ArrowLeft') audio.currentTime -= 10; });
  audio.addEventListener('waiting', () => { if (!audio.paused) setState('loading'); });
  audio.addEventListener('playing', () => { setState('playing'); follow = true; });
  audio.addEventListener('pause', () => { if (!audio.ended) setState('paused'); });
  audio.addEventListener('ended', () => { segEls[cur]?.classList.remove('speaking'); cur = -1; setState('ended'); });
  addEventListener('scroll', () => { if (Date.now() - scrolledByUs > 900) follow = false; }, { passive: true });
  audio.addEventListener('timeupdate', () => {
    if (!T) return;
    const t = audio.currentTime, pct = (t / T.duration) * 100;
    fill.style.width = pct + '%'; bar.setAttribute('aria-valuenow', String(Math.round(pct)));
    time.textContent = `${mmss(t)} / ${mmss(T.duration)}`;
    let k = -1; for (let i = 0; i < T.segments.length; i++) if (t >= T.segments[i].start - 0.05) k = i;
    if (k === cur) return;
    segEls[cur]?.classList.remove('speaking'); cur = k;
    const el = segEls[k]; if (!el) return;
    el.classList.add('speaking');
    if (!audio.paused) now.textContent = sectionName();
    const r = el.getBoundingClientRect();
    if (follow && !audio.paused && (r.top < 170 || r.bottom > innerHeight - 60)) { scrolledByUs = Date.now(); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  });
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({ title: 'What a Neuron Computes', artist: 'How AI Works · Season 1, Chapter 1', album: 'Parvish Gajjar', artwork: [{ src: 'media/f3-weights-sm.jpg', sizes: '640x360', type: 'image/jpeg' }] });
    navigator.mediaSession.setActionHandler('seekbackward', () => { audio.currentTime -= 15; });
    navigator.mediaSession.setActionHandler('seekforward', () => { audio.currentTime += 15; });
  }

  // ------------------------------------------------------------ the network
  let N = null;
  const relu = (z) => z.map((v) => (v > 0 ? v : 0));
  const affine = (W, b, x) => W.map((row, j) => { let s = b[j]; for (let i = 0; i < row.length; i++) s += row[i] * x[i]; return s; });
  function forward(x) {
    const z1 = affine(N.W1, N.b1, x), a1 = relu(z1), a2 = relu(affine(N.W2, N.b2, a1)), z3 = affine(N.W3, N.b3, a2);
    const m = Math.max(...z3), e = z3.map((v) => Math.exp(v - m)), s = e.reduce((a, b) => a + b, 0);
    return { z1, a1, p: e.map((v) => v / s) };
  }
  // drawing pad → MNIST-style 28×28 (fit the ink into 20×20, centre its centre of mass)
  const pad = $('draw'), pc = pad.getContext('2d', { willReadFrequently: true });
  const clearPad = () => { pc.fillStyle = '#000'; pc.fillRect(0, 0, pad.width, pad.height); };
  clearPad();
  let drawing = false, last = null, queued = false, x = new Array(784).fill(0), sel = 6, fromVideo = false;
  const pos = (e) => { const r = pad.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * pad.width, y: ((e.clientY - r.top) / r.height) * pad.height }; };
  pad.addEventListener('pointerdown', (e) => { if (fromVideo) { clearPad(); fromVideo = false; } drawing = true; last = pos(e); pad.setPointerCapture(e.pointerId); $('hint').hidden = true; stroke(last, last); });
  pad.addEventListener('pointermove', (e) => { if (!drawing) return; const p = pos(e); stroke(last, p); last = p; });
  const end = () => { drawing = false; };
  pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end);
  function stroke(a, b) {
    pc.strokeStyle = '#fff'; pc.lineWidth = 42; pc.lineCap = 'round'; pc.lineJoin = 'round';
    pc.beginPath(); pc.moveTo(a.x, a.y); pc.lineTo(b.x, b.y); pc.stroke();
    if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; x = sample(); update(); }); }
  }
  function sample() {
    const W = pad.width, H = pad.height, d = pc.getImageData(0, 0, W, H).data;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y += 2) for (let i = 0; i < W; i += 2) if (d[(y * W + i) * 4] > 30) { x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    if (x1 < 0) return new Array(784).fill(0);
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, s = 20 / Math.max(bw, bh);
    const w = Math.max(1, Math.round(bw * s)), h = Math.max(1, Math.round(bh * s));
    const small = document.createElement('canvas'); small.width = 28; small.height = 28;
    const sc = small.getContext('2d', { willReadFrequently: true }); sc.imageSmoothingQuality = 'high';
    const place = (ox, oy) => { sc.fillStyle = '#000'; sc.fillRect(0, 0, 28, 28); sc.drawImage(pad, x0, y0, bw, bh, ox, oy, w, h); return sc.getImageData(0, 0, 28, 28).data; };
    let px = place((28 - w) / 2, (28 - h) / 2), m = 0, cx = 0, cy = 0;
    for (let k = 0; k < 784; k++) { const v = px[k * 4] / 255; m += v; cx += v * (k % 28); cy += v * Math.floor(k / 28); }
    if (m > 0) px = place((28 - w) / 2 + Math.round(13.5 - cx / m), (28 - h) / 2 + Math.round(13.5 - cy / m));
    return Array.from({ length: 784 }, (_, k) => px[k * 4] / 255);
  }
  function showPixelsOnPad(pix) { clearPad(); const c = pad.width / 28; pix.forEach((v, k) => { if (!v) return; pc.fillStyle = `rgba(255,255,255,${v})`; pc.fillRect((k % 28) * c, Math.floor(k / 28) * c, c + 0.5, c + 0.5); }); }
  function paintMap(canvas, vals, mode, scale) {
    const c = canvas.getContext('2d'), img = c.createImageData(28, 28);
    for (let k = 0; k < 784; k++) {
      const v = vals[k], a = mode === 'x' ? v : Math.min(1, Math.abs(v) / scale), rgb = mode === 'x' ? BONE : v >= 0 ? AMBER : CYAN;
      img.data.set([rgb[0] * a, rgb[1] * a, rgb[2] * a, 255], k * 4);
    }
    c.putImageData(img, 0, 0);
  }
  function reluSVG(z) {
    const W = 400, H = 130, zmin = -8, zmax = 12, X = (v) => ((v - zmin) / (zmax - zmin)) * (W - 20) + 10, Y = (v) => H - 18 - (v / zmax) * (H - 34);
    const zc = Math.max(zmin, Math.min(zmax, z)), a = Math.max(0, zc), col = z > 0 ? '#f4b36a' : '#d5dde5';
    $('reluPlot').innerHTML = `<line x1="10" y1="${Y(0)}" x2="${W - 10}" y2="${Y(0)}" stroke="rgba(255,255,255,.2)"/>
      <line x1="${X(0)}" y1="${Y(0)}" x2="${X(0)}" y2="10" stroke="rgba(255,255,255,.2)"/>
      <polyline points="${X(zmin)},${Y(0)} ${X(0)},${Y(0)} ${X(zmax)},${Y(zmax)}" fill="none" stroke="#6ee7e0" stroke-width="2.5"/>
      <line x1="${X(zc)}" y1="${Y(0)}" x2="${X(zc)}" y2="${Y(a)}" stroke="rgba(255,255,255,.35)" stroke-dasharray="3 3"/>
      <circle cx="${X(zc)}" cy="${Y(a)}" r="6" fill="${col}"/>
      <text x="${W - 12}" y="${Y(0) + 14}" fill="#8b97a3" font-family="JetBrains Mono" font-size="11" text-anchor="end">score z</text>
      <text x="${X(0) + 6}" y="18" fill="#8b97a3" font-family="JetBrains Mono" font-size="11">passed on</text>
      <text x="${Math.min(W - 70, X(zc) + 10)}" y="${Math.max(26, Y(a) - 9)}" fill="${col}" font-family="JetBrains Mono" font-size="12">z = ${f2(z)}</text>`;
  }
  function update() {
    if (!N) return;
    const empty = x.every((v) => v === 0), r = forward(x), amax = Math.max(1e-6, ...r.a1);
    document.querySelectorAll('#neurons button').forEach((b, i) => {
      const k = empty ? 0 : r.a1[i] / amax, pct = Math.round(18 + 70 * Math.sqrt(k));
      b.style.background = k > 0 ? `radial-gradient(circle, rgba(244,179,106,${0.35 + 0.65 * k}) 0 ${pct}%, #07090b ${pct + 1}%)` : '#07090b';
      b.style.color = k > 0.5 ? '#140d02' : '';
      b.title = `neuron ${i}: score ${f2(r.z1[i])}, passes on ${f2(r.a1[i])}`;
    });
    const w = N.W1[sel], prod = w.map((v, k) => v * x[k]);
    paintMap($('mx'), x, 'x'); paintMap($('mw'), w, 'w', Math.max(...w.map(Math.abs))); paintMap($('mp'), prod, 'w', Math.max(0.05, ...prod.map(Math.abs)));
    let pos = 0, neg = 0; for (const v of prod) { if (v > 0) pos += v; else neg += v; }
    const z = pos + neg + N.b1[sel];
    $('rPos').textContent = '+' + pos.toFixed(2); $('rNeg').textContent = f2(neg); $('rB').textContent = f2(N.b1[sel]);
    $('rZ').textContent = f2(z); $('rA').textContent = (z > 0 ? z : 0).toFixed(2);
    $('neuronSub').textContent = empty ? 'Choose a first-layer neuron. Filled circles are firing.' : `Neuron ${sel}: ${z > 0 ? 'its score is above zero, so it fires.' : 'its score is below zero, so ReLU passes on 0.'}`;
    reluSVG(empty ? 0 : z);
    const top = r.p.indexOf(Math.max(...r.p));
    $('bars').innerHTML = r.p.map((p, d) => `<div class="bar${!empty && d === top ? ' top' : ''}"><span>${d}</span><i style="--w:${empty ? 0 : (p * 100).toFixed(1)}%"></i><em>${empty ? '—' : (p * 100).toFixed(1) + '%'}</em></div>`).join('');
    $('verdict').textContent = empty ? '' : `The network reads it as “${top}” (${(r.p[top] * 100).toFixed(1)}%).`;
  }
  const nb = $('neurons');
  for (let i = 0; i < 16; i++) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = i; b.setAttribute('aria-pressed', String(i === sel));
    b.addEventListener('click', () => { sel = i; nb.querySelectorAll('button').forEach((y, j) => y.setAttribute('aria-pressed', String(j === sel))); update(); });
    nb.appendChild(b);
  }
  $('clear').addEventListener('click', () => { clearPad(); x = new Array(784).fill(0); fromVideo = false; $('hint').hidden = false; update(); });
  $('load7').addEventListener('click', () => {
    if (!N) return; x = N.digit.pixels.slice(); fromVideo = true; $('hint').hidden = true; showPixelsOnPad(x);
    sel = N.star.neuron; nb.querySelectorAll('button').forEach((y, j) => y.setAttribute('aria-pressed', String(j === sel))); update();
  });
  fetch('net-lite.json').then((r) => r.json()).then((j) => { N = j; update(); }).catch(() => { $('verdict').textContent = 'Could not load the network weights.'; });

  // ------------------------------------------------------------ up next, from the series map
  try {
    const all = window.SERIES.seasons.flatMap((s) => s.chapters.map((c) => ({ ...c, season: s.n })));
    const i = all.findIndex((c) => c.id === 's1c1'), nx = all[i + 1];
    if (nx) {
      const n = $('next');
      n.querySelector('.section-kicker').lastChild.textContent = `Up next · Season ${nx.season}, Chapter ${nx.n}: ${nx.title}`;
      n.querySelector('h3').textContent = nx.blurb;
      if (nx.status === 'live') { const a = n.querySelector('a'); a.href = nx.url; a.textContent = 'Go to Chapter ' + nx.n; }
    }
  } catch (_) {}
})();
