'use strict';
/* Yuji: Story — the open-world mode. Zones you roam freely (Sendai, Tokyo Jujutsu High), a main quest that follows the
   manga, a few short side quests, curses to fight, talking, jumping and wall-running. Progress saves in the browser. */
window.OW = (function () {
  const { G, RO, Fighter } = GAME, V3 = THREE.Vector3, $ = q => document.querySelector(q), rand = (a, b) => a + Math.random() * (b - a);
  const LN = window.LINES_OW.y1, NONE = { mv: new V3(), my: 0 };

  /* ---------------- cast ---------------- */
  RO.yujiow = Object.assign({}, RO.yuji, { spr: 'yuji', title: 'First-Year', hp: 900, bf: 0, jumper: 1, moves: {} });
  RO.sukunay = { name: 'Ryomen Sukuna', jp: '両面宿儺', title: "In Yuji's Body", spr: 'sukunay', bark: 'sukuna', hp: 1500, spd: 12.5, range: 5, aura: '#ff2e4d', jumper: 1, regen: 6, bf: .1,
    moves: { k: RO.sukuna.moves.k, l: RO.sukuna.moves.l } };
  RO.megumi = { name: 'Megumi Fushiguro', jp: '伏黒恵', title: 'Ten Shadows', hp: 900, spd: 10.5, range: 6, aura: '#8a9aff', jumper: 1,
    moves: { k: { n: 'Divine Dogs', kind: 'blast', cost: 14, cd: 2.6, dmg: 45, r: 2.6, delay: .4, range: 12, launch: 14, col: '#c8d0ff' },
      l: { n: 'Nue', kind: 'proj', cost: 16, cd: 3.2, dmg: 40, spd: 24, hom: 1.5, tex: 'bolt', col: '#ffe070', stun: .3 } } };
  RO.gojoow = Object.assign({}, RO.gojo0, { spr: 'gojo0', bark: 'gojo0', hp: 5000, moves: { k: RO.gojo.moves.k, l: RO.gojo.moves.l } });
  const claw = dmg => ({ n: 'Claw', kind: 'strike', cost: 0, cd: 1.5, dmg, range: 3, col: '#c8c0a0' });
  RO.curse1 = { name: 'Cursed Spirit', jp: '呪霊', title: 'Grade 4', hp: 140, spd: 8, range: 2, aura: '#6a8048', scale: .9, moves: { k: claw(24) } };
  RO.curse2 = { name: 'Cursed Spirit', jp: '呪霊', title: 'Grade 3', hp: 260, spd: 8.5, range: 4, aura: '#80486a', scale: 1.15,
    moves: { k: claw(32), l: { n: 'Spit', kind: 'proj', cost: 0, cd: 3, dmg: 22, spd: 16, hom: 1, tex: 'curse', col: '#80486a' } } };
  RO.cboss = Object.assign({}, RO.curse2, { spr: 'curse2', title: 'Drawn by the Finger', hp: 800, scale: 2.1, range: 5, jumper: 1, moves: { k: claw(55), l: RO.curse2.moves.l } });

  /* ---------------- save ---------------- */
  const S = { step: 0, side: {}, bonusHp: 0, spd: 1, k: 0 };
  const load = () => { try { return JSON.parse(localStorage.getItem('ss-yuji') || 'null'); } catch (e) { return null; } };
  const save = () => { try { localStorage.setItem('ss-yuji', JSON.stringify(S)); } catch (e) { } };

  /* ---------------- zones ---------------- */
  const ZONES = {
    sendai: { map: 'sendai', time: 'night', song: 'tension', start: [4880, 0, -130], yaw: Math.PI, name: 'Sendai',
      npcs: [['megumi', [5010, 0, 47], 'megumi', "Go home. Gojo-sensei is waiting for you in Tokyo."]], roam: [[4800, 120], [5150, -150], [5200, 180], [4760, -40]] },
    jjh: { map: 'jjh', time: 'afternoon', song: 'title', start: [2500, 0, 150], yaw: 0, name: 'Tokyo Jujutsu High',
      npcs: [['gojoow', [2505, 0, -19], 'gojo', 'Go get them, Yuji.'], ['megumi', [2470, 0, 30], 'megumi', 'Train harder.']], roam: [] } };
  let ents = [], zone = null, busy = false, qT = 0, T = 0, yaw = 0, pitch = .3, drag = null, track = null, spar = null, beam = null, lastHp = 0, calm = 0;

  function spawn(key, at, tag, o = {}) { const f = new Fighter(key, at, false); Object.assign(f, { hostile: true, tag }, o); f.opp = G.p1; ents.push(f); return f; }
  function enterZone(z, at) {
    const Z = ZONES[z]; zone = z; S.map = z; GAME.clearArena(); ents = []; track = spar = null;
    WORLD.setMap(Z.map); WORLD.reset(); WORLD.setTime(Z.time); SPR.release(['yuji', 'sukunay', 'megumi', 'gojo0', 'curse1', 'curse2']);
    const P = G.p1 = new Fighter(S.form || 'yujiow', at || Z.start, true); applyStats(P);
    for (const [k, p, talk, idle] of Z.npcs) spawn(k, p, 'npc', { hostile: false, npc: talk, idle });
    if (S.step >= 7) for (const [x, zz] of Z.roam) spawn(Math.random() < .6 ? 'curse1' : 'curse2', [x, 0, zz], 'roam');
    yaw = Z.yaw; pick(); G.camSnap = true; G.mode = 'ow'; GAME.show(null); GAME.fillHud(); AUDIO.play(Z.song); AUDIO.preload(['y1', 'barks']);
    GAME.banner('', Z.name, '', 1600);
  }
  function applyStats(P) { P.d = Object.assign({}, RO[P.k], { spd: RO[P.k].spd * (P.k === 'yujiow' ? S.spd : 1) }); if (P.k === 'yujiow') { P.maxhp = P.hp = P.trail = RO.yujiow.hp + S.bonusHp; if (S.k) P.mv.k = RO.yuji.moves.k; } }
  function become(key) { const o = G.p1; S.form = key === 'yujiow' ? null : key; const P = G.p1 = new Fighter(key, [o.pos.x, o.pos.y, o.pos.z], true); o.remove(); applyStats(P); pick(); GAME.fillHud(); GAME.flash(key === 'sukunay' ? '#ff2040' : '#fff', .7); }
  // the nearest hostile becomes the fight target (G.p2); everyone else is drawn as an extra
  function pick() { const P = G.p1; let best = null, bd = 1e9;
    for (const f of ents) { const d = f.pos.distanceTo(P.pos) - (f.hostile && !f.dead ? 25 : 0); if (d < bd) { bd = d; best = f; } }
    G.p2 = best || P; G.extra = ents.filter(f => f !== best); P.opp = G.p2; for (const f of ents) f.opp = P; }
  const alive = tag => ents.some(f => f.tag === tag && !f.dead);

  /* ---------------- main quest (Slice 1: Sendai prologue → Tokyo) ---------------- */
  const gojoNear = () => ents.find(f => f.k === 'gojoow');
  const MAIN = [
    { zone: 'sendai', t: 'Head to Sugisawa Third High', at: [5010, 0, 52], r: 6, start: 'intro', cut: 'gate' },
    { zone: 'sendai', t: 'Clear the curses from the school grounds', enter: () => { for (const [k, x, z] of [['curse1', 5000, -12], ['curse1', 5022, 2], ['curse1', 4990, 18], ['curse2', 5035, -30]]) spawn(k, [x, 0, z], 'yard'); }, kill: 'yard' },
    { zone: 'sendai', t: 'Get onto the school roof (hold Space against the wall)', at: [5010, 15, -56], r: 30, needY: 14.5, cut: 'roof' },
    { zone: 'sendai', t: 'Hold off the curse', enter: () => { const b = spawn('cboss', [5032, 15, -56], 'boss'); b.armor = .08; }, timer: 22, lowHp: .4, cut: 'finger', after: () => become('sukunay') },
    { zone: 'sendai', t: 'Sukuna has taken over: destroy the curse', enter: () => { let b = ents.find(f => f.tag === 'boss'); if (!b) b = spawn('cboss', [5032, 15, -56], 'boss'); b.armor = 1; b.hp = b.maxhp; }, kill: 'boss',
      cut: 'sukuna', after: () => { const P = G.p1; spawn('gojoow', [P.pos.x + 5, P.pos.y, P.pos.z + 3], 'gojo', { hostile: false }); pick(); } },
    { zone: 'sendai', t: 'Survive ten seconds against Gojo', start: 'gojo', enter: () => { let g = gojoNear(); if (!g) g = spawn('gojoow', [5015, 15, -52], 'gojo'); g.hostile = true; g.armor = .05; }, timer: 10, lowHp: .02,
      cut: 'duel', after: () => { become('yujiow'); enterZone('jjh'); } },
    { zone: 'jjh', t: 'Talk to Gojo in front of the main hall', start: 'tokyo', talk: 'gojo', cut: 'train', after: () => { S.k = 1; G.p1.mv.k = RO.yuji.moves.k; GAME.fillHud(); } },
    { zone: 'jjh', t: 'Exorcise the curses in the cedar woods', enter: () => { for (let i = 0; i < 5; i++) spawn(i < 3 ? 'curse1' : 'curse2', [2440 + i * 28, 0, 165 + rand(-8, 8)], 'woods'); }, kill: 'woods', cut: 'woods' },
    { zone: null, t: 'To be continued: the Cursed Womb arc', end: true }];
  const cur = () => MAIN[Math.min(S.step, MAIN.length - 1)];
  const scene = async key => { busy = true; pick(); if (WORLD.camera.position.distanceTo(G.p1.pos) > 30) G.camSnap = true; await GAME.cutscene(LN[key], 'Yuji: Story'); busy = false; if (OW.active && G.mode === 'ow') GAME.show(null); };
  async function begin(fresh) { const q = cur(); if (q.zone && q.zone !== zone) enterZone(q.zone); if (fresh && q.start) await scene(q.start); if (!OW.active) return; if (q.enter) q.enter(); qT = 0; pick(); }
  async function complete() { const q = cur(); busy = true; if (q.cut) await scene(q.cut); if (!OW.active) return; if (q.after) q.after(); S.step++; save(); busy = false; await begin(true); }

  /* ---------------- side quests ---------------- */
  const TRACK = [[4985, 30], [4960, -5], [4985, -40], [5050, -40], [5055, 25]];
  const SIDE = [{ id: 'track', zone: 'sendai', t: 'Side: Fifty meters in three seconds', at: [5030, 0, 30] }, { id: 'spar', zone: 'jjh', t: 'Side: Spar with Megumi (talk to him)', npc: 'megumi' }];
  const sideOpen = s => !S.side[s.id] && s.zone === zone && (s.id !== 'spar' || S.step >= 7) && S.step >= (s.id === 'track' ? 1 : 0) && !(s.id === 'track' && S.step >= 2 && S.step < 6);

  /* ---------------- per frame ---------------- */
  function step(dt, I) {
    const P = G.p1, k = GAME.keys; T += dt; qT += dt; if (busy) return;
    Object.assign(I, { my: 0, jump: !!k.Space, sprint: !!(k.ShiftLeft || k.ShiftRight), guard: !!k.KeyQ });
    if (k.KeyZ) yaw += dt * 2.2; if (k.KeyX) yaw -= dt * 2.2;
    pick(); const Q = G.p2, fighting = Q !== P && Q.hostile && !Q.dead && Q.pos.distanceTo(P.pos) < 16;
    P.faceLock = !fighting; if (!fighting) { const r = new V3().setFromMatrixColumn(WORLD.camera.matrixWorld, 0), s = P.vel.dot(r); if (Math.abs(s) > .5) P.face = s > 0 ? 1 : -1; }
    P.update(dt, I, Q);
    for (const f of ents) { const d = f.pos.distanceTo(P.pos);
      if (f.dead) { f.update(dt, NONE, P); if ((f.goneT -= dt) < 0) { f.remove(); ents.splice(ents.indexOf(f), 1); pick(); } continue; }
      if (!f.hostile || d > 70) { f.update(dt, NONE, P); continue; }
      const J = GAME.aiIntent(f, P, dt); if (!f.d.fly && !f.d.jumper) J.my = 0; if (f.d.jumper) { J.jump = P.pos.y - f.pos.y > 1.5; J.my = 0; }
      f.update(dt, J, P); const t = f.pos.clone().sub(P.pos).setY(0), dd = t.length(), m = 1.1 * Math.max(1, f.scale); if (dd < m && dd > 0) { t.multiplyScalar((m - dd) / dd / 2); P.pos.sub(t); f.pos.add(t); } }
    // out of a fight Yuji catches his breath
    if (P.hp < lastHp - .5) calm = 0; calm += dt; lastHp = P.hp; if (calm > 5 && !P.dead) P.hp = Math.min(P.maxhp, P.hp + P.maxhp * .06 * dt);
    const b = ents.find(f => f.armor < .5 && !f.dead && f.hostile); if (b && Math.random() < dt * .4) GAME.floatText(b.center().add(new V3(0, 3, 0)), 'No cursed energy: it barely feels it', '#a99fb8');
    // quest checks
    const q = cur(), d2 = (a) => Math.hypot(P.pos.x - a[0], P.pos.z - a[2]);
    if (!q.end && q.zone === zone && ((q.at && d2(q.at) < q.r && (!q.needY || P.pos.y >= q.needY)) || (q.kill && qT > .5 && !alive(q.kill)) || (q.timer && qT >= q.timer) || (q.lowHp && P.hp / P.maxhp < q.lowHp))) { complete(); return; }
    // side quests
    if (track) { track.t -= dt; const c = TRACK[track.i]; if (Math.hypot(P.pos.x - c[0], P.pos.z - c[1]) < 4) { track.i++; AUDIO.sfx('ui'); if (track.i >= TRACK.length) { track = null; S.side.track = 1; S.spd = 1.12; applyStats(G.p1); save(); scene('trackB'); } }
      else if (track.t <= 0) { track = null; GAME.banner('', 'Too slow', 'Try again from the start marker', 1600); } }
    else for (const s of SIDE) if (s.at && sideOpen(s) && Math.hypot(P.pos.x - s.at[0], P.pos.z - s.at[2]) < 3) { track = { i: 0, t: 25 }; scene('trackA'); }
    if (spar) { const m = spar; if (m.hp < m.maxhp * .3) endSpar(true); else if (P.hp < P.maxhp * .2) endSpar(false); }
  }
  async function endSpar(won) { const m = spar; spar = null; m.hostile = false; m.hp = m.maxhp; G.p1.hp = Math.max(G.p1.hp, G.p1.maxhp * .5); if (won) { S.side.spar = 1; S.bonusHp += 150; save(); } await scene(won ? 'sparB' : 'sparC'); if (won) applyStats(G.p1); }
  function talk() { if (busy) return; const P = G.p1, n = ents.filter(f => f.npc && !f.hostile && f.pos.distanceTo(P.pos) < 4).sort((a, b) => a.pos.distanceTo(P.pos) - b.pos.distanceTo(P.pos))[0]; if (!n) return;
    const q = cur(); if (q.talk === n.npc && q.zone === zone) { complete(); return; }
    if (n.npc === 'megumi' && zone === 'jjh' && sideOpen(SIDE[1])) { (async () => { await scene('sparA'); n.hostile = true; spar = n; })(); return; }
    GAME.floatText(n.center().add(new V3(0, 1.6, 0)), n.idle, '#e2b25c'); }
  function travel() { if (S.step < 6 || busy || G.mode !== 'ow') return; enterZone(zone === 'jjh' ? 'sendai' : 'jjh'); }
  function died(f) {
    if (f === G.p1) { if (spar) { endSpar(false); f.hp = f.maxhp * .5; return; } const q = cur(); if (q.lowHp) { f.hp = 1; return; }
      f.dead = true; f.hp = 0; GAME.banner('', 'Down', 'Back on your feet at the zone entrance', 1800); busy = true;
      setTimeout(() => { if (!OW.active) return; busy = false; enterZone(zone); begin(false); }, 2200); return; }
    if (spar === f) { f.hp = 1; endSpar(true); return; }
    f.dead = true; f.hp = 0; f.goneT = 3; GAME.spark(f.center(), '#e2b25c', 4); if (f.k === 'curse1' || f.k === 'curse2') GAME.floatText(f.center(), 'Exorcised', '#e2b25c');
  }

  /* ---------------- camera: behind Yuji, orbit with drag or Z/X, pulled in when a building is in the way ---------------- */
  addEventListener('pointerdown', e => { if (G.mode === 'ow' && e.target.id === 'cv') drag = [e.clientX, e.clientY]; });
  addEventListener('pointermove', e => { if (!drag) return; yaw -= (e.clientX - drag[0]) * .006; pitch = Math.max(.05, Math.min(1.1, pitch + (e.clientY - drag[1]) * .004)); drag = [e.clientX, e.clientY]; });
  addEventListener('pointerup', () => drag = null);
  addEventListener('keydown', e => { if (e.code === 'KeyT' && G.mode === 'ow') travel(); });
  function cam() { const P = G.p1, look = P.pos.clone().add(new V3(0, 1.6, 0)), dist = 8.5;
    const off = new V3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(dist);
    let best = dist; for (const { p } of WORLD.segment(look, look.clone().add(off), .3)) best = Math.min(best, Math.max(2.2, p.distanceTo(look) - 1.2));
    return [look.clone().add(off.setLength(best)), look]; }

  /* ---------------- HUD: quest box, talk prompt, markers ---------------- */
  const beamM = new THREE.MeshBasicMaterial({ color: 0xffd070, transparent: true, opacity: .35, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const sideM = beamM.clone(); sideM.color.set(0x5ed4ff);
  const mkBeam = m => { const b = new THREE.Mesh(new THREE.CylinderGeometry(.6, .6, 60, 8, 1, true).translate(0, 30, 0), m); b.userData.keep = 1; b.frustumCulled = false; return b; };
  const beams = [mkBeam(beamM), mkBeam(sideM)];
  function objective() { const q = cur(); if (q.end || q.zone !== zone) return null; if (q.at) return q.at;
    if (q.kill) { const f = ents.find(e => e.tag === q.kill && !e.dead); return f && [f.pos.x, f.pos.y, f.pos.z]; }
    if (q.talk) { const f = ents.find(e => e.npc === q.talk); return f && [f.pos.x, f.pos.y, f.pos.z]; } return null; }
  function sideTarget() { if (track) { const c = TRACK[track.i]; return [c[0], 0, c[1]]; } const s = SIDE.find(sideOpen); if (!s) return null; if (s.at) return s.at; const f = ents.find(e => e.npc === s.npc); return f && [f.pos.x, 0, f.pos.z]; }
  function hud() {
    const P = G.p1, Q = G.p2, q = cur(), o = objective(), st = sideTarget();
    [o, st].forEach((p, i) => { const b = beams[i]; if (p && !b.parent) WORLD.scene.add(b); if (!p && b.parent) WORLD.scene.remove(b); if (p) b.position.set(p[0], 0, p[2]); b.material.opacity = .25 + Math.sin(T * 3) * .1; });
    const lines = [`<b>${q.end ? 'Main' : 'Main quest'}</b> ${q.t}${q.timer && q.zone === zone ? ` · ${Math.max(0, Math.ceil(q.timer - qT))}s` : ''}`];
    if (track) lines.push(`<i>Side</i> Checkpoint ${track.i + 1}/${TRACK.length} · ${Math.ceil(track.t)}s`); else { const s = SIDE.find(sideOpen); if (s) lines.push(`<i>Side</i> ${s.t.replace('Side: ', '')}`); }
    const hint = 'Space jump · hold Space on walls to climb · Shift sprint · F talk · drag or Z/X camera' + (S.step >= 6 ? ' · T travel' : '') + ' · Esc pause';
    if ($('#hint').textContent !== hint) $('#hint').textContent = hint;
    const html = lines.join('<br>'); if ($('#owq').innerHTML !== html) $('#owq').innerHTML = html;
    const n = ents.find(f => f.npc && !f.hostile && f.pos.distanceTo(P.pos) < 4); $('#owp').hidden = !n || busy; if (n) $('#owp').innerHTML = `<kbd>F</kbd> Talk to ${n.d.name}`;
    const foe = Q !== P && Q.hostile && !Q.dead && Q.pos.distanceTo(P.pos) < 30; $('.pb.r').style.visibility = foe ? 'visible' : 'hidden';
    if (foe && $('#n2').dataset.k !== Q.k) { $('#n2').dataset.k = Q.k; $('#n2').innerHTML = `<small>${Q.d.jp}</small> ${Q.d.name}`; }
    const mg = $('#mini').getContext('2d'), X = x => (x - WORLD.MAP.x0) * WORLD.MS, Z = z => (z - WORLD.MAP.z0) * WORLD.MS;
    for (const [p, c] of [[o, '#ffd070'], [st, '#5ed4ff']]) if (p) { mg.fillStyle = '#0b0912'; mg.fillRect(X(p[0]) - 4, Z(p[2]) - 4, 8, 8); mg.fillStyle = c; mg.fillRect(X(p[0]) - 3, Z(p[2]) - 3, 6, 6); }
  }

  /* ---------------- entry points ---------------- */
  function start(fresh) { if (fresh) { Object.assign(S, { step: 0, side: {}, bonusHp: 0, spd: 1, k: 0, form: null }); save(); } else Object.assign(S, load() || {});
    OW.active = true; zone = null; busy = false; if (S.step === 4 || S.step === 5) S.form = 'sukunay'; enterZone(cur().zone || S.map || 'jjh'); begin(fresh || S.step === 0); }
  const foesOf = f => f === G.p1 ? ents.filter(e => e.hostile && !e.dead) : f.hostile ? [G.p1] : [];
  return { active: false, step, cam, hud, talk, died, foesOf, start, restart: () => start(false), hasSave: () => !!load(), get S() { return S; } };
})();
