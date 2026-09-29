// How AI Works · the music-video player, on every chapter page.
// Replaces the browser's built-in controls with our own bar INSIDE the video (like YouTube / Netflix):
//   play · next chapter (hover to preview it) · volume · time ······ autoplay switch · loop · fullscreen
// Near the end, a small corner card previews the next chapter; when the song ends it counts down and moves on
// (Cancel / Play now). With loop on, the song just repeats. Settings are remembered on this device.
// Without JavaScript the page keeps the browser's normal controls. Reads the chapter list from series.js.
(() => {
  'use strict';
  const video = document.getElementById('mv'), box = video && video.closest('.player');
  if (!video || !box || !window.SERIES) return;

  const all = [];
  window.SERIES.seasons.forEach((s) => s.chapters.forEach((c) => all.push({ ...c, season: s.n })));
  const here = all.findIndex((c) => c.url && location.pathname.startsWith(c.url));
  if (here < 0) return;
  const me = all[here];
  const next = all.slice(here + 1).find((c) => c.status === 'live' && c.url) || null;
  const first = all.find((c) => c.status === 'live' && c.url);
  const target = next || (first !== me ? first : null);           // after the last chapter: the season from the top

  const store = { get(k, d) { try { const v = localStorage.getItem('haiw.' + k); return v === null ? d : v === '1'; } catch { return d; } },
    set(k, v) { try { localStorage.setItem('haiw.' + k, v ? '1' : '0'); } catch { /* private mode: lasts this visit */ } } };
  let autoNext = store.get('autonext', true), loop = store.get('loop', false);
  video.loop = loop;
  video.controls = false;

  const I = {
    play: '<path d="M7 4.5v15l12-7.5z"/>', pause: '<path d="M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z"/>',
    next: '<path d="M5 5v14l10-7zM16.5 5h2.5v14h-2.5z"/>',
    vol: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15 9a4 4 0 0 1 0 6M17.5 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    mute: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9.5l5 5M20.5 9.5l-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    loop: '<path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/><path d="M13 15V9h-1l-2 1v1h1.5v4z"/>',
    fs: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
    fsx: '<path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
  };
  const svg = (p) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">${p}</svg>`;
  const mmss = (s) => (isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00');

  const css = document.createElement('style');
  css.textContent = `
  .player.pl { cursor: default; }
  .player.pl.idle { cursor: none; }
  .pl-ui { position: absolute; inset: auto 0 0 0; padding: 2.6rem 0.9rem 0.55rem; background: linear-gradient(transparent, rgba(5,6,7,0.88)); transition: opacity .25s; z-index: 3; color: #ece7dc; font: 500 0.8rem/1 "JetBrains Mono", monospace; }
  .player.pl.idle .pl-ui { opacity: 0; pointer-events: none; }
  .pl-seek { position: relative; height: 16px; cursor: pointer; touch-action: none; }
  .pl-seek i { position: absolute; left: 0; right: 0; top: 7px; height: 3px; border-radius: 3px; background: rgba(255,255,255,0.2); transition: height .12s, top .12s; }
  .pl-seek b { position: absolute; left: 0; top: 7px; height: 3px; border-radius: 3px; background: #ffb23f; transition: height .12s, top .12s; }
  .pl-seek u { position: absolute; top: 3px; width: 11px; height: 11px; margin-left: -5.5px; border-radius: 50%; background: #ffb23f; transform: scale(0); transition: transform .12s; }
  .pl-seek:hover i, .pl-seek:hover b { top: 6px; height: 5px; } .pl-seek:hover u { transform: scale(1); }
  .pl-row { display: flex; align-items: center; gap: 0.2rem; margin-top: 0.1rem; }
  .pl-b { position: relative; display: grid; place-items: center; width: 2.4rem; height: 2.4rem; border: 0; border-radius: 8px; background: none; color: #ece7dc; cursor: pointer; opacity: 0.9; }
  .pl-b:hover, .pl-b:focus-visible { opacity: 1; background: rgba(255,255,255,0.08); outline: none; }
  .pl-b.on { color: #ffb23f; }
  .pl-b.on::after { content: ""; position: absolute; bottom: 5px; width: 4px; height: 4px; border-radius: 50%; background: #ffb23f; }
  .pl-vol { width: 0; opacity: 0; transition: width .2s, opacity .2s; accent-color: #ffb23f; }
  .pl-volw:hover .pl-vol, .pl-vol:focus { width: 4.5rem; opacity: 1; }
  .pl-volw { display: flex; align-items: center; }
  .pl-time { margin-left: 0.5rem; color: #9b9da1; white-space: nowrap; }
  .pl-sp { flex: 1; }
  .pl-auto { display: inline-flex; align-items: center; gap: 0.45rem; height: 2.4rem; padding: 0 0.55rem; border: 0; border-radius: 8px; background: none; color: #9b9da1; cursor: pointer; font: inherit; }
  .pl-auto:hover, .pl-auto:focus-visible { background: rgba(255,255,255,0.08); color: #ece7dc; outline: none; }
  .pl-auto i { position: relative; width: 2.1rem; height: 0.9rem; border-radius: 999px; background: rgba(255,255,255,0.25); }
  .pl-auto i::after { content: ""; position: absolute; top: -0.2rem; left: -0.1rem; width: 1.3rem; height: 1.3rem; border-radius: 50%; background: #d5d5d5; display: grid; transition: transform .2s, background .2s; box-shadow: 0 1px 3px rgba(0,0,0,.4); }
  .pl-auto[aria-pressed="true"] { color: #ece7dc; } .pl-auto[aria-pressed="true"] i { background: rgba(255,178,63,0.45); }
  .pl-auto[aria-pressed="true"] i::after { transform: translateX(1rem); background: #ffb23f; }
  .pl-tip { position: absolute; bottom: 3.1rem; left: 50%; transform: translate(-50%, 6px); opacity: 0; pointer-events: none; transition: opacity .15s, transform .15s; white-space: nowrap; padding: 0.4rem 0.55rem; border-radius: 6px; background: rgba(8,9,11,0.92); color: #ece7dc; font: 500 0.72rem/1.2 "JetBrains Mono", monospace; }
  .pl-b:hover .pl-tip, .pl-auto:hover .pl-tip, .pl-b:focus-visible .pl-tip { opacity: 1; transform: translate(-50%, 0); }
  .pl-prev { position: absolute; bottom: 3.1rem; left: 0; width: 15rem; padding: 0.45rem; border-radius: 10px; background: rgba(8,9,11,0.94); border: 1px solid rgba(255,255,255,0.14); opacity: 0; transform: translateY(6px); pointer-events: none; transition: opacity .18s, transform .18s; text-align: left; }
  .pl-b:hover .pl-prev, .pl-b:focus-visible .pl-prev { opacity: 1; transform: none; }
  .pl-prev img { display: block; width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: 6px; }
  .pl-prev small { display: block; margin: 0.5rem 0.2rem 0.25rem; color: #ffb23f; font-size: 0.64rem; letter-spacing: .12em; text-transform: uppercase; }
  .pl-prev b { display: block; margin: 0 0.2rem 0.2rem; font: 600 0.92rem/1.25 "Space Grotesk", sans-serif; color: #ece7dc; white-space: normal; }
  .pl-big { position: absolute; left: 50%; top: 50%; width: 4.6rem; height: 4.6rem; margin: -2.3rem 0 0 -2.3rem; border-radius: 50%; border: 0; background: rgba(8,9,11,0.6); color: #ffb23f; display: grid; place-items: center; cursor: pointer; z-index: 2; backdrop-filter: blur(4px); transition: transform .15s; }
  .pl-big:hover { transform: scale(1.06); }
  .pl-big svg { width: 34px; height: 34px; margin-left: 4px; }
  .player.pl.playing .pl-big { display: none; }
  .pl-up { position: absolute; right: 1rem; bottom: 5.2rem; z-index: 4; width: 17rem; padding: 0.55rem; border-radius: 12px; background: rgba(8,9,11,0.9); border: 1px solid rgba(255,255,255,0.14); color: #ece7dc; backdrop-filter: blur(6px); opacity: 0; transform: translateY(8px); pointer-events: none; transition: opacity .3s, transform .3s; }
  .pl-up.on { opacity: 1; transform: none; pointer-events: auto; }
  .pl-up .th { position: relative; display: block; border-radius: 7px; overflow: hidden; }
  .pl-up img { display: block; width: 100%; aspect-ratio: 16/9; object-fit: cover; }
  .pl-up .bar { position: absolute; left: 0; bottom: 0; height: 3px; background: #ffb23f; width: 0; }
  .pl-up small { display: block; margin: 0.5rem 0.15rem 0.2rem; color: #ffb23f; font: 500 0.64rem/1.2 "JetBrains Mono", monospace; letter-spacing: .12em; text-transform: uppercase; }
  .pl-up b { display: block; margin: 0 0.15rem; font: 600 0.95rem/1.25 "Space Grotesk", sans-serif; }
  .pl-up .act { display: flex; gap: 0.4rem; margin-top: 0.55rem; }
  .pl-up .act button { flex: 1; padding: 0.5rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.18); background: rgba(255,255,255,0.06); color: #ece7dc; font: 600 0.8rem/1 "Space Grotesk", sans-serif; cursor: pointer; }
  .pl-up .act .go { background: #ffb23f; border-color: #ffb23f; color: #0a0d10; }
  .player.pl:fullscreen { border-radius: 0; border: 0; }
  @media (max-width: 640px) { .pl-vol, .pl-prev, .pl-tip, .pl-auto span { display: none; } .pl-ui { padding: 1.8rem 0.4rem 0.3rem; } .pl-b { width: 2.1rem; height: 2.1rem; } .pl-up { width: 12rem; right: 0.5rem; bottom: 3.8rem; } .pl-up img { display: none; } }`;
  document.head.append(css);

  // ---------------------------------------------------------------- build the bar
  box.classList.add('pl');
  const ui = document.createElement('div'); ui.className = 'pl-ui';
  const chLabel = (c) => (c.season !== me.season ? `Season ${c.season} · Chapter ${c.n}` : `Chapter ${c.n}`);
  const nextLabel = next ? `Next · ${chLabel(next)}` : target ? `From the start · ${chLabel(target)}` : '';
  ui.innerHTML = `
    <div class="pl-seek" role="slider" aria-label="Seek" tabindex="0" aria-valuemin="0" aria-valuemax="100"><i></i><b></b><u></u></div>
    <div class="pl-row">
      <button class="pl-b" data-k="play" type="button" aria-label="Play">${svg(I.play)}<span class="pl-tip">Play (k)</span></button>
      ${target ? `<button class="pl-b" data-k="next" type="button" aria-label="${nextLabel}">${svg(I.next)}
        <span class="pl-prev">${target.thumb ? `<img src="${target.thumb}" alt="">` : ''}<small>${nextLabel}</small><b>${target.title}</b></span></button>` : ''}
      <span class="pl-volw"><button class="pl-b" data-k="mute" type="button" aria-label="Mute">${svg(I.vol)}<span class="pl-tip">Mute (m)</span></button>
        <input class="pl-vol" type="range" min="0" max="1" step="0.05" value="1" aria-label="Volume"></span>
      <span class="pl-time">0:00 / 0:00</span>
      <span class="pl-sp"></span>
      ${target ? `<button class="pl-auto" data-k="auto" type="button" aria-pressed="${autoNext}" aria-label="Autoplay next chapter"><i></i><span>Autoplay</span><span class="pl-tip">Autoplay is ${autoNext ? 'on' : 'off'}</span></button>` : ''}
      <button class="pl-b${loop ? ' on' : ''}" data-k="loop" type="button" aria-pressed="${loop}" aria-label="Loop this song">${svg(I.loop)}<span class="pl-tip">Loop this song</span></button>
      <button class="pl-b" data-k="fs" type="button" aria-label="Full screen">${svg(I.fs)}<span class="pl-tip">Full screen (f)</span></button>
    </div>`;
  box.append(ui);
  const big = document.createElement('button'); big.type = 'button'; big.className = 'pl-big'; big.setAttribute('aria-label', 'Play'); big.innerHTML = svg(I.play);
  box.append(big);
  const up = document.createElement('div'); up.className = 'pl-up'; up.setAttribute('role', 'status');
  if (target) up.innerHTML = `<a class="th" href="${target.url}?autoplay=1#video">${target.thumb ? `<img src="${target.thumb}" alt="">` : ''}<span class="bar"></span></a>
    <small>${next ? `Up next · ${chLabel(next)}` : 'Play the series again'}</small><b>${target.title}</b>
    <div class="act"><button type="button" data-c>Cancel</button><button type="button" class="go" data-g>Play now</button></div>`;
  box.append(up);
  const $ = (k) => ui.querySelector(`[data-k="${k}"]`);
  const seek = ui.querySelector('.pl-seek'), fill = seek.querySelector('b'), knob = seek.querySelector('u'), time = ui.querySelector('.pl-time'), vol = ui.querySelector('.pl-vol');

  // ---------------------------------------------------------------- behaviour
  // The SONG plays from a separate audio track (media/song.m4a, cut from this video) and the picture follows it.
  // Phones pause <video> when the screen locks or the browser goes to the background, but keep <audio> playing,
  // so the music carries on; when you come back the picture catches up. No song file: the video plays its own sound.
  const song = new Audio(); song.preload = 'metadata'; song.src = 'media/song.m4a'; song.loop = loop;
  let hasSong = true, internal = false, bg = null;              // bg: the chapter the song moved on to while hidden
  const M = () => (hasSong ? song : video);                      // the clock and the sound
  video.muted = true;
  song.addEventListener('error', () => { if (bg) return; hasSong = false; video.muted = false; setPlay(); });
  const dur = () => video.duration || (hasSong ? song.duration : 0) || 0;
  const now = () => M().currentTime;
  const setT = (t) => { t = Math.max(0, Math.min(dur() || t, t)); video.currentTime = t; if (hasSong) song.currentTime = t; paint(); };
  function play() {
    if (!hasSong) return video.play();
    if (Math.abs(song.currentTime - video.currentTime) > 0.25) song.currentTime = video.currentTime;
    const p = song.play(); video.play().catch(() => {});
    return p;
  }
  function pause() { internal = true; song.pause(); video.pause(); internal = false; }
  const toggle = () => (M().paused || M().ended ? play().catch(() => {}) : pause());
  const go = (c, t) => { location.href = c.url + '?autoplay=1' + (t ? '&t=' + t.toFixed(1) : '') + '#video'; };
  $('play').addEventListener('click', toggle);
  big.addEventListener('click', toggle);
  video.addEventListener('click', toggle);
  video.addEventListener('dblclick', () => $('fs').click());
  $('next')?.addEventListener('click', () => go(target));
  const snd = () => (hasSong ? song : video);
  $('mute').addEventListener('click', () => { snd().muted = !snd().muted; showVol(); });
  vol.addEventListener('input', () => { snd().volume = +vol.value; snd().muted = +vol.value === 0; showVol(); });
  const showVol = () => { const a = snd(); $('mute').firstElementChild.outerHTML = svg(a.muted || a.volume === 0 ? I.mute : I.vol); vol.value = a.muted ? 0 : a.volume; };
  $('auto')?.addEventListener('click', (e) => { autoNext = !autoNext; store.set('autonext', autoNext); const b = e.currentTarget; b.setAttribute('aria-pressed', String(autoNext)); b.querySelector('.pl-tip').textContent = `Autoplay is ${autoNext ? 'on' : 'off'}`; if (!autoNext) hideUp(); });
  $('loop').addEventListener('click', (e) => { loop = !loop; video.loop = loop; song.loop = loop; store.set('loop', loop); const b = e.currentTarget; b.classList.toggle('on', loop); b.setAttribute('aria-pressed', String(loop)); b.querySelector('.pl-tip').textContent = loop ? 'Looping this song' : 'Loop this song'; if (loop) hideUp(); });
  $('fs').addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else if (box.requestFullscreen) box.requestFullscreen(); else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen(); });
  document.addEventListener('fullscreenchange', () => { $('fs').firstElementChild.outerHTML = svg(document.fullscreenElement ? I.fsx : I.fs); });
  const setPlay = () => { const p = !M().paused && !M().ended; box.classList.toggle('playing', p); $('play').firstElementChild.outerHTML = svg(p ? I.pause : I.play); $('play').setAttribute('aria-label', p ? 'Pause' : 'Play'); if ('mediaSession' in navigator) navigator.mediaSession.playbackState = p ? 'playing' : 'paused'; };
  for (const el of [song, video]) {
    el.addEventListener('play', () => { if (el !== M()) return; setPlay(); hideUp(); poke(); session(); });
    el.addEventListener('pause', () => { if (el !== M()) return; setPlay(); box.classList.remove('idle'); });
  }
  // something else paused the video while the page is visible (e.g. the narration player): pause the song too
  video.addEventListener('pause', () => { if (hasSong && !internal && !document.hidden && !video.ended && !song.paused) pause(); });
  const paint = () => {
    const d = dur(), t = now(), k = d ? t / d : 0;
    fill.style.width = k * 100 + '%'; knob.style.left = k * 100 + '%'; time.textContent = `${mmss(t)} / ${mmss(d)}`;
    seek.setAttribute('aria-valuenow', String(Math.round(k * 100)));
    const left = d - t;                                                            // the corner card, last 12 seconds
    if (target && next && autoNext && !loop && d && left < 12 && left > 0.3 && !M().paused) showUp(false);
    if (hasSong && !document.hidden && !song.paused && !bg) {                      // keep the picture on the music
      if (video.paused && !video.ended) { video.currentTime = song.currentTime; video.play().catch(() => {}); }
      else if (Math.abs(video.currentTime - song.currentTime) > 0.3) video.currentTime = song.currentTime;
    }
  };
  song.addEventListener('timeupdate', paint); video.addEventListener('timeupdate', () => { if (!hasSong) paint(); });
  video.addEventListener('loadedmetadata', paint);
  const seekTo = (e) => { const r = seek.getBoundingClientRect(); const k = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); if (dur()) setT(k * dur()); };
  seek.addEventListener('pointerdown', (e) => { seek.setPointerCapture(e.pointerId); seekTo(e); const mv = (ev) => seekTo(ev); seek.addEventListener('pointermove', mv); seek.addEventListener('pointerup', () => seek.removeEventListener('pointermove', mv), { once: true }); });
  seek.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') setT(now() + 5); if (e.key === 'ArrowLeft') setT(now() - 5); });
  box.tabIndex = -1;
  box.addEventListener('keydown', (e) => {
    if (e.target.closest('input')) return;
    const k = e.key.toLowerCase();
    if (k === ' ' || k === 'k') { e.preventDefault(); toggle(); } else if (k === 'f') $('fs').click(); else if (k === 'm') $('mute').click();
    else if (k === 'arrowright') setT(now() + 5); else if (k === 'arrowleft') setT(now() - 5); else if (k === 'escape') cancelUp();
    poke();
  });

  // ---------------------------------------------------------------- lock screen / background
  function session(ch = me) {
    if (!('mediaSession' in navigator)) return;
    const base = ch.url;
    navigator.mediaSession.metadata = new MediaMetadata({ title: ch.song || ch.title, artist: `How AI Works · Season ${ch.season}, Chapter ${ch.n}`, album: ch.title,
      artwork: [{ src: base + 'media/poster.jpg', sizes: '1280x720', type: 'image/jpeg' }] });
    const h = (a, f) => { try { navigator.mediaSession.setActionHandler(a, f); } catch { /* unsupported action */ } };
    h('play', () => play().catch(() => {})); h('pause', pause);
    h('seekto', (d) => setT(d.seekTime)); h('seekbackward', () => setT(now() - 10)); h('seekforward', () => setT(now() + 10));
    h('previoustrack', () => setT(0));
    const nx = chainNext();
    h('nexttrack', nx ? () => (document.hidden ? switchTo(nx) : go(nx)) : null);
  }
  const chainNext = () => { const at = bg || me; const i = all.indexOf(at); return all.slice(i + 1).find((c) => c.status === 'live' && c.url) || null; };
  function switchTo(ch) {                                     // hidden: carry the music on into the next chapter
    bg = ch; song.src = ch.url + 'media/song.m4a'; song.currentTime = 0;
    song.play().catch(() => {}); session(ch);
  }
  setInterval(() => { if ('mediaSession' in navigator && navigator.mediaSession.setPositionState && hasSong && song.duration) { try { navigator.mediaSession.setPositionState({ duration: song.duration, position: Math.min(song.currentTime, song.duration), playbackRate: 1 }); } catch { /* ignore */ } } }, 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (bg) { go(bg, song.currentTime); return; }             // the song moved on while you were away: follow it
    if (hasSong && !song.paused) { video.currentTime = song.currentTime; video.play().catch(() => {}); }
  });
  // hide the bar while playing and the mouse is still
  let idleT = 0;
  function poke() { box.classList.remove('idle'); clearTimeout(idleT); idleT = setTimeout(() => { if (!M().paused && !ui.matches(':hover')) box.classList.add('idle'); }, 2600); }
  box.addEventListener('pointermove', poke); box.addEventListener('pointerdown', poke);

  // ---------------------------------------------------------------- up next: corner card + countdown at the end
  const WAIT = 8;
  let raf = 0, counting = false;
  const bar = up.querySelector('.bar');
  function showUp(count) {
    up.classList.add('on');
    if (!count || counting) return;
    counting = true; const t0 = performance.now();
    const tick = (now) => { const k = Math.min(1, (now - t0) / (WAIT * 1000)); if (bar) bar.style.width = k * 100 + '%'; up.querySelector('.go').textContent = `Play now · ${Math.ceil(WAIT * (1 - k))}`; if (k >= 1) { go(target); return; } raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
  }
  function cancelUp() { cancelAnimationFrame(raf); counting = false; if (bar) bar.style.width = '0'; const g = up.querySelector('.go'); if (g) g.textContent = 'Play now'; }
  function hideUp() { cancelUp(); up.classList.remove('on'); }
  up.querySelector('[data-c]')?.addEventListener('click', hideUp);
  up.querySelector('[data-g]')?.addEventListener('click', () => go(target));
  const onEnd = () => {
    if (loop) return;
    if (document.hidden && hasSong && autoNext) { const nx = chainNext(); if (nx) { switchTo(nx); return; } }
    setPlay(); box.classList.remove('idle');
    if (!target || bg) return;
    showUp(autoNext && !!next);                    // autoplay off (or end of the season): the card stays, no countdown
  };
  song.addEventListener('ended', () => { if (hasSong) onEnd(); });
  video.addEventListener('ended', () => { if (!hasSong) onEnd(); });
  video.addEventListener('seeking', () => { if (dur() && dur() - video.currentTime > 12) hideUp(); });

  // ---------------------------------------------------------------- arriving with ?autoplay=1
  if (new URLSearchParams(location.search).has('autoplay')) {
    const t = parseFloat(new URLSearchParams(location.search).get('t') || '0') || 0;
    history.replaceState(null, '', location.pathname + location.hash);
    box.scrollIntoView({ block: 'center' });
    const start = () => { if (t) setT(t); play().catch(() => { /* the browser wants a tap first: the big play button is showing */ }); };
    if (video.readyState >= 1) start(); else { video.addEventListener('loadedmetadata', start, { once: true }); video.preload = 'auto'; video.load(); }
  }
  setPlay();
})();
