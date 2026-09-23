'use strict';
/* Shinjuku Showdown: fighters, techniques, summons, domains, AI, camera, cutscenes and menus. */
(function () {
  const $ = q => document.querySelector(q), rand = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => Math.max(a, Math.min(b, v)), pick = a => a[Math.random() * a.length | 0];
  const V3 = THREE.Vector3, UP = new V3(0, 1, 0), RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const { scene, camera } = WORLD, PX2U = 1.9 / 158, { OW: FW, OH, ATW, ATH } = SPR;

  /* =================== ROSTER =================== */
  const RO = {
    gojo: { name: 'Satoru Gojo', jp: '五条悟', title: 'The Strongest of Today', hp: 1300, spd: 11, fly: 1, range: 8, aura: '#62d6ff', infinity: 1, rct: 1, ceRegen: 10,
      passive: 'Infinity stops most damage but drains cursed energy. Reverse Cursed Technique shortens burnout after a domain.',
      moves: { k: { n: 'Lapse: Blue', kind: 'proj', cost: 15, cd: 2.4, dmg: 55, spd: 15, hom: 2.6, tex: 'orb', col: '#3a8cff', size: 1.5, pull: 1, stun: .5 },
        l: { n: 'Reversal: Red', kind: 'proj', cost: 22, cd: 4, dmg: 90, spd: 26, hom: 1, tex: 'orb', col: '#ff3040', size: 1.2, launch: 48, stun: .3, boom: 7 },
        i: { n: 'Hollow Purple', kind: 'beam', cost: 60, cd: 14, dmg: 250, w: 2.8, charge: .9, col: '#b45cff', len: 150, erase: 1, launch: 34 },
        o: { n: 'Unlimited Void', jp: '無量空処', kind: 'domain', dom: 'void', dur: 6.5, cost: 30 } } },
    sukuna: { name: 'Ryomen Sukuna', jp: '両面宿儺', title: 'King of Curses · Vessel', hp: 1400, spd: 10.5, fly: 1, range: 6, aura: '#ff2e4d', regen: 3, bf: .08, summon: 1,
      passive: 'Reverse Cursed Technique heals him. Summons Mahoraga (U); every turn of its wheel brings it closer to adapting to Infinity.',
      moves: { k: { n: 'Dismantle', kind: 'proj', cost: 10, cd: 1.1, dmg: 38, spd: 34, hom: .5, tex: 'slash', col: '#ff3a52', count: 3, spread: .14, cut: 1 },
        l: { n: 'Cleave', kind: 'blast', cost: 18, cd: 3.4, dmg: 105, r: 3, delay: .3, range: 10, launch: 24, col: '#ff2040' },
        i: { n: 'Divine Flame: Open', kind: 'beam', cost: 55, cd: 13, dmg: 230, w: 2.8, charge: 1, col: '#ff8a24', len: 130, fire: 1, launch: 36 },
        o: { n: 'Malevolent Shrine', jp: '伏魔御廚子', kind: 'domain', dom: 'shrine', dur: 6.5, cost: 30 },
        u: { n: 'Mahoraga', kind: 'summon', cost: 35, cd: 30 } } },
    yuji: { name: 'Yuji Itadori', jp: '虎杖悠仁', title: 'The Cog Who Stayed', hp: 1150, spd: 11.5, range: 2.5, aura: '#ff6a4a', bf: .2,
      passive: 'Black Flash: melee can deal 2.5× damage, and each one makes the next more likely.',
      moves: { k: { n: 'Divergent Fist', kind: 'strike', cost: 10, cd: 1.8, dmg: 55, range: 8, echo: 35, launch: 14, col: '#6ad0ff' },
        l: { n: 'Piercing Blood', kind: 'beam', cost: 20, cd: 4, dmg: 90, w: .9, charge: .35, col: '#d0142c', len: 80 },
        i: { n: 'Black Flash', kind: 'strike', cost: 40, cd: 9, dmg: 70, range: 10, bf: 1, launch: 40, col: '#ff2030' },
        o: { n: 'Domain Expansion', jp: '領域展開', kind: 'domain', dom: 'yuji', dur: 7, cost: 30 } } },
    yuta: { name: 'Yuta Okkotsu', jp: '乙骨憂太', title: 'Special Grade', hp: 1180, spd: 10.5, range: 6, aura: '#e8e0ff', ceRegen: 13,
      passive: 'Rika, the Queen of Curses, gives him a nearly bottomless reserve of cursed energy.',
      moves: { k: { n: 'Rika', kind: 'blast', cost: 14, cd: 2.2, dmg: 85, r: 3, delay: .45, range: 16, launch: 20, col: '#efe6ff' },
        l: { n: "Cursed Speech: Don't Move", kind: 'speech', cost: 18, cd: 6, dmg: 20, range: 14, stun: 1.3, self: 25, col: '#c0ffd8' },
        i: { n: 'Pure Love Beam', kind: 'beam', cost: 65, cd: 15, dmg: 280, w: 3, charge: 1.1, col: '#f4f0ff', len: 140, erase: 1, launch: 34 },
        o: { n: 'Authentic Mutual Love', jp: '真贋相愛', kind: 'domain', dom: 'love', dur: 6, cost: 30 } } },
    kashimo: { name: 'Hajime Kashimo', jp: '鹿紫雲一', title: 'The Thunder God', hp: 1100, spd: 12, range: 4, aura: '#8af0ff',
      passive: 'Electric cursed energy stuns on contact. Mythical Beast Amber can be used once per fight.',
      moves: { k: { n: 'Lightning', kind: 'proj', cost: 9, cd: .9, dmg: 42, spd: 38, hom: .5, tex: 'bolt', col: '#8af0ff', stun: .25 },
        l: { n: 'Staff Strike', kind: 'strike', cost: 12, cd: 2.5, dmg: 70, range: 7, launch: 26, col: '#8af0ff', stun: .2 },
        i: { n: 'Mythical Beast Amber', kind: 'buff', cost: 40, cd: 30, dur: 12, spd: 1.6, mul: 1.8, once: 1, col: '#bff6ff' } } },
    higuruma: { name: 'Hiromi Higuruma', jp: '日車寛見', title: 'The Judge', hp: 1100, spd: 10.5, range: 3, aura: '#f2d27a',
      passive: "Deadly Sentencing confiscates the enemy's techniques. A confiscated target takes 4× from the Executioner's Sword.",
      moves: { k: { n: 'Gavel', kind: 'strike', cost: 8, cd: 1.6, dmg: 65, range: 6, launch: 16, col: '#f2c25a' },
        l: { n: 'Gavel Toss', kind: 'proj', cost: 12, cd: 2.5, dmg: 55, spd: 20, hom: 1.5, tex: 'orb', col: '#f2c25a', size: 1.2 },
        i: { n: "Executioner's Sword", kind: 'strike', cost: 45, cd: 12, dmg: 120, range: 8, exec: 1, pierce: 1, launch: 30, col: '#f6e6a8' },
        o: { n: 'Deadly Sentencing', jp: '誅伏賜死', kind: 'domain', dom: 'judge', dur: 1.6, cost: 25 } } },
    maki: { name: "Maki Zen'in", jp: '禪院真希', title: 'Heavenly Restriction', hp: 1120, spd: 13, range: 3, aura: '#9affc8', hr: 1, ceRegen: 16,
      passive: 'No cursed energy at all: domains cannot lock onto her. Her bar is stamina, and it refills fast.',
      moves: { k: { n: 'Split Soul Katana', kind: 'strike', cost: 12, cd: 2.2, dmg: 80, range: 8, pierce: 1, noGuard: 1, col: '#dff6ff' },
        l: { n: 'Dragon-Bone', kind: 'strike', cost: 14, cd: 3.5, dmg: 70, range: 5, launch: 42, stun: .3, col: '#ffd070' },
        i: { n: 'Heavenly Rush', kind: 'strike', cost: 40, cd: 10, dmg: 34, range: 10, hits: 5, iv: .14, pierce: 1, col: '#9affc8' } } },
    todo: { name: 'Aoi Todo', jp: '東堂葵', title: 'Best Friend', hp: 1250, spd: 10.5, range: 3, aura: '#ffb04a', bf: .1,
      passive: 'Boogie Woogie: his vibraslap swaps places with the enemy. Higher Black Flash odds.',
      moves: { k: { n: 'Boogie Woogie', kind: 'swap', cost: 10, cd: 2.5, stun: .7, col: '#ffb04a' },
        l: { n: 'Brute Punch', kind: 'strike', cost: 12, cd: 2.5, dmg: 80, range: 6, launch: 36, col: '#ffb04a' },
        i: { n: 'Black Flash', kind: 'strike', cost: 40, cd: 9, dmg: 75, range: 9, bf: 1, launch: 44, col: '#ff2030' } } },
    geto: { name: 'Suguru Geto', jp: '夏油傑', title: 'Curse Manipulator', hp: 1250, spd: 10.5, fly: 1, range: 8, aura: '#a88ad8', ceRegen: 11,
      passive: 'Cursed Spirit Manipulation: he fights with the curses he has swallowed. U calls Kuchisake-onna, whose question freezes anyone near her.',
      moves: { k: { n: 'Curse Swarm', kind: 'proj', cost: 12, cd: 1.6, dmg: 30, spd: 18, hom: 2, tex: 'curse', col: '#6a4a8a', count: 4, spread: .22, size: 1.2 },
        l: { n: 'Rainbow Dragon', kind: 'proj', cost: 22, cd: 5, dmg: 95, spd: 22, hom: 1.4, tex: 'dragon', col: '#9adfc8', size: 2.4, launch: 36, boom: 5 },
        i: { n: 'Maximum: Uzumaki', kind: 'beam', cost: 60, cd: 14, dmg: 260, w: 3.2, charge: 1.1, col: '#7a4ab0', len: 140, launch: 36 },
        u: { n: 'Kuchisake-onna', kind: 'summon', sum: 'kuchisake', cost: 30, cd: 25 } } },
    maki0: { name: "Maki Zen'in", jp: '禪院真希', title: 'Second Year · 2017', hp: 950, spd: 12.5, range: 3.5, aura: '#b8e8c8', hr: 1, ceRegen: 15,
      passive: 'Heavenly Restriction: no cursed energy, so domains cannot lock onto her. A cursed-tool spear and a lot of nerve.',
      moves: { k: { n: 'Spear Thrust', kind: 'strike', cost: 10, cd: 1.8, dmg: 62, range: 9, pierce: 1, col: '#dff6ff' },
        l: { n: 'Pole Sweep', kind: 'strike', cost: 14, cd: 3.2, dmg: 60, range: 5, launch: 38, stun: .3, col: '#ffd070' },
        i: { n: 'Cursed Tool Flurry', kind: 'strike', cost: 38, cd: 10, dmg: 30, range: 10, hits: 4, iv: .15, pierce: 1, col: '#b8e8c8' } } },
    // summons (swing = their one attack; intro = the banner when they arrive)
    mahoraga: { name: 'Mahoraga', jp: '魔虚羅', title: 'Divine General', hp: 700, spd: 9, fly: 1, range: 3, aura: '#f0c850', scale: 1.45, moves: {},
      swing: { range: 5, dmg: 70, launch: 30, col: '#f0c850', pose: 'cross', n: 'mahoraga' },
      intro: ['八握剣異戒神将魔虚羅', 'Divine General Mahoraga', 'The wheel turns each time it is struck, and each time Infinity blocks a blow.'] },
    rika: { name: 'Rika Orimoto', jp: '祈本里香', title: 'Queen of Curses', hp: 650, spd: 10, fly: 1, range: 3.5, aura: '#e8e0ff', scale: 1.6, moves: {},
      swing: { range: 6, dmg: 80, launch: 38, col: '#efe6ff', pose: 'cross', n: 'Rika' },
      intro: ['祈本里香 · 完全顕現', 'Rika: Full Manifestation', 'The Queen of Curses. Pure Love hits half again as hard while she is here.'] },
    kuchisake: { name: 'Kuchisake-onna', jp: '口裂け女', title: 'Slit-Mouthed Woman', hp: 380, spd: 9.5, range: 2.5, aura: '#c8a8b8', scale: 1.05, moves: {},
      swing: { range: 4, dmg: 42, stun: .5, col: '#e0c0d0', pose: 'jab1', n: 'Scissors' },
      intro: ['口裂け女', 'Kuchisake-onna', '"Am I pretty?" Anyone near her freezes until they answer.'] }
  };
  RO.yuta.moves.u = { n: 'Rika', kind: 'summon', sum: 'rika', cost: 30, cd: 28 };
  RO.yuta.passive = 'Rika, the Queen of Curses, gives him a nearly bottomless reserve of cursed energy. U manifests her; Pure Love hits harder while she is here.';
  RO.gojo0 = Object.assign({}, RO.gojo, { title: 'The Strongest · 2017', moves: Object.assign({}, RO.gojo.moves) });
  // Yuta's mind in Gojo's body (ch. 261): Gojo's techniques, but the body only accepts him for so long
  RO.yutag = Object.assign({}, RO.gojo, { name: 'Yuta Okkotsu', jp: '乙骨憂太', title: "In Gojo's Body", hp: 1150, aura: '#9adfff', body: 100,
    passive: "Gojo's Six Eyes, Infinity and Limitless, borrowed. After 100 seconds the body rejects him and he loses health fast.",
    moves: { k: RO.gojo.moves.k, l: RO.gojo.moves.l, i: RO.gojo.moves.i } });
  RO.sukunah = Object.assign({}, RO.sukuna, { name: 'Ryomen Sukuna', title: 'King of Curses · True Form', hp: 1500, spd: 11.5, bf: .1, moves: Object.assign({}, RO.sukuna.moves) });
  const WORLD_SLASH = { n: 'World-Cutting Slash', kind: 'beam', cost: 25, cd: 5, dmg: 220, w: 1.4, charge: .45, col: '#ffffff', len: 160, pierce: 1, world: 1, launch: 30 };
  const PLAYABLE = ['gojo', 'sukuna', 'sukunah', 'yuji', 'yuta', 'yutag', 'kashimo', 'higuruma', 'maki', 'todo', 'geto', 'gojo0', 'maki0'];
  const summonOf = k => RO[k].moves.u && (RO[k].moves.u.sum || 'mahoraga');

  /* =================== ASSETS =================== */
  // sprite atlases are drawn on demand (SPR caches them); menus only need the small thumbnails
  const THUMB = {}, thumb = k => THUMB[k] || (THUMB[k] = SPR.thumb(k));
  function nearestTex(c) { const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; return t; }
  const FXT = {};
  function fxTex(kind, col) { const key = kind + col; if (FXT[key]) return FXT[key]; const S = 32, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), P = (x, y, cl) => { g.fillStyle = cl; g.fillRect(x, y, 1, 1); };
    if (kind === 'glow' || kind === 'orb') { for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const d = Math.hypot(x - 15.5, y - 15.5) / 16; if (d > 1) continue; g.globalAlpha = kind === 'orb' ? (d < .35 ? 1 : d < .6 ? .9 : d < .8 ? .5 : .2) : Math.round(Math.pow(1 - d, 1.6) * 5) / 5; P(x, y, kind === 'orb' && d < .35 ? '#fff' : col); } }
    else if (kind === 'slash') { for (let a = -1.2; a <= 1.2; a += .02) { const t = 1 - Math.abs(a) / 1.2, th = Math.max(1, t * 5); for (let r = 11; r < 11 + th; r++) P(Math.round(10 + Math.cos(a) * r), Math.round(16 + Math.sin(a) * r), r < 11 + th * .5 ? '#fff' : col); } }
    else if (kind === 'bolt') { let x = 2, y = 16; while (x < 30) { const ny = clamp(y + rand(-4, 4) | 0, 6, 26); for (let i = 0; i <= 3; i++) { const px = x + i, py = Math.round(y + (ny - y) * i / 3); P(px, py, '#fff'); P(px, py - 1, col); P(px, py + 1, col); } x += 3; y = ny; } }
    else if (kind === 'spark') { g.fillStyle = col; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, l = i % 2 ? 8 : 15; for (let r = 2; r < l; r++) g.fillRect(Math.round(16 + Math.cos(a) * r), Math.round(16 + Math.sin(a) * r), 1, 1); } g.fillStyle = '#fff'; g.fillRect(14, 14, 4, 4); }
    else if (kind === 'bf') { for (let k = 0; k < 7; k++) { let x = 16, y = 16, a = rand(0, 6.28); for (let s = 0; s < 7; s++) { a += rand(-.8, .8); g.fillStyle = '#ff1030'; g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3); g.fillStyle = '#000'; g.fillRect(Math.round(x), Math.round(y), 1, 1); x += Math.cos(a) * 2.4; y += Math.sin(a) * 2.4; } } }
    else if (kind === 'curse') { for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const d = Math.hypot(x - 15.5, (y - 15.5) * 1.15) / 11 + Math.sin(Math.atan2(y - 16, x - 16) * 5) * .12; if (d > 1) continue; P(x, y, d > .8 ? col : d > .5 ? '#2a1a36' : '#140a1c'); }
      g.fillStyle = '#ffe24a'; for (const [x, y] of [[11, 13], [19, 12], [15, 17]]) g.fillRect(x, y, 2, 2); g.fillStyle = '#e8e0ff'; g.fillRect(12, 21, 8, 1); }
    else if (kind === 'dragon') { const hue = ['#ff5a5a', '#ffb04a', '#ffe24a', '#6adf7a', '#5ab0ff', '#9a7aff']; for (let i = 0; i < 16; i++) { const t = i / 15; g.fillStyle = hue[i % 6]; g.beginPath(); g.arc(4 + t * 20, 16 + Math.sin(t * 6.3) * 7, 2.2 + t * 1.6, 0, 7); g.fill(); }
      g.fillStyle = '#e8f0e0'; g.beginPath(); g.moveTo(24, 10); g.lineTo(31, 16); g.lineTo(24, 22); g.fill(); g.fillStyle = '#ff2020'; g.fillRect(26, 14, 2, 2); }
    else if (kind === 'ring') { for (let a = 0; a < 6.28; a += .02) { P(Math.round(16 + Math.cos(a) * 14), Math.round(16 + Math.sin(a) * 14), col); g.globalAlpha = .4; P(Math.round(16 + Math.cos(a) * 12), Math.round(16 + Math.sin(a) * 12), col); g.globalAlpha = 1; } }
    return FXT[key] = nearestTex(c); }
  const WHEEL = nearestTex(SPR.wheel());

  /* =================== FX =================== */
  const FX = [], PR = [], FT = []; let EV = [];
  const later = (t, fn) => EV.push({ t, fn });
  function fxSprite(tex, pos, scale, life, o = {}) { const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: !!o.normal, blending: o.normal ? THREE.NormalBlending : THREE.AdditiveBlending, fog: false, rotation: o.rot || 0 });
    const s = new THREE.Sprite(m); s.position.copy(pos); s.scale.set(scale, scale, 1); scene.add(s); FX.push({ o: s, life, max: life, s0: scale, grow: o.grow ?? 1.2 }); return s; }
  function spark(pos, col, n = 1) { for (let i = 0; i < n; i++) fxSprite(fxTex('spark', col), pos.clone().add(new V3(rand(-.3, .3), rand(-.3, .3), rand(-.3, .3))), rand(1, 1.8), .22, { rot: rand(0, 3), grow: .8 }); }
  function ring(pos, col, r, life) { const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: fxTex('ring', col), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    m.rotation.x = -Math.PI / 2; m.position.copy(pos); m.position.y = Math.max(.1, pos.y); m.scale.set(r, r, r); scene.add(m); FX.push({ o: m, life, max: life, s0: r, grow: .15, mesh: 1 }); }
  function flash(col, a = .6) { if (RM) a *= .3; const f = $('#flash'); f.style.transition = 'none'; f.style.background = col; f.style.opacity = a; requestAnimationFrame(() => { f.style.transition = 'opacity .35s'; f.style.opacity = 0; }); }
  let shakeA = 0, hitstop = 0, slowmo = 1;
  const shake = a => { if (!RM) shakeA = Math.max(shakeA, Math.min(a, 1.4)); };
  function floatText(pos, text, col = '#fff', big = false) { const el = document.createElement('div'); el.className = 'ft' + (big ? ' big' : ''); el.textContent = text; el.style.color = col; $('#floats').appendChild(el);
    FT.push({ el, pos: pos.clone(), life: big ? 1.4 : .8, max: big ? 1.4 : .8 }); }
  let bannerT = null;
  function banner(jp, big, sub = '', ms = 1400, col) { const b = $('#banner'); b.innerHTML = (jp ? `<div class="jp">${jp}</div>` : '') + `<div class="big" style="color:${col || 'var(--bone)'}">${big}</div>` + (sub ? `<div class="sub">${sub}</div>` : '');
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); b.hidden = false; clearTimeout(bannerT); bannerT = setTimeout(() => b.hidden = true, ms); }
  function afterimage(f) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: f.tex, transparent: true, opacity: .45, depthWrite: false, color: new THREE.Color(f.d.aura) }));
    s.center.copy(f.spr.center); s.scale.copy(f.spr.scale); s.position.copy(f.spr.position); scene.add(s); FX.push({ o: s, life: .25, max: .25, s0: f.spr.scale.x, grow: 0, ghost: 1 }); }

  /* =================== FIGHTERS =================== */
  const shadowTex = fxTex('glow', '#000000');
  // sprites are lit by the sun/moon through their normal-map atlas, so they sit in the scene's light instead of on top of it
  const LIT = { L: { value: new V3(0, 0, 1) }, sun: { value: new THREE.Color() }, amb: { value: new THREE.Color() }, rim: { value: new THREE.Color() }, mix: { value: .75 } };
  function litMat(tex, ntex, flip) { const m = new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: .5 });
    m.onBeforeCompile = sh => { Object.assign(sh.uniforms, { uN: { value: ntex }, uFlip: flip, uL: LIT.L, uSun: LIT.sun, uAmb: LIT.amb, uRim: LIT.rim, uMix: LIT.mix });
      sh.fragmentShader = 'uniform sampler2D uN; uniform float uFlip, uMix; uniform vec3 uL, uSun, uAmb, uRim;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        vec3 nn = texture2D(uN, vUv).xyz * 2. - 1.; nn.x *= uFlip; nn = normalize(nn + vec3(0., 0., .02));
        vec3 lit = uAmb + uSun * max(dot(nn, uL), 0.);
        float rim = pow(1. - clamp(nn.z, 0., 1.), 3.) * max(dot(normalize(nn.xy + 1e-4), normalize(uL.xy + 1e-4)), 0.);
        diffuseColor.rgb = diffuseColor.rgb * mix(vec3(1.), lit, uMix) + uRim * rim;`); };
    m.customProgramCacheKey = () => 'litSprite'; return m; }
  function updateLit() { const T = WORLD.TOD, md = WORLD.mood, s = md ? [.3, .6, .75] : T.sun;
    LIT.L.value.set(s[0], Math.max(.2, s[1]), s[2]).normalize().transformDirection(camera.matrixWorldInverse);
    LIT.sun.value.set(md ? '#ffffff' : T.sunC).multiplyScalar((md ? .9 : T.sunI) * .72); LIT.amb.value.set(md ? '#c0b8d0' : T.hs).multiplyScalar(.42).addScalar(.3);
    LIT.rim.value.set(md ? '#ffffff' : T.sunC).multiplyScalar(.4); }
  class Fighter {
    constructor(key, pos, isP, owner) {
      const d = this.d = RO[key]; this.k = key; this.isP = isP; this.owner = owner || null;
      this.pos = new V3(...pos); this.vel = new V3(); this.kb = new V3(); this.maxhp = d.hp; this.hp = this.trail = d.hp; this.ce = 100; this.dm = 0;
      this.cd = { j: 0, k: 0, l: 0, i: 0, o: 0, u: 0, e: 0 };
      this.hurt = this.stun = this.poseT = this.comboT = this.conf = this.slow = this.dash = this.inv = this.bfBonus = this.launched = this.burn = 0;
      this.combo = 0; this.face = 1; this.pose = 'idle0'; this.buff = null; this.charge = null; this.lunge = null; this.used = false; this.dead = false; this.guard = false;
      this.mv = Object.assign({}, d.moves); this.ai = { t: 1, strafe: 1 }; this.summons = []; this.adaptPts = 0; this.adapted = false; this.lastBark = -9; this.animT = rand(0, 3); this.scale = d.scale || 1;
      const A = this.A = SPR.build(d.spr || key), tx = c => { const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapNearestFilter; return t; };
      this.tex = tx(A.canvas); this.ntex = tx(A.ncanvas); this.flip = { value: 1 };
      this.spr = new THREE.Sprite(litMat(this.tex, this.ntex, this.flip));
      this.sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: .6, depthWrite: false })); this.sh.rotation.x = -Math.PI / 2;
      this.aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: fxTex('glow', d.aura), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      for (const o of [this.spr, this.sh, this.aura]) o.userData.keep = 1;
      scene.add(this.aura, this.spr, this.sh);
      if (key === 'mahoraga') { this.wheel = new THREE.Sprite(new THREE.SpriteMaterial({ map: WHEEL, transparent: true, alphaTest: .5 })); this.wheel.userData.keep = 1; this.wheelA = 0; this.wheelT = 0; scene.add(this.wheel); this.adaptMap = {}; }
      this.setFrame('idle0', 1);
    }
    remove() { scene.remove(this.spr, this.sh, this.aura); if (this.wheel) scene.remove(this.wheel); if (this.charge) scene.remove(this.charge.orb); this.tex.dispose(); this.ntex.dispose(); this.spr.material.dispose(); }
    center() { return this.pos.clone().add(new V3(0, (this.dead ? .45 : 1.1) * this.scale, 0)); }
    get foe() { return this.owner ? this.owner.opp : this.opp; }
    setFrame(name, face) {
      // atlas: 26 frames of OW x OH along the top row; the lying-down frame (OH x OH) under the first ones
      const t = this.tex, s = PX2U * this.scale, f = face > 0 ? 1 : -1; this.flip.value = f;
      if (name === 'down') { t.repeat.set(f * OH / ATW, OH / ATH); t.offset.set(f > 0 ? 0 : OH / ATW, 0); this.spr.center.set(.5, 8 / OH); this.spr.scale.set(OH * s, OH * s, 1); return; }
      const i = this.A.frames[name]; t.repeat.set(f * FW / ATW, OH / ATH); t.offset.set((i + (f > 0 ? 0 : 1)) * FW / ATW, 1 - OH / ATH);
      this.spr.center.set(f > 0 ? SPR.PXO / FW : 1 - SPR.PXO / FW, (OH - SPR.GYO) / OH); this.spr.scale.set(FW * s, OH * s, 1);
    }
    update(dt, I, o) {
      for (const k in this.cd) this.cd[k] = Math.max(0, this.cd[k] - dt);
      this.hurt -= dt; this.stun -= dt; this.poseT -= dt; this.comboT -= dt; this.conf -= dt; this.slow -= dt; this.dash -= dt; this.inv -= dt; this.burn -= dt; this.animT += dt;
      const prevY = this.pos.y;
      if (this.dead) { this.pos.addScaledVector(this.kb, dt); this.kb.multiplyScalar(Math.pow(.05, dt)); this.pos.y = Math.max(WORLD.surfaceY(this.pos.x, this.pos.z, this.pos.y), this.pos.y - 14 * dt); return; }
      this.ce = Math.min(100, this.ce + (this.d.ceRegen || 9) * dt);
      if (this.d.regen) this.hp = Math.min(this.maxhp, this.hp + this.d.regen * dt);
      if (this.d.body && G.mode === 'fight') { this.bodyT = (this.bodyT ?? this.d.body) - dt;
        if (this.bodyT < 0) { this.hp -= 40 * dt; if (this.hp <= 0) { KO(this.opp, this); return; } } }
      if (this.buff && (this.buff.t -= dt) <= 0) this.buff = null;
      if (this.charge) { const c = this.charge; c.t -= dt; if (c.t > c.m.charge * .35) c.aim = o.center();
        c.orb.position.copy(this.center()).add(new V3(0, .3, 0)).addScaledVector(camRight, this.face * .9); c.orb.scale.setScalar(.6 + (c.big ? 4 : 2.6) * (1 - c.t / c.m.charge));
        if (c.t <= 0) { scene.remove(c.orb); this.charge = null; fireBeam(this, o, c.m, c.aim, c.big); } }
      const can = this.hurt <= 0 && this.stun <= 0 && !this.charge && this.launched <= 0 && !clash;
      if (this.launched > 0) {
        this.launched -= dt; this.kb.y -= 15 * dt; this.pos.addScaledVector(this.kb, dt); this.kb.multiplyScalar(Math.pow(.3, dt));
        if (Math.random() < .45) afterimage(this);
        const r = WORLD.collide(this.pos, .6, prevY);
        if (r && !r.landed) { const sp = this.kb.length(); if (sp > 13) crashInto(this, r.b, sp); this.kb.multiplyScalar(.12); }
        const sy = WORLD.surfaceY(this.pos.x, this.pos.z, this.pos.y + 1);
        if (this.pos.y <= sy + .05 && this.kb.y < -9) { groundSlam(this); this.kb.y *= -.25; this.kb.x *= .45; this.kb.z *= .45; }
        if (this.kb.length() < 5 || this.launched <= 0) { this.launched = 0; this.hurt = Math.max(this.hurt, .2); }
      } else if (this.lunge) { const L = this.lunge; L.t += dt; this.pos.lerpVectors(L.from, L.to, Math.min(1, L.t / L.T)); if (L.trail && Math.random() < .7) afterimage(this); if (L.t >= L.T) this.lunge = null; }
      else {
        const spd = this.d.spd * (this.buff ? this.buff.spd : 1) * (this.slow > 0 ? .5 : 1) * (this.guard ? .35 : 1) * (I.sprint ? 1.6 : 1);
        const want = can ? I.mv.clone().multiplyScalar(spd) : new V3();
        if (this.dash > 0) want.copy(this.dashDir).multiplyScalar(30);
        this.vel.lerp(want, Math.min(1, dt * 12)); this.pos.addScaledVector(this.vel, dt);
        const sy = WORLD.surfaceY(this.pos.x, this.pos.z, this.pos.y + .3);
        if (this.d.jumper) {   // no flying: gravity, jumps, and running up walls while holding jump against them
          const ground = this.pos.y <= sy + .05; this.vy = (this.vy || 0) - 32 * dt; if (ground && this.vy < 0) { this.vy = 0; this.pos.y = sy; }
          if (can && I.jump && ground) { this.vy = 15; AUDIO.sfx('whoosh', .35); } else if (can && I.jump && this.wall > 0 && this.vy < 9) this.vy = 9;
          this.pos.y += this.vy * dt; this.wall = (this.wall || 0) - dt; }
        else if (can && I.my) this.pos.y += I.my * spd * .85 * dt; else if (!this.d.fly && this.pos.y > sy) this.pos.y = Math.max(sy, this.pos.y - 7 * dt);
        if (this.dash > 0 && Math.random() < .5) afterimage(this);
        this.pos.addScaledVector(this.kb, dt); this.kb.multiplyScalar(Math.pow(.02, dt));
      }
      const hitW = WORLD.collide(this.pos, .55, prevY); if (hitW && !hitW.landed) this.wall = .15;
      const sy = WORLD.surfaceY(this.pos.x, this.pos.z, this.pos.y + .3); if (this.pos.y < sy) this.pos.y = sy;
      const M = WORLD.MAP; this.pos.x = clamp(this.pos.x, M.x0 + 5, M.x1 - 5); this.pos.z = clamp(this.pos.z, M.z0 + 5, M.z1 - 5); const top = M.ceil ? M.ceil - 1.9 : 135; if (this.pos.y > top) { this.pos.y = top; if (this.vy > 0) this.vy = 0; } if (this.pos.y < 0) this.pos.y = 0;
      this.guard = !!I.guard && can;
      if (can && I.act) this.act(I.act, o);
    }
    msg(t) { if (this.isP) floatText(this.center().add(new V3(0, 1.7, 0)), t, '#a99fb8'); }
    bark(key, force) { if (!force && G.time - this.lastBark < 2.2) return; this.lastBark = G.time; AUDIO.say('b_' + (d0 => d0.bark || d0.spr || this.k)(this.d) + '_' + key, { cut: false, vol: this.isP ? 1 : .85 }); }
    act(a, o) {
      const tgt = aimTarget(this);
      if (a === 'j') { if (this.cd.j > 0) return; this.combo = this.comboT > 0 ? (this.combo + 1) % 3 : 0; this.comboT = .7; this.cd.j = this.combo === 2 ? .45 : .26;
        const mul = this.d.hr ? 1.3 : 1; KIND.strike(this, tgt, { range: 4.5, dmg: [28, 28, 46][this.combo] * mul, launch: this.combo === 2 ? 20 : 0, kb: 2, col: '#ffffff', pose: ['jab1', 'cross', 'kick1'][this.combo] }); return; }
      if (a === 'e') { if (this.cd.e > 0) return; const dist = this.pos.distanceTo(tgt.pos);
        if ((dist > 13 || tgt.launched > 0) && this.ce >= 10) { this.ce -= 10; this.cd.e = .8; const dir = tgt.pos.clone().sub(this.pos).normalize(), dest = tgt.pos.clone().addScaledVector(dir, -2.6).add(tgt.launched > 0 ? tgt.kb.clone().multiplyScalar(.15) : new V3());
          this.lunge = { from: this.pos.clone(), to: dest, t: 0, T: clamp(dist / 140, .12, .45), trail: 1 }; this.inv = .3; AUDIO.sfx('whoosh'); return; }
        if (this.ce < 6) return; this.ce -= 6; this.cd.e = .55; this.dash = .18; this.inv = .2; AUDIO.sfx('whoosh', .6);
        this.dashDir = this.vel.lengthSq() > 1 ? this.vel.clone().setY(0).normalize() : this.pos.clone().sub(tgt.pos).setY(0).normalize(); return; }
      const m = this.mv[a]; if (!m) return;
      if (this.cd[a] > 0) return;
      if (this.conf > 0) { this.msg('CONFISCATED'); return; }
      if (this.burn > 0 && a !== 'u') { this.msg('Technique burned out'); return; }
      if (a === 'o' && this.dm < 100) { this.msg('Domain meter not full'); return; }
      if (m.once && this.used) { this.msg('Already used'); return; }
      if (a === 'u' && this.summons.some(s => !s.dead)) { this.msg(RO[m.sum || 'mahoraga'].name + ' is already here'); return; }
      const cost = this.buff && this.buff.free ? 0 : m.cost;
      if (this.ce < cost) { this.msg(this.d.hr ? 'Out of stamina' : 'Not enough cursed energy'); return; }
      this.ce -= cost; this.cd[a] = m.cd; if (m.once) this.used = true;
      this.pose = a === 'i' ? 'castC' : a === 'o' ? 'sign' : a === 'k' ? 'castA' : 'castB'; this.poseT = .4;
      const big = a === 'i' && this.first200; if (big) this.first200 = false;
      this.bark(m.world ? 'world' : big ? 'i200' : a, a === 'o' || a === 'u' || a === 'i');
      KIND[m.kind](this, tgt, m, big);
    }
    visual(t) {
      const f = this; let p;
      if (f.dead) p = 'down'; else if (f.launched > 0) p = 'launch'; else if (f.hurt > 0 || f.stun > 0) p = 'hurt'; else if (f.charge) p = 'castC';
      else if (f.poseT > 0) p = f.pose; else if (f.guard) p = 'guard'; else if (f.dash > 0 || f.lunge) p = 'dash';
      else { const sy = WORLD.surfaceY(f.pos.x, f.pos.z, f.pos.y + .3), sp = f.vel.length(), air = f.pos.y > sy + .6;
        if (air) p = sp > 9 ? 'dash' : (f.animT * 2 % 2 < 1 ? 'fly0' : 'fly1'); else if (sp > 2) p = 'run' + ((f.animT * sp * .9 | 0) % 6); else p = 'idle' + ((f.animT * 3 | 0) % 4); }
      if (f.k === 'mahoraga' && !f.dead && p.startsWith('run')) p = 'run' + ((f.animT * 6 | 0) % 6);
      f.setFrame(p, f.face);
      f.spr.position.copy(f.pos); if (!f.dead && (p === 'fly0' || p === 'fly1')) f.spr.position.y += Math.sin(t * 3 + f.pos.x) * .08;
      f.spr.material.color.set(f.inv > 0 && !f.dead ? '#bfe8ff' : (f.hurt > 0 && (t * 20 | 0) % 2) ? '#ff9090' : '#ffffff');
      const sy = WORLD.surfaceY(f.pos.x, f.pos.z, f.pos.y + .3); f.sh.position.set(f.pos.x, sy + .06, f.pos.z); const ss = 1.9 * f.scale * Math.max(.25, 1 - (f.pos.y - sy) / 16); f.sh.scale.set(ss, ss * .6, 1);
      f.aura.position.copy(f.center()); const hot = G.mode !== 'cut' && (f.charge || f.buff || (domain && domain.owner === f) || (f.poseT > 0 && f.pose !== 'jab1'));
      f.aura.material.opacity = f.dead ? 0 : (hot ? .55 : G.mode === 'cut' ? .06 : .12) + Math.sin(t * 6) * .04; f.aura.scale.setScalar((hot ? 4.4 : 3) * f.scale);
      if (f.wheel) { f.wheelA += (f.wheelT - f.wheelA) * Math.min(1, .06 + 0); f.wheel.material.rotation = f.wheelA; f.wheel.position.copy(f.pos).add(new V3(0, 4.6, 0)); f.wheel.scale.setScalar(f.dead ? 0 : 2.2); }
    }
  }

  /* =================== COMBAT =================== */
  const foes = f => { if (G.mode === 'ow' || G.mode === 'cut' && window.OW && OW.active) return OW.foesOf(f); const o = f.owner ? f.owner.opp : f.opp; if (!o) return []; return [o, ...o.summons.filter(s => !s.dead)]; };
  function aimTarget(f) { const list = foes(f); let best = list[0], bd = best ? best.pos.distanceTo(f.pos) : 1e9; for (const s of list.slice(1)) { const d = s.pos.distanceTo(f.pos); if (d < bd * .6) { best = s; bd = d; } } return best || f; }
  const KIND = {
    proj(f, o, m) { const n = m.count || 1; for (let i = 0; i < n; i++) { const dir = o.center().sub(f.center()).normalize().applyAxisAngle(UP, (i - (n - 1) / 2) * (m.spread || 0));
        const s = fxSprite(fxTex(m.tex, m.col), f.center().addScaledVector(dir, .9), 1.5 * (m.size || 1), 99, { grow: 0, normal: m.tex === 'curse' || m.tex === 'dragon' }); if (m.tex !== 'orb') s.material.rotation = rand(-.4, .4);
        PR.push({ o: s, own: f, tgt: o, m, vel: dir.multiplyScalar(m.spd), life: 3, cuts: 0, last: s.position.clone() }); }
      AUDIO.sfx(m.tex === 'slash' ? 'slash' : m.tex === 'bolt' ? 'zap' : 'charge'); },
    strike(f, o, m) { const to = o.pos.clone().sub(f.pos), d = to.length(), go = Math.min(Math.max(0, d - 1.3), m.range || 2.5);
      f.lunge = { from: f.pos.clone(), to: f.pos.clone().add(to.normalize().multiplyScalar(go)), t: 0, T: go > 5 ? .16 : .1, trail: go > 5 }; f.pose = m.pose || 'jab1'; f.poseT = .3 + (m.hits || 1) * (m.iv || 0);
      const hits = m.hits || 1;
      for (let h = 0; h < hits; h++) later(.12 + h * (m.iv || 0), () => { if (f.dead || o.dead) return;
        if (h > 0) { afterimage(f); const a = rand(0, 6.28); f.lunge = null; f.pos.set(o.pos.x + Math.cos(a) * 1.5, o.pos.y, o.pos.z + Math.sin(a) * 1.5); f.pose = pick(['jab1', 'cross', 'kick1']); }
        for (const t of foes(f)) if (f.pos.distanceTo(t.pos) < 2.9 * Math.max(1, t.scale)) { let dmg = m.dmg; if (m.exec && t.conf > 0) { dmg *= 4; banner('死刑', 'DEATH PENALTY', "The Executioner's Sword falls", 1400, '#f6e6a8'); flash('#fff6d0', .7); }
          if (damage(f, t, dmg, { melee: 1, bf: m.bf, kb: m.kb, launch: m.launch, pierce: m.pierce, noGuard: m.noGuard, stun: m.stun, kind: m.n || 'melee' })) spark(t.center(), m.col, 2); } });
      if (m.echo) later(.42, () => { for (const t of foes(f)) if (!t.dead && f.pos.distanceTo(t.pos) < 3.4 && damage(f, t, m.echo, { kb: 6, kind: m.n })) spark(t.center(), m.col, 3); }); },
    blast(f, o, m) { const to = o.pos.clone().sub(f.pos), p = f.pos.clone().add(to.clampLength(0, m.range)); p.y = o.pos.y; ring(p, m.col, m.r, m.delay + .1);
      later(m.delay, () => { const c = p.clone().add(new V3(0, 1, 0)); fxSprite(fxTex('glow', m.col), c, m.r * 1.9, .35, { grow: .6 }); spark(c, m.col, 4); AUDIO.sfx('heavy'); shake(.4);
        for (const b of WORLD.within(p, m.r + 4)) if (f.k.startsWith('sukuna')) WORLD.cutB(b, p.y + rand(2, 8)); else WORLD.hitB(b, 60, c);
        for (const t of foes(f)) if (t.pos.distanceTo(p) < m.r + .8) damage(f, t, m.dmg, { launch: m.launch, stun: m.stun, kind: m.n }); }); },
    beam(f, o, m, big) { const orb = fxSprite(fxTex('glow', m.col), f.center(), .6, 99, { grow: 0 }); f.charge = { t: m.charge * (big ? 1.3 : 1), m, aim: o.center(), orb, big }; AUDIO.sfx('charge'); },
    buff(f, o, m) { f.buff = { t: m.dur, spd: m.spd, dmg: m.mul, free: 1 }; banner('幻獣琥珀', m.n, 'Speed and power surge. Techniques cost nothing.', 1600, m.col); flash(m.col, .5); AUDIO.sfx('zap'); },
    speech(f, o, m) { floatText(f.center().add(new V3(0, 1.8, 0)), '「動くな」 Don\'t move.', m.col, true); f.hp = Math.max(1, f.hp - m.self); ring(f.pos.clone(), m.col, m.range, .5);
      for (const t of foes(f)) if (f.pos.distanceTo(t.pos) < m.range) damage(f, t, m.dmg, { stun: m.stun, noGuard: 1, kind: m.n }); },
    swap(f, o, m) { AUDIO.sfx('clap'); floatText(f.center().add(new V3(0, 1.6, 0)), 'CLAP!', '#ffb04a', true); const a = f.pos.clone(); f.pos.copy(o.pos); o.pos.copy(a); f.lunge = o.lunge = null;
      spark(f.center(), m.col, 3); spark(o.center(), m.col, 3); o.stun = Math.max(o.stun, m.stun); f.poseT = 0; },
    domain(f, o, m) { expand(f, o, m); },
    summon(f, o, m) { const k = m.sum || 'mahoraga', d = RO[k], p = f.pos.clone().add(new V3(rand(-3, 3), 0, rand(-3, 3))), s = new Fighter(k, [p.x, p.y, p.z], false, f); f.summons.push(s); G.extra.push(s);
      banner(...d.intro, 2400, d.aura); flash(d.aura, .5); shake(.6); AUDIO.sfx(k === 'mahoraga' ? 'wheel' : 'expand', .7);
      if (k === 'kuchisake') { floatText(s.center().add(new V3(0, 1.6, 0)), '「わたし、きれい？」 Am I pretty?', '#e0c0d0', true); for (const t of foes(f)) if (t.pos.distanceTo(s.pos) < 10) t.stun = Math.max(t.stun, 1.4); }
      for (let i = 0; i < 8; i++) WORLD.dustAt(p.clone().add(new V3(rand(-4, 4), rand(0, 2), rand(-4, 4))), rand(5, 9), 0x2a1a30); }
  };
  function fireBeam(f, o, m, aim, big) {
    if (f.dead) return; const rika = f.k === 'yuta' && f.summons.some(s => !s.dead && s.k === 'rika'), mul = (big ? 2 : 1) * (rika ? 1.5 : 1);
    const org = f.center(), dir = aim.clone().sub(org).normalize(), len = m.len || 60, w = m.w * (big ? 1.7 : 1) * (rika ? 1.4 : 1);
    const grp = new THREE.Group(), geo = new THREE.CylinderGeometry(.5, .5, 1, 12, 1, true);
    const outer = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: m.col, transparent: true, opacity: .75, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    const core = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    outer.scale.set(w, len, w); core.scale.set(w * .4, len, w * .4); grp.add(outer, core); grp.userData.keep = 1;
    grp.position.copy(org).addScaledVector(dir, len / 2); grp.quaternion.setFromUnitVectors(UP, dir); scene.add(grp);
    FX.push({ o: grp, life: .6, max: .6, beam: [outer, core], w });
    AUDIO.sfx(m.world ? 'slash' : 'beam'); shake(.8); flash(m.col, m.world ? .8 : .35); if (big) banner('', 'HOLLOW PURPLE · 200%', '', 1200, '#b45cff'); if (rika) banner('純愛', 'PURE LOVE · with Rika', '', 1200, '#f4f0ff');
    const end = org.clone().addScaledVector(dir, len);
    let stop = len;
    if (m.fire) { const hitsB = WORLD.segment(org, end, w * .5); if (hitsB.length) { const p = hitsB[0].p; stop = org.distanceTo(p); } }
    const end2 = org.clone().addScaledVector(dir, stop);
    for (const { b, p } of WORLD.segment(org, end2, w * .5 + .5)) { if (m.erase) WORLD.erase(b); else if (m.world) WORLD.cutB(b, p.y); else WORLD.hitB(b, 90, p); }
    if (m.fire) { const c = end2.clone(); later(.15, () => { explosion(c, 20, f); }); }
    for (const t of foes(f)) { const c = t.center(), k = clamp(c.clone().sub(org).dot(dir), 0, stop);
      if (org.clone().addScaledVector(dir, k).distanceTo(c) < w * .5 + .8 * t.scale) { damage(f, t, m.dmg * mul, { launch: m.launch, pierce: m.pierce, stun: .4, kind: m.n }); spark(c, m.col, 4); } }
  }
  function explosion(p, r, src) { fxSprite(fxTex('glow', '#ff8a24'), p, r * 1.4, .6, { grow: .5 }); fxSprite(fxTex('glow', '#fff0b0'), p, r * .6, .4, { grow: .4 }); AUDIO.sfx('boom'); shake(1); flash('#ff9a40', .45);
    for (const b of WORLD.within(p, r)) WORLD.collapse(b); for (let i = 0; i < 10; i++) WORLD.fireAt(p.clone().add(new V3(rand(-r, r) * .7, 0, rand(-r, r) * .7)).setY(0), rand(3, 6), 30);
    WORLD.crater(p.clone().setY(0), r * .6); for (let i = 0; i < 8; i++) WORLD.dustAt(p.clone().add(new V3(rand(-r, r) * .5, rand(0, 4), rand(-r, r) * .5)), rand(8, 14));
    for (const t of foes(src)) if (t.center().distanceTo(p) < r * .6) damage(src, t, 60, { launch: 30, kind: 'blast' }); }
  function crashInto(f, b, sp) { const p = f.center(); AUDIO.sfx('crash', .9); shake(.9); hitstop = Math.max(hitstop, .05);
    for (let i = 0; i < 4; i++) WORLD.dustAt(p.clone().add(new V3(rand(-2, 2), rand(-1, 2), rand(-2, 2))), rand(4, 8));
    if (sp > 24 || b.h < 14) WORLD.collapse(b); else WORLD.hitB(b, sp * 5, p);
    damage(f.lastHit || f.foe || f, f, sp * .45, { sure: 1, crash: 1 }); }
  function groundSlam(f) { const p = f.pos.clone(); WORLD.crater(p, 2.5); for (let i = 0; i < 4; i++) WORLD.dustAt(p.clone().add(new V3(rand(-2, 2), .5, rand(-2, 2))), rand(3, 6)); WORLD.debris(p, 10, null, 8); AUDIO.sfx('heavy', .8); shake(.5); }
  const onCrash = (p, size) => { AUDIO.sfx('crash', clamp(size / 800, .3, 1)); shake(clamp(size / 1500, .2, .8)); };

  function adaptTurn(owner, reason) {
    const m = owner.summons.find(s => !s.dead && s.k === 'mahoraga'); if (!m && reason === 'infinity') return;
    owner.adaptPts++; if (owner.adaptPts % 4) return;
    const step = owner.adaptPts / 4; if (m) { m.wheelT += Math.PI / 4; AUDIO.sfx('wheel'); floatText(m.center().add(new V3(0, 3.5, 0)), 'CLANK', '#f0c850', true); }
    if (reason === 'infinity' && step >= 4 && !owner.adapted) {
      owner.adapted = true; owner.mv.k = WORLD_SLASH; for (const s of owner.summons) s.adapted = true;
      banner('魔虚羅 · 適応', 'Mahoraga has adapted to Infinity', 'Dismantle became the World-Cutting Slash. Infinity no longer protects Gojo.', 3000, '#ff2e4d'); flash('#fff', .6); owner.bark('adapt', true);
    }
  }
  function damage(src, tgt, amt, opt = {}) {
    if (tgt.dead || (tgt.inv > 0 && !opt.sure)) return false;
    const srcF = src.owner || src; let a = amt * (src.buff ? src.buff.dmg : 1);
    if (domain && domain.m.dom === 'void' && domain.owner === srcF) a *= 1.4;
    if (opt.melee) { const yd = domain && domain.m.dom === 'yuji' && domain.owner === src ? .4 : 0;
      if (opt.bf || Math.random() < (src.d.bf || .04) + src.bfBonus + yd) { a *= 2.5; src.bfBonus = Math.min(.35, src.bfBonus + .07); src.ce = Math.min(100, src.ce + 25);
        fxSprite(fxTex('bf', 'x'), tgt.center(), 5, .35, { normal: 1, rot: rand(0, 6), grow: .5 }); flash('#000', .55); later(.05, () => flash('#ff1030', .35)); hitstop = .14; AUDIO.sfx('bf');
        floatText(tgt.center().add(new V3(0, 1.4, 0)), '黒閃 BLACK FLASH', '#ff3040', true); } }
    if (tgt.adaptMap && opt.kind) { const r = tgt.adaptMap[opt.kind] || 0; a *= 1 - r; if (r < .75 && !tgt.adaptCd) { tgt.adaptMap[opt.kind] = r + .25; tgt.wheelT += Math.PI / 4; AUDIO.sfx('wheel'); tgt.adaptCd = 1; later(1.2, () => tgt.adaptCd = 0); } }
    if (tgt.armor != null) a *= tgt.armor;
    let blocked = false;
    if (tgt.d.infinity && tgt.ce > 5 && !opt.pierce && !srcF.adapted && !opt.sure) { blocked = true; tgt.ce = Math.max(0, tgt.ce - a * .09); a *= .3;
      if (Math.random() < .35) { floatText(tgt.center().add(new V3(0, 1, 0)), 'INFINITY', '#5ed4ff'); AUDIO.sfx('infinity'); }
      if (srcF.k.startsWith('sukuna')) adaptTurn(srcF, 'infinity'); }
    const guarded = tgt.guard && !opt.noGuard && !opt.sure; if (guarded) { a *= .25; spark(tgt.center(), '#5ed4ff'); }
    tgt.hp -= a; srcF.dm = Math.min(100, srcF.dm + a * .13); tgt.dm = Math.min(100, tgt.dm + a * .09); tgt.lastHit = srcF;
    if (!opt.sure || a > 12) { tgt.hurt = Math.max(tgt.hurt, guarded ? .06 : .22); if (opt.stun && !guarded) tgt.stun = Math.max(tgt.stun, opt.stun); }
    if (tgt.charge && a > 25 && !guarded) { scene.remove(tgt.charge.orb); tgt.charge = null; floatText(tgt.center(), 'INTERRUPTED', '#e2b25c'); }
    const dir = tgt.pos.clone().sub(src.pos).setY(0); if (dir.lengthSq() < .01) dir.set(1, 0, 0); dir.normalize();
    if (opt.launch && !guarded && !blocked && !tgt.owner) { const L = opt.launch * (tgt.scale > 1 ? .5 : 1); tgt.kb.copy(dir).multiplyScalar(L); tgt.kb.y = L * .22 + 4; tgt.launched = 1.2; tgt.lunge = null; tgt.charge && (scene.remove(tgt.charge.orb), tgt.charge = null); }
    else tgt.kb.addScaledVector(dir, (opt.kb || 2) * (guarded ? .3 : 1));
    floatText(tgt.center().add(new V3(rand(-.4, .4), .7, 0)), Math.round(a), a > 90 ? '#ffd070' : '#fff', a > 90);
    if (!opt.sure) { AUDIO.sfx(a > 70 ? 'heavy' : 'hit'); shake(a / 150); if (a > 60) hitstop = Math.max(hitstop, .06); }
    if (tgt.hp <= 0) { if (tgt.owner) { tgt.dead = true; tgt.hp = 0; const mh = tgt.k === 'mahoraga'; banner('', tgt.d.name + (mh ? ' destroyed' : ' is gone'), mh && !tgt.owner.adapted && tgt.owner.adaptPts ? 'The wheel keeps what it learned.' : '', 1600, tgt.d.aura); for (let i = 0; i < 6; i++) WORLD.dustAt(tgt.center().add(new V3(rand(-2, 2), 0, rand(-2, 2))), rand(5, 8)); }
      else if (G.mode === 'fight') KO(srcF, tgt); else if (G.mode === 'ow') OW.died(tgt, srcF); }
    return true;
  }

  /* =================== DOMAINS =================== */
  let domain = null, clash = null;
  function expand(f, o, m) {
    f.dm = 0; AUDIO.sfx('expand'); shake(.6);
    if (domain && domain.owner !== f && !clash) { clash = { a: domain.owner, b: f, ma: domain.m, mb: m, t: 3, pa: 0, pb: 0, flip: 0 }; banner('領域 · 押し合い', 'DOMAIN CLASH', 'Mash O or J to overpower the other domain', 2000, '#e2b25c');
      f.bark('clash', true); $('#clash').hidden = false; return; }
    startDomain(f, o, m);
  }
  function startDomain(f, o, m) {
    banner('領域展開 · ' + (m.jp || ''), m.n, 'Domain Expansion', 2000, f.d.aura);
    const away = f.pos.clone().sub(o.pos).setY(0); if (away.lengthSq() < .01) away.set(1, 0, 0); away.normalize();
    domain = { owner: f, tgt: o, m, t: m.dur, tick: 0, said: 0, c: f.pos.clone(), bl: [] }; WORLD.setMood(m.dom, m.dom === 'shrine' ? f.pos.clone().addScaledVector(away, 24) : f.pos.clone(), o.pos); flash(f.d.aura, .8);
    AUDIO.play(m.dom === 'void' ? 'void' : m.dom === 'shrine' ? 'shrine' : 'battle');
    if (m.dom === 'shrine') domain.bl = WORLD.within(f.pos, 70);
    if (m.dom === 'judge') { if (o.d.hr) floatText(o.center(), 'No cursed technique to confiscate', '#9affc8'); else { o.conf = 12; floatText(o.center().add(new V3(0, 1.5, 0)), 'GUILTY · TECHNIQUE CONFISCATED', '#f2d27a', true); } }
    if (m.dom === 'love') f.ce = 100;
  }
  function updateDomain(dt) {
    if (clash) { const C = clash; C.t -= dt; C.flip -= dt; if (C.flip <= 0) { C.flip = .22; WORLD.setMood((C.t * 4 | 0) % 2 ? C.ma.dom : C.mb.dom, C.b.pos.clone()); }
      const aiSide = C.a.isP ? C.b : C.a, rate = [3, 5.5, 8][G.diff]; if (Math.random() < rate * dt) { if (aiSide === C.a) C.pa++; else C.pb++; }
      const pa = C.pa + C.a.ce * .05, pb = C.pb + C.b.ce * .05; $('#clashbar i').style.width = clamp(50 + (pa - pb) * 4, 5, 95) + '%';
      if (C.t <= 0) { const aw = pa >= pb, win = aw ? C.a : C.b, lose = aw ? C.b : C.a; clash = null; $('#clash').hidden = true;
        lose.burn = 5; lose.stun = 1; floatText(lose.center().add(new V3(0, 1.5, 0)), 'DOMAIN SHATTERED', '#e2324d', true); flash('#fff', .6); startDomain(win, win.opp, aw ? C.ma : C.mb); }
      return; }
    if (!domain) return; const D = domain, f = D.owner, o = D.tgt; D.t -= dt; D.tick -= dt;
    const immune = o.d.hr; if (immune && !D.said && D.m.dom !== 'judge') { D.said = 1; floatText(o.center().add(new V3(0, 1.5, 0)), 'Maki is invisible to the domain', '#9affc8', true); }
    const inRange = o.pos.distanceTo(D.c) < 75;
    if (!immune && inRange) {
      if (D.m.dom === 'void' && D.t > D.m.dur - 3.4) o.stun = Math.max(o.stun, .1);
      if (D.m.dom === 'yuji') o.slow = .1;
      if ((D.m.dom === 'shrine' || D.m.dom === 'love') && D.tick <= 0) { D.tick = D.m.dom === 'shrine' ? .2 : .3; damage(f, o, D.m.dom === 'shrine' ? 8 : 10, { sure: 1 });
        if (D.m.dom === 'shrine') { fxSprite(fxTex('slash', '#ff3a52'), o.center().add(new V3(rand(-1, 1), rand(-1, 1), rand(-1, 1))), 2.2, .18, { rot: rand(0, 6), grow: .5 }); AUDIO.sfx('slash', .5); } } }
    if (D.m.dom === 'shrine' && Math.random() < dt * 9 && D.bl.length) { const b = pick(D.bl); if (b.h > 2) { WORLD.cutB(b, b.base + b.h * rand(.3, .85)); fxSprite(fxTex('slash', '#ff3a52'), new V3(b.x, b.base + b.h * .6, b.z), 9, .25, { rot: rand(0, 6), grow: .4 }); } }
    if (D.t <= 0 || f.dead || o.dead) endDomain();
  }
  function endDomain() { const f = domain && domain.owner; domain = null; WORLD.setMood(null); if (G.mode === 'fight' || G.mode === 'ow') AUDIO.play('battle');
    if (f && !f.dead) { f.burn = f.d.rct ? 1.5 : 4; floatText(f.center().add(new V3(0, 1.6, 0)), f.d.rct ? 'BURNOUT · repairing with RCT' : 'TECHNIQUE BURNOUT', '#e2b25c'); if (f.d.rct) later(.6, () => f.bark('burn')); } }

  /* =================== INPUT / AI =================== */
  const keys = {}, pressed = new Set();
  const ACTK = { KeyJ: 'j', KeyK: 'k', KeyL: 'l', KeyI: 'i', KeyO: 'o', KeyU: 'u', KeyE: 'e' };
  function press(code, down) { if (down && !keys[code]) pressed.add(code); keys[code] = down;
    if (down) { AUDIO.init(); if (G.mode === 'cut' && (code === 'Enter' || code === 'Space' || code === 'KeyJ')) advance();
      if (clash && (code === 'KeyO' || code === 'KeyJ')) { if (clash.a.isP) clash.pa++; else clash.pb++; }
      if (code === 'Escape') { if (G.mode === 'cut') skipCut(); else if (G.mode === 'fight' || G.mode === 'ready' || G.mode === 'ow') setPause(!G.paused); }
      if (code === 'KeyF' && G.mode === 'ow') OW.talk(); } }
  $('#bQuests').onclick = () => { AUDIO.sfx('ui'); OW.quests(); };
  addEventListener('keydown', e => { if (e.target.tagName === 'BUTTON' && (e.code === 'Enter' || e.code === 'Space') && G.mode !== 'fight' && G.mode !== 'cut') return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); if (!e.repeat) press(e.code, true); });
  addEventListener('keyup', e => press(e.code, false));
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  addEventListener('pointerdown', () => AUDIO.init());
  document.querySelectorAll('#touch button').forEach(b => { const k = b.dataset.k; b.addEventListener('pointerdown', e => { e.preventDefault(); press(k, true); }); ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, () => press(k, false))); });
  const camRight = new V3(1, 0, 0), camFwd = new V3(0, 0, -1);
  function playerIntent() { const I = { mv: new V3(), my: 0, act: null, guard: false };
    const x = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0), z = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    I.mv.addScaledVector(camRight, x).addScaledVector(camFwd, z); if (I.mv.lengthSq() > 1) I.mv.normalize();
    I.my = (keys.Space ? 1 : 0) - (keys.KeyC ? 1 : 0); I.guard = keys.KeyQ || keys.ShiftLeft || keys.ShiftRight;
    for (const c of ['KeyO', 'KeyU', 'KeyI', 'KeyL', 'KeyK', 'KeyE', 'KeyJ']) if (pressed.has(c)) { I.act = ACTK[c]; break; }
    if (!I.act && keys.KeyJ) I.act = 'j'; return I; }
  function ready(f, s, o, dist) { const m = f.mv[s]; if (!m || f.cd[s] > 0 || f.conf > 0 || (f.burn > 0 && s !== 'u')) return false; if (m.once && f.used) return false; if (s === 'o' && f.dm < 100) return false;
    if (s === 'u' && (f.summons.some(x => !x.dead) || (f.hp > f.maxhp * .8 && G.time < 25))) return false;
    if (f.ce < (f.buff ? 0 : m.cost)) return false; if (m.kind === 'strike' && dist > m.range + 1.5) return false; if (m.kind === 'speech' && dist > m.range) return false;
    if (m.kind === 'blast' && dist > m.range + m.r) return false; if (m.kind === 'swap' && dist < 3) return false; if (m.kind === 'buff' && f.hp > f.maxhp * .75) return false; if (m.kind === 'beam' && dist > (m.len || 60) * .8) return false; return true; }
  function aiIntent(f, o, dt) {
    const I = { mv: new V3(), my: 0, act: null, guard: false }, D = G.diff, react = [1, .6, .32][D];
    const to = o.pos.clone().sub(f.pos).setY(0), dist = f.pos.distanceTo(o.pos); to.normalize(); const side = new V3(-to.z, 0, to.x), pref = f.d.range;
    if (dist > pref + 1) I.mv.add(to); else if (dist < pref - 1.5 && pref > 4) I.mv.sub(to);
    I.mv.addScaledVector(side, f.ai.strafe * .5); if (Math.random() < dt * .6) f.ai.strafe *= -1; if (I.mv.lengthSq() > 1) I.mv.normalize();
    let dy = o.pos.y - f.pos.y; const blk = dist > 4 && WORLD.occluded(f.center(), o.center()); if (blk) dy = Math.max(dy, blk.base + blk.h + 2 - f.pos.y);
    I.my = Math.abs(dy) > .8 ? Math.sign(dy) : 0;
    if (o.charge && o.charge.t < o.charge.m.charge * .6 && Math.random() < dt * [1.2, 3, 7][D]) { I.act = 'e'; f.vel.copy(side).multiplyScalar(f.ai.strafe * 10); }
    if (!I.act && (dist > 16 || (o.launched > 0 && dist > 6)) && f.ce > 20 && Math.random() < dt * [.5, 1.2, 2.5][D]) I.act = 'e';
    f.ai.t -= dt;
    if (f.ai.t <= 0 && !I.act) { f.ai.t = react * rand(.6, 1.4);
      const opts = ['u', 'o', 'i', 'l', 'k'].filter(s => ready(f, s, o, dist));
      if (opts.includes('u') && Math.random() < .6) I.act = 'u'; else if (opts.includes('o') && Math.random() < .7) I.act = 'o'; else if (opts.includes('i') && Math.random() < .45) I.act = 'i';
      else if (dist < 3 && Math.random() < .6) { I.act = 'j'; f.ai.t = react * .35; } else if (opts.length) I.act = pick(opts.filter(s => s !== 'o' && s !== 'i' && s !== 'u')) || null; else if (dist < 5) I.act = 'j'; }
    if (dist < 3.2 && o.poseT > 0 && Math.random() < [.05, .2, .4][D]) I.guard = true;
    return I;
  }
  function summonIntent(s, dt) { const o = aimTarget(s), I = { mv: new V3(), my: 0, act: null }; const to = o.pos.clone().sub(s.pos), dist = to.length(); to.setY(0).normalize();
    if (dist > 2.6) I.mv.copy(to); const dy = o.pos.y - s.pos.y; I.my = Math.abs(dy) > .8 ? Math.sign(dy) : 0;
    s.ai.t -= dt; if (s.ai.t <= 0 && dist < 4.5) { s.ai.t = rand(1.4, 2.4); I.act = 'swing'; } return I; }
  function updateSummon(s, dt) { const I = summonIntent(s, dt); if (I.act === 'swing') { I.act = null; KIND.strike(s, aimTarget(s), s.d.swing); AUDIO.sfx('whoosh', .7); }
    s.update(dt, I, aimTarget(s)); }

  /* =================== CAMERA =================== */
  const G = { mode: 'boot', p1: null, p2: null, story: null, diff: 1, paused: false, time: 0, a: 'gojo', b: 'sukuna', axis: new V3(1, 0, 0), extra: [], tod: 'noon', stage: 0, auto: true, flow: 0 };
  let camLook = new V3(), shot = null, shotT = 0, shotRot = null, shotChk = 0, focusD = 20;
  const setShot = s => { shot = s; shotT = 0; shotRot = null; };
  // a cutscene camera must see its subject: no building between lens and target, and the lens not inside one
  const clearView = (pos, look) => !WORLD.segment(pos, look, .6).length;
  function unblock(pos, look) {
    if (shotRot === null || shotT - shotChk > 1) { shotChk = shotT; const off = pos.clone().sub(look);
      if (shotRot === null || !clearView(look.clone().add(off.clone().applyAxisAngle(UP, shotRot)), look)) { shotRot = 0;
        for (let k = 0; k < 9; k++) { const a = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * .7; if (clearView(look.clone().add(off.clone().applyAxisAngle(UP, a)), look)) { shotRot = a; break; } } } }
    const off = pos.clone().sub(look).applyAxisAngle(UP, shotRot); pos.copy(look).add(off);
    if (!clearView(pos, look)) pos.y = Math.max(pos.y, WORLD.surfaceY(pos.x, pos.z, 999) + 2); }
  function spot(at) { if (at === 'p1') return G.p1.pos.clone(); if (at === 'p2') return G.p2.pos.clone(); return new V3(...at); }
  function camUpdate(dt) {
    const P = G.p1, Q = G.p2; if (!P) return; let pos, look;
    if (G.mode === 'title' || G.mode === 'menu' || G.mode === 'boot') { const a = G.time * .04; const c = new V3(-220, 0, 10); pos = c.clone().add(new V3(Math.sin(a) * 170, 95, Math.cos(a) * 170)); look = c.clone().add(new V3(0, 30, 0)); focusD = 180; }
    else if (G.mode === 'ow') { [pos, look] = OW.cam(dt); }
    else if (G.mode === 'cut' || G.mode === 'result') {
      const s = shot || { cam: 'two' }; shotT += dt;
      if (s.cam === 'aerial') { const c = spot(s.at), a = shotT * .05 + (s.a0 || 0); pos = c.clone().add(new V3(Math.sin(a) * s.r, s.h, Math.cos(a) * s.r)); look = c.clone().add(new V3(0, s.h * .15, 0)); focusD = s.r; }
      else if (s.cam === 'dolly') { const k = clamp(shotT / 7, 0, 1), e = k * k * (3 - 2 * k); pos = new V3(...s.from).lerp(new V3(...s.to), e); look = new V3(...s.look); focusD = pos.distanceTo(P.pos); }
      else if (s.cam === 'close') { const f = s.who === 'p2' ? Q : s.who === 'p1' ? P : (G.extra.find(e => e.k === s.who || e.d.spr === s.who) || P), o = f === P ? Q : P, ax = o.pos.clone().sub(f.pos).setY(0), side = new V3();
        if (ax.lengthSq() < .01) ax.set(1, 0, 0); ax.normalize(); side.set(-ax.z, 0, ax.x); const k = f.scale;
        look = f.center().add(new V3(0, .35 * k, 0)); pos = look.clone().addScaledVector(ax, 3.2 * k).addScaledVector(side, (3.4 + Math.sin(shotT * .3) * .3) * k).add(new V3(0, .5, 0)); unblock(pos, look); }
      else { const mid = P.pos.clone().add(Q.pos).multiplyScalar(.5), ax = Q.pos.clone().sub(P.pos).setY(0), a = shotT * .04, r = clamp(8 + P.pos.distanceTo(Q.pos) * .9, 11, 30);
        if (ax.lengthSq() < .01) ax.set(1, 0, 0); ax.normalize(); const side = new V3(-ax.z, 0, ax.x);
        look = mid.clone().add(new V3(0, 1.1, 0)); pos = look.clone().addScaledVector(side, r * Math.cos(a)).addScaledVector(ax, r * Math.sin(a) * .4).add(new V3(0, 3.2, 0)); unblock(pos, look); }
    } else {
      const mid = P.pos.clone().add(Q.pos).multiplyScalar(.5), ax = Q.pos.clone().sub(P.pos).setY(0), sep = P.pos.distanceTo(Q.pos);
      if (ax.lengthSq() > .5) G.axis.lerp(ax.normalize(), Math.min(1, dt * 3)).normalize();
      let perp = new V3(-G.axis.z, 0, G.axis.x); if (perp.dot(camera.position.clone().sub(mid)) < 0) perp.negate();
      const focus = mid.clone().lerp(P.pos, clamp((sep - 26) / 40, 0, .7)); const s2 = Math.min(sep, 38);
      const dist = clamp(7.5 + s2 * .7, 8.5, 32); look = focus.clone().add(new V3(0, 1.3, 0)); pos = look.clone().addScaledVector(perp, dist).add(new V3(0, 2.6 + s2 * .2, 0));
    }
    if (G.mode === 'cut' || G.mode === 'result') { const roof = WORLD.surfaceY(pos.x, pos.z, 999); if (roof > pos.y - 4 && (shot && shot.cam === 'aerial')) pos.y = roof + 8; } pos.y = Math.max(pos.y, 1); if (WORLD.MAP.ceil) pos.y = Math.min(pos.y, WORLD.MAP.ceil - .4);
    if (G.camSnap) { camera.position.copy(pos); camLook.copy(look); G.camSnap = false; } else { camera.position.lerp(pos, Math.min(1, dt * (G.mode === 'fight' ? 4 : G.mode === 'ow' ? 10 : 2.2))); camLook.lerp(look, Math.min(1, dt * 5)); }
    camera.lookAt(camLook); focusD = camera.position.distanceTo(camLook);
    if (shakeA > 0) { camera.position.add(new V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(shakeA * .35)); shakeA = Math.max(0, shakeA - dt * 3); }
    camera.updateMatrixWorld(); camRight.setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize(); camFwd.crossVectors(UP, camRight).normalize();
    // see-through cutouts around both fighters
    [P, Q].forEach((f, i) => { if (G.mode === 'title' || G.mode === 'menu') { WORLD.setCut(i, 0, 0, 0, 0); return; } const v = f.center().project(camera); const d = camera.position.distanceTo(f.center());
      WORLD.setCut(i, (v.x * .5 + .5) * WORLD.W, (v.y * .5 + .5) * WORLD.H, clamp(WORLD.H * .16 * 12 / d, WORLD.H * .06, WORLD.H * .3), v.z * .5 + .5 - .0004); });
  }

  /* =================== HUD =================== */
  const MM = $('#mini'), mg = MM.getContext('2d'); let lastDistrict = '', miniDirty = 0;
  function fillHud() { const P = G.p1, Q = G.p2;
    $('#n1').innerHTML = `${P.d.name} <small>${P.d.jp}</small>`; $('#n2').innerHTML = `<small>${Q.d.jp}</small> ${Q.d.name}`;
    const slots = [['J', 'Strike', null]].concat(['k', 'l', 'i', 'o', 'u'].filter(s => P.mv[s]).map(s => [s.toUpperCase(), P.mv[s].n, P.mv[s]]));
    $('#moves').innerHTML = slots.map(([k, n, m]) => `<div class="mv" data-s="${k.toLowerCase()}"><kbd>${k}</kbd><span>${n} </span>${m ? `<em>${k === 'O' ? 'meter' : m.cost}</em>` : ''}<div class="cdv"></div></div>`).join('');
    $('#hint').textContent = (P.d.hr ? 'Stamina' : 'CE') + ' = purple · gold = domain · E dash / chase · Q guard · Space/C fly · Esc pause';
    document.querySelectorAll('#touch [data-k]').forEach(b => { const s = ACTK[b.dataset.k]; if (s && s !== 'j' && s !== 'e') { b.hidden = !P.mv[s]; if (P.mv[s]) b.textContent = P.mv[s].n.split(/[:\s]/)[0].slice(0, 7); } });
    MM.width = WORLD.mini.width; MM.height = WORLD.mini.height; }
  function hud() { const P = G.p1, Q = G.p2; if (!P) return;
    [[P, 1], [Q, 2]].forEach(([f, i]) => { f.trail += (Math.max(0, f.hp) - f.trail) * .04;
      $('#h' + i).style.width = Math.max(0, f.hp) / f.maxhp * 100 + '%'; $('#t' + i).style.width = f.trail / f.maxhp * 100 + '%'; $('#c' + i).style.width = f.ce + '%'; $('#d' + i).style.width = f.dm + '%';
      $('#dm' + i + 'w').classList.toggle('full', f.dm >= 100 && !!f.mv.o); $('#dm' + i + 'w').style.visibility = f.mv.o ? 'visible' : 'hidden';
      const tg = []; if (f.buff) tg.push('AMBER'); if (f.conf > 0) tg.push('CONFISCATED ' + Math.ceil(f.conf) + 's'); if (f.burn > 0) tg.push('BURNOUT'); if (f.d.infinity && f.ce > 5 && !f.opp.adapted) tg.push('INFINITY'); if (f.d.body) tg.push(f.bodyT > 0 || f.bodyT === undefined ? `BODY ${Math.ceil(f.bodyT ?? f.d.body)}s` : 'BODY REJECTING');
      const mh = f.summons.find(s => !s.dead); if (mh) tg.push(`${mh.d.name.split(' ')[0].toUpperCase()} ${Math.ceil(mh.hp)}`); if (f.summons.some(s => s.k === 'mahoraga') && !f.adapted && f.opp.d.infinity) tg.push(`WHEEL ${Math.min(4, f.adaptPts / 4 | 0)}/4`); if (f.adapted) tg.push('ADAPTED');
      if (f.dm >= 100 && f.mv.o) tg.push('DOMAIN READY'); $('#g' + i).textContent = tg.join(' · '); });
    document.querySelectorAll('#moves .mv').forEach(el => { const s = el.dataset.s, m = P.mv[s]; if (s === 'k' && m) el.querySelector('span').textContent = m.n + ' ';
      const c = P.cd[s] || 0, max = m ? m.cd : .45; el.querySelector('.cdv').style.height = Math.min(1, c / max) * 100 + '%';
      el.classList.toggle('off', !!m && (P.ce < m.cost || P.conf > 0 || (P.burn > 0 && s !== 'u') || (s === 'o' && P.dm < 100) || (m.once && P.used))); });
    // minimap
    if (--miniDirty < 0) { miniDirty = 90; WORLD.drawMini(); }
    mg.drawImage(WORLD.mini, 0, 0); const X = x => (x - WORLD.MAP.x0) * WORLD.MS, Z = z => (z - WORLD.MAP.z0) * WORLD.MS;
    const dot = (f, c, r) => { mg.fillStyle = '#0b0912'; mg.fillRect(X(f.pos.x) - r - 1, Z(f.pos.z) - r - 1, r * 2 + 2, r * 2 + 2); mg.fillStyle = c; mg.fillRect(X(f.pos.x) - r, Z(f.pos.z) - r, r * 2, r * 2); };
    for (const s of G.extra) if (!s.dead) dot(s, '#f0c850', 1.5); dot(Q, '#ff4a5e', 2.5); dot(P, '#62d6ff', 2.5);
    const cp = camera.position; mg.strokeStyle = '#ffffff66'; mg.beginPath(); mg.moveTo(X(cp.x), Z(cp.z)); mg.lineTo(X(P.pos.x), Z(P.pos.z)); mg.stroke();
    const d = WORLD.district(P.pos.x, P.pos.z); if (d.id !== lastDistrict) { lastDistrict = d.id; const el = $('#district'); el.innerHTML = `<b>${d.jp}</b> ${d.name}`; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); }
  }

  /* =================== FLOW =================== */
  let prog = {}; try { prog = JSON.parse(localStorage.getItem('ss2-progress') || '{}'); } catch (e) { }
  let settings = { music: true, voice: true, sfx: true, auto: true, lang: 'ja' }; try { Object.assign(settings, JSON.parse(localStorage.getItem('ss2-settings') || '{}')); } catch (e) { }
  const save = () => { try { localStorage.setItem('ss2-progress', JSON.stringify(prog)); localStorage.setItem('ss2-settings', JSON.stringify(settings)); } catch (e) { } };
  for (const k of ['music', 'voice', 'sfx', 'lang']) AUDIO.set(k, settings[k]);
  const screens = ['#title', '#story', '#versus', '#help', '#settings', '#result', '#pause', '#owmenu', '#quests'];
  function show(id) { for (const s of screens) $(s).hidden = s !== id; const fight = id === null && ['fight', 'ready', 'ko', 'ow'].includes(G.mode); $('#owhud').hidden = !(fight && G.mode === 'ow');
    $('#hud').hidden = !fight; $('#touch').hidden = !(fight && matchMedia('(pointer:coarse)').matches); }
  function clearArena() { for (const f of [G.p1, G.p2, ...G.extra]) if (f) f.remove(); G.extra = [];
    for (const x of FX) scene.remove(x.o); FX.length = 0; for (const p of PR) scene.remove(p.o); PR.length = 0; for (const t of FT) t.el.remove(); FT.length = 0; EV = []; domain = null; clash = null; $('#clash').hidden = true; }
  function setup(a, b, o = {}) { clearArena(); WORLD.setMap(o.map); WORLD.reset(); WORLD.setTime(o.time || 'noon'); if (o.ruin) WORLD.ruin(o.ruin, .45);
    const extra = [summonOf(a), summonOf(b), ...(o.keep || [])].filter(Boolean); SPR.release([a, b, ...extra]);
    const sp = o.spawn || [[-196, 0, 1], [-218, 0, -1]];
    G.p1 = new Fighter(a, sp[0], true); G.p2 = new Fighter(b, sp[1], false); G.p1.opp = G.p2; G.p2.opp = G.p1; for (const k of extra) SPR.build(k);
    if (o.sk) G.p2.maxhp = G.p2.hp = G.p2.trail = Math.round(RO[b].hp * o.sk);
    if (o.first200) G.p1.first200 = true;
    G.axis.copy(G.p2.pos).sub(G.p1.pos).setY(0).normalize(); G.camSnap = true; G.time = 0; lastDistrict = ''; }
  async function startFight() { const id = G.flow; G.mode = 'ready'; show(null); fillHud(); AUDIO.play('battle');
    banner(G.story != null ? CH[G.story].sub : '', G.story != null ? 'Fight!' : 'Round 1', '', 1000); G.p1.bark('start', true); later(1.8, () => G.p2 && G.p2.bark('start', true));
    await wait(1000); if (G.mode !== 'ready' || id !== G.flow) return; banner('', 'FIGHT!', '', 700, '#e2b25c'); AUDIO.sfx('heavy'); G.mode = 'fight'; }
  const wait = ms => new Promise(r => setTimeout(r, ms));
  async function KO(w, l) { const id = G.flow; G.mode = 'ko'; l.dead = true; l.hp = 0; if (l.charge) { scene.remove(l.charge.orb); l.charge = null; } AUDIO.sfx('ko'); flash('#fff', .8); banner('', 'K.O.', '', 1800, '#e2324d'); slowmo = .25;
    await wait(1800); slowmo = 1; if (id !== G.flow) return; if (domain) endDomain(); clash = null; $('#clash').hidden = true; endFight(w === G.p1); }
  // before an ending plays: nobody inside a wall or mid-air, and the winner standing a few steps from the loser
  function settle(f) { f.kb.set(0, 0, 0); f.vel.set(0, 0, 0); f.lunge = null; f.launched = f.dash = 0; if (f.charge) { scene.remove(f.charge.orb); f.charge = null; }
    WORLD.collide(f.pos, .6, -1); f.pos.y = WORLD.surfaceY(f.pos.x, f.pos.z, f.pos.y + .3); }
  const freeSpot = p => !WORLD.within(p, .8).some(b => b.base < p.y + 1.8 && b.base + b.h > p.y + .1);
  function stageEnding() { const L = G.p1.dead ? G.p1 : G.p2, W = L === G.p1 ? G.p2 : G.p1; settle(L);
    const d = W.pos.clone().sub(L.pos).setY(0), a0 = d.lengthSq() > .01 ? Math.atan2(d.z, d.x) : 0; let spot = L.pos.clone().add(new V3(1.6, 0, 0));
    for (let k = 0; k < 12; k++) { const a = a0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * Math.PI / 6, p = L.pos.clone().add(new V3(Math.cos(a) * 4.5, 0, Math.sin(a) * 4.5)); p.y = WORLD.surfaceY(p.x, p.z, L.pos.y + .3);
      if (Math.abs(p.y - L.pos.y) < .6 && freeSpot(p) && clearView(p.clone().setY(p.y + 1), L.center())) { spot = p; break; } }
    W.pos.copy(spot); settle(W); for (const s of G.extra) if (!s.dead) { s.pos.copy(W.pos).add(new V3(0, 0, 2.5)); settle(s); } G.camSnap = true; }
  async function endFight(won) { const id = G.flow;
    const ch = G.story != null ? CH[G.story] : null; stageEnding();
    if (ch) { if (won) prog[ch.id] = 'win'; else if (!prog[ch.id]) prog[ch.id] = 'lose'; save(); AUDIO.play(won ? 'victory' : 'sad'); await cutscene(won ? ch.win : ch.lose, ch.title); }
    else { const W = won ? G.p1 : G.p2, L = won ? G.p2 : G.p1; AUDIO.play(won ? 'victory' : 'sad'); await cutscene([{ s: W.k, t: LINES.vs[W.k].win, id: `vs_${W.k}_win` }, { s: L.k, t: LINES.vs[L.k].lose, id: `vs_${L.k}_lose` }], ''); }
    if (id !== G.flow) return;
    G.mode = 'result'; show('#result'); setShot({ cam: 'aerial', at: 'p1', r: 40, h: 22 });
    $('#rT').textContent = won ? 'Victory' : 'Defeat'; $('#rT').style.color = won ? '#e2b25c' : '#e2324d';
    const b = [], last = ch && (!CH[G.story + 1] || CH[G.story + 1].season !== ch.season), film = ch && ch.season === 0;
    if (ch) { $('#rP').textContent = won ? (last ? (film ? "You played the film's ending. Rika is free, and the Night Parade is over." : "You played the manga's ending. The King of Curses is gone.") : 'You changed history, at least in this timeline.')
        : (last ? "This isn't how it ends. Try again." : film ? 'That is how it went in the film. The night goes on.' : 'That is how it went in the manga. The fight continues.');
      if (!last) b.push(['Next Chapter', () => playChapter(G.story + 1)]); else if (film && won) b.push(['Shinjuku Showdown', () => playChapter(CH.findIndex(c => c.season === 1))]);
      b.push([won ? 'Replay' : 'Retry for the What If', () => playChapter(G.story)]); b.push(['Chapters', () => openStory()]); }
    else { $('#rP').textContent = `${(won ? G.p1 : G.p2).d.name} wins.`; b.push(['Rematch', () => startVersus()], ['Change Fighters', () => openVersus()]); }
    b.push(['Title', () => toTitle()]);
    $('#rB').innerHTML = ''; b.forEach(([t, fn]) => { const e = document.createElement('button'); e.textContent = t; e.onclick = () => { AUDIO.sfx('ui'); fn(); }; $('#rB').appendChild(e); }); $('#rB').firstChild.focus(); }
  function setPause(p, quit) { G.paused = p; $('#pause').hidden = !p; if (p) $(quit ? '#bQuit' : '#bResume').focus(); }
  const restart = () => window.OW && OW.active ? OW.restart() : G.story != null ? playChapter(G.story) : startVersus();
  $('#bResume').onclick = () => setPause(false); $('#bQuit').onclick = () => { setPause(false); toTitle(); }; $('#bRestart').onclick = () => { setPause(false); restart(); };
  $('#bExit').onclick = () => { AUDIO.sfx('ui'); setPause(true, true); };
  $('#cutExit').onclick = () => { AUDIO.sfx('ui'); toTitle(); };

  /* cutscenes */
  let cutRes = null, typing = null, cutSkip = false, autoT = null;
  function advance() { if (typing) { typing(); return; } if (cutRes) { const r = cutRes; cutRes = null; clearTimeout(autoT); r(); } }
  function skipCut() { cutSkip = true; AUDIO.stopVoice(); advance(); advance(); }
  $('#cut').addEventListener('click', e => { if (e.target.closest('button')) return; advance(); }); $('#skip').onclick = skipCut;
  async function cutscene(lines, title) { const id = G.flow; document.activeElement && document.activeElement.blur(); const prev = G.mode; G.mode = 'cut'; cutSkip = false; show(null); $('#cut').hidden = false; $('#chapTitle').textContent = title || '';
    setShot(lines[0] && lines[0].shot || { cam: 'two' });
    for (const ln of lines) { if (cutSkip || id !== G.flow) break; await say(ln); }
    if (id !== G.flow) return; AUDIO.stopVoice(); $('#cut').hidden = true; G.mode = prev === 'cut' ? 'title' : prev; }
  // a line can re-stage the scene: swap the first actor, move both (the Season 0 epilogue in the alley)
  function restage(S) { if (S.p1 && S.p1 !== G.p1.k) { G.p1.remove(); G.p1 = new Fighter(S.p1, S.at, true); G.p1.opp = G.p2; G.p2.opp = G.p1; }
    else if (S.at) G.p1.pos.set(...S.at); if (S.p2at) G.p2.pos.set(...S.p2at); for (const e of G.extra) e.remove(); G.extra = []; G.p1.summons = []; G.p2.summons = []; G.camSnap = true; }
  function say(ln) { return new Promise(async res => {
    if (ln.stage) restage(ln.stage);
    if (ln.shot) setShot(ln.shot); else if (ln.stage) setShot({ cam: 'two' });
    else if (ln.s && ln.s !== 'n') { const is = f => f && (f.k === ln.s || f.d.spr === ln.s), who = is(G.p1) ? 'p1' : is(G.p2) ? 'p2' : G.extra.some(e => is(e) && !e.dead) ? ln.s : null;
      if (who && (!shot || shot.cam !== 'close' || shot.who !== who)) setShot({ cam: 'close', who }); }
    if (ln.fx === 'slash') { flash('#fff', .9); AUDIO.sfx('slash'); }
    const d = $('#dlg'), tip = !!ln.tip; d.classList.toggle('narr', !ln.s || ln.s === 'n'); d.classList.toggle('tip', tip); const hasP = ln.s && ln.s !== 'n' && SPR.CHARS[ln.s];
    $('#dimg').hidden = !hasP; if (hasP) $('#dimg').src = thumb(ln.s).portrait;
    $('#djp').textContent = settings.lang === 'ja' && settings.voice && ln.id && !tip && window.LINES_JA && LINES_JA[ln.id] || ''; $('#dwho').textContent = tip ? 'TIP' : hasP ? RO[ln.s].name : '';
    const full = ln.tip || ln.t, el = $('#dtxt'); let i = 0; el.textContent = '';
    const dur = ln.id && !tip ? await AUDIO.say(ln.id) : 0; const cps = dur ? Math.max(18, full.length / Math.max(.8, dur - .2)) : 45;
    const t0 = performance.now(); let doneTyping = false, voiceDone = !dur, mine = null;   // timers only ever advance their own line
    const finish = () => { if (settings.auto && dur && doneTyping && voiceDone && mine && cutRes === mine && !mine.__auto) { mine.__auto = 1; autoT = setTimeout(() => { if (cutRes === mine) advance(); }, 700); } };
    if (dur) setTimeout(() => { voiceDone = true; finish(); }, dur * 1000);
    const iv = setInterval(() => { i = Math.floor((performance.now() - t0) / 1000 * cps); el.textContent = full.slice(0, i); if (i >= full.length) done(); }, 30);
    function done() { clearInterval(iv); el.textContent = full; typing = null; doneTyping = true; cutRes = mine = () => { AUDIO.stopVoice(); res(); }; finish(); }
    typing = done; }); }

  // Season 0 (Jujutsu Kaisen 0, 2017) then the Shinjuku Showdown (2018), in one list
  const CH = [...LINES.story0.map(c => Object.assign(c, { season: 0 })), ...LINES.story.map(c => Object.assign(c, { season: 1 }))];
  const SEASONS = [{ n: 'Season 0', sub: 'Jujutsu Kaisen 0 · Tokyo Jujutsu High, December 2017' }, { n: 'Shinjuku Showdown', sub: 'The Culling Game ends · Shinjuku, December 2018' }];
  async function playChapter(i) { const ch = CH[i], id = ++G.flow; G.story = i; $('#cut').hidden = true;
    const keep = ch.intro.concat(ch.win, ch.lose).map(l => l.stage && l.stage.p1).filter(Boolean);
    setup(ch.hero, ch.foe, { map: ch.map, time: ch.time, spawn: ch.spawn, sk: ch.sk, ruin: ch.ruin, first200: ch.id === 'c1' && ch.hero === 'gojo', keep });
    if (ch.season === 0) delete G.p1.mv.o;   // nobody had a domain yet in 2017
    AUDIO.preload([ch.id, 'barks', 'vs']); AUDIO.play('tension'); G.mode = 'cut'; await cutscene(ch.intro, ch.title); if (id === G.flow) startFight(); }
  const STAGES = [{ n: 'Nishi-Shinjuku · Chūō-dōri', spawn: [[-196, 0, 1], [-218, 0, -1]] }, { n: 'Tochō Plaza', spawn: [[-318, 0, 24], [-340, 0, 22]] }, { n: 'Kabukichō', spawn: [[110, 0, -158], [130, 0, -158]] },
    { n: 'Shinjuku Station', spawn: [[-6, 0, 62], [6, 0, 40]] }, { n: 'Shinjuku Gyoen', spawn: [[322, 0, 120], [346, 0, 118]] }, { n: 'Jujutsu High', map: 'jjh', spawn: [[2496, 0, 40], [2512, 0, 22]] }];
  function startVersus() { const id = ++G.flow; G.story = null; $('#cut').hidden = true; const st = STAGES[G.stage]; setup(G.a, G.b, { time: G.tod, spawn: st.spawn, map: st.map });
    AUDIO.preload(['barks', 'vs']); AUDIO.play('tension'); (async () => { G.mode = 'cut'; await cutscene([{ s: G.a, t: LINES.vs[G.a].vs, id: `vs_${G.a}_vs`, shot: { cam: 'two' } }, { s: G.b, t: LINES.vs[G.b].vs, id: `vs_${G.b}_vs` }], 'Versus · ' + st.n); if (id === G.flow) startFight(); })(); }
  function toTitle() { G.flow++; if (window.OW) OW.active = false; if (domain) endDomain(); clash = null; $('#clash').hidden = true; cutSkip = true; AUDIO.stopVoice(); if (typing) typing(); if (cutRes) { const r = cutRes; cutRes = null; r(); } clearTimeout(autoT); $('#cut').hidden = true;
    G.paused = false; G.story = null; setup('gojo', 'sukuna', { time: 'sunset' }); G.mode = 'title'; show('#title'); AUDIO.play('title'); $('#bStory').focus(); }
  function segRow(el, opts, get, set) { el.innerHTML = opts.map((t, i) => `<button data-i="${i}" class="${get() === i ? 'on' : ''}">${t}</button>`).join('');
    el.querySelectorAll('button').forEach(b => b.onclick = () => { set(+b.dataset.i); AUDIO.sfx('ui'); el.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); }); }
  const diffRow = el => segRow(el, ['Easy', 'Normal', 'Hard'], () => G.diff, v => G.diff = v);
  let season = 0;
  function openStory(focusTabs) { G.mode = 'menu'; show('#story'); const box = $('#chaps'); box.innerHTML = '';
    segRow($('#seasons'), SEASONS.map(s => s.n), () => season, v => { season = v; openStory(true); }); $('#seasonSub').textContent = SEASONS[season].sub;
    CH.forEach((ch, i) => { if (ch.season !== season) return; const b = document.createElement('button'); b.className = 'chap'; const st = prog[ch.id] === 'win' ? '★ Won' : prog[ch.id] === 'lose' ? 'Played' : '';
      b.innerHTML = `<img src="${thumb(ch.hero).portrait}" alt=""><div><b>${ch.title}</b><span>${ch.sub} · ${ch.time}</span></div><i>${st}</i>`; b.onclick = () => { AUDIO.sfx('ui'); playChapter(i); }; box.appendChild(b); });
    diffRow($('#diffS')); (focusTabs ? $('#seasons .on') : box.firstChild).focus(); }
  const TODS = ['noon', 'afternoon', 'sunset', 'dusk', 'night'];
  function openVersus() { G.mode = 'menu'; show('#versus');
    const grid = (el, key) => { el.innerHTML = ''; for (const k of PLAYABLE) { const b = document.createElement('button'); b.className = 'card' + (G[key] === k ? ' sel' : '');
      b.innerHTML = `<img src="${thumb(k).full}" alt=""><span>${RO[k].name}</span><small>${RO[k].title}</small>`; b.onclick = () => { G[key] = k; AUDIO.sfx('ui'); openVersus(); }; b.onfocus = b.onmouseenter = () => info(k); el.appendChild(b); } };
    const info = k => { const d = RO[k]; $('#vinfo').innerHTML = `<b>${d.name}</b> · ${d.passive}<br>K ${d.moves.k.n} · L ${d.moves.l.n} · I ${d.moves.i.n}${d.moves.o ? ' · O ' + d.moves.o.n : ' · no domain'}${d.moves.u ? ' · U ' + d.moves.u.n : ''}`; };
    grid($('#gridA'), 'a'); grid($('#gridB'), 'b'); info(G.a); diffRow($('#diffV'));
    segRow($('#todV'), TODS.map(t => t[0].toUpperCase() + t.slice(1)), () => TODS.indexOf(G.tod), v => G.tod = TODS[v]);
    segRow($('#stageV'), STAGES.map(s => s.n), () => G.stage, v => G.stage = v); }
  function openSettings() { show('#settings'); const el = $('#setRows'); el.innerHTML = '';
    for (const [k, label, note] of [['music', 'Music', 'Original score, synthesized live'], ['voice', 'Voices', 'Synthetic voices, not the anime cast'], ['lang', 'Voice language', 'Japanese with English subtitles, like the anime'], ['sfx', 'Sound effects', ''], ['auto', 'Auto-advance voiced lines', 'Cutscenes play on their own']]) {
      const b = document.createElement('button'); b.className = 'toggle'; const val = () => k === 'lang' ? (settings.lang === 'ja' ? '日本語' : 'English') : settings[k] ? 'ON' : 'OFF';
      const draw = () => b.innerHTML = `<span>${label}${note ? `<small>${note}</small>` : ''}</span><b>${val()}</b>`; draw();
      b.onclick = () => { settings[k] = k === 'lang' ? (settings.lang === 'ja' ? 'en' : 'ja') : !settings[k]; if (k !== 'auto') AUDIO.set(k, settings[k]); save(); draw(); AUDIO.sfx('ui'); }; el.appendChild(b); } el.firstChild.focus(); }
  $('#bStory').onclick = () => { AUDIO.sfx('ui'); openStory(); };
  $('#bYuji').onclick = () => { AUDIO.sfx('ui'); G.mode = 'menu'; show('#owmenu'); OW.menu(); ($('#owCont').hidden ? $('#owNew') : $('#owCont')).focus(); };
  $('#owCont').onclick = () => { AUDIO.sfx('ui'); OW.start(false); }; $('#owNew').onclick = () => { AUDIO.sfx('ui'); OW.start(true); }; $('#bVersus').onclick = () => { AUDIO.sfx('ui'); openVersus(); }; $('#bHelp').onclick = () => { AUDIO.sfx('ui'); show('#help'); };
  $('#bSettings').onclick = () => { AUDIO.sfx('ui'); openSettings(); }; $('#bFight').onclick = () => { AUDIO.sfx('ui'); startVersus(); };
  document.querySelectorAll('.back').forEach(b => b.onclick = () => { AUDIO.sfx('ui'); show('#title'); G.mode = 'title'; });

  /* =================== LOOP =================== */
  let last = performance.now(), slow = 0, degraded = 0;
  function frame() {
    const now = performance.now(), rdt = Math.min(.05, (now - last) / 1000); last = now; G.time += rdt;
    // automatic quality drop on slow machines: bigger pixels, then no sun shadows
    slow = rdt > 1 / 32 ? slow + rdt : Math.max(0, slow - rdt * .5); if (slow > 3 && degraded < 2) { slow = 0; WORLD.degrade(++degraded); }
    const dt = G.paused ? 0 : rdt * (hitstop > 0 ? .06 : slowmo); hitstop -= rdt;
    const P = G.p1, Q = G.p2;
    if (P && ['fight', 'ko', 'ready', 'ow'].includes(G.mode) && dt > 0) {
      const live = G.mode === 'fight', none = { mv: new V3(), my: 0 };
      if (G.mode === 'ow') OW.step(dt, playerIntent()); else {
      P.update(dt, live ? playerIntent() : none, aimTarget(P)); Q.update(dt, live ? aiIntent(Q, P, dt) : none, aimTarget(Q));
      for (const s of G.extra) { if (s.dead) { s.update(dt, none, P); continue; } if (live) updateSummon(s, dt); else s.update(dt, none, P); }
      const tmp = Q.pos.clone().sub(P.pos), d = tmp.length(); if (d < 1.1 && d > 0) { tmp.multiplyScalar((1.1 - d) / d / 2); P.pos.sub(tmp); Q.pos.add(tmp); } }
      for (let i = EV.length - 1; i >= 0; i--) { if (!EV[i]) continue; EV[i].t -= dt; if (EV[i].t <= 0) { const e = EV.splice(i, 1)[0]; e.fn(); } }
      for (let i = PR.length - 1; i >= 0; i--) { const p = PR[i], m = p.m; p.life -= dt;
        const want = p.tgt.center().sub(p.o.position).normalize().multiplyScalar(m.spd); p.vel.lerp(want, Math.min(1, (m.hom || 0) * dt));
        p.last.copy(p.o.position); p.o.position.addScaledVector(p.vel, dt); if (m.tex === 'orb') p.o.material.rotation += dt * 6;
        if (m.pull && p.o.position.distanceTo(p.tgt.center()) < 5) p.tgt.kb.add(p.o.position.clone().sub(p.tgt.pos).setY(0).multiplyScalar(dt * 3));
        let hit = false;
        for (const t of foes(p.own)) if (!hit && p.o.position.distanceTo(t.center()) < 1.1 * (m.size || 1) * t.scale) { hit = true;
          if (damage(p.own, t, m.dmg, { launch: m.launch, kb: m.kb || 3, stun: m.stun, pierce: m.pierce, kind: m.n }) && m.pull) t.kb.add(p.own.pos.clone().sub(t.pos).setY(0).normalize().multiplyScalar(10)); spark(p.o.position, m.col, 2); }
        if (!hit) for (const { b, p: hp } of WORLD.segment(p.last, p.o.position, .3)) { if (m.cut) { WORLD.cutB(b, hp.y); if (++p.cuts > 2) { hit = true; break; } } else { if (m.boom) { for (const bb of WORLD.within(hp, m.boom)) WORLD.collapse(bb); fxSprite(fxTex('glow', m.col), hp, 12, .4, { grow: .5 }); AUDIO.sfx('boom', .7); shake(.5); } else WORLD.hitB(b, 40, hp); hit = true; break; } }
        if (hit || p.life <= 0 || p.o.position.y < 0) { scene.remove(p.o); PR.splice(i, 1); if (!hit && p.o.position.y < 0) { spark(p.o.position, m.col, 1); WORLD.crater(p.o.position.clone().setY(0), 1.2); } } }
      updateDomain(dt);
      AUDIO.setIntensity(P.hp < P.maxhp * .35 || Q.hp < Q.maxhp * .35 ? 1 : 0);
      if (live || G.mode === 'ow') pressed.clear();
    } else pressed.clear();
    for (let i = FX.length - 1; i >= 0; i--) { const x = FX[i]; x.life -= rdt; const k = 1 - x.life / x.max;
      if (x.beam) { const w = x.w * (1 - k * .8); x.beam[0].scale.x = x.beam[0].scale.z = w; x.beam[1].scale.x = x.beam[1].scale.z = w * .4; x.beam[0].material.opacity = .75 * (1 - k); x.beam[1].material.opacity = .9 * (1 - k); }
      else if (x.mesh) { x.o.scale.setScalar(x.s0 * (1 + x.grow * k)); x.o.material.opacity = 1 - k * .6; }
      else if (x.ghost) x.o.material.opacity = .45 * (1 - k);
      else if (x.max < 50) { x.o.scale.setScalar(x.s0 * (1 + x.grow * k)); x.o.material.opacity = 1 - k; }
      if (x.life <= 0) { scene.remove(x.o); FX.splice(i, 1); } }
    if (P) { camUpdate(rdt); updateLit();
      for (const [f, o] of [[P, Q], [Q, P], ...G.extra.map(s => [s, aimTarget(s)])]) { if (!f.dead && !f.faceLock) { const s = o.pos.clone().sub(f.pos).dot(camRight); if (Math.abs(s) > .2) f.face = s > 0 ? 1 : -1; } f.visual(G.time); } }
    for (let i = FT.length - 1; i >= 0; i--) { const t = FT[i]; t.life -= rdt; t.pos.y += rdt * 1.2; const v = t.pos.clone().project(camera);
      t.el.style.left = (v.x + 1) / 2 * innerWidth + 'px'; t.el.style.top = (1 - v.y) / 2 * innerHeight + 'px'; t.el.style.opacity = Math.min(1, t.life / t.max * 2); t.el.hidden = v.z > 1; if (t.life <= 0) { t.el.remove(); FT.splice(i, 1); } }
    if (['fight', 'ko', 'ready', 'ow'].includes(G.mode)) hud(); if (G.mode === 'ow') OW.hud();
    const focus = P ? (['title', 'menu', 'boot'].includes(G.mode) ? camLook : G.mode === 'ow' || window.OW && OW.active ? P.pos.clone() : P.pos.clone().add(Q.pos).multiplyScalar(.5)) : new V3();
    WORLD.update(rdt, focus); WORLD.compM.uniforms.dof.value = ['title', 'menu', 'boot'].includes(G.mode) ? .7 : 1; WORLD.render(focusD);
  }
  window.GAME = { onCrash, G, RO, Fighter, aiIntent, cutscene, setShot, banner, floatText, flash, fillHud, show, clearArena, keys, pressed, later, spark, toTitle, wait, save: () => save(), settings, prog, SEASONS };
  addEventListener('resize', () => WORLD.resize());
  document.addEventListener('visibilitychange', () => { WORLD.renderer.setAnimationLoop(document.hidden ? null : frame); last = performance.now(); if (document.hidden && G.mode === 'fight') setPause(true); });

  /* =================== BOOT =================== */
  $('#load').textContent = 'Drawing sorcerers…';
  setTimeout(() => {
    $('#load').remove(); toTitle(); WORLD.renderer.setAnimationLoop(frame);
    $('#title').classList.add('in');
  }, 30);
})();
