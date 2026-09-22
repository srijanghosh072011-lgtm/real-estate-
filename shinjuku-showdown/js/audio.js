'use strict';
/* Audio: an original procedural score (Web Audio synthesis), sound effects, and voice playback from pre-rendered banks. */
window.AUDIO = (function () {
  let ctx = null, master, musicBus, sfxBus, voiceBus, verb, verbIn, noise;
  const on = { music: true, voice: true, sfx: true };
  const NOTE = n => { const m = /^([A-G])(#|b)?(-?\d)$/.exec(n); const k = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); return 12 * (+m[3] + 1) + k; };
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  const CH = { Dm: ['D3', 'F3', 'A3', 'D4'], Bb: ['Bb2', 'D3', 'F3', 'Bb3'], C: ['C3', 'E3', 'G3', 'C4'], Gm: ['G2', 'Bb2', 'D3', 'G3'], A: ['A2', 'C#3', 'E3', 'A3'], Am: ['A2', 'C3', 'E3', 'A3'], Eb: ['Eb3', 'G3', 'Bb3', 'Eb4'],
    F: ['F2', 'A2', 'C3', 'F3'], Dm9: ['D3', 'F3', 'C4', 'E4'], Bbmaj7: ['Bb2', 'D3', 'F3', 'A3'], Gm7: ['G2', 'Bb2', 'F3', 'D4'], Asus: ['A2', 'D3', 'E3', 'A3'], E: ['E3', 'G#3', 'B3', 'D#4'], Emaj7: ['E3', 'G#3', 'B3', 'D#4'], D: ['D3', 'F#3', 'A3', 'D4'], G: ['G2', 'B2', 'D3', 'G3'], Dsus: ['D3', 'G3', 'A3', 'D4'] };

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 4; comp.connect(ctx.destination);
    master = ctx.createGain(); master.gain.value = .9; master.connect(comp);
    musicBus = ctx.createGain(); musicBus.gain.value = .5; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = .75; sfxBus.connect(master);
    voiceBus = ctx.createGain(); voiceBus.gain.value = 1.15; voiceBus.connect(master);
    verb = ctx.createConvolver(); const len = ctx.sampleRate * 2.8, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    verb.buffer = ir; verbIn = ctx.createGain(); verbIn.gain.value = .5; verbIn.connect(verb); const vo = ctx.createGain(); vo.gain.value = .45; verb.connect(vo); vo.connect(musicBus);
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    setInterval(tick, 25);
    if (want) play(want);
  }

  /* ---------------- instruments ---------------- */
  const env = (g, t, a, peak, d, sus, r, end) => { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.setTargetAtTime(peak * sus, t + a, d); g.gain.setTargetAtTime(0.0001, end, r); };
  function osc(type, f, t, end, dest, det) { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (det) o.detune.value = det; o.connect(dest); o.start(t); o.stop(end + .6); return o; }
  function nz(t, dur, type, f, q, dest, vol) { const s = ctx.createBufferSource(); s.buffer = noise; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; if (q) fl.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur); s.connect(fl); fl.connect(g); g.connect(dest); s.start(t, Math.random()); s.stop(t + dur + .05); return fl; }
  const I = {
    kick(t, v = 1) { const g = ctx.createGain(); g.connect(musicBus); const o = osc('sine', 150, t, t + .35, g); o.frequency.exponentialRampToValueAtTime(42, t + .12); g.gain.setValueAtTime(v * .9, t); g.gain.exponentialRampToValueAtTime(.001, t + .32); },
    taiko(t, v = 1) { const g = ctx.createGain(); g.connect(musicBus); g.connect(verbIn); const o = osc('sine', 118, t, t + .6, g); o.frequency.exponentialRampToValueAtTime(52, t + .35); g.gain.setValueAtTime(v * .85, t); g.gain.exponentialRampToValueAtTime(.001, t + .55); nz(t, .18, 'lowpass', 380, 0, musicBus, v * .5); },
    snare(t, v = 1) { nz(t, .16, 'bandpass', 1900, .8, musicBus, v * .55); const g = ctx.createGain(); g.connect(musicBus); osc('triangle', 196, t, t + .1, g); g.gain.setValueAtTime(v * .25, t); g.gain.exponentialRampToValueAtTime(.001, t + .09); },
    hat(t, v = 1, open) { nz(t, open ? .22 : .045, 'highpass', 7200, 0, musicBus, v * .22); },
    bass(t, m, d, v = 1) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 6; f.frequency.setValueAtTime(1400, t); f.frequency.setTargetAtTime(260, t, .08); const g = ctx.createGain(); f.connect(g); g.connect(musicBus);
      osc('sawtooth', hz(m), t, t + d, f, -7); osc('sawtooth', hz(m), t, t + d, f, 7); osc('square', hz(m - 12), t, t + d, f); env(g, t, .005, .32 * v, .12, .6, .05, t + d * .9); },
    lead(t, m, d, v = 1) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2800; const g = ctx.createGain(); f.connect(g); g.connect(musicBus); g.connect(verbIn);
      const a = osc('sawtooth', hz(m), t, t + d, f, 4), b = osc('square', hz(m), t, t + d, f, -5); const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 5.2; lg.gain.value = 0;
      lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(9, t + Math.min(d, .5)); l.connect(lg); lg.connect(a.detune); lg.connect(b.detune); l.start(t); l.stop(t + d + .6); env(g, t, .02, .12 * v, .3, .7, .08, t + d * .95); },
    pluck(t, m, v = 1) { const f = hz(m), g = ctx.createGain(); g.connect(musicBus); g.connect(verbIn); const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(f * 8, t); fl.frequency.exponentialRampToValueAtTime(f * 1.5, t + .4); fl.connect(g);
      osc('sawtooth', f, t, t + 1.2, fl); osc('triangle', f * 2, t, t + .5, fl); g.gain.setValueAtTime(.16 * v, t); g.gain.exponentialRampToValueAtTime(.001, t + 1.1); },
    pad(t, notes, d, v = 1) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; const g = ctx.createGain(); f.connect(g); g.connect(musicBus); g.connect(verbIn);
      for (const n of notes) { osc('sawtooth', hz(NOTE(n)), t, t + d, f, -9); osc('sawtooth', hz(NOTE(n)), t, t + d, f, 9); } env(g, t, .5, .05 * v, 1, .9, .5, t + d); },
    choir(t, notes, d, v = 1) { const g = ctx.createGain(); g.connect(musicBus); g.connect(verbIn); const src = ctx.createGain();
      for (const [fq, q] of [[730, 9], [1090, 9], [2440, 12]]) { const b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = fq; b.Q.value = q; src.connect(b); b.connect(g); }
      for (const n of notes) { osc('sawtooth', hz(NOTE(n)), t, t + d, src, -6); osc('sawtooth', hz(NOTE(n)), t, t + d, src, 6); } env(g, t, .8, .5 * v, 1, .9, .6, t + d); },
    bell(t, m, v = 1) { const g = ctx.createGain(); g.connect(musicBus); g.connect(verbIn); osc('sine', hz(m), t, t + 2.4, g); const g2 = ctx.createGain(); g2.connect(g); osc('sine', hz(m) * 2.76, t, t + 1, g2);
      g2.gain.setValueAtTime(.4, t); g2.gain.exponentialRampToValueAtTime(.001, t + .8); g.gain.setValueAtTime(.12 * v, t); g.gain.exponentialRampToValueAtTime(.001, t + 2.2); },
    piano(t, m, v = 1) { const g = ctx.createGain(); g.connect(musicBus); g.connect(verbIn); osc('triangle', hz(m), t, t + 2.4, g); osc('sine', hz(m) * 2, t, t + 1.2, g); g.gain.setValueAtTime(.16 * v, t); g.gain.exponentialRampToValueAtTime(.001, t + 2.2); }
  };

  /* ---------------- songs ---------------- */
  const N = s => s.trim().split(/\s+/).map(x => { const [n, l] = x.split(':'); return [n === '.' ? null : NOTE(n), +(l || 1)]; });
  const SONGS = {
    battle: { bpm: 156, chords: ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Gm', 'A', 'Bb', 'C', 'Am', 'Dm', 'Bb', 'C', 'Eb', 'A'],
      lead: ['D5:4 F5:2 E5:2 D5:2 A4:4 C5:2', 'D5:6 E5:2 F5:4 G5:4', 'F5:4 E5:2 D5:2 C5:4 D5:4', 'E5:6 C5:2 G4:8', 'D5:4 F5:2 A5:2 G5:4 F5:2 E5:2', 'F5:2 E5:2 D5:4 A4:8', 'Bb4:4 D5:4 G5:4 F5:2 E5:2', 'E5:4 C#5:4 A4:8',
        'F5:8 G5:4 A5:4', 'G5:8 E5:4 C5:4', 'E5:8 A5:4 G5:2 E5:2', 'D5:16', 'D6:4 C6:4 Bb5:4 A5:4', 'G5:4 A5:4 Bb5:4 C6:4', 'Bb5:8 G5:4 Eb5:4', 'E5:4 F5:2 E5:2 C#5:4 A4:4'],
      drums(b, s, I2, t, int) { if (s % 4 === 0) I.kick(t, .9); if (s === 4 || s === 12) I.snare(t, .8); if (b % 16 === 15 && s >= 8) I.snare(t, .35 + s * .03);
        if (s % 2 === 0 || (b >= 8 && int)) I.hat(t, s % 4 === 2 ? .9 : .5, s === 14); if (s === 0 || s === 10) I.taiko(t, .8); if (int && (s === 3 || s === 7)) I.taiko(t, .5); },
      bass(b, s, chord, t, spb) { if (s % 2) return; const r = NOTE(CH[chord][0]) - 12, pat = [0, 0, 12, 0, 0, 12, 7, 0]; I.bass(t, r + pat[s / 2], spb * 1.8); },
      pluck(b, s, chord, t) { if (b < 8 ? s % 4 === 2 : s % 2 === 0) { const n = CH[chord]; I.pluck(t, NOTE(n[(s >> 1) % 4]) + 12, .7); } },
      pad: 1 },
    title: { bpm: 80, chords: ['Dm9', 'Bbmaj7', 'Gm7', 'Asus', 'Dm9', 'Bbmaj7', 'Gm7', 'A'],
      lead: ['.:8 A4:4 C5:4', 'D5:12 C5:4', 'Bb4:8 A4:4 G4:4', 'A4:16', '.:8 A4:4 D5:4', 'F5:8 E5:4 D5:4', 'D5:8 C5:4 Bb4:4', 'A4:16'], leadInst: 'bell', leadVol: .9,
      drums(b, s, I2, t) { if (s === 0 && b % 2 === 0) I.taiko(t, .6); if (s === 10 && b % 4 === 3) I.taiko(t, .4); },
      pluck(b, s, chord, t) { if (s % 2 === 0) { const n = CH[chord]; I.pluck(t, NOTE(n[[0, 1, 2, 3, 2, 1, 2, 3][s >> 1]]) + 12, .45); } }, pad: 1 },
    tension: { bpm: 96, chords: ['Dm', 'Eb', 'Dm', 'C', 'Dm', 'Eb', 'Bb', 'A'],
      drums(b, s, I2, t) { I.hat(t, s % 4 === 0 ? .5 : .25); if (s === 0) I.taiko(t, .7); if (s === 8 && b % 2) I.taiko(t, .45); },
      bass(b, s, chord, t, spb) { if (s % 2) return; I.bass(t, NOTE(CH[chord][0]) - 12, spb * 1.5, .8); }, pad: 1 },
    void: { bpm: 72, chords: ['Emaj7', 'E', 'Emaj7', 'E'],
      pluck(b, s, chord, t) { const arp = [0, 1, 2, 3, 2, 1, 3, 2]; if (s % 2 === 0) I.bell(t, NOTE(CH[chord][arp[s >> 1]]) + 24, .7); }, pad: 1 },
    shrine: { bpm: 100, chords: ['Dm', 'Dm', 'Eb', 'Dm'],
      drums(b, s, I2, t) { if ([0, 3, 6, 8, 12].includes(s)) I.taiko(t, s === 0 ? 1 : .7); if (s % 4 === 2) I.hat(t, .4); },
      bass(b, s, chord, t, spb) { if (s === 0 || s === 8) I.bass(t, NOTE('D1'), spb * 6, 1); },
      choir: [['D3', 'Ab3', 'D4'], ['D3', 'A3', 'D4'], ['Eb3', 'A3', 'Eb4'], ['D3', 'Ab3', 'D4']] },
    sad: { bpm: 66, chords: ['Dm', 'Bb', 'F', 'C', 'Gm', 'Dm', 'Bb', 'A'],
      lead: ['A4:6 G4:2 F4:4 E4:4', 'D4:8 F4:4 A4:4', 'C5:8 A4:4 F4:4', 'G4:16', 'Bb4:6 A4:2 G4:4 F4:4', 'A4:8 F4:4 D4:4', 'D5:6 C5:2 Bb4:4 A4:4', 'A4:16'], leadInst: 'piano', pad: 1 },
    victory: { bpm: 116, chords: ['D', 'G', 'A', 'D', 'Bb', 'C', 'Dsus', 'D'],
      lead: ['D5:4 F#5:4 A5:8', 'B5:4 A5:4 G5:8', 'A5:4 G5:4 E5:8', 'D5:16', 'D5:4 F5:4 Bb5:8', 'C6:4 Bb5:4 G5:8', 'A5:8 G5:8', 'F#5:16'],
      drums(b, s, I2, t) { if (s % 4 === 0) I.kick(t, .7); if (s === 4 || s === 12) I.snare(t, .5); if (s === 0) I.taiko(t, .8); I.hat(t, .3); }, pad: 1 }
  };
  let want = '', song = null, songName = '', bar = 0, step = 0, nextT = 0, intensity = 0, leadQ = [];
  function play(name) { want = name; if (!ctx || name === songName) return; songName = name; song = SONGS[name] || null; bar = 0; step = 0; nextT = ctx.currentTime + .08;
    if (musicBus) { musicBus.gain.cancelScheduledValues(ctx.currentTime); musicBus.gain.setValueAtTime(0, ctx.currentTime); musicBus.gain.linearRampToValueAtTime(on.music ? .5 : 0, ctx.currentTime + 1.2); } }
  function tick() {
    if (!song || !ctx) return; const spb = 60 / song.bpm / 4;
    while (nextT < ctx.currentTime + .12) {
      const t = nextT, chord = song.chords[bar % song.chords.length];
      if (on.music) {
        if (step === 0) {
          if (song.pad) I.pad(t, CH[chord], spb * 16, song === SONGS.void ? 1.4 : 1);
          if (song.choir) I.choir(t, song.choir[bar % song.choir.length], spb * 16, 1);
          if (song.lead) { let s = 0; for (const [m, l] of N(song.lead[bar % song.lead.length])) { if (m != null) (I[song.leadInst || 'lead'])(t + s * spb, m, l * spb * .95, song.leadVol || 1); s += l; } }
        }
        if (song.drums) song.drums(bar, step, I, t, intensity);
        if (song.bass) song.bass(bar, step, chord, t, spb);
        if (song.pluck) song.pluck(bar, step, chord, t);
      }
      nextT += spb; if (++step >= 16) { step = 0; bar++; }
    }
  }

  /* ---------------- sfx ---------------- */
  function sfx(k, vol = 1) {
    if (!ctx || !on.sfx) return; const t = ctx.currentTime, out = ctx.createGain(); out.gain.value = vol; out.connect(sfxBus);
    const tone = (f0, f1, d, type, v) => { const g = ctx.createGain(); g.connect(out); const o = osc(type, f0, t, t + d, g); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + d); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); };
    ({ hit: () => { nz(t, .09, 'lowpass', 2000, 0, out, .5); tone(180, 60, .08, 'sine', .4); },
      heavy: () => { nz(t, .3, 'lowpass', 800, 0, out, .7); tone(110, 35, .3, 'sine', .6); },
      slash: () => { const f = nz(t, .18, 'bandpass', 5000, 2, out, .5); f.frequency.exponentialRampToValueAtTime(1800, t + .16); },
      beam: () => { tone(70, 900, .7, 'sawtooth', .12); nz(t, .8, 'bandpass', 900, .6, out, .5); },
      charge: () => tone(180, 900, .6, 'triangle', .1),
      bf: () => { nz(t, .4, 'lowpass', 600, 0, out, .9); tone(58, 28, .45, 'square', .3); tone(2400, 300, .2, 'sawtooth', .08); },
      expand: () => { tone(80, 30, 1.8, 'sawtooth', .18); nz(t, 1.6, 'lowpass', 300, 0, out, .6); tone(440, 438, 1.6, 'sine', .06); },
      ui: () => tone(660, 880, .06, 'square', .05), zap: () => { tone(1500, 260, .14, 'square', .08); nz(t, .12, 'highpass', 4000, 0, out, .3); },
      clap: () => { nz(t, .07, 'bandpass', 2400, 1.2, out, .8); tone(900, 400, .08, 'triangle', .1); },
      crash: () => { nz(t, 1.6, 'lowpass', 260, 0, out, .9); tone(60, 24, 1.4, 'sine', .45); nz(t + .1, .6, 'bandpass', 1200, .8, out, .25); },
      whoosh: () => { const f = nz(t, .3, 'bandpass', 600, 1.5, out, .35); f.frequency.exponentialRampToValueAtTime(3200, t + .25); },
      infinity: () => tone(1800, 1760, .25, 'sine', .07),
      wheel: () => { tone(620, 600, .5, 'square', .06); tone(930, 900, .6, 'triangle', .08); nz(t, .1, 'highpass', 3000, 0, out, .25); },
      ko: () => { tone(220, 40, 1.3, 'sawtooth', .14); nz(t, 1.2, 'lowpass', 400, 0, out, .5); },
      boom: () => { nz(t, 1.1, 'lowpass', 500, 0, out, 1); tone(90, 25, 1, 'sine', .7); } }[k] || (() => { }))();
  }

  /* ---------------- voice ---------------- */
  const banks = {}; let cur = null;
  function bank(name) { const V = window.VOICE; if (!ctx || !V || !V.banks[name]) return Promise.resolve(null);
    return banks[name] || (banks[name] = fetch(V.banks[name]).then(r => { if (!r.ok) throw 0; return r.arrayBuffer(); }).then(b => new Promise((ok, no) => ctx.decodeAudioData(b, ok, no))).catch(() => null)); }
  function preload(list) { list.forEach(bank); }
  // plays a line; resolves with its duration in seconds (0 when voice is off or missing)
  async function say(id, opts = {}) {
    const V = window.VOICE; if (!ctx || !on.voice || !V || !V.clips[id]) return 0;
    const [bk, start, dur] = V.clips[id], buf = await bank(bk); if (!buf) return 0;
    if (opts.cut !== false && cur) { try { cur.stop(); } catch (e) { } }
    const s = ctx.createBufferSource(); s.buffer = buf; const g = ctx.createGain(); g.gain.value = opts.vol || 1; s.connect(g); g.connect(voiceBus); s.start(0, start, dur + .05); cur = s;
    if (musicBus && on.music) { const t = ctx.currentTime; musicBus.gain.cancelScheduledValues(t); musicBus.gain.setTargetAtTime(.2, t, .08); musicBus.gain.setTargetAtTime(.5, t + dur, .4); }
    return dur;
  }
  function stopVoice() { if (cur) { try { cur.stop(); } catch (e) { } cur = null; } }
  function set(k, v) { on[k] = v; if (!ctx) return; if (k === 'music') musicBus.gain.setTargetAtTime(v ? .5 : 0, ctx.currentTime, .1); if (k === 'voice' && !v) stopVoice(); }
  return { init, play, sfx, say, preload, stopVoice, set, on, get ready() { return !!ctx; }, setIntensity(v) { intensity = v; }, get song() { return songName; } };
})();
