// How AI Works · S2·C1 "Pieces of a Sentence". The narrated chapter, the season's real tokenizer, the galaxy of its
// 512 learned embeddings (at 17 moments of training) and the in-order vs backwards surprise. Nothing here is simulated:
// c1.json is written from the season model's files (bpe.json, the saved embedding tables, the trained checkpoint).
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  // ------------------------------------------------------------ video (the song and the narration never play over each other)
  const video = $('mv');
  video.addEventListener('play', () => { if (!audio.paused) audio.pause(); });

  // ------------------------------------------------------------ the chapter, narrated
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
  const sectionName = () => { const h = segEls.slice(0, Math.max(cur, 0) + 1).reverse().find((x) => x.tagName === 'H2'); return h ? h.textContent : 'Pieces of a Sentence'; };
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
    navigator.mediaSession.metadata = new MediaMetadata({ title: 'Pieces of a Sentence', artist: 'How AI Works · Season 2, Chapter 1', album: 'Parvish Gajjar', artwork: [{ src: 'media/poster.jpg', sizes: '1280x720', type: 'image/jpeg' }] });
    navigator.mediaSession.setActionHandler('seekbackward', () => { audio.currentTime -= 15; });
    navigator.mediaSession.setActionHandler('seekforward', () => { audio.currentTime += 15; });
  }

  // ============================================================ the labs
  const show = (s) => s.replace(/^ /, '·').replace(/\n/g, '↵');
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const COLS = ['#6ee7e0', '#ffb23f', '#9c8cff', '#ff8fa3', '#b5e86e', '#7cc4ff', '#f5d76e', '#c9a0ff'];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let D = null;

  fetch('c1.json').then((r) => r.json()).then((d) => { D = d; tokenizer(); galaxy(); order(); });

  // ------------------------------------------------------------ 1. the tokenizer (65 characters + 447 merges, exactly as trained)
  function tokenizer() {
    const chars = D.chars, NC = chars.length, V = D.vocab, M = D.merges;
    const cid = new Map(chars.map((c, i) => [c, i]));
    const rank = new Map(M.map(([a, b], k) => [a * 1024 + b, k]));
    const PAT = / ?[A-Za-z]+| ?[0-9]+| ?[^\sA-Za-z0-9]+|\s+(?!\S)|\s+/g;
    const inp = $('tokIn'), out = $('tokOut'), mk = $('mk');
    function encode(text, K) {
      const pieces = [], fired = new Set();
      for (const w of text.match(PAT) || []) {
        let s = [...w].map((c) => (cid.has(c) ? cid.get(c) : -1 - c.codePointAt(0)));   // unknown characters are negative and never merge
        while (s.length > 1) {
          let best = Infinity, at = -1;
          for (let i = 0; i < s.length - 1; i++) { if (s[i] < 0 || s[i + 1] < 0) continue; const r = rank.get(s[i] * 1024 + s[i + 1]); if (r !== undefined && r < K && r < best) { best = r; at = i; } }
          if (at < 0) break;
          fired.add(best); s = [...s.slice(0, at), NC + best, ...s.slice(at + 2)];
        }
        pieces.push(...s);
      }
      return { pieces, fired };
    }
    const txt = (id) => (id < 0 ? String.fromCodePoint(-1 - id) : V[id]);
    function render() {
      const K = +mk.value, text = inp.value;
      $('mkVal').textContent = String(K); $('mkVocab').textContent = `${NC + K} pieces`;
      const { pieces, fired } = encode(text, K);
      out.innerHTML = pieces.slice(0, 400).map((id) => {
        if (id < 0) return `<span class="tk unk" title="not one of the 65 characters"><b>${esc(txt(id))}</b><small>?</small></span>`;
        const s = V[id];
        if (/^\s+$/.test(s) && s.includes('\n')) return `<span class="tk nl"><b>${s.replace(/\n/g, '↵').replace(/ /g, '·')}</b><small>${id}</small></span>`;
        const lead = s.startsWith(' ') ? '<i>·</i>' : '';
        return `<span class="tk"><b style="background:${COLS[id % COLS.length]}">${lead}${esc(s.replace(/^ /, ''))}</b><small>${id}</small></span>`;
      }).join('') + (pieces.length > 400 ? '<span class="tk"><small>…</small></span>' : '');
      const nch = [...text].length;
      $('sChars').textContent = nch.toLocaleString('en-US'); $('sPieces').textContent = pieces.length.toLocaleString('en-US');
      $('sRatio').textContent = pieces.length ? (nch / pieces.length).toFixed(2) : '—';
      const list = [...fired].sort((a, b) => a - b);
      $('mList').innerHTML = list.length ? list.map((k) => `<li><b>#${k + 1}</b>  ${esc(show(V[M[k][0]]))} + ${esc(show(V[M[k][1]]))} → <em>${esc(show(V[NC + k]))}</em></li>`).join('') : '<li>none yet: every character is its own piece</li>';
    }
    const presets = ['I never learned to say it', 'To be, or not to be, that is the question', 'The king is dead; long live the king!', 'Wherefore art thou Romeo?', 'Parvish learns about tokenizers', 'naïve café 😊'];
    $('tokPresets').innerHTML = presets.map((p, i) => `<button class="chip" type="button" data-i="${i}">${esc(p.length > 26 ? p.slice(0, 24) + '…' : p)}</button>`).join('');
    $('tokPresets').addEventListener('click', (e) => { const b = e.target.closest('.chip'); if (!b) return; inp.value = presets[+b.dataset.i]; stop(); mk.value = '447'; render(); });
    inp.addEventListener('input', () => { stop(); render(); });
    mk.addEventListener('input', () => { stop(); render(); });
    let timer = 0;
    const stop = () => { clearTimeout(timer); timer = 0; $('mkPlay').textContent = 'Replay the merges'; };
    $('mkPlay').addEventListener('click', () => {
      if (timer) { stop(); return; }
      const ranks = [...encode(inp.value, 447).fired].sort((a, b) => a - b);
      const stops = [0, ...ranks.map((r) => r + 1), 447];
      let i = 0; $('mkPlay').textContent = 'Stop';
      const step = () => { mk.value = String(stops[i]); render(); i++; if (i < stops.length) timer = setTimeout(step, i === 1 ? 900 : 520); else { timer = 0; $('mkPlay').textContent = 'Replay the merges'; } };
      step();
    });
    render();
  }

  // ------------------------------------------------------------ 2. the galaxy: 512 pieces at 17 moments of training
  function galaxy() {
    const V = D.vocab, n = V.length, S = D.maps.length;
    const dec16 = (b64) => { const raw = atob(b64), u = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) u[i] = raw.charCodeAt(i); return u.buffer; };
    const maps = D.maps.map((m) => Float32Array.from(new Int16Array(dec16(m.b64)), (v) => v / 100));
    const nnS = D.nn_snap.map((m) => new Uint16Array(dec16(m.b64)));
    const steps = D.maps.map((m) => m.step), maxC = Math.max(...D.counts);
    const HUE = ['#6ee7e0', '#ffb23f', '#9c8cff', '#ff8fa3', '#b5e86e', '#7cc4ff', '#f5d76e', '#c9a0ff', '#8ff0c0', '#ffa86e', '#a0b4ff', '#e6e1d6', '#ff7ad9', '#9ee6ff'];
    const rgb = HUE.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
    const cv = $('galCv'), g = cv.getContext('2d'), wrap = $('gal');
    const P = new Float32Array(n * 3), SX = new Float32Array(n), SY = new Float32Array(n), SZ = new Float32Array(n), order = new Uint16Array(n);
    let yaw = 0.6, pitch = 0.25, dist = 34, want = 34, tv = 1600, focus = true, tx = 0, ty = 0, tz = 0, sel = V.indexOf(' say'), hover = -1, lastUser = 0, W = 0, H = 0, dpr = 1, dirty = true;
    const bigLabel = new Set([...D.counts.map((c, i) => [c, i])].sort((a, b) => b[0] - a[0]).slice(0, 90).map((x) => x[1]));
    function size() { dpr = Math.min(2, devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; dirty = true; }
    new ResizeObserver(size).observe(cv); size();
    const snapF = () => tv / 100;
    function positions() {
      const f = snapF(), i = Math.min(S - 2, Math.floor(f)), u = f - i, k = u * u * (3 - 2 * u), A = maps[i], B = maps[i + 1];
      for (let j = 0; j < n * 3; j++) P[j] = A[j] + (B[j] - A[j]) * k;
    }
    function follow() {                                   // the camera glides to the chosen piece (or to the middle, for the whole galaxy)
      const gx = focus && sel >= 0 ? P[sel * 3] : 0, gy = focus && sel >= 0 ? P[sel * 3 + 1] : 0, gz = focus && sel >= 0 ? P[sel * 3 + 2] : 0;
      const k = reduce ? 1 : 0.08, d = Math.abs(gx - tx) + Math.abs(gy - ty) + Math.abs(gz - tz) + Math.abs(want - dist);
      tx += (gx - tx) * k; ty += (gy - ty) * k; tz += (gz - tz) * k; dist += (want - dist) * k;
      return d > 0.05;
    }
    const lerpAt = (xs, ys, x) => { if (x <= xs[0]) return ys[0]; for (let i = 0; i < xs.length - 1; i++) if (x <= xs[i + 1]) return ys[i] + (ys[i + 1] - ys[i]) * (x - xs[i]) / (xs[i + 1] - xs[i]); return ys[ys.length - 1]; };
    function stepNow() { const f = snapF(), i = Math.min(S - 2, Math.floor(f)); return steps[i] + (steps[i + 1] - steps[i]) * (f - i); }
    function project() {
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), fx = Math.min(W, H) * 1.05;
      for (let j = 0; j < n; j++) {
        const x = P[j * 3] - tx, y = P[j * 3 + 1] - ty, z = P[j * 3 + 2] - tz;
        const x1 = cy * x + sy * z, z1 = -sy * x + cy * z, y2 = cp * y - sp * z1, z2 = sp * y + cp * z1 + dist;
        SZ[j] = z2; SX[j] = W / 2 + (fx * x1) / Math.max(z2, 0.5); SY[j] = H / 2 - (fx * y2) / Math.max(z2, 0.5);
      }
      for (let j = 0; j < n; j++) order[j] = j;
      order.sort((a, b) => SZ[b] - SZ[a]);
    }
    function draw() {
      positions(); moving = follow(); project();
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      const fi = Math.round(snapF()), nowN = nnS[fi], endN = D.nn[sel] || [];
      const company = sel >= 0 ? Array.from(nowN.subarray(sel * 8, sel * 8 + 8)) : [];
      const hot = new Set([sel, ...company]);
      // lines: the company it keeps at this moment
      if (sel >= 0) {
        g.lineWidth = 1.2;
        for (const j of company) {
          const keep = endN.includes(j);
          g.strokeStyle = keep ? 'rgba(110,231,224,0.75)' : 'rgba(236,231,220,0.28)';
          g.beginPath(); g.moveTo(SX[sel], SY[sel]); g.lineTo(SX[j], SY[j]); g.stroke();
        }
      }
      g.textAlign = 'center'; g.textBaseline = 'bottom';
      const ui = Math.max(0.55, Math.min(1, W / 720));          // smaller screens: smaller dots and words, fewer labels
      for (let q = 0; q < n; q++) {
        const j = order[q], z = SZ[j]; if (z < 1) continue;
        const pz = 52 / z, fog = Math.max(0.16, Math.min(1, 1.45 - z / (dist + 40)));
        const isHot = hot.has(j), isSel = j === sel;
        const r = (1.3 + 2.6 * Math.sqrt(D.counts[j] / maxC)) * pz * ui * (isSel ? 1.8 : isHot ? 1.3 : 1);
        const c = rgb[D.cluster[j] % rgb.length];
        const a = sel >= 0 && !isHot ? fog * 0.55 : fog;
        g.fillStyle = isSel ? '#ffffff' : `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;
        if (isHot) { g.shadowColor = isSel ? '#ffffff' : '#6ee7e0'; g.shadowBlur = isSel ? 18 : 10; }
        g.beginPath(); g.arc(SX[j], SY[j], Math.max(0.9, r), 0, Math.PI * 2); g.fill();
        if (isHot) g.shadowBlur = 0;
        if (isSel || isHot || j === hover || (bigLabel.has(j) && pz * ui > 0.62) || pz * ui > 2.2) {
          const fs = Math.round(Math.max(9, Math.min(20, 11 * pz * ui * (isSel ? 1.35 : 1))));
          g.font = `500 ${fs}px "JetBrains Mono", monospace`;
          g.fillStyle = isSel ? '#ffffff' : isHot ? (endN.includes(j) ? 'rgba(110,231,224,1)' : 'rgba(236,231,220,0.9)') : `rgba(236,231,220,${(fog * 0.75).toFixed(3)})`;
          g.fillText(show(V[j]), SX[j], SY[j] - r - 2);
        }
      }
      // readouts
      const st = stepNow();
      $('gStep').textContent = Math.round(st).toLocaleString('en-US');
      $('gLoss').textContent = lerpAt(D.val.map((v) => v[0]), D.val.map((v) => v[1]), st).toFixed(2);
      const ag = lerpAt(D.agree.map((v) => v.step), D.agree.map((v) => v.nn8), st);
      $('gAgree').textContent = Math.round(ag * 100) + '%'; $('gMeter').style.width = (ag * 100).toFixed(1) + '%';
      if (sel >= 0) {
        $('gNowH').textContent = `${show(V[sel])} keeps company with, at step ${steps[fi].toLocaleString('en-US')}`;
        $('gNow').innerHTML = company.map((j) => `<span class="${endN.includes(j) ? 'keep' : ''}">${esc(show(V[j]))}</span><em>${endN.includes(j) ? 'stays' : ''}</em>`).join('');
        $('gEnd').innerHTML = endN.map((j, q) => `<span class="keep">${esc(show(V[j]))}</span><em>${D.sim[sel][q].toFixed(2)}</em>`).join('');
      }
    }
    function loop(t) {
      if (!document.hidden && isVisible) {
        if (!reduce && Date.now() - lastUser > 3500) { yaw += 0.0022; dirty = true; }
        if (playing) { tv = Math.min(1600, tv + 3.2); $('galT').value = String(tv); dirty = true; if (tv >= 1600) { playing = false; $('galPlay').textContent = 'Train it from step 0'; } }
        if (dirty || moving) { draw(); dirty = false; }
      }
      requestAnimationFrame(loop);
    }
    let isVisible = false, playing = false, moving = true;
    new IntersectionObserver((es) => { isVisible = es[0].isIntersecting; }).observe(wrap);
    // input: drag to turn, click to pick, wheel / pinch to zoom
    const ptrs = new Map(); let downAt = null, moved = 0, pinch0 = 0, dist0 = dist;
    wrap.addEventListener('pointerdown', (e) => { wrap.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]); downAt = [e.clientX, e.clientY]; moved = 0; lastUser = Date.now(); $('galHint').hidden = true;
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); dist0 = dist; } });
    wrap.addEventListener('pointermove', (e) => {
      const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
      if (ptrs.has(e.pointerId)) {
        const p = ptrs.get(e.pointerId), dx = e.clientX - p[0], dy = e.clientY - p[1]; ptrs.set(e.pointerId, [e.clientX, e.clientY]);
        if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch0) { dist = want = Math.max(10, Math.min(130, dist0 * pinch0 / d)); } }
        else { yaw += dx * 0.006; pitch = Math.max(-1.3, Math.min(1.3, pitch + dy * 0.006)); }
        moved += Math.abs(dx) + Math.abs(dy); lastUser = Date.now(); dirty = true; return;
      }
      const h = pick(mx, my, 14); if (h !== hover) { hover = h; dirty = true; }
    });
    const up = (e) => {
      ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch0 = 0;
      if (downAt && moved < 6) { const r = cv.getBoundingClientRect(); const h = pick(e.clientX - r.left, e.clientY - r.top, 18); if (h >= 0) { choose(h); $('galQ').value = show(V[h]); } }
      downAt = null;
    };
    wrap.addEventListener('pointerup', up); wrap.addEventListener('pointercancel', up);
    wrap.addEventListener('wheel', (e) => { e.preventDefault(); dist = want = Math.max(10, Math.min(130, dist * Math.pow(1.0015, e.deltaY))); lastUser = Date.now(); dirty = true; }, { passive: false });
    function pick(x, y, R) { let best = -1, bd = R * R; for (let j = 0; j < n; j++) { if (SZ[j] < 1) continue; const d = (SX[j] - x) ** 2 + (SY[j] - y) ** 2; if (d < bd) { bd = d; best = j; } } return best; }
    // find a piece
    const find = (q) => { if (!q) return -1; q = q.replace(/^·/, ' '); const tries = [' ' + q, q, ' ' + q.toLowerCase(), q.toLowerCase(), ' ' + q[0].toUpperCase() + q.slice(1)]; for (const t of tries) { const i = V.indexOf(t); if (i >= 0) return i; } return -1; };
    $('galQ').addEventListener('input', (e) => { const i = find(e.target.value.trimEnd() || ''); if (i >= 0) choose(i); });
    function choose(i) { sel = i; focus = true; want = Math.min(want, 34); dirty = true; }
    const pres = [' say', ' love', ' king', ' will', ' my', ',', ' death', ' he'];
    $('galPresets').innerHTML = pres.map((p) => `<button class="chip" type="button" data-p="${esc(p)}">${esc(show(p))}</button>`).join('') + '<button class="chip" type="button" data-all="1">whole galaxy</button>';
    $('galPresets').addEventListener('click', (e) => { const b = e.target.closest('.chip'); if (!b) return; if (b.dataset.all) { focus = false; want = 70; dirty = true; return; } choose(V.indexOf(b.dataset.p)); $('galQ').value = show(b.dataset.p); });
    $('galT').addEventListener('input', (e) => { tv = +e.target.value; playing = false; $('galPlay').textContent = 'Train it from step 0'; dirty = true; });
    $('galPlay').addEventListener('click', () => { playing = !playing; if (playing) { if (tv >= 1600) tv = 0; $('galPlay').textContent = 'Pause'; } else $('galPlay').textContent = 'Train it from step 0'; dirty = true; });
    $('galQ').value = '·say';
    requestAnimationFrame(loop);
  }

  // ------------------------------------------------------------ 3. say it backwards (the trained model's surprise, per piece)
  function order() {
    const V = D.vocab; let which = 'hero', dir = 'fwd';
    const row = $('ordRow'), TOP = 14.5, BLIND = Math.log(512);
    function render() {
      const O = D.order[which], ids = dir === 'fwd' ? O.ids : [...O.ids].reverse(), per = dir === 'fwd' ? O.forward_per : O.reversed_per;
      row.innerHTML = ids.map((id, i) => {
        const v = per[i], h = (v / TOP) * 12.5;
        const col = dir === 'fwd' ? (v > BLIND ? '#ff6b57' : '#ffb23f') : (v > BLIND ? '#ff6b57' : '#ffb23f');
        return `<div class="ord-col"><small>${v.toFixed(2)}</small><i style="height:${h.toFixed(2)}rem;background:${col}"></i><b>${esc(show(V[id]))}</b></div>`;
      }).join('') + `<div class="ord-line" style="bottom:calc(${((BLIND / TOP) * 12.5).toFixed(2)}rem + 1.75rem)"><span>blind guess ${BLIND.toFixed(2)}</span></div>`;
      $('ordAvg').textContent = (dir === 'fwd' ? O.forward : O.reversed).toFixed(2);
    }
    const seg = (id, set) => $(id).addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; $(id).querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); set(b.dataset.v); render(); });
    seg('ordWhich', (v) => { which = v; }); seg('ordDir', (v) => { dir = v; });
    render();
  }
})();
