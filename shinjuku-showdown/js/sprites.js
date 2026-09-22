'use strict';
/* Pixel-art character renderer.
   Bodies are a 2D rig (capsules + cloth polygons) rasterized with 4-step cel shading, hue-shifted ramps,
   separation lines between parts and a coloured outline. Hair is built from curved tapered locks, faces are
   placed pixel by pixel. Every character becomes one atlas: row 0 holds 64x128 frames, row 1 the 128x128 "down" frame. */
window.SPR = (function () {
  const CW = 64, CH = 128, GY = 125, PX = 30, ATW = 2048, ATH = 256;
  const D2R = Math.PI / 180;
  const LV = (() => { const v = [0.45, -0.6, 0.66], n = Math.hypot(...v); return v.map(x => x / n); })();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------- colour helpers ---------- */
  function hex2rgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; }
  function rgbStr(r, g, b) { return `rgb(${clamp(r | 0, 0, 255)},${clamp(g | 0, 0, 255)},${clamp(b | 0, 0, 255)})`; }
  function rgb2hsl(r, g, b) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2;
    if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return [h, s, l]; }
  function hsl2hex(h, s, l) { h = ((h % 360) + 360) % 360; s = clamp(s, 0, 1); l = clamp(l, 0, 1);
    const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    return '#' + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join(''); }
  function toward(h, t, amt) { let d = ((t - h + 540) % 360) - 180; return h + clamp(d, -amt, amt); }
  function mkRamp(base) { const [h, s, l] = rgb2hsl(...hex2rgb(base));
    return [hsl2hex(toward(h, 255, 28), s * 1.05 + .06, l * .42), hsl2hex(toward(h, 255, 14), s * 1.02 + .03, l * .7), base, hsl2hex(toward(h, 50, 8), s * .95, l + (1 - l) * .4)]; }
  const R = (a) => typeof a === 'string' ? mkRamp(a) : a;

  /* ---------- index buffer ---------- */
  function Buf(w, h) { this.w = w; this.h = h; this.mat = new Int16Array(w * h).fill(-1); this.sh = new Int8Array(w * h); this.ord = new Int16Array(w * h); this.fam = new Int16Array(w * h); }
  Buf.prototype.put = function (x, y, m, s, o, f) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; const i = y * this.w + x;
    this.mat[i] = m; this.sh[i] = clamp(s, 0, 3); this.ord[i] = o; this.fam[i] = f; };
  Buf.prototype.get = function (x, y) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1; return this.mat[y * this.w + x]; };

  function shadeN(nx, ny, nz, bias) { const d = nx * LV[0] + ny * LV[1] + nz * LV[2]; const i = d > .8 ? 3 : d > .42 ? 2 : d > .06 ? 1 : 0; return clamp(i + (bias | 0), 0, 3); }

  /* ---------- painter ---------- */
  function Painter(buf, mats) { this.b = buf; this.mats = mats; this.o = 1; this.f = 1; this.ox = 0; this.oy = 0; }
  Painter.prototype.m = function (name) { const i = this.mats.names.indexOf(name); if (i < 0) throw new Error('no material ' + name); return i; };
  Painter.prototype.fam = function () { return ++this.f; };
  Painter.prototype.capsule = function (ax, ay, bx, by, ra, rb, mat, o) {
    o = o || {}; const m = this.m(mat), ord = o.ord ?? ++this.o, fam = o.fam ?? this.fam(), bias = o.bias || 0;
    const x0 = Math.floor(Math.min(ax - ra, bx - rb)) - 1, x1 = Math.ceil(Math.max(ax + ra, bx + rb)) + 1, y0 = Math.floor(Math.min(ay - ra, by - rb)) - 1, y1 = Math.ceil(Math.max(ay + ra, by + rb)) + 1;
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-6;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + .5, py = y + .5; const t = clamp(((px - ax) * dx + (py - ay) * dy) / L2, 0, 1);
      const cx = ax + dx * t, cy = ay + dy * t, r = ra + (rb - ra) * t, ex = px - cx, ey = py - cy, d2 = ex * ex + ey * ey;
      if (d2 > r * r) continue; const nx = ex / r, ny = ey / r, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      this.b.put(x, y, m, o.flat != null ? o.flat : shadeN(nx, ny, nz, bias), ord, fam);
    }
    return fam;
  };
  Painter.prototype.ellipse = function (cx, cy, rx, ry, mat, o) {
    o = o || {}; const m = this.m(mat), ord = o.ord ?? ++this.o, fam = o.fam ?? this.fam(), bias = o.bias || 0;
    for (let y = Math.floor(cy - ry) - 1; y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx) - 1; x <= cx + rx + 1; x++) {
      const nx = (x + .5 - cx) / rx, ny = (y + .5 - cy) / ry, d = nx * nx + ny * ny; if (d > 1) continue;
      if (o.clip && !o.clip(x, y)) continue;
      this.b.put(x, y, m, o.flat != null ? o.flat : shadeN(nx, ny, Math.sqrt(1 - d), bias), ord, fam);
    }
    return fam;
  };
  // polygon with cylindrical shading across each row (cloth, torso panels)
  Painter.prototype.poly = function (pts, mat, o) {
    o = o || {}; const m = this.m(mat), ord = o.ord ?? ++this.o, fam = o.fam ?? this.fam(), bias = o.bias || 0;
    let y0 = 1e9, y1 = -1e9, x0 = 1e9, x1 = -1e9; for (const [x, y] of pts) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
    const inside = (px, py) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) c = !c; } return c; };
    for (let y = Math.floor(y0); y <= y1; y++) {
      const row = []; for (let x = Math.floor(x0); x <= x1; x++) if (inside(x + .5, y + .5)) row.push(x);
      if (!row.length) continue; const a = row[0], b = row[row.length - 1], mid = (a + b) / 2 + .5, hw = Math.max(1, (b - a + 1) / 2);
      for (const x of row) { const nx = clamp((x + .5 - mid) / hw, -1, 1) * .92, ny = o.ny ?? -.15;
        let s = o.flat != null ? o.flat : shadeN(nx, ny, Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)), bias);
        if (o.folds && ((x + (o.fo || 0)) % o.folds === 0) && y > y0 + 2) s = Math.max(0, s - 1);
        this.b.put(x, y, m, s, ord, fam); }
    }
    return fam;
  };
  Painter.prototype.px = function (x, y, mat, s, o) { o = o || {}; this.b.put(Math.floor(x), Math.floor(y), this.m(mat), s ?? 2, o.ord ?? this.o, o.fam ?? this.f); };
  Painter.prototype.line = function (x0, y0, x1, y1, mat, s, o) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1); for (let i = 0; i <= n; i++) this.px(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, mat, s, o); };
  // curved, tapered hair lock (quadratic bezier spine) shaded with a blend of lock- and head-sphere normals
  Painter.prototype.lock = function (b, c, t, w, mat, hc, o) {
    o = o || {}; const m = this.m(mat), ord = o.ord ?? ++this.o, fam = o.fam ?? this.fam(), bias = o.bias || 0, N = 14, P = [];
    for (let i = 0; i <= N; i++) { const s = i / N, u = 1 - s; P.push([u * u * b[0] + 2 * u * s * c[0] + s * s * t[0], u * u * b[1] + 2 * u * s * c[1] + s * s * t[1]]); }
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of P) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    x0 -= w; y0 -= w; x1 += w; y1 += w;
    for (let y = Math.floor(y0); y <= y1; y++) for (let x = Math.floor(x0); x <= x1; x++) {
      const px = x + .5, py = y + .5; let best = 1e9, bt = 0, side = 1, tx = 0, ty = 1;
      for (let i = 0; i < N; i++) { const [ax, ay] = P[i], [bx, by] = P[i + 1], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-6;
        const tt = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1), qx = ax + dx * tt - px, qy = ay + dy * tt - py, d = qx * qx + qy * qy;
        if (d < best) { best = d; bt = (i + tt) / N; side = (dx * (py - ay) - dy * (px - ax)) > 0 ? 1 : -1; const l = Math.sqrt(l2); tx = dx / l; ty = dy / l; } }
      const half = w * .5 * Math.pow(1 - bt, .8) + .3, d = Math.sqrt(best); if (d > half) continue;
      const ac = side * d / half; let nx = -ty * ac, ny = tx * ac, nz = Math.sqrt(Math.max(0, 1 - ac * ac));
      if (hc) { const sx = (px - hc[0]) / hc[2], sy = (py - hc[1]) / hc[2], sz = Math.sqrt(Math.max(0, 1 - Math.min(1, sx * sx + sy * sy)));
        nx = nx * .55 + sx * .45; ny = ny * .55 + sy * .45; nz = nz * .55 + sz * .45; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l; }
      this.b.put(x, y, m, shadeN(nx, ny, nz, bias + (bt > .82 ? 1 : 0)), ord, fam);
    }
    return fam;
  };

  /* ---------- rig ---------- */
  const dirA = a => [Math.sin(a * D2R), Math.cos(a * D2R)];
  function rig(pr, p) {
    const legY = (h, k) => pr.thigh * Math.cos(h * D2R) + pr.shin * Math.cos((h - k) * D2R);
    let py = GY - 2 - Math.max(legY(p.lF[0], p.lF[1]), legY(p.lB[0], p.lB[1]));
    if (p.air) py = GY - 2 - (pr.thigh + pr.shin);
    py += p.py || 0; const pel = [PX + (p.px || 0), py];
    const t = (p.lean || 0) * D2R, u = [Math.sin(t), -Math.cos(t)], r = [Math.cos(t), Math.sin(t)];
    const add = (a, b, k) => [a[0] + b[0] * k, a[1] + b[1] * k];
    const neck = add(pel, u, pr.torso), head = add(add(neck, u, pr.neck), [p.hx || 0, p.hy || 0], 1);
    const sF = add(add(neck, r, pr.shF), u, -1.5), sB = add(add(neck, r, -pr.shB), u, -1.5);
    const hF = add(pel, r, 2.2), hB = add(pel, r, -2.2);
    const arm = (s, a) => { const e = add(s, dirA(a[0]), pr.uarm), w = add(e, dirA(a[0] + a[1]), pr.farm); return { s, e, w, fd: dirA(a[0] + a[1]), hand: a[2] || 'fist' }; };
    const leg = (h, l) => { const k = add(h, dirA(l[0]), pr.thigh), an = add(k, dirA(l[0] - l[1]), pr.shin); return { h, k, a: an, sd: dirA(l[0] - l[1]) }; };
    const J = { pel, neck, head, u, r, t, aF: arm(sF, p.aF), aB: arm(sB, p.aB), lF: leg(hF, p.lF), lB: leg(hB, p.lB) };
    if (p.a2F) { const s2 = add(sF, u, -6), s2b = add(sB, u, -6); J.a2F = arm(s2, p.a2F); J.a2B = arm(s2b, p.a2B || p.a2F); }
    return J;
  }

  /* ---------- body part helpers ---------- */
  function hand(P, A, mat, o) {
    const [x, y] = A.w, [fx, fy] = A.fd; o = o || {};
    if (A.hand === 'pocket' || A.hand === 'hide') return;
    if (A.hand === 'open') P.capsule(x, y, x + fx * 3.3, y + fy * 3.3, 1.5, 1.3, mat, o);
    else if (A.hand === 'point') { P.ellipse(x + fx * 1.2, y + fy * 1.2, 1.9, 1.9, mat, o); P.capsule(x + fx * 1.5, y + fy * 1.5, x + fx * 5, y + fy * 5, .65, .6, mat, { ...o, fam: P.f, ord: P.o }); }
    else if (A.hand === 'sign') { P.ellipse(x + fx * 1.1, y + fy * 1.1, 1.8, 1.8, mat, o); P.capsule(x + fx * .8 - .3, y + fy * .8 - 1, x + fx * .8 - .2, y + fy * .8 - 4.6, .6, .55, mat, { ...o, fam: P.f, ord: P.o });
      P.capsule(x + fx * .8 + 1, y + fy * .8 - 1, x + fx * .8 + 1.2, y + fy * .8 - 4.4, .6, .55, mat, { ...o, fam: P.f, ord: P.o }); }
    else P.ellipse(x + fx * 1.2, y + fy * 1.2, 2, 2, mat, o);
  }
  function limbArm(P, A, sleeve, skin, o) {
    o = o || {}; const b = o.bias || 0, r1 = o.r1 || 2.3, r2 = o.r2 || 2.05, r3 = o.r3 || 1.8, fam = P.fam();
    P.capsule(A.s[0], A.s[1], A.e[0], A.e[1], r1, r2, sleeve, { bias: b, fam });
    if (A.hand === 'pocket') { const w = [A.e[0] + A.fd[0] * (P.last = 6), A.e[1] + A.fd[1] * 6]; P.capsule(A.e[0], A.e[1], w[0], w[1], r2, r3, o.fore || sleeve, { bias: b, fam }); return; }
    P.capsule(A.e[0], A.e[1], A.w[0], A.w[1], r2, r3, o.fore || sleeve, { bias: b, fam });
    hand(P, A, skin, { bias: b, fam });
  }
  function limbLeg(P, Lg, pants, shoe, o) {
    o = o || {}; const b = o.bias || 0, fam = P.fam();
    P.capsule(Lg.h[0], Lg.h[1], Lg.k[0], Lg.k[1], o.t1 || 3.2, o.t2 || 2.8, pants, { bias: b, fam });
    P.capsule(Lg.k[0], Lg.k[1], Lg.a[0], Lg.a[1], o.t2 || 2.8, o.t3 || 2.2, o.shinMat || pants, { bias: b, fam });
    if (o.cuff) P.capsule(Lg.a[0] - Lg.sd[0] * 1.4, Lg.a[1] - Lg.sd[1] * 1.4, Lg.a[0], Lg.a[1], (o.t3 || 2.2) + .7, (o.t3 || 2.2) + .4, o.cuff, { bias: b - 1, fam });
    // foot points along the direction perpendicular to the shin, forward
    const fx = Lg.sd[1], fy = -Lg.sd[0], toe = [Lg.a[0] + fx * (o.foot || 4.2) + Lg.sd[0] * 1.4, Lg.a[1] + fy * (o.foot || 4.2) + Lg.sd[1] * 1.4];
    P.capsule(Lg.a[0] + Lg.sd[0] * .8 - fx * .6, Lg.a[1] + Lg.sd[1] * .8 - fy * .6, toe[0], toe[1], 1.7, 1.35, shoe, { bias: b, fam: P.fam() });
    if (o.sandal) { P.capsule(Lg.a[0] + Lg.sd[0] * 1.9 - fx * .4, Lg.a[1] + Lg.sd[1] * 1.9 - fy * .4, toe[0] + Lg.sd[0] * .6, toe[1] + Lg.sd[1] * .6, .6, .6, o.sandal, { flat: 0, fam: P.f }); }
  }
  function torso(P, J, mat, pr, o) {
    o = o || {}; const top = [J.neck[0] - J.u[0] * 1.2, J.neck[1] - J.u[1] * 1.2], low = [J.pel[0] + J.u[0] * 3, J.pel[1] + J.u[1] * 3];
    const fam = P.capsule(top[0], top[1], low[0], low[1], pr.chestW, pr.waistW, mat, { bias: o.bias || 0 });
    P.ellipse(J.pel[0] + J.r[0] * .3, J.pel[1] + 1, pr.hipW, 3.2, o.hipMat || mat, { fam, bias: o.bias || 0 });
    return fam;
  }
  // wide hanging sleeve (kimono) along an arm
  function sleeve(P, A, mat, drop, o) {
    const s = A.s, e = A.e, w = [A.e[0] + (A.w[0] - A.e[0]) * .75, A.e[1] + (A.w[1] - A.e[1]) * .75];
    const pts = [[s[0] - 2, s[1] - 1.5], [e[0], e[1] - 2.4], [w[0] + .5, w[1] - 2.4], [w[0] + .5, w[1] + 2.6], [w[0] - 1, w[1] + drop], [e[0] - 3, Math.max(e[1], w[1]) + drop - 1], [s[0] - 3, s[1] + drop * .7]];
    return P.poly(pts, mat, { bias: (o && o.bias) || 0, folds: 4, fo: 1 });
  }
  function skirt(P, J, mat, len, pr, o) {
    o = o || {}; const w = pr.waistW + 1.2, top = [J.pel[0] + J.u[0] * 2.5, J.pel[1] + J.u[1] * 2.5], wind = o.wind || 0;
    const kx0 = Math.min(J.lF.k[0], J.lB.k[0]), kx1 = Math.max(J.lF.k[0], J.lB.k[0]), ky = J.pel[1] + len;
    const pts = [[top[0] - w - J.r[0], top[1]], [top[0] + w, top[1] + 1], [Math.max(kx1 + 1.5, top[0] + w + 1) - wind * 1.5, ky], [Math.min(kx0 - 1.5, top[0] - w - 1) - wind * 4, ky + 1 + wind]];
    return P.poly(pts, mat, { bias: o.bias || 0, folds: o.folds || 3, fo: 2 });
  }
  function belt(P, J, mat, pr, tails) {
    const c = [J.pel[0] + J.u[0] * 3.2, J.pel[1] + J.u[1] * 3.2], w = pr.waistW + .8, fam = P.fam();
    P.poly([[c[0] - w, c[1] - 1.2], [c[0] + w, c[1] - 1.2], [c[0] + w, c[1] + 1.4], [c[0] - w, c[1] + 1.4]], mat, { fam, ny: -.1 });
    if (tails) { const k = [c[0] + w - 2, c[1]]; P.capsule(k[0], k[1], k[0] + .5, k[1] + 6, .8, .7, mat, { fam }); P.capsule(k[0] + 1.3, k[1], k[0] + 2.3, k[1] + 5, .8, .7, mat, { fam }); P.ellipse(k[0] + .6, k[1] + .3, 1.5, 1.3, mat, { fam }); }
  }
  function blade(P, from, ang, len, o) {
    o = o || {}; const d = dirA(ang), fam = P.fam(), s = [from[0] - d[0] * 4, from[1] - d[1] * 4];
    P.capsule(s[0], s[1], from[0], from[1], 1.05, 1.05, o.hilt || 'hilt', { fam, flat: 1 });
    P.capsule(from[0] - d[1] * 1.8, from[1] + d[0] * 1.8, from[0] + d[1] * 1.8, from[1] - d[0] * 1.8, .7, .7, o.guard || 'hilt', { fam, flat: 2 });
    const tip = [from[0] + d[0] * len, from[1] + d[1] * len];
    P.capsule(from[0], from[1], tip[0], tip[1], o.w || .95, .35, o.mat || 'steel', { fam });
    P.line(from[0] + d[1] * .4, from[1] - d[0] * .4, tip[0] - d[0] * 2, tip[1] - d[1] * 2, o.mat || 'steel', 3, { fam, ord: P.o });
  }

  /* ---------- heads (rendered once per expression, composited per frame) ---------- */
  const HB = 36, HOX = 11, HOY = 12;               // head buffer size and local-origin offset
  const NECK = [6.8, 17.4];                        // neck point in head-local coordinates
  function renderHead(C, expr) {
    const buf = new Buf(HB, HB), P = new Painter(buf, C.mats), H = C.head, X = x => x + HOX, Y = y => y + HOY;
    const hc = [X(7), Y(6.5), 9.5];
    const L = (b, c, t, w, mat, o) => P.lock([X(b[0]), Y(b[1])], [X(c[0]), Y(c[1])], [X(t[0]), Y(t[1])], w, mat, hc, o);
    for (const k of H.back || []) L(...k);
    if (H.backFn) H.backFn(P, X, Y, hc);
    // skull + jaw share one normal field so the face reads as one volume
    const skin = H.skin || 'skin', m = P.m(skin), fam = P.fam(), ord = ++P.o;
    const jaw = (H.jaw || [[1, 9.4], [13.6, 8.6], [13.6, 12], [12.7, 15], [11.1, 17], [8.4, 17.6], [5, 16], [2.4, 13.2]]).map(([x, y]) => [X(x), Y(y)]);
    const inJaw = (px, py) => { let c = false; for (let i = 0, j = jaw.length - 1; i < jaw.length; j = i++) { const [xi, yi] = jaw[i], [xj, yj] = jaw[j];
      if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) c = !c; } return c; };
    const cc = [X(7.2), Y(7.4)], crx = H.crx || 6.8, cry = 7.2;
    for (let y = Y(-1); y <= Y(19); y++) for (let x = X(-1); x <= X(16); x++) {
      const px = x + .5, py = y + .5, ex = (px - cc[0]) / crx, ey = (py - cc[1]) / cry;
      if (ex * ex + ey * ey > 1 && !inJaw(px, py)) continue;
      const nx = (px - X(8)) / 8.4, ny = (py - Y(9)) / 9.8, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      let s = shadeN(nx, ny, nz, 0); if (py > Y(15.8) && px < X(9)) s = Math.max(0, s - 1);
      buf.put(x, y, m, s, ord, fam);
    }
    P.px(X(13), Y(12.4), skin, 1, { fam, ord });
    P.ellipse(X(3.6), Y(11.2), 1.4, 2, skin, { fam, ord, bias: -1 }); P.px(X(3.6), Y(11.2), skin, 0, { fam, ord });
    if (H.faceFn) H.faceFn(P, X, Y, expr, fam, ord);
    // eyes
    const E = H.eyes, put = (x, y, ch) => { const k = E.map[ch]; if (k) P.px(X(x), Y(y), k[0], k[1], { fam, ord }); };
    const rows = expr === 'hurt' ? E.hurt : E.open;
    rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) put(E.x + i, E.y + j, row[i]); });
    if (E.brow) { put(7, E.y - 2, 'B'); put(8, E.y - 2, 'B'); put(9, E.y - 3 + (expr === 'shout' ? 1 : 0), 'B'); put(11, E.y - 2, 'B'); put(12, E.y - 2, 'B'); }
    // mouth
    const mo = H.mouth || [11, 15];
    if (expr === 'shout') { P.px(X(mo[0]), Y(mo[1]), 'mouth', 0, { fam, ord }); P.px(X(mo[0] + 1), Y(mo[1]), 'mouth', 0, { fam, ord }); P.px(X(mo[0]), Y(mo[1] + 1), 'mouth', 1, { fam, ord }); P.px(X(mo[0] + 1), Y(mo[1] - .9), 'teeth', 2, { fam, ord }); }
    else if (expr === 'smirk') { P.px(X(mo[0]), Y(mo[1]), 'mouth', 1, { fam, ord }); P.px(X(mo[0] + 1), Y(mo[1] - 1), 'mouth', 1, { fam, ord }); }
    else if (expr === 'hurt') { P.px(X(mo[0]), Y(mo[1]), 'mouth', 0, { fam, ord }); P.px(X(mo[0] + 1), Y(mo[1] + .5), 'mouth', 1, { fam, ord }); }
    else P.px(X(mo[0]), Y(mo[1]), 'mouth', 1, { fam, ord });
    // hair
    if (H.cap) P.ellipse(X(H.cap[0]), Y(H.cap[1]), H.cap[2], H.cap[3], H.hair, { clip: H.capClip ? (x, y) => H.capClip(x - HOX, y - HOY) : null });
    for (const k of H.front || []) L(...k);
    if (H.topFn) H.topFn(P, X, Y, hc, expr);
    // hair shadow on the forehead
    const hm = [...new Set([...(H.front || []), ...(H.back || [])].map(k => k[4]).concat(H.hair ? [H.hair] : []))].map(n => P.m(n));
    for (let y = HB - 1; y > 0; y--) for (let x = 0; x < HB; x++) { const i = y * HB + x; if (buf.mat[i] === m && buf.fam[i] === fam && hm.includes(buf.mat[i - HB]) && buf.sh[i] > 0 && y < Y(9.5)) buf.sh[i] = 1; }
    return buf;
  }
  function blitHead(frame, head, J, ordBase) {
    const dx = Math.round(J.head[0] - NECK[0] - HOX), dy = Math.round(J.head[1] - NECK[1] - HOY);
    for (let y = 0; y < HB; y++) for (let x = 0; x < HB; x++) { const i = y * HB + x; if (head.mat[i] < 0) continue;
      frame.put(x + dx, y + dy, head.mat[i], head.sh[i], ordBase + head.ord[i], 1000 + head.fam[i]); }
  }

  /* ---------- final pass: separation lines, outline, colour ---------- */
  function finish(buf, mats, ctx, ox, oy) {
    const W = buf.w, H = buf.h, sh = Int8Array.from(buf.sh);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (buf.mat[i] < 0) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const j = Y * W + X;
        if (buf.mat[j] >= 0 && buf.ord[j] < buf.ord[i] && buf.fam[j] !== buf.fam[i] && !mats.noSep[buf.mat[i]]) { sh[i] = Math.max(0, Math.min(sh[i], buf.sh[i] - 2)); break; } } }
    const img = ctx.createImageData(W, H), d = img.data, rgb = mats.ramps.map(r => r.map(hex2rgb));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, o = i * 4;
      if (buf.mat[i] >= 0) { const c = rgb[buf.mat[i]][sh[i]]; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255; continue; }
      let nb = -1; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; if (buf.mat[Y * W + X] >= 0) { nb = buf.mat[Y * W + X]; break; } }
      if (nb >= 0) { const c = rgb[nb][0]; d[o] = c[0] * .35 + 8; d[o + 1] = c[1] * .3 + 4; d[o + 2] = c[2] * .35 + 12; d[o + 3] = 255; }
    }
    ctx.putImageData(img, ox, oy);
  }

  /* ---------- poses ---------- */
  const FRAMES = ['idle0', 'idle1', 'idle2', 'idle3', 'run0', 'run1', 'run2', 'run3', 'run4', 'run5', 'fly0', 'fly1', 'dash', 'jab0', 'jab1', 'cross', 'kick0', 'kick1', 'castA', 'castB', 'castC', 'sign', 'guard', 'hurt', 'launch', 'victory'];
  const base = () => ({ px: 0, py: 0, lean: 5, hx: 0, hy: 0, expr: 'n', aF: [36, 78, 'fist'], aB: [22, 84, 'fist'], lF: [16, 10], lB: [-14, 6], wind: 0 });
  function pose(C, name) {
    const p = base(), st = C.stance || 'fight', S = C.poses || {};
    const set = o => Object.assign(p, o);
    if (name.startsWith('idle')) {
      const f = +name[4], b = [0, .6, 1, .5][f];
      if (st === 'pockets') set({ lean: 1, aF: [2, 32, 'pocket'], aB: [-6, 30, 'pocket'], lF: [7, 3], lB: [-6, 3], py: b * .6, expr: 'smirk' });
      else if (st === 'crossed') set({ lean: -1, aF: [34, 118, 'hide'], aB: [40, 112, 'hide'], backFront: 1, lF: [10, 2], lB: [-10, 2], py: b * .6, expr: 'smirk', a2F: [6, 30, 'fist'], a2B: [-4, 28, 'fist'] });
      else if (st === 'katana') set({ lean: 7, aF: [28, 58, 'fist'], aB: [34, 70, 'fist'], lF: [20, 12], lB: [-16, 6], py: b, weapon: 'guardLow' });
      else if (st === 'staff') set({ lean: 6, aF: [30, 60, 'fist'], aB: [30, 88, 'fist'], lF: [18, 12], lB: [-16, 6], py: b });
      else if (st === 'brute') set({ lean: 10, aF: [22, 30, 'fist'], aB: [14, 28, 'fist'], lF: [14, 8], lB: [-12, 6], py: b * 1.2 });
      else set({ py: b, aF: [36 + b * 2, 78, 'fist'] });
    } else if (name.startsWith('run')) {
      const ph = (+name[3]) / 6 * Math.PI * 2, s = Math.sin(ph), s2 = Math.sin(ph + Math.PI);
      set({ lean: 16, py: -Math.abs(Math.sin(ph * 2)) * 1.4, lF: [30 * s + 8, 14 + 40 * Math.max(0, Math.sin(ph + 1.4))], lB: [30 * s2 + 8, 14 + 40 * Math.max(0, Math.sin(ph + Math.PI + 1.4))],
        aF: [-34 * s + 12, 74, 'fist'], aB: [-34 * s2 + 12, 74, 'fist'], wind: 1 });
      if (st === 'crossed') set({ a2F: [-20 * s, 40, 'fist'], a2B: [-20 * s2, 40, 'fist'] });
    } else if (name === 'fly0' || name === 'fly1') {
      const k = name === 'fly1' ? 1 : 0;
      set({ air: 1, lean: 10, py: -1 - k, lF: [-8 - k * 3, 26 + k * 6], lB: [-26 - k * 3, 40 - k * 4], aF: [-18, 30, 'open'], aB: [-36, 26, 'open'], wind: 1 + k });
      if (st === 'pockets') set({ lean: 2, aF: [2, 32, 'pocket'], aB: [-6, 30, 'pocket'], lF: [-2, 8 + k * 3], lB: [-12, 16 + k * 3], expr: 'smirk' });
      if (st === 'crossed') set({ lean: 0, aF: [34, 118, 'hide'], aB: [40, 112, 'hide'], backFront: 1, lF: [-2, 6 + k * 2], lB: [-12, 14], expr: 'smirk', a2F: [4, 30, 'fist'], a2B: [-6, 28, 'fist'] });
    } else if (name === 'dash') set({ air: 1, lean: 36, lF: [-38, 50], lB: [-58, 34], aF: [-70, 12, 'open'], aB: [-82, 6, 'open'], wind: 3 });
    else if (name === 'jab0') set({ lean: 4, aF: [28, 122, 'fist'], aB: [22, 92, 'fist'], lF: [22, 14], lB: [-18, 6] });
    else if (name === 'jab1') set({ lean: 14, aF: [88, 4, 'fist'], aB: [18, 96, 'fist'], lF: [28, 16], lB: [-24, 4], expr: 'shout' });
    else if (name === 'cross') set({ lean: 22, aB: [86, 2, 'fist'], backFront: 1, aF: [14, 104, 'fist'], lF: [30, 22], lB: [-30, 4], expr: 'shout' });
    else if (name === 'kick0') set({ lean: -4, lF: [72, 112], lB: [-4, 4], aF: [16, 72, 'fist'], aB: [-26, 40, 'fist'] });
    else if (name === 'kick1') set({ lean: -16, lF: [100, 2], lB: [-8, 6], aF: [-22, 44, 'fist'], aB: [36, 64, 'fist'], expr: 'shout', wind: 1 });
    else if (name === 'castA') set({ lean: 6, aF: [94, -4, 'point'], aB: [12, 52, 'fist'], lF: [18, 10], lB: [-14, 6] });
    else if (name === 'castB') set({ lean: 10, aF: [90, 0, 'open'], aB: [82, 8, 'open'], backFront: 1, lF: [22, 12], lB: [-18, 6], expr: 'shout' });
    else if (name === 'castC') set({ lean: 12, aF: [96, 0, 'open'], aB: [100, 14, 'open'], backFront: 1, lF: [26, 14], lB: [-22, 4], expr: 'shout', wind: 2 });
    else if (name === 'sign') set({ lean: 2, aF: [52, 122, 'sign'], aB: [48, 116, 'sign'], backFront: 1, lF: [12, 4], lB: [-12, 4], expr: 'n' });
    else if (name === 'guard') set({ lean: -4, aF: [56, 126, 'fist'], aB: [46, 122, 'fist'], backFront: 1, lF: [14, 12], lB: [-18, 8] });
    else if (name === 'hurt') set({ lean: -18, hx: -1, aF: [-34, 40, 'open'], aB: [-54, 32, 'open'], lF: [20, 16], lB: [-6, 20], expr: 'hurt' });
    else if (name === 'launch') set({ air: 1, lean: -52, px: 8, py: 6, aF: [-110, 30, 'open'], aB: [-136, 22, 'open'], lF: [42, 40], lB: [22, 60], expr: 'hurt', wind: 3 });
    else if (name === 'victory') set({ lean: 0, aF: [160, 4, 'fist'], aB: [12, 30, 'fist'], lF: [12, 4], lB: [-12, 4], expr: 'smirk' });
    else if (name === 'down') set({ lean: 0, aF: [-6, 20, 'open'], aB: [12, 24, 'open'], lF: [4, 8], lB: [-4, 14], expr: 'hurt' });
    if (st === 'crossed' && !p.a2F) set({ a2F: [p.aF[0] * .6, 40, 'fist'], a2B: [p.aB[0] * .6, 40, 'fist'] });
    if (S[name]) set(typeof S[name] === 'function' ? S[name](p) : S[name]);
    return p;
  }

  /* ---------- characters ---------- */
  const SK = { skin: ['#a86a5e', '#e0a58f', '#f7d0bc', '#fff0e6'], skinW: ['#9e5f55', '#d69a86', '#f0c6b0', '#ffe4d4'], skinT: ['#7a4630', '#b5724e', '#d99a72', '#f2c29c'], skinH: ['#8f5a4a', '#c78c74', '#e6b59a', '#f8d8c4'] };
  const flat = c => [c, c, c, c];
  const COMMON = { mouth: ['#5a1e24', '#9a4a4a', '#c07070', '#e0a0a0'], teeth: flat('#fff6ee'), eyeW: flat('#f6f8ff'), hi: flat('#ffffff'), lashK: flat('#1b1024'),
    steel: ['#4a5060', '#8e96a8', '#d4dcea', '#ffffff'], hilt: ['#120c10', '#241820', '#3a2a30', '#58444a'], mark: flat('#1d0a10') };
  const eyesStd = (iris, irisD, lash, extra) => ({ x: 7, y: 9, brow: true,
    map: { K: ['lash', 0], W: ['eyeW', 0], I: ['iris', 0], i: ['irisD', 0], h: ['hi', 0], B: ['brow', 0], s: ['skin', 1], M: ['mark', 0], r: ['iris', 0], ...(extra || {}) },
    open: ['KKK.KK', 'WhI.hI', 'WIi.Ii', '.s....'], hurt: ['......', 'KKK.KK', '.s....', '......'] });

  const CHARS = {
    gojo: {
      name: 'gojo', stance: 'pockets',
      pr: { torso: 22, neck: 2, thigh: 15, shin: 15, uarm: 12, farm: 11, chestW: 5.6, waistW: 4.5, hipW: 4.8, shF: 2.4, shB: 2.8 },
      mats: { skin: SK.skin, hair: ['#6c79a6', '#aebbe0', '#e9eeff', '#ffffff'], brow: flat('#c9d2ee'), iris: flat('#7af4ff'), irisD: flat('#1b86d2'), lash: flat('#56608c'),
        shirt: ['#06060b', '#0f111b', '#1c2033', '#343b55'], pants: ['#878ea9', '#c0c6d9', '#e9ecf4', '#ffffff'], belt: ['#050508', '#0e0e14', '#1e1e28', '#383848'], shoe: ['#050508', '#0e0e14', '#1d1d27', '#30303f'] },
      head: {
        hair: 'hair', cap: [7, 3.4, 7.8, 4.6],
        back: [[[4, 3], [0, 5], [-2.6, 9.5], 5.2, 'hair'], [[3.5, 6], [0.6, 10], [0.2, 14.6], 4.6, 'hair'], [[5, 1.5], [1, 0], [-2.2, 3], 4.6, 'hair'], [[2.5, 8], [0, 12], [2.2, 15.6], 3.4, 'hair']],
        front: [[[6, 0], [4, -2.5], [1.5, -4], 5, 'hair'], [[9, 0], [9.5, -3], [7.8, -5.2], 5, 'hair'], [[11.5, 1.5], [14, -.5], [16, -1.6], 4, 'hair'],
          [[5.5, 2.6], [4.4, 6], [3.2, 9.4], 3.8, 'hair'], [[7, 2.5], [7.2, 5], [6.8, 7.6], 3.8, 'hair'], [[8.6, 2.5], [9.4, 5.6], [10, 9.8], 3.4, 'hair'], [[10.8, 2.6], [12.6, 5.4], [13.8, 8.8], 3.2, 'hair']],
        eyes: eyesStd(), mouth: [11, 15]
      },
      draw(P, J, p, head) {
        const pr = this.pr;
        limbArm(P, J.aB, 'shirt', 'skin', { bias: -1 });
        limbLeg(P, J.lB, 'pants', 'shoe', { bias: -1, t1: 3.9, t2: 3.4, t3: 2.5, cuff: 'pants' });
        limbLeg(P, J.lF, 'pants', 'shoe', { t1: 3.9, t2: 3.4, t3: 2.5, cuff: 'pants' });
        P.capsule(J.neck[0], J.neck[1], J.head[0], J.head[1], 2, 2, 'skin', { bias: -1 });
        torso(P, J, 'shirt', pr, { hipMat: 'pants' });
        P.capsule(J.neck[0] - J.u[0] * .6 - .6, J.neck[1] - J.u[1] * .6, J.neck[0] + .8, J.neck[1] - 1.4, 2.2, 2, 'shirt', {});
        belt(P, J, 'belt', pr, true);
        blitHead(P.b, head, J, 100);
        if (p.backFront) limbArm(P, J.aB, 'shirt', 'skin', { bias: -1 });
        limbArm(P, J.aF, 'shirt', 'skin');
      }
    },
    sukuna: {
      name: 'sukuna', stance: 'crossed',
      pr: { torso: 21, neck: 2, thigh: 14.5, shin: 14, uarm: 11.5, farm: 10.5, chestW: 5.6, waistW: 4.8, hipW: 5, shF: 2.4, shB: 2.8 },
      mats: { skin: SK.skinW, hair: ['#04050a', '#0e1019', '#1d2236', '#3b4462'], brow: flat('#0e1019'), iris: flat('#ff4636'), irisD: flat('#8a0f14'), lash: flat('#12060c'),
        kimono: ['#8c8578', '#cdc5b6', '#f0eadf', '#ffffff'], under: ['#06060b', '#0f111b', '#1c2033', '#343b55'], belt: ['#050508', '#0e0e14', '#1e1e28', '#383848'], shoe: ['#050508', '#0e0e14', '#1d1d27', '#30303f'] },
      noSep: ['kimono'],
      head: {
        hair: 'hair', cap: [7, 3.2, 7.8, 5],
        back: [[[3, 4], [-1, 3], [-4, .6], 4.6, 'hair'], [[3, 7.5], [-.5, 8.5], [-3.2, 10.4], 4.2, 'hair'], [[5, 1.5], [2, -1.5], [-.4, -4.6], 4.6, 'hair'], [[3.2, 10], [1, 12.5], [1.6, 15], 3.2, 'hair']],
        front: [[[7, .5], [7.2, -3.5], [6, -7], 5.2, 'hair'], [[9.5, 1], [11.4, -2.4], [12, -5.6], 4.6, 'hair'], [[11.5, 2.5], [14.4, .4], [17, -1.6], 4.2, 'hair'],
          [[12, 4.2], [15, 4], [18, 4.6], 3.6, 'hair'], [[11, 4.4], [13.6, 6.6], [15.2, 8.6], 3, 'hair'], [[8.8, 3.6], [9.6, 6.6], [10.1, 9.4], 3, 'hair'], [[6.8, 3.6], [6.8, 5.8], [6.4, 7.6], 3.2, 'hair'], [[5.6, 4], [4.6, 7], [3.6, 9.6], 3.2, 'hair'], [[4.2, 1], [1.8, -2], [1, -5], 4.4, 'hair']],
        eyes: Object.assign(eyesStd(), { open: ['KKK.KK', 'WhI.hI', 'WIi.Ii', '.MM..M'], hurt: ['......', 'KKK.KK', '.s....', '.MM..M'] }),
        faceFn(P, X, Y, e, fam, ord) { P.px(X(6), Y(13), 'mark', 0, { fam, ord }); P.px(X(6), Y(14), 'mark', 0, { fam, ord }); },
        mouth: [11, 15]
      },
      draw(P, J, p, head) {
        const pr = this.pr;
        if (!p.backFront) { sleeve(P, J.aB, 'kimono', 7, { bias: -1 }); limbArm(P, J.aB, 'kimono', 'skin', { bias: -1 }); }
        limbLeg(P, J.lB, 'kimono', 'shoe', { bias: -1, t1: 4.1, t2: 3.7, t3: 3.1, sandal: 'belt' });
        limbLeg(P, J.lF, 'kimono', 'shoe', { t1: 4.1, t2: 3.7, t3: 3.1, sandal: 'belt' });
        skirt(P, J, 'kimono', 9, pr, { wind: p.wind });
        P.capsule(J.neck[0], J.neck[1], J.head[0], J.head[1], 2, 2, 'skin', { bias: -1 });
        const tf = torso(P, J, 'kimono', pr, {});
        // crossed collar: black undershirt V, white lapels
        const n = [J.neck[0] + J.r[0] * 1.2, J.neck[1] - J.u[1] * 0 + 1];
        P.poly([[n[0] - 2.6, n[1] - 1], [n[0] + 2.8, n[1] - 1], [n[0] + .6, n[1] + 6]], 'under', { fam: tf, ord: ++P.o });
        P.line(n[0] - 2.6, n[1] - 1, n[0] + .6, n[1] + 6.5, 'kimono', 1, { fam: tf, ord: P.o });
        belt(P, J, 'belt', pr, false);
        blitHead(P.b, head, J, 100);
        if (p.backFront) { sleeve(P, J.aB, 'kimono', 7, { bias: -1 }); limbArm(P, J.aB, 'kimono', 'skin', { bias: -1 }); }
        sleeve(P, J.aF, 'kimono', 7); limbArm(P, J.aF, 'kimono', 'skin');
      }
    },
    sukunah: {
      name: 'sukunah', stance: 'crossed',
      pr: { torso: 24, neck: 2, thigh: 16, shin: 15.5, uarm: 12.5, farm: 11.5, chestW: 6.4, waistW: 5.2, hipW: 5.4, shF: 2.6, shB: 3 },
      mats: { skin: SK.skinW, hair: ['#8a3f58', '#c77890', '#eaa2b4', '#ffd6e0'], brow: flat('#8a3f58'), iris: flat('#ff4636'), irisD: flat('#8a0f14'), lash: flat('#12060c'),
        hakama: ['#0c080e', '#1a121e', '#2c2230', '#463a4c'], obi: ['#8c8578', '#cdc5b6', '#f0eadf', '#ffffff'], shoe: ['#050508', '#0e0e14', '#1d1d27', '#30303f'] },
      head: {
        hair: 'hair', cap: [6.4, 3.6, 7.4, 4.6],
        back: [[[5, 1.5], [1, -2], [-3, -3.6], 5.2, 'hair'], [[4, 4.5], [0, 3], [-4, 2.6], 4.8, 'hair'], [[3.4, 8], [0, 9.4], [-2.6, 11.6], 4.2, 'hair']],
        front: [[[8, .8], [6.5, -3.4], [3.6, -6.4], 5.2, 'hair'], [[10.6, 2], [10.6, -2.4], [9.2, -5.6], 4.6, 'hair'], [[12, 3.6], [13.4, .6], [13.6, -2.6], 3.6, 'hair'], [[12.6, 3.8], [13.8, 5.6], [14, 7.4], 2.4, 'hair']],
        eyes: Object.assign(eyesStd(), { open: ['KKK.KK', 'WhI.hI', 'WIi.Ii', 'MrM.Mr'], hurt: ['......', 'KKK.KK', '.s....', 'MrM.Mr'] }),
        faceFn(P, X, Y, e, fam, ord) { for (const [x, y] of [[6, 13], [6, 14], [8, 6], [9, 6], [10, 6], [12, 7]]) P.px(X(x), Y(y), 'mark', 0, { fam, ord }); },
        mouth: [11, 15.2]
      },
      draw(P, J, p, head) {
        const pr = this.pr, bare = { r1: 2.5, r2: 2.3, r3: 1.9 };
        limbArm(P, J.aB, 'skin', 'skin', { bias: -1, ...bare });
        if (J.a2B) limbArm(P, J.a2B, 'skin', 'skin', { bias: -1, ...bare });
        limbLeg(P, J.lB, 'hakama', 'shoe', { bias: -1, t1: 4.4, t2: 4, t3: 3.4 });
        limbLeg(P, J.lF, 'hakama', 'shoe', { t1: 4.4, t2: 4, t3: 3.4 });
        P.capsule(J.neck[0], J.neck[1], J.head[0], J.head[1], 2.2, 2.2, 'skin', { bias: -1 });
        const tf = torso(P, J, 'skin', pr, { hipMat: 'hakama' });
        // tattoo bands and the mouth on the abdomen
        const c = J.neck, u = J.u, r = J.r;
        for (const k of [5, 9]) P.line(c[0] - r[0] * 4 - u[0] * k, c[1] - u[1] * k - 0, c[0] + r[0] * 4 - u[0] * k, c[1] - u[1] * k + r[1] * 4, 'mark', 0, { fam: tf, ord: ++P.o });
        const m = [J.pel[0] + J.r[0] * 1.5 + J.u[0] * 8, J.pel[1] + J.u[1] * 8];
        P.line(m[0] - 2.5, m[1], m[0] + 2.5, m[1], 'mark', 0, { fam: tf, ord: ++P.o }); P.px(m[0] - 1, m[1] - 1, 'teeth', 2, { fam: tf, ord: P.o }); P.px(m[0] + 1, m[1] - 1, 'teeth', 2, { fam: tf, ord: P.o });
        belt(P, J, 'obi', pr, true);
        blitHead(P.b, head, J, 100);
        if (J.a2F) limbArm(P, J.a2F, 'skin', 'skin', bare);
        if (p.backFront) limbArm(P, J.aB, 'skin', 'skin', { bias: -1, ...bare });
        limbArm(P, J.aF, 'skin', 'skin', bare);
        for (const A of [J.aF, J.a2F]) if (A && A.hand !== 'hide') P.line(A.w[0] - A.fd[0] * 3 - 1.5, A.w[1] - A.fd[1] * 3, A.w[0] - A.fd[0] * 3 + 1.5, A.w[1] - A.fd[1] * 3 + 1, 'mark', 0, { ord: ++P.o });
      }
    },
    yuji: {
      name: 'yuji', stance: 'fight',
      pr: { torso: 20, neck: 2, thigh: 14, shin: 13.5, uarm: 11, farm: 10, chestW: 5.6, waistW: 4.7, hipW: 4.8, shF: 2.4, shB: 2.8 },
      mats: { skin: ['#9a5e4e', '#d89a80', '#f2c6aa', '#ffe4d2'], hair: ['#8a3f4e', '#d0788a', '#f2a6b2', '#ffd8df'], under: ['#1a0f0e', '#2e1c1a', '#44302c', '#5e4640'], brow: flat('#6a3038'),
        iris: flat('#c07a48'), irisD: flat('#5a2e1c'), lash: flat('#1b1024'), jacket: ['#07080f', '#111427', '#1d2340', '#303a60'], hood: ['#5e0c14', '#9a1824', '#cf2a36', '#f06a6a'], shoe: ['#7a7a88', '#c8c8d4', '#f0f0f6', '#ffffff'], gold: flat('#e8b45a') },
      head: {
        hair: 'hair', cap: [7, 3.4, 7, 3.8],
        backFn(P, X, Y) { P.ellipse(X(3.2), Y(7.6), 2.6, 3.4, 'under', { bias: -1 }); },
        back: [[[3, 3], [0, 2], [-2.4, 1.6], 3.8, 'hair']],
        front: [[[4, 1], [3, -2.4], [1.6, -4], 3.8, 'hair'], [[7, 0], [7, -3], [6.2, -5], 4, 'hair'], [[10, 1], [11, -2], [11.4, -4.2], 3.8, 'hair'], [[12, 3], [14.2, 1.6], [15.6, .6], 3, 'hair'],
          [[8, 2.6], [8.6, 4.8], [8.2, 6.8], 3.4, 'hair'], [[10.5, 2.6], [12, 4.8], [12.4, 6.8], 3, 'hair'], [[6, 2.6], [5.4, 4.8], [4.6, 6.6], 3, 'hair']],
        eyes: eyesStd(), mouth: [11, 15],
        faceFn(P, X, Y, e, fam, ord) { P.px(X(9), Y(13), 'skin', 0, { fam, ord }); }
      },
      draw(P, J, p, head) {
        const pr = this.pr;
        limbArm(P, J.aB, 'jacket', 'skin', { bias: -1 });
        limbLeg(P, J.lB, 'jacket', 'shoe', { bias: -1 }); limbLeg(P, J.lF, 'jacket', 'shoe', {});
        P.ellipse(J.neck[0] - J.r[0] * 3.5, J.neck[1] + 1.5, 3.6, 3, 'hood', { bias: -1 });
        P.capsule(J.neck[0], J.neck[1], J.head[0], J.head[1], 2, 2, 'skin', { bias: -1 });
        const tf = torso(P, J, 'jacket', pr, {});
        skirt(P, J, 'jacket', 5, pr, { wind: p.wind });
        P.capsule(J.neck[0] - 3, J.neck[1] + .5, J.neck[0] + 2, J.neck[1] + .5, 1.6, 1.4, 'hood', { fam: tf });
        for (const k of [3, 7, 11]) P.px(J.neck[0] + J.r[0] * 2 - J.u[0] * k, J.neck[1] - J.u[1] * k, 'gold', 0, { fam: tf, ord: ++P.o });
        blitHead(P.b, head, J, 100);
        if (p.backFront) limbArm(P, J.aB, 'jacket', 'skin', { bias: -1 });
        limbArm(P, J.aF, 'jacket', 'skin');
      }
    },
    yuta: {
      name: 'yuta', stance: 'katana',
      pr: { torso: 21, neck: 2, thigh: 14.5, shin: 14, uarm: 11.5, farm: 10.5, chestW: 5.2, waistW: 4.4, hipW: 4.6, shF: 2.3, shB: 2.7 },
      mats: { skin: SK.skin, hair: ['#03040a', '#0c0e1a', '#1a1e30', '#343c58'], brow: flat('#0c0e1a'), iris: flat('#6a7aa0'), irisD: flat('#252a40'), lash: flat('#12081a'),
        coat: ['#8d93a6', '#c7ccda', '#eef0f6', '#ffffff'], pants: ['#0d0e16', '#191b28', '#2a2d40', '#43475e'], shoe: ['#050508', '#0e0e14', '#1d1d27', '#30303f'] },
      head: {
        hair: 'hair', cap: [7, 3.6, 7.6, 4.8],
        back: [[[4, 3], [0, 6], [-1, 11], 5, 'hair'], [[3, 7], [1, 11.5], [2, 15], 4, 'hair'], [[5, 1], [1.5, .5], [-1.8, 3], 4.4, 'hair']],
        front: [[[6, 0], [4.5, -2], [2.6, -3], 4.4, 'hair'], [[9, 0], [10, -2], [11, -3], 4.2, 'hair'], [[6, 2.8], [5, 6.4], [4, 9.8], 3.6, 'hair'], [[7.6, 2.8], [7.8, 5.4], [7.4, 7.8], 3.6, 'hair'], [[9.2, 2.8], [9.8, 6], [10.1, 9.8], 3.2, 'hair'], [[11.2, 3], [12.8, 5.8], [13.6, 8.6], 2.8, 'hair']],
        eyes: eyesStd(), mouth: [11, 15],
        faceFn(P, X, Y, e, fam, ord) { P.px(X(7), Y(13), 'skin', 0, { fam, ord }); P.px(X(8), Y(13), 'skin', 1, { fam, ord }); P.px(X(11), Y(13), 'skin', 0, { fam, ord }); }
      },
      draw(P, J, p, head) {
        const pr = this.pr;
        P.line(J.neck[0] - 7, J.neck[1] - 3, J.pel[0] + 7, J.pel[1] + 3, 'hilt', 1, { ord: ++P.o, fam: P.fam() });
        limbArm(P, J.aB, 'coat', 'skin', { bias: -1 });
        limbLeg(P, J.lB, 'pants', 'shoe', { bias: -1 }); limbLeg(P, J.lF, 'pants', 'shoe', {});
        P.capsule(J.neck[0], J.neck[1], J.head[0], J.head[1], 2, 2, 'skin', { bias: -1 });
        const tf = torso(P, J, 'coat', pr, {});
        skirt(P, J, 'coat', 11, pr, { wind: p.wind });
        P.line(J.neck[0] + J.r[0] * 1.6, J.neck[1] + .5, J.pel[0] + J.r[0] * 1.6 + J.u[0] * 2, J.pel[1] + 4, 'coat', 0, { fam: tf, ord: ++P.o });
        P.capsule(J.neck[0] - 2.6, J.neck[1] - .6, J.neck[0] + 2.6, J.neck[1] - .6, 1.6, 1.6, 'coat', { fam: tf });
        blitHead(P.b, head, J, 100);
        if (p.backFront) limbArm(P, J.aB, 'coat', 'skin', { bias: -1 });
        limbArm(P, J.aF, 'coat', 'skin');
        if (p.weapon === 'guardLow' || p.aF[2] === 'fist' && p.aF[0] > 60) blade(P, J.aF.w, p.aF[0] > 60 ? p.aF[0] + p.aF[1] - 8 : 118, 21, {});
      }
    },
    kashimo: {
      name: 'kashimo', stance: 'staff',
      pr: { torso: 21, neck: 2, thigh: 14.5, shin: 14, uarm: 11.5, farm: 10.5, chestW: 5.4, waistW: 4.5, hipW: 4.8, shF: 2.4, shB: 2.8 },
      mats: { skin: SK.skin, hair: ['#3f6a94', '#76b0d8', '#b0e2ff', '#e8f8ff'], brow: flat('#3f6a94'), iris: flat('#8ac8ff'), irisD: flat('#23406a'), lash: flat('#12081a'),
        top: ['#0a1622', '#15283a', '#22405a', '#3a6282'], trim: ['#2a7aa8', '#4ab8e8', '#8ae0ff', '#dff8ff'], pants: ['#07080e', '#11131c', '#1e2130', '#363a50'], shoe: ['#050508', '#0e0e14', '#1d1d27', '#30303f'], wood: ['#3a2412', '#6a4424', '#9a6a3a', '#c89a60'] },
      head: {
        hair: 'hair', cap: [7, 3.2, 7.4, 4.2],
        back: [[[3, 3], [-3, 8], [-6, 20], 5.4, 'hair'], [[4, 5], [-1, 12], [-2.6, 22], 4.4, 'hair']],
        front: [[[5, 1], [3, -4], [0, -8], 5, 'hair'], [[8, 0], [8, -5], [6.6, -9.4], 5.2, 'hair'], [[10.6, 1.4], [12.6, -2.6], [13.4, -6.4], 4.4, 'hair'], [[12.4, 3.4], [15, 2], [17.4, 1.6], 3.2, 'hair'],
          [[7.8, 2.6], [8.2, 5], [7.6, 7.2], 3.2, 'hair'], [[9.8, 2.6], [10.2, 5.6], [10.1, 8.6], 2.6, 'hair'], [[11.4, 2.8], [12.8, 5.2], [13.2, 7.4], 2.6, 'hair']],
        eyes: eyesStd(), mouth: [11, 15]
      },
      draw(P, J, p, head) {
        const pr = this.pr, sb = J.aB.w, sd = dirA((p.aB[0] + p.aB[1]) + 90);
        P.capsule(sb[0] - sd[0] * 26, sb[1] - sd[1] * 26, sb[0] + sd[0] * 22, sb[1] + sd[1] * 22, 1, 1, 'wood', { bias: -1 });
        limbArm(P, J.aB, 'top', 'skin', { bias: -1 });
        limbLeg(P, J.lB, 'pants', 'shoe', { bias: -1 }); limbLeg(P, J.lF, 'pants', 'shoe', {});
        P.capsule(J.neck[0], J.neck[1], J.head[0], J.head[1], 2, 2, 'skin', { bias: -1 });
        const tf = torso(P, J, 'top', pr, {});
        skirt(P, J, 'top', 7, pr, { wind: p.wind });
        P.line(J.neck[0] - 2, J.neck[1], J.neck[0] + 2, J.neck[1] + 5, 'trim', 2, { fam: tf, ord: ++P.o });
        belt(P, J, 'trim', pr, true);
        blitHead(P.b, head, J, 100);
        if (p.backFront) limbArm(P, J.aB, 'top', 'skin', { bias: -1 });
        limbArm(P, J.aF, 'top', 'skin');
      }
    },
    higuruma: {
      name: 'higuruma', stance: 'fight',
      pr: { torso: 21.5, neck: 2, thigh: 15, shin: 14.5, uarm: 11.5, farm: 10.5, chestW: 5.5, waistW: 4.8, hipW: 4.8, shF: 2.4, shB: 2.8 },
      mats: { skin: SK.skinH, hair: ['#020306', '#0b0c12', '#181a24', '#30344a'], brow: flat('#0b0c12'), iris: flat('#6a5040'), irisD: flat('#2a1c14'), lash: flat('#12081a'), stub: flat('#b88870'),
        suit: ['#0e0f14', '#1b1d26', '#2c2f3c', '#454a5c'], shirt: ['#8d93a6', '#c7ccda', '#eef0f6', '#ffffff'], tie: ['#3a0a10', '#6a1420', '#9a2030', '#c84a58'], shoe: ['#050508', '#0e0e14', '#1d1d27', '#30303f'], gold: flat('#e8c860') },
      head: {
        hair: 'hair', cap: [6.6, 3.4, 7.4, 3.8],
        back: [[[5, 2], [0, 2], [-2.6, 5], 5, 'hair'], [[3, 6], [0, 8], [0, 11.6], 4, 'hair']],
        front: [[[11, 1.8], [7, -1.2], [1, -.8], 5, 'hair'], [[12.4, 3.2], [9, .4], [3, .8], 3.6, 'hair'], [[10.4, 2.8], [11, 5.4], [10.1, 8.8], 1.8, 'hair']],
        eyes: Object.assign(eyesStd(), { open: ['KKK.KK', 'WIi.Ii', 'Wii.ii', 'ss..s.'] }), mouth: [11, 15],
        faceFn(P, X, Y, e, fam, ord) { for (const [x, y] of [[7, 16], [8, 17], [9, 17], [10, 17], [11, 16], [12, 15], [10, 16]]) P.px(X(x), Y(y), 'stub', 0, { fam, ord }); }
      },
      draw(P, J, p, head) {
        const pr = this.pr;
        limbArm(P, J.aB, 'suit', 'skin', { bias: -1 });
        limbLeg(P, J.lB, 'suit', 'shoe', { bias: -1 }); limbLeg(P, J.lF, 'suit', 'shoe', {});
        P.capsule(J.neck[0], J.neck[1], J.head[0], J.head[1], 2, 2, 'skin', { bias: -1 });
        const tf = torso(P, J, 'suit', pr, {});
        const n = [J.neck[0] + J.r[0] * 1.4, J.neck[1] + 1];
        P.poly([[n[0] - 2.2, n[1] - 1.2], [n[0] + 2.4, n[1] - 1.2], [n[0] + .2, n[1] + 7]], 'shirt', { fam: tf, ord: ++P.o });
        P.line(n[0] + .2, n[1] - .4, n[0] + .2, n[1] + 6.4, 'tie', 1, { fam: tf, ord: ++P.o }); P.px(n[0] - 2.6, n[1] + 2.5, 'gold', 0, { fam: tf, ord: P.o });
        skirt(P, J, 'suit', 5, pr, { wind: p.wind });
        blitHead(P.b, head, J, 100);
        if (p.backFront) limbArm(P, J.aB, 'suit', 'skin', { bias: -1 });
        limbArm(P, J.aF, 'suit', 'skin');
        if (p.aF[0] > 60 && p.aF[2] === 'fist') { const w = J.aF.w, d = dirA(p.aF[0] + p.aF[1] - 80); P.capsule(w[0], w[1], w[0] + d[0] * 6, w[1] + d[1] * 6, .8, .8, 'wood2', {}); P.capsule(w[0] + d[0] * 6 - 3, w[1] + d[1] * 6 - 1, w[0] + d[0] * 6 + 3, w[1] + d[1] * 6 + 1, 2, 2, 'wood2', {}); }
      }
    },
    maki: {
      name: 'maki', stance: 'katana',
      pr: { torso: 20, neck: 2, thigh: 15, shin: 14.5, uarm: 11, farm: 10, chestW: 5, waistW: 4, hipW: 4.8, shF: 2.2, shB: 2.6 },
      mats: { skin: SK.skin, hair: ['#08140f', '#122a20', '#1f4232', '#36644c'], brow: flat('#122a20'), iris: flat('#b07a50'), irisD: flat('#4a2a18'), lash: flat('#12081a'), scar: flat('#c98078'),
        suit: ['#07070b', '#111219', '#1e202b', '#363a4c'], shoe: ['#050508', '#0e0e14', '#1d1d27', '#30303f'] },
      head: {
        hair: 'hair', cap: [7, 3.6, 7.4, 4.6],
        back: [[[4, 3], [0.5, 6], [0, 11.4], 5, 'hair'], [[3, 6], [1.4, 10], [2.6, 13.2], 4, 'hair']],
        front: [[[6, 0], [4.5, -1.6], [2.6, -2.4], 4, 'hair'], [[9, 0], [10, -1.6], [11, -2.2], 4, 'hair'], [[5.8, 2.8], [5.2, 6], [4.4, 8.8], 3.4, 'hair'], [[7.8, 2.6], [8.2, 5], [7.8, 7.4], 3.6, 'hair'], [[9.8, 2.6], [10.4, 5.4], [10.1, 8.4], 3, 'hair'], [[12, 3.2], [13.4, 5.6], [13.8, 10.6], 2.4, 'hair']],
        eyes: eyesStd(), mouth: [11, 15],
        faceFn(P, X, Y, e, fam, ord) { for (const [x, y] of [[6, 12], [6, 13], [7, 14], [8, 14], [9, 13], [6, 11], [5, 13]]) P.px(X(x), Y(y), 'scar', 0, { fam, ord }); }
      },
      draw(P, J, p, head) {
        const pr = this.pr;
        limbArm(P, J.aB, 'suit', 'skin', { bias: -1 });
        limbLeg(P, J.lB, 'suit', 'shoe', { bias: -1, t1: 3, t2: 2.6, t3: 2.1 }); limbLeg(P, J.lF, 'suit', 'shoe', { t1: 3, t2: 2.6, t3: 2.1 });
        P.capsule(J.neck[0], J.neck[1], J.head[0], J.head[1], 1.9, 1.9, 'skin', { bias: -1 });
        torso(P, J, 'suit', pr, {});
        P.capsule(J.neck[0] - 2, J.neck[1] - .4, J.neck[0] + 2, J.neck[1] - .4, 1.8, 1.8, 'suit', {});
        blitHead(P.b, head, J, 100);
        if (p.backFront) limbArm(P, J.aB, 'suit', 'skin', { bias: -1 });
        limbArm(P, J.aF, 'suit', 'skin');
        const a = p.aF[0] > 60 ? p.aF[0] + p.aF[1] - 6 : p.weapon === 'guardLow' ? 112 : 150;
        blade(P, J.aF.w, a, 24, { w: 1 });
      }
    },
    todo: {
      name: 'todo', stance: 'fight',
      pr: { torso: 22, neck: 2.4, thigh: 15, shin: 14, uarm: 12, farm: 11, chestW: 7.4, waistW: 5.8, hipW: 5.6, shF: 3.2, shB: 3.6 },
      mats: { skin: SK.skinT, hair: ['#020306', '#0b0c12', '#181a24', '#30344a'], brow: flat('#0b0c12'), iris: flat('#6a4a30'), irisD: flat('#2a1a10'), lash: flat('#12081a'), scar: flat('#8a4040'),
        tank: ['#8d93a6', '#c7ccda', '#eef0f6', '#ffffff'], pants: ['#0d0e16', '#1c1e2a', '#2e3142', '#474b60'], shoe: ['#050508', '#0e0e14', '#1d1d27', '#30303f'], wood: ['#3a2412', '#6a4424', '#9a6a3a', '#c89a60'] },
      head: {
        hair: 'hair', crx: 7, jaw: [[1, 9], [13.6, 8], [13.6, 12], [12.8, 15], [11, 17], [7.6, 17.4], [4.4, 15.8], [2.2, 12.8]],
        backFn(P, X, Y) { P.ellipse(X(6.8), Y(3.6), 6.6, 3.8, 'hair', { bias: -1 }); },
        front: [[[5, 1], [4.6, -2], [5.6, -4.4], 4.4, 'hair'], [[6.4, -1.4], [4, -3], [2.4, -1.2], 3.2, 'hair']],
        topFn(P, X, Y) { P.ellipse(X(5.6), Y(-3.4), 2.4, 2, 'hair', {}); },
        eyes: Object.assign(eyesStd(), { open: ['BBB.BB', 'WIi.Ii', 'Wii.ii', '......'] }), mouth: [11, 15.4],
        faceFn(P, X, Y, e, fam, ord) { for (let y = 7; y <= 14; y++) P.px(X(8), Y(y), 'scar', 0, { fam, ord }); }
      },
      draw(P, J, p, head) {
        const pr = this.pr, big = { r1: 3.1, r2: 2.8, r3: 2.3 };
        limbArm(P, J.aB, 'skin', 'skin', { bias: -1, ...big });
        const w = J.aB.w; P.capsule(w[0], w[1], w[0] + J.aB.fd[0] * 4, w[1] + J.aB.fd[1] * 4, 1.6, 1.6, 'wood', { bias: -1 }); P.ellipse(w[0] + J.aB.fd[0] * 7, w[1] + J.aB.fd[1] * 7, 1.4, 1.4, 'wood', {});
        limbLeg(P, J.lB, 'pants', 'shoe', { bias: -1, t1: 3.8, t2: 3.4, t3: 2.8 }); limbLeg(P, J.lF, 'pants', 'shoe', { t1: 3.8, t2: 3.4, t3: 2.8 });
        P.capsule(J.neck[0], J.neck[1], J.head[0], J.head[1], 2.8, 2.6, 'skin', { bias: -1 });
        const tf = torso(P, J, 'tank', pr, { hipMat: 'pants' });
        P.capsule(J.neck[0] - J.r[0] * 4.2, J.neck[1] + 1.2, J.neck[0] - J.r[0] * 4.2 - J.u[0] * 3, J.neck[1] + 4, 2.4, 2.4, 'skin', { fam: tf, bias: -1 });
        P.capsule(J.neck[0] + J.r[0] * 3.8, J.neck[1] + 1.2, J.neck[0] + J.r[0] * 3.8 - J.u[0] * 3, J.neck[1] + 4, 2.4, 2.4, 'skin', { fam: tf });
        blitHead(P.b, head, J, 100);
        if (p.backFront) limbArm(P, J.aB, 'skin', 'skin', { bias: -1, ...big });
        limbArm(P, J.aF, 'skin', 'skin', big);
      }
    },
    mahoraga: {
      name: 'mahoraga', stance: 'brute',
      pr: { torso: 30, neck: 3, thigh: 21, shin: 20, uarm: 16, farm: 15, chestW: 8.6, waistW: 6.2, hipW: 6.2, shF: 3.4, shB: 3.8 },
      mats: { skin: ['#5e5a62', '#9a969c', '#d2cec8', '#f4f0ea'], cloth: ['#120e14', '#221a26', '#342a3a', '#4e4256'], blade: ['#6a5a30', '#b8a470', '#ece2c4', '#ffffff'], wing: ['#6a6a88', '#b0b0c4', '#e8e8f0', '#ffffff'],
        brow: flat('#5e5a62'), iris: flat('#1d0a10'), irisD: flat('#1d0a10'), lash: flat('#1d0a10'), band: ['#140a14', '#2a1628', '#40243c', '#5a3656'] },
      head: {
        hair: 'wing', skin: 'skin',
        back: [[[3, 6], [-3, 2], [-7, -6], 4.4, 'wing'], [[3, 9], [-4, 7], [-9, 4], 3.8, 'wing']],
        front: [[[9, 3], [8, -3], [4, -9], 4.2, 'wing'], [[11, 4], [13, -2], [12, -7], 3.6, 'wing']],
        eyes: { x: 7, y: 9, map: { K: ['band', 1], k: ['band', 0] }, open: ['KKKKKK', 'kkkkkk', '......', '......'], hurt: ['KKKKKK', 'kkkkkk', '......', '......'] }, mouth: [11, 15]
      },
      draw(P, J, p, head) {
        const pr = this.pr, big = { r1: 4, r2: 3.6, r3: 3 };
        limbArm(P, J.aB, 'skin', 'skin', { bias: -1, ...big });
        limbLeg(P, J.lB, 'skin', 'skin', { bias: -1, t1: 4.6, t2: 4, t3: 3.2, foot: 5 }); limbLeg(P, J.lF, 'skin', 'skin', { t1: 4.6, t2: 4, t3: 3.2, foot: 5 });
        P.capsule(J.neck[0], J.neck[1], J.head[0], J.head[1], 3.4, 3, 'skin', { bias: -1 });
        torso(P, J, 'skin', pr, { hipMat: 'cloth' });
        skirt(P, J, 'cloth', 12, pr, { wind: p.wind, folds: 4 });
        blitHead(P.b, head, J, 100);
        if (p.backFront) limbArm(P, J.aB, 'skin', 'skin', { bias: -1, ...big });
        limbArm(P, J.aF, 'skin', 'skin', big);
        const e = J.aF.e, w = J.aF.w, d = J.aF.fd; P.capsule(e[0] + d[0] * 3, e[1] + d[1] * 3, w[0] + d[0] * 20, w[1] + d[1] * 20, 2, .5, 'blade', {});
      }
    }
  };
  CHARS.higuruma.mats.wood2 = ['#3a2412', '#6a4424', '#9a6a3a', '#c89a60'];
  CHARS.gojo.poses = { castA: { expr: 'smirk' }, sign: { aF: [58, 124, 'sign'], aB: [4, 30, 'pocket'], backFront: 0, expr: 'smirk' }, victory: { aF: [150, 10, 'sign'], aB: [-6, 30, 'pocket'], expr: 'smirk' } };
  CHARS.sukuna.poses = { castA: { aF: [150, -34, 'open'], aB: [30, 110, 'hide'], expr: 'smirk' }, castC: { aF: [92, 0, 'fist'], aB: [84, 150, 'fist'], backFront: 1, expr: 'shout' }, victory: { expr: 'smirk' } };
  CHARS.sukunah.poses = { castA: { aF: [150, -34, 'open'], a2F: [100, 0, 'open'], expr: 'smirk' }, castC: { aF: [92, 0, 'fist'], aB: [84, 150, 'fist'], backFront: 1, a2F: [60, 60, 'fist'], expr: 'shout' }, sign: { a2F: [40, 110, 'sign'], a2B: [44, 108, 'sign'] }, victory: { expr: 'smirk' } };
  CHARS.maki.poses = { idle0: { weapon: 'guardLow' }, idle1: { weapon: 'guardLow' }, idle2: { weapon: 'guardLow' }, idle3: { weapon: 'guardLow' } };

  function materials(C) { const names = [], ramps = []; for (const [k, v] of Object.entries({ ...COMMON, ...C.mats })) { names.push(k); ramps.push(R(v)); }
    const noSep = names.map(n => (C.noSep || []).includes(n) || ['eyeW', 'hi', 'mark', 'teeth', 'mouth', 'lashK'].includes(n)); return { names, ramps, noSep }; }

  function build(key) {
    const C = CHARS[key]; C.mats.iris = C.mats.iris || flat('#333'); const M = materials(C); C.mats = C.mats; C.matsResolved = M;
    const atlas = document.createElement('canvas'); atlas.width = ATW; atlas.height = ATH; const ctx = atlas.getContext('2d');
    const heads = {}; const H = e => heads[e] || (heads[e] = renderHead({ mats: M, head: C.head }, e));
    const anchors = {};
    FRAMES.forEach((name, i) => {
      const p = pose(C, name), J = rig(C.pr, p), buf = new Buf(CW, CH), P = new Painter(buf, M);
      C.draw(P, J, p, H(p.expr || 'n')); finish(buf, M, ctx, i * CW, 0); anchors[name] = J.head;
    });
    // lying frame: draw a standing pose in a square buffer, rotate it 90 degrees and drop it on the ground line
    { const p = pose(C, 'down'), J = rig(C.pr, p), sq = new Buf(128, 128); for (const k of ['pel', 'neck', 'head']) J[k][0] += 34;
      const J2 = rig(C.pr, Object.assign({}, p, { px: 34 })); const P = new Painter(sq, M); C.draw(P, J2, p, H('hurt'));
      const rot = new Buf(128, 128); let maxY = 0;
      for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) { const i = y * 128 + x; if (sq.mat[i] < 0) continue; const nx = y, ny = 127 - x; rot.put(nx, ny, sq.mat[i], sq.sh[i], sq.ord[i], sq.fam[i]); maxY = Math.max(maxY, ny); }
      const sh = new Buf(128, 128), dy = GY - 1 - maxY;
      for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) { const i = y * 128 + x; if (rot.mat[i] < 0) continue; sh.put(x, y + dy, rot.mat[i], rot.sh[i], rot.ord[i], rot.fam[i]); }
      finish(sh, M, ctx, 0, CH); }
    const pc = document.createElement('canvas'), a = anchors.idle0, cx = Math.round(a[0]) - 16, cy = Math.round(a[1]) - 29; pc.width = pc.height = 96;
    const pg = pc.getContext('2d'); pg.imageSmoothingEnabled = false; pg.drawImage(atlas, cx, cy, 32, 32, 0, 0, 96, 96);
    const fc = document.createElement('canvas'); fc.width = 128; fc.height = 192; const fg = fc.getContext('2d'); fg.imageSmoothingEnabled = false; fg.drawImage(atlas, 0, 32, 64, 96, 0, 0, 128, 192);
    return { key, canvas: atlas, frames: Object.fromEntries(FRAMES.map((n, i) => [n, i])), anchors, portrait: pc.toDataURL(), full: fc.toDataURL() };
  }
  // the Divine General's dharma wheel, drawn separately so it can turn
  function wheel() { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d');
    const P = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { const dx = x - 15.5, dy = y - 15.5, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      if (d > 9.5 && d < 12) P(x, y, d > 11 ? '#8a6a20' : '#f0c850');
      else if (d < 3) P(x, y, d < 1.6 ? '#fff0b0' : '#c89a30');
      else if (d <= 9.5 && Math.abs(Math.sin(a * 4)) < .22) P(x, y, '#e0b040');
      if (d >= 12 && d < 15 && Math.abs(Math.sin(a * 4)) < .3) P(x, y, d > 14 ? '#8a6a20' : '#f0c850'); }
    return c; }
  return { build, CHARS, FRAMES, CW, CH, GY, PX, ATW, ATH, wheel };
})();
