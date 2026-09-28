// How AI Works · S1·C3 "Every Link Matters". The music video, the narrated chapter, and a live backpropagation lab.
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
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
  const sectionName = () => { const h = segEls.slice(0, Math.max(cur, 0) + 1).reverse().find((x) => x.tagName === 'H2'); return h ? h.textContent : 'Every Link Matters'; };
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
    navigator.mediaSession.metadata = new MediaMetadata({ title: 'Every Link Matters', artist: 'How AI Works · Season 1, Chapter 3', album: 'Parvish Gajjar', artwork: [{ src: 'media/poster.jpg', sizes: '1280x720', type: 'image/jpeg' }] });
    navigator.mediaSession.setActionHandler('seekbackward', () => { audio.currentTime -= 15; });
    navigator.mediaSession.setActionHandler('seekforward', () => { audio.currentTime += 15; });
  }


  // ------------------------------------------------------------ the backprop lab
  // c3.json (train/backprop.py): the untrained network's real weights (seed 7, step 0; biases start at 0) and our 7.
  // Everything below is recomputed live: the forward pass, the blame at every layer, the chain-rule slope of the
  // chosen dial, the same slope by nudging it, and one gradient step.
  const cvD = $('digit'), gD = cvD.getContext('2d'), cvN = $('net'), gN = cvN.getContext('2d');
  const RED = '#e8412f', GOLD = '#ffb23f', BONE = '#ece7dc', ASH = '#9b9da1', DIM = '#2c3036';
  let P0, X, Y, F0, B0, j = 5, k = 462, eta = 0;
  const fmt = (v, d = 3) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(d);
  const zeros = (n) => new Array(n).fill(0);

  function fwd(P) {
    const z1 = P.W1.map((r, i) => { let s = P.b1[i]; for (let q = 0; q < 784; q++) s += r[q] * X[q]; return s; });
    const a1 = z1.map((v) => (v > 0 ? v : 0));
    const z2 = P.W2.map((r, i) => r.reduce((s, w, q) => s + w * a1[q], P.b2[i]));
    const a2 = z2.map((v) => (v > 0 ? v : 0));
    const z3 = P.W3.map((r, i) => r.reduce((s, w, q) => s + w * a2[q], P.b3[i]));
    const m = Math.max(...z3), e = z3.map((v) => Math.exp(v - m)), S = e.reduce((a, b) => a + b, 0), p = e.map((v) => v / S);
    return { z1, a1, z2, a2, z3, p, loss: -Math.log(p[Y]) };
  }
  function back(P, f) {
    const d3 = f.p.slice(); d3[Y] -= 1;                                                        // blame at the outputs: p − y
    const d2 = zeros(16).map((_, i) => (f.z2[i] > 0 ? P.W3.reduce((s, r, o) => s + r[i] * d3[o], 0) : 0));   // back along W3, then the gate
    const d1 = zeros(16).map((_, i) => (f.z1[i] > 0 ? P.W2.reduce((s, r, o) => s + r[i] * d2[o], 0) : 0));   // back along W2, then the gate
    return { d3, d2, d1 };
  }
  function stepped(e) {                                                                         // w ← w − η · (δ × what came in)
    const f = F0, b = B0;
    return {
      W1: P0.W1.map((r, i) => r.map((w, q) => w - e * b.d1[i] * X[q])), b1: P0.b1.map((v, i) => v - e * b.d1[i]),
      W2: P0.W2.map((r, i) => r.map((w, q) => w - e * b.d2[i] * f.a1[q])), b2: P0.b2.map((v, i) => v - e * b.d2[i]),
      W3: P0.W3.map((r, i) => r.map((w, q) => w - e * b.d3[i] * f.a2[q])), b3: P0.b3.map((v, i) => v - e * b.d3[i]),
    };
  }

  fetch('c3.json').then((r) => r.json()).then((c) => {
    X = c.hero.pixels; Y = c.hero.label;
    P0 = { W1: c.W.W1, W2: c.W.W2, W3: c.W.W3, b1: zeros(16), b2: zeros(16), b3: zeros(10) };
    F0 = fwd(P0); B0 = back(P0, F0);
    buildMaps(); update();
  });

  function buildMaps() {
    const box = $('maps'), mx = Math.max(...B0.d1.map(Math.abs));
    for (let i = 0; i < 16; i++) {
      const fig = document.createElement('figure'), cv = document.createElement('canvas'); cv.width = 28; cv.height = 28;
      const g = cv.getContext('2d'), img = g.createImageData(28, 28);
      for (let q = 0; q < 784; q++) { const m = Math.pow(Math.abs(B0.d1[i] * X[q]) / mx, 0.7); img.data[q * 4] = 232 * m; img.data[q * 4 + 1] = 65 * m; img.data[q * 4 + 2] = 47 * m; img.data[q * 4 + 3] = 255; }
      g.putImageData(img, 0, 0);
      const cap = document.createElement('figcaption'); cap.textContent = F0.z1[i] > 0 ? `${i} · ${fmt(B0.d1[i])}` : `${i} · silent`;
      if (F0.z1[i] <= 0) fig.classList.add('dead');
      fig.append(cv, cap); fig.addEventListener('click', () => { j = i; update(); }); box.append(fig);
    }
  }

  // network diagram geometry (canvas px)
  const COL = { x: 44, h1: 190, h2: 350, out: 490, loss: 585 };
  const yH = (i) => 30 + i * 24, yO = (o) => 48 + o * 36, yL = 210;

  function drawNet() {
    const g = gN, W = cvN.width, H = cvN.height, f = F0, b = B0;
    g.clearRect(0, 0, W, H); g.fillStyle = '#0a0d10'; g.fillRect(0, 0, W, H);
    const xk = X[k], alive1 = f.z1[j] > 0;
    // every path from the chosen dial: x · W2[i][j] · W3[o][i] · δ3[o], through fired layer-2 neurons
    const paths = [];
    if (alive1) for (let i = 0; i < 16; i++) if (f.z2[i] > 0) for (let o = 0; o < 10; o++) paths.push({ i, o, v: xk * P0.W2[i][j] * P0.W3[o][i] * b.d3[o] });
    const vm = Math.max(1e-9, ...paths.map((p) => Math.abs(p.v)));
    g.lineCap = 'round';
    const line = (x0, y0, x1, y1, col, a, w) => { g.globalAlpha = a; g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.globalAlpha = 1; };
    // faint skeleton
    for (let i = 0; i < 16; i++) for (let q = 0; q < 16; q++) line(COL.h1, yH(q), COL.h2, yH(i), ASH, 0.05, 1);
    for (let o = 0; o < 10; o++) for (let i = 0; i < 16; i++) line(COL.h2, yH(i), COL.out, yO(o), ASH, 0.05, 1);
    for (let o = 0; o < 10; o++) line(COL.out, yO(o), COL.loss, yL, ASH, 0.12, 1);
    // the paths
    for (const p of paths) {
      const m = Math.sqrt(Math.abs(p.v) / vm), a = 0.08 + 0.85 * m;
      line(COL.h1, yH(j), COL.h2, yH(p.i), RED, a, 1 + 2.5 * m); line(COL.h2, yH(p.i), COL.out, yO(p.o), RED, a, 1 + 2.5 * m); line(COL.out, yO(p.o), COL.loss, yL, RED, a * 0.8, 1 + 2 * m);
    }
    line(COL.x, yL, COL.h1, yH(j), xk > 0 && alive1 ? RED : ASH, xk > 0 && alive1 ? 0.95 : 0.4, 3);
    // nodes: red fill by |blame|, hollow when silent
    const node = (x, y, r, blame, alive, sel, col = RED) => {
      g.beginPath(); g.arc(x, y, r, 0, 7);
      if (alive) { g.globalAlpha = 0.15 + 0.85 * Math.min(1, Math.abs(blame) / 0.6); g.fillStyle = col; g.fill(); g.globalAlpha = 1; }
      g.lineWidth = sel ? 2.5 : 1.2; g.strokeStyle = sel ? BONE : alive ? ASH : DIM; g.stroke();
    };
    for (let i = 0; i < 16; i++) { node(COL.h1, yH(i), 8, b.d1[i], f.z1[i] > 0, i === j); node(COL.h2, yH(i), 8, b.d2[i], f.z2[i] > 0, false); }
    for (let o = 0; o < 10; o++) node(COL.out, yO(o), 11, b.d3[o], true, false);
    node(COL.loss, yL, 16, 1, true, false);
    g.beginPath(); g.arc(COL.x, yL, 12, 0, 7); g.fillStyle = `rgba(236,231,220,${0.1 + 0.9 * xk})`; g.fill(); g.strokeStyle = ASH; g.lineWidth = 1.2; g.stroke();
    g.font = '500 13px "JetBrains Mono", monospace'; g.fillStyle = ASH; g.textAlign = 'center';
    g.fillText(`x${k}`, COL.x, yL + 32); g.fillText('layer 1', COL.h1, H - 6); g.fillText('layer 2', COL.h2, H - 6); g.fillText('outputs', COL.out, H - 6); g.fillText('loss', COL.loss, yL + 36);
    g.textAlign = 'left';
    for (let o = 0; o < 10; o++) { g.fillStyle = o === Y ? GOLD : ASH; g.fillText(String(o), COL.out + 18, yO(o) + 4); }
    return paths;
  }

  function drawDigit() {
    const g = gD, s = cvD.width / 28;
    for (let q = 0; q < 784; q++) { const v = Math.round(X[q] * 236); g.fillStyle = `rgb(${v},${Math.round(v * 0.98)},${Math.round(v * 0.93)})`; g.fillRect((q % 28) * s, Math.floor(q / 28) * s, s, s); }
    g.strokeStyle = RED; g.lineWidth = 2.5; g.strokeRect((k % 28) * s + 1, Math.floor(k / 28) * s + 1, s - 2, s - 2);
  }

  function update() {
    if (!F0) return;
    drawDigit();
    const paths = drawNet();
    const xk = X[k], d = B0.d1[j], chain = paths.reduce((s, p) => s + p.v, 0);
    // nudge the dial a hair each way and re-run the whole network twice
    const h = 1e-4, old = P0.W1[j][k];
    P0.W1[j][k] = old + h; const up = fwd(P0).loss; P0.W1[j][k] = old - h; const dn = fwd(P0).loss; P0.W1[j][k] = old;
    $('dialName').textContent = `W1[${j}, ${k}]: pixel ${k} → layer-1 neuron ${j}`;
    $('pixLabel').textContent = `pixel ${k} (row ${Math.floor(k / 28)}, column ${k % 28})`;
    $('rW').textContent = fmt(old, 4); $('rX').textContent = xk.toFixed(3); $('rD').textContent = F0.z1[j] > 0 ? fmt(d, 4) : '0 · silent';
    $('rP').textContent = F0.z1[j] > 0 ? `${paths.length} · sum ${fmt(chain, 6)}` : '0 · gate closed';
    $('rG').textContent = fmt(d * xk, 6); $('rN').textContent = fmt((up - dn) / (2 * h), 6);
    $('why').textContent = F0.z1[j] <= 0 ? `Neuron ${j} stayed silent for this 7 (its total was ${fmt(F0.z1[j], 2)}), so the ReLU gate is closed: no blame gets through, and every dial feeding it has slope 0.`
      : xk === 0 ? `Pixel ${k} is black: 0 came in, and 0 × blame = 0. This dial won't move for this digit.`
      : `Slope = blame × what came in = ${fmt(d, 4)} × ${xk.toFixed(3)}. ${d * xk < 0 ? 'Negative: turning this dial up would lower the loss, so the step turns it up.' : 'Positive: turning this dial up would raise the loss, so the step turns it down.'}`;
    document.querySelectorAll('#maps figure').forEach((el, i) => el.classList.toggle('on', i === j));
    // one step
    const f1 = eta > 0 ? fwd(stepped(eta)) : F0;
    $('bars').innerHTML = f1.p.map((v, o) => `<span style="color:${o === Y ? GOLD : ASH}">${o}</span><i class="${o === Y ? 'seven' : ''}" style="width:${(v * 100).toFixed(1)}%"></i><span>${(v * 100).toFixed(1)}%</span>`).join('');
    $('rL').textContent = f1.loss.toFixed(3);
    $('rM').textContent = eta > 0 ? '26,336 for all 13,002 slopes' : '12,960 (forward only)';
  }

  const pick = (cv, e) => { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * cv.width, ((e.clientY - r.top) / r.height) * cv.height]; };
  cvD.addEventListener('click', (e) => { const [x, y] = pick(cvD, e), s = cvD.width / 28; k = Math.min(27, Math.floor(y / s)) * 28 + Math.min(27, Math.floor(x / s)); update(); });
  cvN.addEventListener('click', (e) => {
    const [x, y] = pick(cvN, e);
    if (Math.abs(x - COL.h1) > 30) return;
    j = Math.max(0, Math.min(15, Math.round((y - 30) / 24))); update();
  });
  $('eta').addEventListener('input', (e) => { eta = +e.target.value; $('etaVal').textContent = eta.toFixed(2); update(); });
})();
