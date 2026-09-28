// How AI Works · S1·C4 "Make the Loop Real". The music video, the narrated chapter, and the real training run to scrub through.
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
  const sectionName = () => { const h = segEls.slice(0, Math.max(cur, 0) + 1).reverse().find((x) => x.tagName === 'H2'); return h ? h.textContent : 'Make the Loop Real'; };
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
    navigator.mediaSession.metadata = new MediaMetadata({ title: 'Make the Loop Real', artist: 'How AI Works · Season 1, Chapter 4', album: 'Parvish Gajjar', artwork: [{ src: 'media/poster.jpg', sizes: '1280x720', type: 'image/jpeg' }] });
    navigator.mediaSession.setActionHandler('seekbackward', () => { audio.currentTime -= 15; });
    navigator.mediaSession.setActionHandler('seekforward', () => { audio.currentTime += 15; });
  }



  // ------------------------------------------------------------ the training-run lab
  // c4.json (train/loop.py): Chapter 1's run re-done bit-for-bit and recorded. Nothing here is simulated.
  const $$ = (id) => document.getElementById(id);
  const pctS = (v) => (v * 100).toFixed(1) + '%';
  let C = null, S = [], stepAt = 0, pos = 0, playing = false, raf = 0;
  const plates = [];
  const toStep = (v) => Math.round(Math.pow(7505, v / 1000) - 1);            // log slider: early steps get room
  const fromStep = (s) => Math.log(s + 1) / Math.log(7505) * 1000;
  function lerpTab(xs, ys, x) { if (x <= xs[0]) return ys[0]; const n = xs.length - 1; if (x >= xs[n]) return ys[n]; let lo = 0, hi = n; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] <= x) lo = m; else hi = m; } return ys[lo] + (ys[hi] - ys[lo]) * (x - xs[lo]) / (xs[hi] - xs[lo]); }
  fetch('c4.json').then((r) => r.json()).then((c) => {
    C = c;
    S = c.w1.map((w) => { const raw = atob(w.b64), a = new Float32Array(raw.length); for (let i = 0; i < raw.length; i++) { let v = raw.charCodeAt(i); if (v > 127) v -= 256; a[i] = v * w.scale; } return a; });
    const box = $$('plates');
    for (let j = 0; j < 16; j++) { const cv = document.createElement('canvas'); cv.width = 28; cv.height = 28; box.append(cv); plates.push(cv); }
    // accuracy sparkline (log steps)
    const sp = $$('spark'), X = (s) => 4 + 292 * Math.log10(1 + s) / Math.log10(7505), Y = (a) => 76 - 72 * a;
    const path = c.curve.map((r, i) => (i ? 'L' : 'M') + X(r[0]).toFixed(1) + ' ' + Y(r[1]).toFixed(1)).join(' ');
    sp.innerHTML = `<path d="${path}" fill="none" stroke="#ffb23f" stroke-width="1.6"/><circle id="dot" r="3.5" fill="#ffb23f"/>`;
    // mistakes
    const miss = $$('miss');
    c.mistakes.forEach((m) => {
      const f = document.createElement('figure'), cv = document.createElement('canvas'); cv.width = 28; cv.height = 28;
      const g = cv.getContext('2d'), img = g.createImageData(28, 28), raw = atob(m.px);
      for (let k = 0; k < 784; k++) { const v = raw.charCodeAt(k); img.data[k * 4] = 236 * v / 255; img.data[k * 4 + 1] = 231 * v / 255; img.data[k * 4 + 2] = 220 * v / 255; img.data[k * 4 + 3] = 255; }
      g.putImageData(img, 0, 0);
      const cap = document.createElement('figcaption'); cap.innerHTML = `${m.label} → <b>${m.pred}</b> · ${Math.round(m.p * 100)}%`;
      f.append(cv, cap); miss.append(f);
    });
    // confusion matrix
    const t = $$('conf'); let h = '<tr><th></th>' + [...Array(10).keys()].map((d) => `<th>${d}</th>`).join('') + '</tr>';
    c.confusion.forEach((row, a) => { h += `<tr><th>${a}</th>` + row.map((v, b) => { const m = a === b ? 0 : Math.min(1, v / 25); const bg = a === b ? 'rgba(255,178,63,0.16)' : v ? `rgba(232,65,47,${(0.08 + 0.6 * m).toFixed(2)})` : 'transparent'; return `<td class="${a === b ? 'd' : ''}" style="background:${bg}">${v}</td>`; }).join('') + '</tr>'; });
    t.innerHTML = h;
    set(0);
  });
  function w1At(step) {
    const st = C.w1.map((w) => w.step); let i = 0; while (i < st.length - 2 && st[i + 1] <= step) i++;
    const f = Math.max(0, Math.min(1, (step - st[i]) / (st[i + 1] - st[i]))), a = S[i], b = S[i + 1];
    return (k) => a[k] + (b[k] - a[k]) * f;
  }
  function set(step) {
    if (!C) return;
    stepAt = step; $$('scrub').value = String(fromStep(step)); $$('stepVal').textContent = step.toLocaleString('en-US');
    const w = w1At(step);
    plates.forEach((cv, j) => {
      const g = cv.getContext('2d'), img = g.createImageData(28, 28);
      for (let k = 0; k < 784; k++) { const v = Math.max(-1, Math.min(1, w(j * 784 + k) / 0.3)), a = Math.pow(Math.abs(v), 0.8), col = v >= 0 ? [236, 231, 220] : [168, 90, 18];
        img.data[k * 4] = col[0] * a; img.data[k * 4 + 1] = col[1] * a; img.data[k * 4 + 2] = col[2] * a; img.data[k * 4 + 3] = 255; }
      g.putImageData(img, 0, 0);
    });
    const xs = C.curve.map((r) => r[0]);
    const te = lerpTab(xs, C.curve.map((r) => r[1]), step), tr = lerpTab(xs, C.curve.map((r) => r[2]), step), lo = lerpTab(xs, C.curve.map((r) => r[3]), step);
    $$('rEp').textContent = `${Math.min(8, Math.floor(step / 938) + 1)} of 8`; $$('rTe').textContent = pctS(te); $$('rTr').textContent = pctS(tr); $$('rLo').textContent = lo.toFixed(3);
    const d = document.getElementById('dot'); if (d) { d.setAttribute('cx', (4 + 292 * Math.log10(1 + step) / Math.log10(7505)).toFixed(1)); d.setAttribute('cy', (76 - 72 * te).toFixed(1)); }
    const hx = C.hero.map((r) => r[0]), p = [...Array(10).keys()].map((q) => lerpTab(hx, C.hero.map((r) => r[q + 1]), step));
    $$('bars').innerHTML = p.map((v, q) => `<span style="color:${q === 7 ? '#ffb23f' : 'var(--muted)'}">${q}</span><i class="${q === 7 ? 'seven' : ''}" style="width:${(v * 100).toFixed(1)}%"></i><span>${(v * 100).toFixed(1)}%</span>`).join('');
  }
  $$('scrub').addEventListener('input', (e) => { playing = false; $$('play').textContent = 'Play'; set(toStep(+e.target.value)); });
  $$('toEnd').addEventListener('click', () => { playing = false; $$('play').textContent = 'Play'; set(7504); });
  $$('play').addEventListener('click', () => {
    playing = !playing; $$('play').textContent = playing ? 'Pause' : 'Play';
    pos = fromStep(stepAt); if (playing && stepAt >= 7504) { pos = 0; set(0); }
    let last = performance.now();
    const tick = (now) => { if (!playing) return; pos = Math.min(1000, pos + (now - last) * 0.09); last = now; const v = pos; set(toStep(v)); if (v >= 1000) { playing = false; $$('play').textContent = 'Play'; return; } raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
  });
})();
