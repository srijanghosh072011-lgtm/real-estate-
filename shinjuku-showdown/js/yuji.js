'use strict';
/* Yuji: Story — the open-world mode, from the finger in Sendai to the last fight in Shinjuku. Six zones you roam freely,
   a main quest in manga order (8 arcs), allies who fight beside you, short side quests, curses to hunt, talking,
   jumping, wall-running, travel and a chapter select. Progress saves in the browser. */
window.OW = (function () {
  const { G, RO, Fighter } = GAME, V3 = THREE.Vector3, $ = q => document.querySelector(q), rand = (a, b) => a + Math.random() * (b - a), PI = Math.PI;
  const LO = window.LINES_OW, NONE = { mv: new V3(), my: 0 };

  /* ---------------- cast ---------------- */
  const claw = (dmg, col) => ({ n: 'Claw', kind: 'strike', cost: 0, cd: 1.5, dmg, range: 3, col: col || '#c8c0a0' });
  const spit = (col, dmg) => ({ n: 'Spit', kind: 'proj', cost: 0, cd: 3, dmg: dmg || 22, spd: 16, hom: 1, tex: 'curse', col });
  Object.assign(RO, {
    yujiow: Object.assign({}, RO.yuji, { spr: 'yuji', title: 'Jujutsu Sorcerer', hp: 900, bf: 0, jumper: 1, moves: {} }),
    sukunay: { name: 'Ryomen Sukuna', jp: '両面宿儺', title: "In Yuji's Body", spr: 'sukunay', bark: 'sukuna', hp: 1500, spd: 12.5, range: 5, aura: '#ff2e4d', jumper: 1, regen: 6, bf: .1, moves: { k: RO.sukuna.moves.k, l: RO.sukuna.moves.l } },
    megumi: { name: 'Megumi Fushiguro', jp: '伏黒恵', title: 'Ten Shadows', hp: 900, spd: 10.5, range: 6, aura: '#8a9aff', jumper: 1,
      moves: { k: { n: 'Divine Dogs', kind: 'blast', cost: 14, cd: 2.6, dmg: 45, r: 2.6, delay: .4, range: 12, launch: 14, col: '#c8d0ff' }, l: { n: 'Nue', kind: 'proj', cost: 16, cd: 3.2, dmg: 40, spd: 24, hom: 1.5, tex: 'bolt', col: '#ffe070', stun: .3 } } },
    nobara: { name: 'Nobara Kugisaki', jp: '釘崎野薔薇', title: 'Straw Doll', hp: 900, spd: 10.5, range: 7, aura: '#ff8a6a', jumper: 1,
      moves: { k: { n: 'Hairpin', kind: 'proj', cost: 10, cd: 1.8, dmg: 38, spd: 26, hom: 1, tex: 'spark', col: '#ffb070', count: 3, spread: .12 }, l: { n: 'Resonance', kind: 'blast', cost: 18, cd: 4, dmg: 80, r: 2.5, delay: .35, range: 16, col: '#ff5a3a', stun: .6 } } },
    nanami: { name: 'Kento Nanami', jp: '七海建人', title: 'Grade 1', hp: 1100, spd: 10.5, range: 3, aura: '#e8d070', jumper: 1,
      moves: { k: { n: 'Ratio Technique', kind: 'strike', cost: 12, cd: 2.2, dmg: 80, range: 6, pierce: 1, col: '#f0d860' }, l: { n: 'Collapse', kind: 'blast', cost: 20, cd: 5, dmg: 90, r: 4, delay: .5, range: 10, launch: 24, col: '#e8c060' } } },
    junpei: { name: 'Junpei Yoshino', jp: '吉野順平', title: 'Moon Dregs', hp: 600, spd: 9, range: 3, aura: '#8a9ab0', moves: {} },
    gojoow: Object.assign({}, RO.gojo0, { spr: 'gojo0', bark: 'gojo0', hp: 5000, moves: { k: RO.gojo.moves.k, l: RO.gojo.moves.l } }),
    curse1: { name: 'Cursed Spirit', jp: '呪霊', title: 'Grade 4', hp: 140, spd: 8, range: 2, aura: '#6a8048', scale: .9, moves: { k: claw(24) } },
    curse2: { name: 'Cursed Spirit', jp: '呪霊', title: 'Grade 3', hp: 260, spd: 8.5, range: 4, aura: '#80486a', scale: 1.15, moves: { k: claw(32), l: spit('#80486a') } },
    tfh: { name: 'Transfigured Human', jp: '改造人間', title: "Mahito's work", hp: 170, spd: 9, range: 2, aura: '#7a7482', scale: .95, moves: { k: claw(28) } },
    mahito: { name: 'Mahito', jp: '真人', title: 'Special Grade', hp: 1600, spd: 11, range: 4, aura: '#7a9ad0', jumper: 1, regen: 4,
      moves: { k: { n: 'Transfigured Blade', kind: 'strike', cost: 10, cd: 1.6, dmg: 55, range: 6, col: '#9ab0d0' }, l: { n: 'Soul Isomer', kind: 'proj', cost: 18, cd: 4, dmg: 60, spd: 16, hom: 2, tex: 'curse', col: '#7a9ad0', count: 2, spread: .3 } } },
    hanami: { name: 'Hanami', jp: '花御', title: 'Special Grade', hp: 1800, spd: 9.5, range: 7, aura: '#8ac878', scale: 1.5, jumper: 1,
      moves: { k: { n: 'Cursed Buds', kind: 'proj', cost: 0, cd: 2.2, dmg: 35, spd: 18, hom: 1.2, tex: 'orb', col: '#8ac878', count: 3, spread: .25 }, l: { n: 'Wooden Roots', kind: 'blast', cost: 0, cd: 4, dmg: 85, r: 3.5, delay: .6, range: 14, launch: 26, col: '#6a4a2a' } } },
    eso: { name: 'Eso', jp: '壊相', title: 'Death Painting', hp: 900, spd: 10, range: 7, aura: '#6a9060', jumper: 1, moves: { k: { n: 'Wing King', kind: 'proj', cost: 0, cd: 1.8, dmg: 30, spd: 20, hom: 1.5, tex: 'orb', col: '#c02030', count: 2, spread: .2 } } },
    kechizu: { name: 'Kechizu', jp: '血塗', title: 'Death Painting', hp: 800, spd: 9, range: 3, aura: '#b8766a', scale: 1.3, moves: { k: claw(40), l: spit('#c02030', 28) } },
    choso: { name: 'Choso', jp: '脹相', title: 'Death Painting', hp: 1500, spd: 10, range: 9, aura: '#c02030', jumper: 1,
      moves: { k: { n: 'Slicing Exorcism', kind: 'proj', cost: 10, cd: 1.8, dmg: 40, spd: 26, hom: .8, tex: 'slash', col: '#d01020', count: 2, spread: .1 }, l: RO.yuji.moves.l,
        i: { n: 'Supernova', kind: 'blast', cost: 30, cd: 8, dmg: 100, r: 4, delay: .5, range: 12, launch: 30, col: '#d01020' } } },
    jogo: { name: 'Jogo', jp: '漏瑚', title: 'Special Grade', hp: 1400, spd: 10, fly: 1, range: 9, aura: '#ff7a2a', scale: 1.1,
      moves: { k: { n: 'Ember Insects', kind: 'proj', cost: 0, cd: 1.4, dmg: 35, spd: 20, hom: 2, tex: 'orb', col: '#ff7a2a', count: 3, spread: .3 }, l: { n: 'Maximum: Meteor', kind: 'blast', cost: 0, cd: 7, dmg: 110, r: 6, delay: 1, range: 18, launch: 30, col: '#ff5a1a' } } }
  });
  RO.cboss = Object.assign({}, RO.curse2, { spr: 'curse2', title: 'Drawn by the Finger', hp: 800, scale: 2.1, range: 5, jumper: 1, moves: { k: claw(55), l: RO.curse2.moves.l } });
  RO.wombb = { name: 'Special-Grade Curse', jp: '特級呪霊', title: 'Cursed Womb', spr: 'womb', hp: 900, spd: 9, range: 4, aura: '#8a4a44', scale: 2.2, jumper: 1, moves: { k: claw(60), l: spit('#6a4a44', 30) } };
  RO.sukunab = Object.assign({}, RO.sukunay, { hp: 1800 });
  RO.mahito2 = Object.assign({}, RO.mahito, { spr: 'mahito', title: 'True Form', hp: 2400, moves: Object.assign({}, RO.mahito.moves, { i: { n: 'Soul Multiplicity', kind: 'blast', cost: 40, cd: 10, dmg: 120, r: 4, delay: .6, range: 14, launch: 30, col: '#9ab0ff' } }) });
  RO.higub = Object.assign({}, RO.higuruma, { spr: 'higuruma', bark: 'higuruma', hp: 1300, jumper: 1 });
  RO.todob = Object.assign({}, RO.todo, { spr: 'todo', bark: 'todo', hp: 1250, jumper: 1 });
  RO.sukunam = Object.assign({}, RO.sukuna, { spr: 'sukuna', bark: 'sukuna', hp: 3200, moves: { k: RO.sukuna.moves.k, l: RO.sukuna.moves.l, i: RO.sukuna.moves.i, o: RO.sukuna.moves.o } });
  RO.mahob = { name: 'Mahoraga', jp: '魔虚羅', title: 'Divine General', spr: 'mahoraga', hp: 2200, spd: 10, range: 4, aura: '#f0c850', scale: 1.45, jumper: 1,
    moves: { k: claw(70, '#f0c850'), l: { n: 'Sword of Extermination', kind: 'blast', cost: 0, cd: 5, dmg: 100, r: 3.5, delay: .5, range: 10, launch: 30, col: '#f0c850' } } };
  RO.yutab = Object.assign({}, RO.yuta, { spr: 'yuta', bark: 'yuta', hp: 1400, jumper: 1, moves: { k: RO.yuta.moves.k, l: RO.yuta.moves.l } });
  RO.kenjakun = { name: 'Kenjaku', jp: '羂索', title: "In Geto's body", spr: 'kenjaku', hp: 999, spd: 9, range: 3, aura: '#8a6aa8', moves: {} };
  RO.sukunaf = Object.assign({}, RO.sukunah, { spr: 'sukunah', bark: 'sukunah', hp: 2600, moves: { k: RO.sukunah.moves.k, l: RO.sukunah.moves.l, i: RO.sukunah.moves.i, o: RO.sukunah.moves.o } });

  /* ---------------- save ---------------- */
  const S = { step: 0, max: 0, side: {}, bonusHp: 0, spd: 1, ce: 0, bf: 0, seen: [] };
  // saves store step ids so inserting new canon beats never shifts old progress; numeric-only saves predate ids (OLD order)
  const load = () => { let s; try { s = JSON.parse(localStorage.getItem('ss-yuji') || 'null'); } catch (e) { return null; } if (!s) return null;
    const id = s.id || OLD[Math.min(s.step || 0, OLD.length - 1)], mx = s.maxId || OLD[Math.min(s.max || 0, OLD.length - 1)];
    s.step = I(id) ?? 0; s.max = Math.max(s.step, I(mx) ?? 0); return s; };
  const save = () => { S.max = Math.max(S.max || 0, S.step); S.id = cur().id; S.maxId = MAIN[Math.min(S.max, MAIN.length - 1)].id; try { localStorage.setItem('ss-yuji', JSON.stringify(S)); } catch (e) { } };

  /* ---------------- zones ---------------- */
  const ZONES = {
    sendai: { map: 'sendai', time: 'night', song: 'tension', start: [4880, 0, -130], yaw: PI, name: 'Sendai' },
    jjh: { map: 'jjh', time: 'afternoon', song: 'title', start: [2500, 0, 150], yaw: 0, name: 'Tokyo Jujutsu High' },
    suburb: { map: 'suburb', time: 'dusk', song: 'tension', start: [7500, 0, 110], yaw: 0, name: 'The Suburbs' },
    eishu: { map: 'suburb', time: 'dusk', rain: 1, song: 'tension', start: [7360, 0, -92], yaw: 0, name: 'Eishū Juvenile Detention Center · West Tokyo' },
    canyon: { map: 'canyon', time: 'canyon', song: 'tension', start: [15000, 30, 50], yaw: 0, name: 'Yasohachi Bridge · Koinokuchi Canyon' },
    shibuya: { map: 'shibuya', time: 'night', song: 'tension', start: [9960, 0, 45], yaw: 0, name: 'Shibuya · October 31, 2018' },
    school: { map: 'school', time: 'indoorNight', indoor: 1, song: 'tension', start: [20008, 0, 0], yaw: -PI / 2, name: 'Sugisawa Third High · 4th floor, night' },
    womb: { map: 'womb', time: 'domain', indoor: 1, mood: 'womb', song: 'tension', start: [20500, 0, 60], yaw: 0, name: "Inside the Cursed Womb's Innate Domain" },
    cinema: { map: 'cinema', time: 'indoor', indoor: 1, song: 'tension', start: [20830, 5.4, 26], yaw: 0, name: 'Cinema · Screen 3' },
    gym: { map: 'gym', time: 'indoor', indoor: 1, song: 'tension', start: [21240, 0, 20], yaw: 0, name: 'Satozakura High · Gymnasium' },
    platform: { map: 'platform', time: 'indoor', indoor: 1, song: 'tension', start: [21600, 1.1, 0], yaw: -PI / 2, name: 'Shibuya Station · B5F Fukutoshin Line' },
    court: { map: 'court', time: 'domain', indoor: 1, song: 'shrine', start: [22250, 0, 22], yaw: 0, name: 'Domain Expansion · Deadly Sentencing' },
    ruinshibuya: { map: 'shibuya', time: 'sunset', song: 'tension', ruin: ['centergai', 'dogenzaka', 'shibuya', 'shibuyae'], ruinF: .8, start: [9960, 0, 45], yaw: 0, name: 'Shibuya ruins · November 2018' },
    ruins: { map: 'ruins', time: 'indoor', indoor: 1, song: 'tension', start: [22606, 0, 0], yaw: -PI / 2, name: 'Roppongi · abandoned building' },
    sewer: { map: 'sewer', time: 'indoorNight', indoor: 1, song: 'tension', start: [23012, 0, 4], yaw: -PI / 2, name: "Sewers · Mahito's hideout" },
    colony: { map: 'ikebukuro', time: 'afternoon', song: 'tension', ruin: ['ikebukuro'], start: [12430, 0, 130], yaw: 0, name: 'Ikebukuro · Tokyo Colony No. 1' },
    shinjuku: { map: 'shinjuku', time: 'night', song: 'battle', ruin: ['nishi', 'sanchome'], start: [236, 0, -72], yaw: 0, name: 'Shinjuku · December 24, 2018' } };
  const ORDER = ['jjh', 'sendai', 'eishu', 'suburb', 'canyon', 'shibuya', 'ruinshibuya', 'colony', 'shinjuku'];
  const NPCS = { sendai: s => [['megumi', [5010, 0, 47], 'megumi', 'Go home. Gojo-sensei is waiting for you in Tokyo.']],
    jjh: s => [s < I('y6.gojo') && ['gojoow', [2505, 0, -19], 'gojo', 'Go get them, Yuji.'], ['megumi', [2470, 0, 30], 'megumi', 'Train harder.'], s >= I('y2.meet') && ['nobara', [2532, 0, 32], 'nobara', "Don't slow me down."],
      s >= I('y5.brief') && ['todob', [2485, 0, 70], 'todo', 'Brother! Let us train until the sun goes down!']],
    suburb: s => s >= I('y3.nanami') && s <= I('y3.cinema') ? [['nanami', [7452, 0, 86], 'nanami', 'Overtime is against my principles.']] : [] };
  let ents = [], zone = null, busy = false, qT = 0, T = 0, yaw = 0, pitch = .3, drag = null, side = null, lastHp = 0, calm = 0;

  function spawn(key, at, tag, o = {}) { const f = new Fighter(key, at, false); Object.assign(f, { hostile: true, tag }, o); f.opp = G.p1; ents.push(f); return f; }
  const ally = (key, at) => spawn(key, at, 'ally', { hostile: false, ally: true });
  const boss = (key, at, o) => { const b = spawn(key, at, 'boss', o); AUDIO.play('battle'); return b; };
  const ring = (key, n, c, r, tag) => { for (let i = 0; i < n; i++) { const a = i / n * PI * 2; spawn(typeof key === 'string' ? key : key[i % key.length], [c[0] + Math.cos(a) * r, 0, c[2] + Math.sin(a) * r], tag); } AUDIO.play('battle'); };
  const drop = tag => { for (const f of ents.filter(e => e.tag === tag)) { f.remove(); ents.splice(ents.indexOf(f), 1); } pick(); };
  const near = (dx, dz) => [G.p1.pos.x + dx, G.p1.pos.y, G.p1.pos.z + dz];
  function enterZone(z) {
    const Z = ZONES[z]; zone = z; S.map = z; if (!S.seen.includes(z)) S.seen.push(z); GAME.clearArena(); ents = []; side = null;
    WORLD.setMap(Z.map); WORLD.reset(); WORLD.setTime(Z.time); if (Z.rain) WORLD.setWeather('rain'); if (Z.indoor) WORLD.setWeather('indoor'); if (Z.mood) WORLD.setMood(Z.mood, new V3(...Z.start)); for (const id of Z.ruin || []) WORLD.ruin(id, Z.ruinF || .4);
    SPR.release(['yuji', 'sukunay', 'megumi', 'gojo0', 'curse1', 'curse2', 'nobara', 'todo']);
    G.p1 = new Fighter(S.form || 'yujiow', Z.start, true); applyStats(G.p1);
    syncNpcs();
    if (S.step >= I('y1.woods') && z !== 'jjh' && !Z.indoor) for (let i = 0; i < 4; i++) spawn(z === 'shibuya' || z === 'colony' || z === 'ruinshibuya' ? 'tfh' : i % 2 ? 'curse2' : 'curse1', [Z.start[0] + rand(-120, 120), 0, Z.start[2] + rand(-120, 120)], 'roam');
    yaw = Z.yaw; G.camSnap = true; G.mode = 'ow'; GAME.show(null); AUDIO.play(Z.song); preload();
    const q = cur(); if (q.zone === z && q.enter) { q.enter(); qT = 0; } pick(); GAME.fillHud(); GAME.banner('', Z.name, '', 1600); if (!busy) arrive(q);
  }
  // who stands around a zone depends on the story so far
  function syncNpcs() { const want = (NPCS[zone] || (() => []))(S.step).filter(Boolean);
    for (const f of ents.filter(e => e.tag === 'npc' && !want.some(n => n[2] === e.npc))) { f.remove(); ents.splice(ents.indexOf(f), 1); }
    for (const n of want) if (!ents.some(e => e.npc === n[2])) spawn(n[0], n[1], 'npc', { hostile: false, npc: n[2], idle: n[3] }); }
  const preload = () => AUDIO.preload([cur().arc, 'barks', 'c7', 'c6g']);
  // Yuji's techniques arrive with the story: Divergent Fist (Gojo), Black Flash (Todo), then Piercing Blood, Dismantle and his domain for the finale
  function applyStats(p) { const k = p.k, st = S.step; p.d = Object.assign({}, RO[k]);
    if (k === 'yujiow') { p.d.spd *= S.spd; p.d.ceRegen = 9 + (S.ce || 0); p.d.bf = st >= I('y4.hanami') ? .12 + (S.bf || 0) : 0; p.maxhp = p.hp = p.trail = RO.yujiow.hp + S.bonusHp + (st >= I('y6.brief') ? 250 : 0);
      const m = RO.yuji.moves; p.mv = {}; if (st >= I('y1.woods')) p.mv.k = m.k; if (st >= I('y4.hanami')) p.mv.i = m.i; if (st >= I('y8.final')) Object.assign(p.mv, { l: m.l, u: Object.assign({}, RO.sukuna.moves.k, { n: 'Dismantle' }), o: m.o }); } }
  function become(key) { const o = G.p1; S.form = key === 'yujiow' ? null : key; const p = G.p1 = new Fighter(key, [o.pos.x, o.pos.y, o.pos.z], true); o.remove(); applyStats(p); pick(); GAME.fillHud(); GAME.flash(key === 'yujiow' ? '#fff' : '#ff2040', .7); }
  // the nearest hostile is the fight target (G.p2); everyone else is drawn as an extra
  function pick() { const p = G.p1; let best = null, bd = 1e9;
    for (const f of ents) { const d = f.pos.distanceTo(p.pos) - (f.hostile && !f.dead ? 25 : 0) + (f.ally ? 1e4 : 0); if (d < bd) { bd = d; best = f; } }
    G.p2 = best || p; G.extra = ents.filter(f => f !== best); p.opp = G.p2; for (const f of ents) if (!f.ally) f.opp = p; }
  const alive = tag => ents.some(f => f.tag === tag && !f.dead), bossOf = () => ents.find(f => f.tag === 'boss');

  /* ---------------- main quest: the story beat by beat, anime then manga, to Sukuna's end ---------------- */
  const S1 = (arc, id, o) => Object.assign({ arc, id }, o);
  const vs = (key, at, o) => () => { const b = boss(key, at || near(0, -12), o); return b; };
  const MAIN = [
    // 1 · The Finger (Sendai → Tokyo)
    S1('y1', 'y1.gate', { zone: 'sendai', t: 'Head to Sugisawa Third High', at: [5010, 0, 52], r: 6, start: 'intro', cut: 'gate' }),
    S1('y1', 'y1.hall', { zone: 'school', t: 'Fight through the curses in the 4th-floor hallway', enter: () => { for (const [k, x, z] of [['curse1', 20030, 0], ['curse1', 20046, -10], ['curse2', 20064, 1], ['curse1', 20090, -9], ['curse2', 20108, 0]]) spawn(k, [x, 0, z], 'yard'); AUDIO.play('battle'); }, kill: 'yard' }),
    S1('y1', 'y1.roof', { zone: 'sendai', t: 'Get onto the school roof (hold Space against the wall)', at: [5010, 15, -56], r: 30, needY: 14.5, place: [5010, 0, -45.5], cut: 'roof' }),
    S1('y1', 'y1.hold', { zone: 'sendai', t: 'Hold off the curse', enter: () => boss('cboss', [5032, 15, -56], { armor: .08 }), timer: 22, lowHp: .4, cut: 'finger', after: () => become('sukunay') }),
    S1('y1', 'y1.sukuna', { zone: 'sendai', t: 'Sukuna has taken over: destroy the curse', enter: () => { const b = bossOf() || boss('cboss', [5032, 15, -56]); b.armor = 1; b.hp = b.maxhp; }, kill: 'boss', cut: 'sukuna', after: () => spawn('gojoow', near(5, 3), 'gojo', { hostile: false }) }),
    S1('y1', 'y1.gojo', { zone: 'sendai', t: 'Survive ten seconds against Gojo', start: 'gojo', enter: () => { const g = ents.find(f => f.k === 'gojoow') || spawn('gojoow', [5015, 15, -52], 'gojo'); g.hostile = true; g.armor = .05; }, timer: 10, lowHp: .02, cut: 'duel', after: () => become('yujiow') }),
    S1('y1', 'y1.tokyo', { zone: 'jjh', t: 'Talk to Gojo in front of the main hall', start: 'tokyo', talk: 'gojo', cut: 'train' }),
    S1('y1', 'y1.woods', { zone: 'jjh', t: 'Exorcise the curses in the cedar woods', enter: () => ring(['curse1', 'curse1', 'curse2'], 5, [2500, 0, 165], 20, 'woods'), kill: 'woods', cut: 'woods' }),
    // 2 · Cursed Womb
    S1('y2', 'y2.meet', { zone: 'jjh', t: 'Meet the new first-year, Nobara', talk: 'nobara', cut: 'meet' }),
    S1('y2', 'y2.roppongi', { zone: 'ruins', t: 'First mission: the abandoned building in Roppongi', start: 'roppongi', enter: () => { ally('nobara', near(2, 2)); for (const [k, x, z] of [['curse1', 22630, -18], ['curse1', 22648, -4], ['curse2', 22668, 16], ['curse1', 22684, -18], ['curse2', 22692, 4]]) spawn(k, [x, 0, z], 'yard'); AUDIO.play('battle'); }, kill: 'yard', cut: 'roppongiEnd', after: () => drop('ally') }),
    S1('y2', 'y2.eishu', { zone: 'eishu', t: 'Go to the Eishū Juvenile Detention Center', at: [7360, 0, -100], r: 9, cut: 'enter' }),
    S1('y2', 'y2.search', { zone: 'womb', t: 'Search the domain for survivors', enter: () => { ally('megumi', near(-3, 2)); ally('nobara', near(3, 2)); ring(['curse2', 'curse1'], 6, [20500, 0, 30], 14, 'yard'); }, kill: 'yard' }),
    S1('y2', 'y2.womb', { zone: 'womb', t: 'Face the special grade', enter: () => boss('wombb', [20500, 0, 10], { armor: .15 }), timer: 20, lowHp: .4, cut: 'womb', after: () => { drop('ally'); become('sukunay'); } }),
    S1('y2', 'y2.sukuna', { zone: 'womb', t: 'Sukuna: destroy the special grade', enter: () => { const b = bossOf() || boss('wombb', [20500, 0, 10]); b.armor = 1; b.hp = b.maxhp; }, kill: 'boss', cut: 'betray', after: () => become('megumi') }),
    S1('y2', 'y2.megumi', { zone: 'eishu', t: 'As Megumi: hold out against Sukuna in the rain', place: [7396, 0, -126], enter: () => { spawn('sukunab', near(6, 0), 'boss2', { armor: .2 }); AUDIO.play('battle'); }, timer: 20, lowHp: .02, cut: 'death', after: () => { drop('boss2'); become('yujiow'); } }),
    // 3 · Mahito and Junpei
    S1('y3', 'y3.brief', { zone: 'jjh', t: 'Talk to Gojo', talk: 'gojo', cut: 'brief' }),
    S1('y3', 'y3.movies', { zone: 'jjh', t: 'Secret training: movies and the cursed doll', at: [2505, 1.65, -34], r: 6, cut: 'movies' }),
    S1('y3', 'y3.nanami', { zone: 'suburb', t: 'Find Nanami outside the cinema', talk: 'nanami', cut: 'nanami' }),
    S1('y3', 'y3.cinema', { zone: 'cinema', t: 'Clear the transfigured humans in Screen 3', enter: () => { ally('nanami', near(2, -2)); for (let i = 0; i < 6; i++) spawn('tfh', [20806 + i * 9, 0, -20 + (i % 2) * 4], 'tfh'); AUDIO.play('battle'); }, kill: 'tfh', cut: 'cinema', after: () => drop('ally') }),
    S1('y3', 'y3.sewer', { zone: 'sewer', t: 'As Nanami: face Mahito in the sewers', start: 'sewer', enter: () => { become('nanami'); boss('mahito', [23070, 0, 0]); }, winHp: .5, lowHp: .3, cut: 'sewerEnd', after: () => { drop('boss'); become('yujiow'); } }),
    S1('y3', 'y3.gym', { zone: 'gym', t: "Get to Satozakura High's assembly", at: [21240, 0, 6], r: 10, cut: 'school' }),
    S1('y3', 'y3.mahito', { zone: 'gym', t: 'Defeat Mahito in the gymnasium', enter: () => { if (!alive('ally')) ally('nanami', near(3, 2)); boss('mahito', [21240, 1.3, -24]); }, winHp: .3, cut: 'mahito', after: () => { drop('boss'); drop('ally'); } }),
    // 4 · Kyoto Goodwill Event
    S1('y4', 'y4.event', { zone: 'jjh', t: 'Talk to Gojo', talk: 'gojo', cut: 'event' }),
    S1('y4', 'y4.find', { zone: 'jjh', t: 'Find Todo in the cedar woods', at: [2500, 0, 172], r: 12, cut: 'todo' }),
    S1('y4', 'y4.todo', { zone: 'jjh', t: 'Spar with Todo', enter: () => boss('todob', near(0, -6)), winHp: .45, lowHp: .3, cut: 'hanami', after: () => { const t = bossOf(); if (t) Object.assign(t, { hostile: false, ally: true, tag: 'ally', hp: t.maxhp }); } }),
    S1('y4', 'y4.hanami', { zone: 'jjh', t: 'Fight Hanami alongside Todo (I: Black Flash)', enter: () => { if (!alive('ally')) ally('todob', near(3, 2)); boss('hanami', near(0, -12)); }, winHp: .35, cut: 'flash', after: () => { drop('boss'); drop('ally'); } }),
    // 5 · Death Painting
    S1('y5', 'y5.brief', { zone: 'jjh', t: 'Talk to Nobara', talk: 'nobara', cut: 'brief' }),
    S1('y5', 'y5.bridge', { zone: 'canyon', t: 'Go to Yasohachi Bridge', at: [15000, 30, 20], r: 14, cut: 'bridge' }),
    S1('y5', 'y5.bros', { zone: 'canyon', t: 'Defeat Eso and Kechizu under the bridge', place: [15000, 0, 10], enter: () => { ally('nobara', [15003, 0, 12]); spawn('eso', [14988, 0, -6], 'bros'); spawn('kechizu', [15012, 0, -6], 'bros'); AUDIO.play('battle'); }, kill: 'bros', cut: 'brothers', after: () => drop('ally') }),
    // 6 · Shibuya Incident
    S1('y6', 'y6.brief', { zone: 'jjh', t: 'Talk to Gojo', talk: 'gojo', cut: 'curtainOnly' }),
    S1('y6', 'y6.gojo', { zone: 'platform', t: 'As Gojo: Jogo, Hanami and Choso on B5F', start: 'b5f', enter: () => { become('gojo0'); G.p1.dm = 100; for (const [k, x] of [['jogo', 21650], ['hanami', 21670], ['choso', 21690]]) spawn(k, [x, 1.1, 0], 'trio', { armor: .6 }); for (let i = 0; i < 5; i++) spawn('tfh', [21620 + i * 14, 1.1, (i % 2 ? 4 : -4)], 'trio'); AUDIO.play('battle'); },
      kill: 'trio', pre: () => spawn('kenjakun', near(4, 2), 'story', { hostile: false }), cut: 'prison', after: () => { drop('story'); become('yujiow'); } }),
    S1('y6', 'y6.b5f', { zone: 'platform', t: 'Clear the transfigured humans on the B5F platform', enter: () => { ally('nanami', near(3, 2)); for (let i = 0; i < 7; i++) spawn('tfh', [21630 + i * 18, 1.1, (i % 3 - 1) * 3], 'tfh'); AUDIO.play('battle'); }, kill: 'tfh', cut: 'nanami', after: () => drop('ally') }),
    S1('y6', 'y6.head', { zone: 'platform', t: 'Head down the platform', at: [21720, 1.1, 0], r: 10, cut: 'choso' }),
    S1('y6', 'y6.choso', { zone: 'platform', t: 'Survive Choso', enter: () => boss('choso', [21745, 1.1, 0]), lowHp: .3, timer: 35, cut: 'brother', after: () => drop('boss') }),
    S1('y6', 'y6.jogo', { zone: 'shibuya', t: 'Sukuna: defeat Jogo', start: 'jogo', enter: () => { become('sukunay'); boss('jogo', near(0, -10)); }, kill: 'boss', cut: 'jogoend' }),
    S1('y6', 'y6.mahoraga', { zone: 'shibuya', t: 'Sukuna: defeat Mahoraga', start: 'mahoraga', enter: () => { if (G.p1.k !== 'sukunay') become('sukunay'); boss('mahob', near(0, -12)); }, kill: 'boss', cut: 'ruinAll', after: () => { for (const id of ['centergai', 'shibuya']) WORLD.ruin(id, .5); become('yujiow'); } }),
    S1('y6', 'y6.nanami2', { zone: 'shibuya', t: 'Keep going. Find Nanami in Dōgenzaka', at: [9880, 0, 110], r: 10, cut: 'nanami2' }),
    S1('y6', 'y6.mahito', { zone: 'shibuya', t: 'Defeat Mahito with Todo', enter: () => { ally('todob', near(3, 2)); boss('mahito2', near(0, -8)); }, winHp: .08, cut: 'cog', after: () => { drop('boss'); drop('ally'); } }),
    // 7 · Culling Game
    S1('y7', 'y7.yuta', { zone: 'ruinshibuya', t: "Yuta's orders: survive Yuta Okkotsu", start: 'yuta', enter: vs('yutab'), winHp: .5, lowHp: .3, cut: 'yutaEnd', after: () => drop('boss') }),
    S1('y7', 'y7.colony', { zone: 'colony', t: 'Clear the colony with Choso', start: 'game', enter: () => { ally('choso', near(3, 2)); ring(['tfh', 'curse2'], 7, [12440, 0, 140], 18, 'wave'); }, kill: 'wave', cut: 'judge' }),
    S1('y7', 'y7.higuruma', { zone: 'court', t: 'Face Higuruma inside Deadly Sentencing', enter: () => { drop('ally'); const h = boss('higub', [22250, 0, -12]); h.dm = 40; }, winHp: .4, lowHp: .3, cut: 'verdict', after: () => drop('boss') }),
    // 8 · Shinjuku Showdown: beyond the anime, the manga's last arc, fought by everyone in turn
    S1('y8', 'y8.gojo', { zone: 'shinjuku', t: 'As Gojo: fight Sukuna', start: 'gojo', enter: () => { become('gojo'); G.p1.dm = 100; const b = boss('sukunam', near(0, -14)); b.dm = 80; }, timer: 45, lowHp: .25, cut: 'gojoEnd', after: () => drop('boss') }),
    S1('y8', 'y8.kashimo', { zone: 'shinjuku', t: 'As Kashimo: fight Sukuna', start: 'kashimo', enter: () => { become('kashimo'); boss('sukunaf', near(0, -12)); }, timer: 30, lowHp: .25, cut: 'kashimoEnd', after: () => drop('boss') }),
    S1('y8', 'y8.higuruma', { zone: 'shinjuku', t: 'Fight Sukuna with Higuruma', start: 'higuruma', enter: () => { become('yujiow'); ally('higub', near(3, 2)); boss('sukunaf', near(0, -12)); }, timer: 30, lowHp: .25, cut: 'higurumaEnd', after: () => { drop('boss'); drop('ally'); } }),
    S1('y8', 'y8.yuta', { zone: 'shinjuku', t: 'As Yuta: fight Sukuna', start: 'yuta', enter: () => { become('yuta'); boss('sukunaf', near(0, -12)); }, timer: 30, lowHp: .25, cut: 'yutaEnd', after: () => drop('boss') }),
    S1('y8', 'y8.maki', { zone: 'shinjuku', t: 'As Maki, with Todo: fight Sukuna', start: 'maki', enter: () => { become('maki'); ally('todob', near(3, 2)); boss('sukunaf', near(0, -12)); }, timer: 30, lowHp: .25, cut: 'makiEnd', after: () => { drop('boss'); drop('ally'); } }),
    S1('y8', 'y8.yutag', { zone: 'shinjuku', t: "As Yuta in Gojo's body: fight Sukuna", start: 'yutagStart', enter: () => { become('yutag'); boss('sukunaf', near(0, -12)); }, timer: 35, lowHp: .2, cut: 'yutagEnd', after: () => { drop('boss'); become('yujiow'); } }),
    S1('y8', 'y8.final', { zone: 'shinjuku', t: 'As Yuji: defeat Sukuna', start: 'final', enter: () => { const b = boss('sukunaf', near(0, -12)); b.armor = .8; applyStats(G.p1); GAME.fillHud(); G.p1.dm = 100; }, winHp: .02, cut: 'ending' }),
    S1('y8', 'y8.end', { zone: null, t: 'The end. Free roam: T to travel, side quests are blue', end: true })];
  const IDX = Object.fromEntries(MAIN.map((q, i) => [q.id, i])), I = id => IDX[id];
  const OLD = ['y1.gate', 'y1.hall', 'y1.roof', 'y1.hold', 'y1.sukuna', 'y1.gojo', 'y1.tokyo', 'y1.woods', 'y2.meet', 'y2.eishu', 'y2.search', 'y2.womb', 'y2.sukuna', 'y2.megumi', 'y3.brief', 'y3.nanami', 'y3.cinema', 'y3.gym', 'y3.mahito', 'y4.event', 'y4.find', 'y4.todo', 'y4.hanami', 'y5.brief', 'y5.bridge', 'y5.bros', 'y6.brief', 'y6.b5f', 'y6.head', 'y6.choso', 'y6.jogo', 'y6.nanami2', 'y6.mahito', 'y7.colony', 'y7.higuruma', 'y8.final', 'y8.end'];
  const ARCS = [['y1', 'The Finger'], ['y2', 'Cursed Womb'], ['y3', 'Mahito'], ['y4', 'Kyoto Goodwill Event'], ['y5', 'Death Painting'], ['y6', 'Shibuya Incident'], ['y7', 'Culling Game'], ['y8', 'Shinjuku Showdown']].map(([a, n]) => [a, MAIN.findIndex(q => q.arc === a), n]);
  const arcName = a => (ARCS.find(x => x[0] === a) || ARCS[0])[2];
  const cur = () => MAIN[Math.min(S.step, MAIN.length - 1)];
  const LINE = (arc, key) => key === 'ending' ? LINES.story.find(c => c.id === 'c7').win.filter(l => !l.tip).concat([{ tip: 'The end. Thank you for playing. Free roam is open: T travels anywhere, and blue markers are side quests. Every quest is listed under Quests (Tab).' }])
    : key === 'yutagStart' ? LINES.story.find(c => c.id === 'c6g').intro.filter(l => !l.tip).concat([{ tip: "You are Yuta in Gojo's body: Infinity, Blue, Red and Hollow Purple." }])
    : key === 'ruinAll' ? LO.y6.ruin2.concat(LO.y6.ruin.slice(3)) : key === 'jogoend' ? LO.y6.ruin.slice(0, 2) : LO[arc][key];
  async function scene(lines, title) { busy = true; pick(); const st = ZONES[zone] ? ZONES[zone].start : [0, 0, 0];
    lines = lines.map(l => l.shot && Array.isArray(l.shot.at) && Math.hypot(l.shot.at[0] - st[0], l.shot.at[2] - st[2]) > 400 ? Object.assign({}, l, { shot: { cam: 'two' } }) : l); if (WORLD.camera.position.distanceTo(G.p1.pos) > 30) G.camSnap = true; await GAME.cutscene(lines, title || 'Yuji: Story · ' + arcName(cur().arc)); busy = false; if (OW.active && G.mode === 'ow') GAME.show(null); }
  async function begin(fresh) { const q = cur(); busy = !!(fresh && q.start); if (q.zone && q.zone !== zone) enterZone(q.zone); else { syncNpcs(); if (q.enter) { q.enter(); qT = 0; } pick(); }
    if (fresh && q.start) await scene(LINE(q.arc, q.start)); busy = false; if (OW.active) arrive(q); }
  // put Yuji a few steps from a point, on solid ground and outside buildings, with the camera behind him looking at it
  function goTo(pt, r) { const p = G.p1; for (let k = 0; k < 12; k++) { const a = Math.atan2(p.pos.z - pt[2], p.pos.x - pt[0]) + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * .55, x = pt[0] + Math.cos(a) * r, z = pt[2] + Math.sin(a) * r, y = WORLD.surfaceY(x, z, (pt[1] || 0) + 1);
      if (!WORLD.within(new V3(x, y, z), .8).some(b => b.base < y + 1.8 && b.base + b.h > y + .1)) { put([x, y, z], Math.atan2(x - pt[0], z - pt[2])); return; } } put(pt); }
  function put(pt, ry) { const p = G.p1; p.pos.set(...pt); p.vel.set(0, 0, 0); p.vy = 0; p.kb.set(0, 0, 0); if (ry != null) yaw = ry; G.camSnap = true; GAME.flash('#000', .5); }
  function arrive(q) { if (q.end || q.zone !== zone || busy) return;
    const soon = () => setTimeout(() => { if (OW.active && cur() === q && !busy && G.mode === 'ow') complete(); }, 450);
    if (q.place) { put(q.place, 0); return; }
    if (q.at && !q.needY) { goTo(q.at, 2); soon(); return; }
    if (q.talk) { const n = ents.find(e => e.npc === q.talk); if (n) { goTo([n.pos.x, n.pos.y, n.pos.z], 2.4); soon(); } return; }
    const o = objective(); if (o && Math.hypot(G.p1.pos.x - o[0], G.p1.pos.z - o[2]) > 16) goTo(o, 10); }
  async function complete() { const q = cur(); busy = true; if (q.pre) { q.pre(); pick(); } if (q.cut) await scene(LINE(q.arc, q.cut)); if (!OW.active) return; if (q.after) q.after(); S.step++; save(); busy = false;
    if (G.mode === 'ow') AUDIO.play(ZONES[zone].song); if (cur().arc !== q.arc) preload(); if (G.p1.k === 'yujiow') { applyStats(G.p1); GAME.fillHud(); } await begin(true); }

  /* ---------------- side quests ---------------- */
  const SIDE = [
    { id: 'track', zone: 'sendai', from: 'y1.hall', t: 'Fifty meters in three seconds', kind: 'race', at: [5030, 0, 30], pts: [[4985, 30], [4960, -5], [4985, -40], [5050, -40], [5055, 25]], time: 25, reward: { spd: .12 }, a: 'trackA', b: 'trackB' },
    { id: 'spar', zone: 'jjh', from: 'y1.woods', t: 'Spar with Megumi', kind: 'duel', npc: 'megumi', reward: { hp: 150 }, a: 'sparA', b: 'sparB', c: 'sparC' },
    { id: 'gym', zone: 'sendai', from: 'y1.tokyo', t: 'Curses in the old gym', kind: 'hunt', at: [4968, 0, -8], n: 5, reward: { hp: 100 } },
    { id: 'night', zone: 'sendai', from: 'y1.tokyo', t: 'Night run through Sendai', kind: 'race', at: [4880, 0, -110], pts: [[4880, -40], [4950, 60], [5100, 80], [5150, -100], [5000, -150]], time: 45, reward: { spd: .05 } },
    { id: 'nobspar', zone: 'jjh', from: 'y2.roppongi', t: 'Spar with Nobara', kind: 'duel', npc: 'nobara', reward: { ce: 3 } },
    { id: 'eishu', zone: 'eishu', from: 'y3.brief', t: 'Sweep the detention center', kind: 'hunt', at: [7360, 0, -150], n: 6, reward: { hp: 100 } },
    { id: 'river', zone: 'suburb', from: 'y6.brief', t: 'Suburb street run', kind: 'race', at: [7300, 0, 150], pts: [[7380, 150], [7480, 120], [7500, 40], [7620, 60], [7700, 150]], time: 35, reward: { spd: .05 } },
    { id: 'woods2', zone: 'jjh', from: 'y5.brief', t: 'Night shift in the cedar woods', kind: 'hunt', at: [2420, 0, 130], n: 6, reward: { bf: .03 } },
    { id: 'todospar', zone: 'jjh', from: 'y5.brief', t: 'Spar with Todo', kind: 'duel', npc: 'todo', reward: { hp: 150 } },
    { id: 'centergai', zone: 'shibuya', from: 'y7.colony', t: 'Transfigured humans in Center Gai', kind: 'hunt', at: [9870, 0, -110], n: 6, reward: { hp: 120 } },
    { id: 'roofs', zone: 'shibuya', from: 'y7.colony', t: 'Run the Shibuya streets', kind: 'race', at: [9960, 0, 40], pts: [[9958, -28], [9900, -60], [9870, -150], [10060, -120], [10100, 60]], time: 45, reward: { spd: .05 } },
    { id: 'colony', zone: 'colony', from: 'y8.gojo', t: 'Colony hunters', kind: 'hunt', at: [12520, 0, 120], n: 7, reward: { ce: 3 } },
    { id: 'shinjuku', zone: 'shinjuku', from: 'y8.end', t: 'Shinjuku stragglers', kind: 'hunt', at: [-200, 0, 0], n: 8, reward: { hp: 150 } }];
  const busyMain = () => ents.some(f => f.hostile && !f.dead && f.tag !== 'roam' && f.tag !== 'side');
  const sideOpen = s => !S.side[s.id] && s.zone === zone && S.step >= I(s.from) && !side && !busyMain() && !(s.id === 'track' && S.step > I('y1.hall') && S.step < I('y1.tokyo'));
  const rewardText = r => r.hp ? `+${r.hp} max health` : r.spd ? 'you run faster' : r.ce ? 'faster cursed energy' : 'Black Flash comes more often';
  function sideLines(s, which) { if (s[which]) return LO.y1[s[which]];
    if (which === 'a') return s.kind === 'duel' ? [{ s: s.npc, t: s.npc === 'todo' ? 'Brother! Show me how far you have come!' : "Let's see what you've got." }] : [{ tip: `Side quest: ${s.t}. ${s.kind === 'race' ? `Hit every checkpoint within ${s.time} seconds.` : 'Exorcise every curse here.'}` }];
    if (which === 'b') return [{ tip: `Side quest complete: ${s.t}. Reward: ${rewardText(s.reward)}.` }]; return [{ tip: 'Not this time. Try again whenever you like.' }]; }
  async function startSide(s, npc) { await scene(sideLines(s, 'a'), 'Side quest'); side = { s, i: 0, t: s.time };
    if (s.kind === 'hunt') ring(['curse1', 'curse2'], s.n, s.at, 10, 'side'); if (s.kind === 'duel') { npc.hostile = true; side.npc = npc; } }
  async function endSide(won) { const s = side.s; if (side.npc) { const n = side.npc; n.hostile = false; n.hp = n.maxhp; G.p1.hp = Math.max(G.p1.hp, G.p1.maxhp * .5); } side = null;
    if (won) { S.side[s.id] = 1; const r = s.reward; S.bonusHp += r.hp || 0; S.spd += r.spd || 0; S.ce = (S.ce || 0) + (r.ce || 0); S.bf = (S.bf || 0) + (r.bf || 0); save(); }
    await scene(sideLines(s, won ? 'b' : 'c'), 'Side quest'); if (won && G.p1.k === 'yujiow') { const hp = G.p1.hp; applyStats(G.p1); G.p1.hp = Math.min(G.p1.maxhp, hp + 200); GAME.fillHud(); } }

  /* ---------------- per frame ---------------- */
  function step(dt, I) {
    const p = G.p1, k = GAME.keys; T += dt; qT += dt; if (busy) return;
    Object.assign(I, { my: 0, jump: !!k.Space, sprint: !!(k.ShiftLeft || k.ShiftRight), guard: !!k.KeyQ });
    if (k.KeyZ) yaw += dt * 2.2; if (k.KeyX) yaw -= dt * 2.2;
    pick(); const Q = G.p2, fighting = Q !== p && Q.hostile && !Q.dead && Q.pos.distanceTo(p.pos) < 16;
    p.faceLock = !fighting; if (!fighting) { const r = new V3().setFromMatrixColumn(WORLD.camera.matrixWorld, 0), s = p.vel.dot(r); if (Math.abs(s) > .5) p.face = s > 0 ? 1 : -1; }
    p.update(dt, I, Q);
    for (const sm of p.summons) if (!ents.includes(sm)) { Object.assign(sm, { ally: true, hostile: false, tag: 'ally' }); ents.push(sm); }
    const hostiles = ents.filter(f => f.hostile && !f.dead), friends = [p, ...ents.filter(f => f.ally && !f.dead)];
    for (const f of ents.slice()) { const d = f.pos.distanceTo(p.pos);
      if (f.dead) { f.update(dt, NONE, p); if ((f.goneT -= dt) < 0) { f.remove(); ents.splice(ents.indexOf(f), 1); pick(); } continue; }
      if (f.ally) {   // allies fight the nearest curse, or keep up with Yuji
        const tg = hostiles.filter(h => h.pos.distanceTo(f.pos) < 40).sort((a, b) => a.pos.distanceTo(f.pos) - b.pos.distanceTo(f.pos))[0];
        let J; if (tg) { J = GAME.aiIntent(f, tg, dt); f.opp = tg; } else { J = { mv: new V3(), my: 0 }; const to = p.pos.clone().sub(f.pos).setY(0); if (to.length() > 6) J.mv.copy(to.normalize()); }
        J.my = 0; J.jump = p.pos.y - f.pos.y > 1.5 || !!(tg && tg.pos.y - f.pos.y > 1.5); J.sprint = d > 20; f.update(dt, J, tg || p); continue; }
      if (!f.hostile || d > 70) { f.update(dt, NONE, p); continue; }
      const tg = friends.slice().sort((a, b) => a.pos.distanceTo(f.pos) - b.pos.distanceTo(f.pos))[0];
      const J = GAME.aiIntent(f, tg, dt); if (!f.d.fly) J.my = 0; if (f.d.jumper) J.jump = tg.pos.y - f.pos.y > 1.5;
      f.update(dt, J, tg); const t = f.pos.clone().sub(p.pos).setY(0), dd = t.length(), m = 1.1 * Math.max(1, f.scale); if (dd < m && dd > 0) { t.multiplyScalar((m - dd) / dd / 2); p.pos.sub(t); f.pos.add(t); } }
    // out of a fight, catch your breath
    if (p.hp < lastHp - .5) calm = 0; calm += dt; lastHp = p.hp; if (calm > 5 && !p.dead) p.hp = Math.min(p.maxhp, p.hp + p.maxhp * .06 * dt);
    const b = ents.find(f => f.armor < .5 && !f.dead && f.hostile); if (b && Math.random() < dt * .35) GAME.floatText(b.center().add(new V3(0, 3, 0)), p.k === 'megumi' ? 'Too strong: just survive' : 'It barely feels it', '#a99fb8');
    // main quest
    const q = cur(), d2 = a => Math.hypot(p.pos.x - a[0], p.pos.z - a[2]), bo = bossOf();
    if (!q.end && q.zone === zone && qT > .5 && ((q.at && d2(q.at) < q.r && (!q.needY || p.pos.y >= q.needY)) || (q.kill && !alive(q.kill)) || (q.winHp && (!bo || bo.dead || bo.hp / bo.maxhp < q.winHp)) || (q.timer && qT >= q.timer) || (q.lowHp && p.hp / p.maxhp < q.lowHp))) { complete(); return; }
    // side quests
    if (side) { const s = side.s;
      if (s.kind === 'race') { side.t -= dt; const c = s.pts[side.i]; if (Math.hypot(p.pos.x - c[0], p.pos.z - c[1]) < 4.5) { side.i++; AUDIO.sfx('ui'); if (side.i >= s.pts.length) endSide(true); } else if (side.t <= 0) { side = null; GAME.banner('', 'Too slow', 'Try again from the blue marker', 1600); } }
      else if (s.kind === 'hunt' && !alive('side')) endSide(true);
      else if (s.kind === 'duel') { const n = side.npc; if (n.hp < n.maxhp * .3) endSide(true); else if (p.hp < p.maxhp * .2) endSide(false); } }
    else for (const s of SIDE) if (s.at && sideOpen(s) && Math.hypot(p.pos.x - s.at[0], p.pos.z - s.at[2]) < 3.5) { startSide(s); break; }
  }
  function talk() { if (busy) return; const p = G.p1, n = ents.filter(f => f.npc && !f.hostile && f.pos.distanceTo(p.pos) < 4.5).sort((a, b) => a.pos.distanceTo(p.pos) - b.pos.distanceTo(p.pos))[0]; if (!n) return;
    const q = cur(); if (q.talk === n.npc && q.zone === zone) { complete(); return; }
    const s = SIDE.find(x => x.kind === 'duel' && x.npc === n.npc && sideOpen(x)); if (s) { startSide(s, n); return; }
    GAME.floatText(n.center().add(new V3(0, 1.6, 0)), n.idle, '#e2b25c'); }
  const unlocked = () => ORDER.filter(z => S.seen.includes(z) && !(z === 'shibuya' && S.step >= I('y7.yuta')));
  function travel() { if (S.step < I('y1.tokyo') || busy || G.mode !== 'ow' || side) return; const u = unlocked(); if (u.length < 2) return; enterZone(u[(u.indexOf(zone) + 1) % u.length]); }
  function died(f) {
    if (f === G.p1) { if (side && side.npc) { f.hp = f.maxhp * .3; endSide(false); return; } const q = cur(); if (q.lowHp && q.zone === zone) { f.hp = 1; return; }
      f.dead = true; f.hp = 0; GAME.banner('', 'Down', 'Back on your feet at the zone entrance', 1800); busy = true; side = null;
      setTimeout(() => { if (!OW.active) return; busy = false; enterZone(zone); }, 2200); return; }
    if (side && side.npc === f) { f.hp = 1; endSide(true); return; }
    if (f.ally) { f.hp = f.maxhp * .4; GAME.floatText(f.center(), 'Still standing', '#e2b25c'); return; }
    if (cur().winHp && f.tag === 'boss') { f.hp = 1; return; }   // story bosses leave when beaten; the quest check picks that up
    f.dead = true; f.hp = 0; f.goneT = 3; GAME.spark(f.center(), '#e2b25c', 4); if (!f.tag.startsWith('boss')) GAME.floatText(f.center(), 'Exorcised', '#e2b25c');
  }

  /* ---------------- camera: behind Yuji, orbit with drag or Z/X, pulled in when a building is in the way ---------------- */
  addEventListener('pointerdown', e => { if (G.mode === 'ow' && e.target.id === 'cv') drag = [e.clientX, e.clientY]; });
  addEventListener('pointermove', e => { if (!drag) return; yaw -= (e.clientX - drag[0]) * .006; pitch = Math.max(.05, Math.min(1.1, pitch + (e.clientY - drag[1]) * .004)); drag = [e.clientX, e.clientY]; });
  addEventListener('pointerup', () => drag = null);
  addEventListener('keydown', e => { if (e.code === 'KeyT' && G.mode === 'ow') travel(); });
  function cam() { const p = G.p1, look = p.pos.clone().add(new V3(0, 1.6, 0)), dist = 8.5;
    const off = new V3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(dist);
    let best = dist; for (const { p: hp } of WORLD.segment(look, look.clone().add(off), .3)) best = Math.min(best, Math.max(2.2, hp.distanceTo(look) - 1.2));
    return [look.clone().add(off.setLength(best)), look]; }

  /* ---------------- HUD: quest box, talk prompt, markers ---------------- */
  const mkBeam = c => { const b = new THREE.Mesh(new THREE.CylinderGeometry(.6, .6, 60, 8, 1, true).translate(0, 30, 0), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: .35, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); b.userData.keep = 1; b.frustumCulled = false; return b; };
  const beams = [mkBeam(0xffd070), mkBeam(0x5ed4ff)];
  function objective() { const q = cur(); if (q.end || q.zone !== zone) return null; if (q.at) return q.at;
    const f = q.kill ? ents.find(e => e.tag === q.kill && !e.dead) : q.winHp ? bossOf() : q.talk ? ents.find(e => e.npc === q.talk) : null; return f && [f.pos.x, f.pos.y, f.pos.z]; }
  function sideTarget() { if (side) { if (side.s.kind === 'race') { const c = side.s.pts[side.i]; return [c[0], 0, c[1]]; } return null; }
    const s = SIDE.find(sideOpen); if (!s) return null; if (s.at) return s.at; const f = ents.find(e => e.npc === s.npc); return f && [f.pos.x, 0, f.pos.z]; }
  function hud() {
    const p = G.p1, Q = G.p2, q = cur(), o = objective(), st = sideTarget();
    [o, st].forEach((pt, i) => { const b = beams[i]; if (pt && !b.parent) WORLD.scene.add(b); if (!pt && b.parent) WORLD.scene.remove(b); if (pt) b.position.set(pt[0], 0, pt[2]); b.material.opacity = .25 + Math.sin(T * 3) * .1; });
    const where = q.zone && q.zone !== zone ? ` <i>(${ZONES[q.zone].name}${S.step >= I('y1.tokyo') ? ': press T' : ''})</i>` : '';
    const lines = [`<b>${arcName(q.arc)}</b> ${q.t}${where}${q.timer && q.zone === zone ? ` · ${Math.max(0, Math.ceil(q.timer - qT))}s` : ''}`];
    if (side) lines.push(`<i>Side</i> ${side.s.t}${side.s.kind === 'race' ? ` · ${side.i + 1}/${side.s.pts.length} · ${Math.ceil(side.t)}s` : ''}`); else { const s = SIDE.find(sideOpen); if (s) lines.push(`<i>Side</i> ${s.t}${s.npc ? ' (talk to them)' : ''}`); }
    const html = lines.join('<br>'); if ($('#owq').innerHTML !== html) $('#owq').innerHTML = html;
    const hint = 'Space jump/climb · Shift sprint · F talk · Z/X camera' + (S.step >= I('y1.tokyo') ? ' · T travel' : '') + ' · Tab quests · Esc';
    if ($('#hint').textContent !== hint) $('#hint').textContent = hint;
    const n = ents.find(f => f.npc && !f.hostile && f.pos.distanceTo(p.pos) < 4.5); $('#owp').hidden = !n || busy; if (n) $('#owp').innerHTML = `<kbd>F</kbd> Talk to ${n.d.name}`;
    const foe = Q !== p && Q.hostile && !Q.dead && Q.pos.distanceTo(p.pos) < 30; $('.pb.r').style.visibility = foe ? 'visible' : 'hidden';
    if (foe && $('#n2').dataset.k !== Q.k) { $('#n2').dataset.k = Q.k; $('#n2').innerHTML = `<small>${Q.d.jp}</small> ${Q.d.name}`; }
    const mg = $('#mini').getContext('2d'), X = x => (x - WORLD.MAP.x0) * WORLD.MS, Z = z => (z - WORLD.MAP.z0) * WORLD.MS;
    for (const f of ents) if (f.ally && !f.dead) { mg.fillStyle = '#9affc8'; mg.fillRect(X(f.pos.x) - 1.5, Z(f.pos.z) - 1.5, 3, 3); }
    for (const [pt, c] of [[o, '#ffd070'], [st, '#5ed4ff']]) if (pt) { mg.fillStyle = '#0b0912'; mg.fillRect(X(pt[0]) - 4, Z(pt[2]) - 4, 8, 8); mg.fillStyle = c; mg.fillRect(X(pt[0]) - 3, Z(pt[2]) - 3, 6, 6); }
  }

  /* ---------------- entry points ---------------- */
  const reset = () => Object.assign(S, { step: 0, max: 0, side: {}, bonusHp: 0, spd: 1, ce: 0, bf: 0, form: null, seen: [] });
  function start(fresh, arcStep) { if (fresh) reset(); else Object.assign(S, load() || {}); S.seen = S.seen || [];
    if (arcStep != null) { S.step = arcStep; S.form = null; } else if (!fresh && S.form !== 'sukunay' && S.form !== 'megumi') S.form = null;
    OW.active = true; zone = null; busy = false; side = null;
    if (!cur().zone) enterZone(ZONES[S.map] ? S.map : 'jjh'); save(); begin(fresh || arcStep != null || S.step === 0); }
  const foesOf = f => f === G.p1 || f.ally ? ents.filter(e => e.hostile && !e.dead) : f.hostile ? [G.p1, ...ents.filter(e => e.ally && !e.dead)] : [];
  function menu() { const s = load(); $('#owCont').hidden = !s; const box = $('#owArcs'); box.innerHTML = '';
    ARCS.forEach(([a, i, name], n) => { const b = document.createElement('button'); b.textContent = `${n + 1} · ${name}`; b.disabled = !s || Math.max(s.max || 0, s.step) < i; b.onclick = () => { AUDIO.sfx('ui'); start(false, i); }; box.appendChild(b); }); }
  /* ---------------- quests screen: story beats by arc + side quests ---------------- */
  let qOpen = false;
  const esc = t => String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  function quests() {
    const inGame = OW.active && G.mode === 'ow', s = inGame ? S : load(), st = s ? s.step : -1, mx = s ? Math.max(s.max || 0, st) : -1;
    const q = s && MAIN[Math.min(st, MAIN.length - 1)], zn = z => z && ZONES[z] ? ZONES[z].name : '';
    $('#qnow').innerHTML = !s ? 'No story save yet. Start <b>Yuji: Story</b> from the title screen and your quests will be listed here.'
      : `<b>${arcName(q.arc)}</b> · now: ${esc(q.t)}${q.zone ? ` <i>(${zn(q.zone)})</i>` : ''}<br><small>Story ${Math.min(st + 1, MAIN.length)} / ${MAIN.length} · side quests ${Object.keys(s.side || {}).length} / ${SIDE.length}</small>`;
    const box = $('#qlist'); box.innerHTML = '';
    ARCS.forEach(([a, i0, name], n) => { const h = document.createElement('h3'); h.textContent = `${n + 1} · ${name}`;
      if (s && mx >= i0) { const b = document.createElement('button'); b.textContent = 'Play from here'; b.onclick = () => { AUDIO.sfx('ui'); closeQ(true); start(false, i0); }; h.appendChild(b); }
      const ol = document.createElement('ol');
      MAIN.forEach((m, i) => { if (m.arc !== a) return; const li = document.createElement('li'), c = i === st ? 'now' : i < st || i <= mx ? 'done' : 'lock'; li.className = c;
        li.innerHTML = `<i>${c === 'now' ? '▶ now' : c === 'done' ? '✓ done' : 'locked'}</i><span>${esc(m.t)}</span>${m.zone ? `<small>${zn(m.zone)}</small>` : ''}`; ol.appendChild(li); });
      box.append(h, ol); });
    const h = document.createElement('h3'); h.textContent = 'Side quests (blue markers)'; const ol = document.createElement('ol');
    for (const x of SIDE) { const li = document.createElement('li'), done = s && s.side && s.side[x.id], open = s && st >= I(x.from);
      li.className = done ? 'done' : open ? '' : 'lock';
      li.innerHTML = `<i>${done ? '✓ done' : open ? 'open' : 'locked'}</i><span>${esc(x.t)}<br><small style="margin:0">${open ? 'Reward: ' + rewardText(x.reward) : 'Opens at: ' + esc(MAIN[I(x.from)].t)}</small></span><small>${zn(x.zone)}</small>`;
      if (inGame && open && !done && !side && !busy) { const b = document.createElement('button'); b.textContent = 'Go'; b.onclick = () => { AUDIO.sfx('ui'); closeQ(); goSide(x); }; li.appendChild(b); }
      ol.appendChild(li); }
    box.append(h, ol);
    qOpen = true; if (inGame) G.paused = true; else G.mode = 'menu'; GAME.show('#quests'); $('#qClose').focus();
    const now = box.querySelector('li.now'); if (now) now.scrollIntoView({ block: 'center' }); }
  function closeQ(silent) { if (!qOpen) return; qOpen = false; if (OW.active && G.mode === 'ow') { G.paused = false; GAME.show(null); } else if (!silent) { G.mode = 'title'; GAME.show('#title'); } }
  function goSide(x) { if (x.zone !== zone) enterZone(x.zone); const n = x.npc && ents.find(f => f.k === x.npc || f.d.spr === x.npc);
    const pt = x.at || (n && [n.pos.x, 0, n.pos.z]); if (pt) put([pt[0] + 3, 0, pt[2] + 3]); }
  $('#qClose').onclick = () => { AUDIO.sfx('ui'); closeQ(); };
  $('#owQuests').onclick = () => { if (G.mode === 'ow' && !G.paused && !busy) quests(); };
  addEventListener('keydown', e => { if (e.code === 'Tab' && (qOpen || G.mode === 'ow')) { e.preventDefault(); e.stopPropagation(); if (qOpen) closeQ(); else if (!G.paused && !busy) quests(); }
    else if (e.code === 'Escape' && qOpen) { e.stopPropagation(); closeQ(); } }, true);

  return { active: false, quests, step, cam, hud, talk, died, foesOf, start, menu, restart: () => start(false), hasSave: () => !!load(), get S() { return S; }, get q() { return cur(); }, get ents() { return ents; }, set qT(v) { qT = v; }, get busy() { return busy; } };
})();
