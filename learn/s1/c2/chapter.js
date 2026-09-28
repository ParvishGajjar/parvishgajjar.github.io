// How AI Works · S1·C2 "Follow the Slope". The music video, the narrated chapter, and the real loss landscape.
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
  const sectionName = () => { const h = segEls.slice(0, Math.max(cur, 0) + 1).reverse().find((x) => x.tagName === 'H2'); return h ? h.textContent : 'Follow the Slope'; };
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
    navigator.mediaSession.metadata = new MediaMetadata({ title: 'Follow the Slope', artist: 'How AI Works · Season 1, Chapter 2', album: 'Parvish Gajjar', artwork: [{ src: 'media/poster.jpg', sizes: '1280x720', type: 'image/jpeg' }] });
    navigator.mediaSession.setActionHandler('seekbackward', () => { audio.currentTime -= 15; });
    navigator.mediaSession.setActionHandler('seekforward', () => { audio.currentTime += 15; });
  }

  // ------------------------------------------------------------ the landscape lab
  // slice.json: the true loss of the Chapter 1 network on a 121×121 grid over a plane through its untrained start,
  // the bend at step 1,548 and its trained end (train/landscape.py), plus the real Adam path projected onto it.
  const cv = $('land'), g = cv.getContext('2d');
  let S = null, lnG = null, NG = 0, A0 = 0, A1 = 1, B0 = 0, B1 = 1, base = null;
  let run = null, timer = 0, start = null;
  const cr = (a, b, c, d, t) => b + 0.5 * t * (c - a + t * (2 * a - 5 * b + 4 * c - d + t * (3 * (b - c) + d - a)));
  const at = (i, j) => lnG[Math.min(NG - 1, Math.max(0, j)) * NG + Math.min(NG - 1, Math.max(0, i))];
  function lnAt(a, b) {                     // bicubic ln(loss) at plane coords, same as the video's terrain
    const x = ((a - A0) / (A1 - A0)) * (NG - 1), y = ((b - B0) / (B1 - B0)) * (NG - 1);
    const ix = Math.floor(x), iy = Math.floor(y), tx = x - ix, ty = y - iy, r = [];
    for (let k = -1; k <= 2; k++) r.push(cr(at(ix - 1, iy + k), at(ix, iy + k), at(ix + 1, iy + k), at(ix + 2, iy + k), tx));
    return cr(r[0], r[1], r[2], r[3], ty);
  }
  const lossAt = (a, b) => Math.exp(lnAt(a, b));
  function grad(a, b) { const e = ((A1 - A0) / (NG - 1)) * 0.35; return [(lossAt(a + e, b) - lossAt(a - e, b)) / (2 * e), (lossAt(a, b + e) - lossAt(a, b - e)) / (2 * e)]; }
  const px = (a) => ((a - A0) / (A1 - A0)) * cv.width, py = (b) => (1 - (b - B0) / (B1 - B0)) * cv.height;
  const toA = (x) => A0 + (x / cv.width) * (A1 - A0), toB = (y) => B0 + (1 - y / cv.height) * (B1 - B0);
  const etaOf = (v) => +(0.1 * Math.pow(2000, v / 100)).toPrecision(2);
  const vOf = (eta) => (Math.log(eta / 0.1) / Math.log(2000)) * 100;

  fetch('slice.json').then((r) => r.json()).then((j) => {
    S = j; NG = j.a.length; A0 = j.a[0]; A1 = j.a[NG - 1]; B0 = j.b[0]; B1 = j.b[NG - 1];
    lnG = new Float32Array(NG * NG);
    for (let jj = 0; jj < NG; jj++) for (let i = 0; i < NG; i++) lnG[jj * NG + i] = Math.log(j.loss[jj][i]);
    paintBase(); reset(); updateEta();
  });

  function paintBase() {
    const W = cv.width, H = cv.height, img = g.createImageData(W, H), lv = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) lv[y * W + x] = lnAt(toA(x + 0.5), toB(y + 0.5)) / Math.LN10;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = lv[y * W + x], k = (y * W + x) * 4;
      const t = Math.max(0, Math.min(1, (v + 0.9) / 2.1));           // log10 loss -0.9 .. 1.2 -> 0..1
      let r = 10 + 38 * t, gg = 13 + 44 * t, bb = 16 + 52 * t;
      // contours: every 0.1 of log10(loss); brighter every 0.5
      const vx = lv[y * W + Math.min(W - 1, x + 1)], vy = lv[Math.min(H - 1, y + 1) * W + x];
      const minor = Math.floor(v * 10) !== Math.floor(vx * 10) || Math.floor(v * 10) !== Math.floor(vy * 10);
      const index = Math.floor(v * 2) !== Math.floor(vx * 2) || Math.floor(v * 2) !== Math.floor(vy * 2);
      if (index) { r = 180; gg = 176; bb = 168; } else if (minor) { r += 40; gg += 40; bb += 40; }
      img.data[k] = r; img.data[k + 1] = gg; img.data[k + 2] = bb; img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    base = g.getImageData(0, 0, W, H);
  }

  function draw() {
    if (!base) return;
    g.putImageData(base, 0, 0);
    g.lineCap = 'round'; g.lineJoin = 'round';
    if ($('showPath').checked) {
      g.strokeStyle = 'rgba(244,179,106,0.9)'; g.lineWidth = 3; g.beginPath();
      S.path.a.forEach((a, i) => { const x = px(a), y = py(S.path.b[i]); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke();
      g.fillStyle = '#f4b36a'; g.beginPath(); g.arc(px(0), py(0), 7, 0, 7); g.fill();
      g.font = '500 20px "JetBrains Mono", monospace'; g.fillText('trained', px(0) + 12, py(0) - 10);
      g.fillStyle = '#ece7dc'; g.fillText('untrained', px(S.path.a[0]) - 118, py(S.path.b[0]) - 14);
    }
    if (run && run.length) {
      g.strokeStyle = 'rgba(110,231,224,0.95)'; g.lineWidth = 2.5; g.beginPath();
      run.forEach(([a, b], i) => { const x = px(a), y = py(b); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke();
      g.fillStyle = 'rgba(110,231,224,0.9)';
      for (const [a, b] of run) { g.beginPath(); g.arc(px(a), py(b), 3.2, 0, 7); g.fill(); }
      const [a, b] = run[run.length - 1];
      g.fillStyle = '#6ee7e0'; g.shadowColor = '#6ee7e0'; g.shadowBlur = 18; g.beginPath(); g.arc(px(a), py(b), 9, 0, 7); g.fill(); g.shadowBlur = 0;
    }
    readout();
  }
  function readout() {
    if (!run || !run.length) return;
    const [a, b, L] = run[run.length - 1], [ga, gb] = grad(a, b);
    $('rStep').textContent = String(run.length - 1);
    $('rLoss').textContent = run.off ? 'thrown off the map' : L.toFixed(3);
    $('rGrad').textContent = Math.hypot(ga, gb).toFixed(3);
    const sv = $('spark'), n = run.length, lo = Math.log(0.12), hi = Math.log(14);
    const X = (i) => 6 + (i / Math.max(1, 60)) * 288, Y = (L) => 74 - ((Math.log(L) - lo) / (hi - lo)) * 68;
    sv.innerHTML = `<line x1="6" y1="74" x2="294" y2="74" stroke="rgba(255,255,255,.15)"/><polyline fill="none" stroke="#6ee7e0" stroke-width="2" points="${run.map((r, i) => `${X(i).toFixed(1)},${Y(r[2]).toFixed(1)}`).join(' ')}"/>`
      + `<text x="294" y="12" text-anchor="end" fill="rgba(255,255,255,.45)" font-size="10" font-family="JetBrains Mono, monospace">loss per step (log)</text>`;
  }
  function reset() { stop(); start = [S.path.a[0], S.path.b[0]]; run = [[start[0], start[1], lossAt(start[0], start[1])]]; $('landHint').hidden = false; draw(); }
  function stop() { clearInterval(timer); timer = 0; $('run').textContent = 'Run 60 steps'; }
  function go() {
    if (timer) { stop(); return; }
    if (!run || run.length > 60 || run.off) run = [[start[0], start[1], lossAt(start[0], start[1])]];
    const eta = etaOf(+$('eta').value);
    $('run').textContent = 'Stop';
    timer = setInterval(() => {
      let [a, b] = run[run.length - 1];
      const [ga, gb] = grad(a, b);
      a -= eta * ga; b -= eta * gb;
      if (a < A0 || a > A1 || b < B0 || b > B1) { run.off = true; stop(); draw(); return; }
      run.push([a, b, lossAt(a, b)]);
      draw();
      if (run.length > 60) stop();
    }, 70);
  }
  cv.addEventListener('click', (e) => {
    if (!S) return;
    const r = cv.getBoundingClientRect();
    start = [toA(((e.clientX - r.left) / r.width) * cv.width), toB(((e.clientY - r.top) / r.height) * cv.height)];
    stop(); run = [[start[0], start[1], lossAt(start[0], start[1])]]; $('landHint').hidden = true; draw(); go();
  });
  const updateEta = () => { $('etaVal').textContent = String(etaOf(+$('eta').value)); };
  $('eta').addEventListener('input', updateEta);
  document.querySelectorAll('.presets .chip').forEach((b) => b.addEventListener('click', () => { $('eta').value = String(vOf(+b.dataset.eta)); updateEta(); stop(); if (S) { run = null; go(); } }));
  $('run').addEventListener('click', () => { if (S) go(); });
  $('reset').addEventListener('click', () => { if (S) reset(); });
  $('showPath').addEventListener('change', draw);
})();
