'use strict';
/* Character renderer.
   Every body is a 2D rig (capsules, cloth polygons, curved hair locks) that is rasterized at 2x supersampling with
   six-step hue-shifted cel shading, separation lines, a coloured outline and hand-built faces. Alongside the colour
   atlas it writes a normal-map atlas, so the game can light sprites with the scene's sun, sky and domains.
   Atlas layout: row 0 holds 128x256 frames, row 1 the 256x256 "down" frame. */
window.SPR = (function () {
  const K = 2, CW = 64, CH = 128, GY = 125, PX = 30, OW = CW * K, OH = CH * K, ATW = 4096, ATH = 512;
  const BODY = { torso: 1.14, thigh: 1.24, shin: 1.24, uarm: 1.16, farm: 1.16 }, KH = K * .88;           // longer bodies, smaller heads: ~6 heads tall
  const D2R = Math.PI / 180;
  const LV = (() => { const v = [0.45, -0.6, 0.66], n = Math.hypot(...v); return v.map(x => x / n); })();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------- colour ---------- */
  function hex2rgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; }
  function rgb2hsl(r, g, b) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2;
    if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return [h, s, l]; }
  function hsl2hex(h, s, l) { h = ((h % 360) + 360) % 360; s = clamp(s, 0, 1); l = clamp(l, 0, 1);
    const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    return '#' + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join(''); }
  function toward(h, t, amt) { const d = ((t - h + 540) % 360) - 180; return h + clamp(d, -amt, amt); }
  function mkRamp(base) { const [h, s, l] = rgb2hsl(...hex2rgb(base));
    return [hsl2hex(toward(h, 255, 28), s * 1.05 + .06, l * .42), hsl2hex(toward(h, 255, 14), s * 1.02 + .03, l * .7), base, hsl2hex(toward(h, 50, 8), s * .95, l + (1 - l) * .4)]; }
  const mix = (a, b, t) => { const A = hex2rgb(a), B = hex2rgb(b); return A.map((v, i) => Math.round(v + (B[i] - v) * t)); };
  // four hand-picked anchors become six shading steps
  function six(r4) { const r = typeof r4 === 'string' ? mkRamp(r4) : r4; return [hex2rgb(r[0]), mix(r[0], r[1], .5), hex2rgb(r[1]), mix(r[1], r[2], .5), hex2rgb(r[2]), hex2rgb(r[3])]; }

  /* ---------- buffers ---------- */
  function Buf(w, h) { this.w = w; this.h = h; const n = w * h; this.mat = new Int16Array(n).fill(-1); this.sh = new Uint8Array(n); this.ord = new Int16Array(n); this.fam = new Int16Array(n); this.nx = new Int8Array(n); this.ny = new Int8Array(n); this.nz = new Int8Array(n); }
  Buf.prototype.put = function (x, y, m, s, o, f, nx, ny, nz) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; const i = y * this.w + x;
    this.mat[i] = m; this.sh[i] = clamp(s, 0, 5); this.ord[i] = o; this.fam[i] = f; this.nx[i] = (nx ?? 0) * 127; this.ny[i] = (ny ?? 0) * 127; this.nz[i] = (nz ?? 1) * 127; };
  function shade6(nx, ny, nz, bias) { const d = nx * LV[0] + ny * LV[1] + nz * LV[2]; const i = d > .86 ? 5 : d > .64 ? 4 : d > .42 ? 3 : d > .22 ? 2 : d > .04 ? 1 : 0; return clamp(i + (bias | 0) * 2, 0, 5); }

  /* ---------- painter: design units in, output pixels out ---------- */
  function Painter(buf, mats, k) { this.b = buf; this.mats = mats; this.k = k; this.o = 1; this.f = 1; }
  const PP = Painter.prototype;
  PP.m = function (n) { const i = this.mats.names.indexOf(n); if (i < 0) throw new Error('no material ' + n); return i; };
  PP.fam = function () { return ++this.f; };
  PP.span = function (x0, y0, x1, y1, fn) { const k = this.k; for (let Y = Math.floor(y0 * k) - 1; Y <= Math.ceil(y1 * k) + 1; Y++) for (let X = Math.floor(x0 * k) - 1; X <= Math.ceil(x1 * k) + 1; X++) fn(X, Y, (X + .5) / k, (Y + .5) / k); };
  PP.capsule = function (ax, ay, bx, by, ra, rb, mat, o) {
    o = o || {}; const m = this.m(mat), ord = o.ord ?? ++this.o, fam = o.fam ?? this.fam(), bias = o.bias || 0, dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-6;
    this.span(Math.min(ax - ra, bx - rb), Math.min(ay - ra, by - rb), Math.max(ax + ra, bx + rb), Math.max(ay + ra, by + rb), (X, Y, px, py) => {
      const t = clamp(((px - ax) * dx + (py - ay) * dy) / L2, 0, 1), cx = ax + dx * t, cy = ay + dy * t, r = ra + (rb - ra) * t, ex = px - cx, ey = py - cy, d2 = ex * ex + ey * ey;
      if (d2 > r * r) return; const nx = ex / r, ny = ey / r, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      this.b.put(X, Y, m, o.flat != null ? o.flat : shade6(nx, ny, nz, bias), ord, fam, nx, ny, nz); });
    return fam;
  };
  PP.ellipse = function (cx, cy, rx, ry, mat, o) {
    o = o || {}; const m = this.m(mat), ord = o.ord ?? ++this.o, fam = o.fam ?? this.fam(), bias = o.bias || 0;
    this.span(cx - rx, cy - ry, cx + rx, cy + ry, (X, Y, px, py) => { const nx = (px - cx) / rx, ny = (py - cy) / ry, d = nx * nx + ny * ny; if (d > 1) return; if (o.clip && !o.clip(px, py)) return;
      const nz = Math.sqrt(1 - d); this.b.put(X, Y, m, o.flat != null ? o.flat : shade6(nx, ny, nz, bias), ord, fam, nx, ny, nz); });
    return fam;
  };
  PP.poly = function (pts, mat, o) {
    o = o || {}; const m = this.m(mat), ord = o.ord ?? ++this.o, fam = o.fam ?? this.fam(), bias = o.bias || 0, k = this.k;
    let y0 = 1e9, y1 = -1e9, x0 = 1e9, x1 = -1e9; for (const [x, y] of pts) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
    const inside = (px, py) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) c = !c; } return c; };
    for (let Y = Math.floor(y0 * k); Y <= Math.ceil(y1 * k); Y++) { const py = (Y + .5) / k, row = [];
      for (let X = Math.floor(x0 * k); X <= Math.ceil(x1 * k); X++) if (inside((X + .5) / k, py)) row.push(X);
      if (!row.length) continue; const a = row[0], b = row[row.length - 1], mid = (a + b) / 2 + .5, hw = Math.max(1, (b - a + 1) / 2);
      for (const X of row) { const nx = clamp((X + .5 - mid) / hw, -1, 1) * .92, ny = o.ny ?? -.15, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        let s = o.flat != null ? o.flat : shade6(nx, ny, nz, bias);
        if (o.folds && (Math.floor((X / k) + (o.fo || 0)) % o.folds === 0) && py > y0 + 2) s = Math.max(0, s - 2);
        this.b.put(X, Y, m, s, ord, fam, nx, ny, nz); } }
    return fam;
  };
  // a single design-unit block, or a fine output pixel when o.fine is set
  PP.px = function (x, y, mat, s, o) { o = o || {}; const k = this.k, m = this.m(mat), ord = o.ord ?? this.o, fam = o.fam ?? this.f, sz = o.fine ? 1 : Math.round(k);
    const X0 = Math.floor(x * k), Y0 = Math.floor(y * k); for (let j = 0; j < sz; j++) for (let i = 0; i < sz; i++) this.b.put(X0 + i, Y0 + j, m, s ?? 3, ord, fam, 0, 0, 1); };
  PP.dot = function (X, Y, mat, s, o) { o = o || {}; this.b.put(X, Y, this.m(mat), s ?? 3, o.ord ?? this.o, o.fam ?? this.f, 0, 0, 1); };
  PP.line = function (x0, y0, x1, y1, mat, s, o) { o = o || {}; const k = this.k, X0 = x0 * k, Y0 = y0 * k, X1 = x1 * k, Y1 = y1 * k, n = Math.max(Math.abs(X1 - X0), Math.abs(Y1 - Y0), 1), t = Math.max(1, Math.round((o.w || .5) * k));
    for (let i = 0; i <= n; i++) { const X = Math.round(X0 + (X1 - X0) * i / n), Y = Math.round(Y0 + (Y1 - Y0) * i / n); for (let a = 0; a < t; a++) for (let b = 0; b < t; b++) this.dot(X + a, Y + b, mat, s, o); } };
  PP.lock = function (b, c, t, w, mat, hc, o) {
    o = o || {}; const m = this.m(mat), ord = o.ord ?? ++this.o, fam = o.fam ?? this.fam(), bias = o.bias || 0, N = 16, P = [];
    for (let i = 0; i <= N; i++) { const s = i / N, u = 1 - s; P.push([u * u * b[0] + 2 * u * s * c[0] + s * s * t[0], u * u * b[1] + 2 * u * s * c[1] + s * s * t[1]]); }
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of P) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    this.span(x0 - w, y0 - w, x1 + w, y1 + w, (X, Y, px, py) => {
      let best = 1e9, bt = 0, side = 1, tx = 0, ty = 1;
      for (let i = 0; i < N; i++) { const [ax, ay] = P[i], [bx, by] = P[i + 1], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-6;
        const tt = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1), qx = ax + dx * tt - px, qy = ay + dy * tt - py, d = qx * qx + qy * qy;
        if (d < best) { best = d; bt = (i + tt) / N; side = (dx * (py - ay) - dy * (px - ax)) > 0 ? 1 : -1; const l = Math.sqrt(l2); tx = dx / l; ty = dy / l; } }
      const half = w * .5 * Math.pow(1 - bt, .8) + .25, d = Math.sqrt(best); if (d > half) return;
      const ac = side * d / half; let nx = -ty * ac, ny = tx * ac, nz = Math.sqrt(Math.max(0, 1 - ac * ac));
      if (hc) { const sx = (px - hc[0]) / hc[2], sy = (py - hc[1]) / hc[2], sz = Math.sqrt(Math.max(0, 1 - Math.min(1, sx * sx + sy * sy)));
        nx = nx * .55 + sx * .45; ny = ny * .55 + sy * .45; nz = nz * .55 + sz * .45; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l; }
      let s = shade6(nx, ny, nz, bias); if (bt > .8) s = Math.min(5, s + 1);
      // anime hair sheen: a bright band across the upper hair mass
      if (hc && o.sheen !== false && Math.abs(py - (hc[1] - hc[2] * .25)) < .55 && Math.abs(ac) < .55 && s >= 3) s = 5;
      this.b.put(X, Y, m, s, ord, fam, nx, ny, nz); });
    return fam;
  };

  /* ---------- rig (design units) ---------- */
  const dirA = a => [Math.sin(a * D2R), Math.cos(a * D2R)];
  function rig(pr0, p) {
    const pr = Object.assign({}, pr0); for (const k in BODY) pr[k] *= BODY[k];
    const legY = (h, k) => pr.thigh * Math.cos(h * D2R) + pr.shin * Math.cos((h - k) * D2R);
    let py = GY - 2 - Math.max(legY(p.lF[0], p.lF[1]), legY(p.lB[0], p.lB[1]));
    if (p.air) py = GY - 2 - (pr.thigh + pr.shin);
    py += p.py || 0; const pel = [PX + (p.px || 0), py];
    const t = (p.lean || 0) * D2R, u = [Math.sin(t), -Math.cos(t)], r = [Math.cos(t), Math.sin(t)];
    const add = (a, b, k) => [a[0] + b[0] * k, a[1] + b[1] * k];
    const neck = add(pel, u, pr.torso), head = add(add(neck, u, pr.neck), [p.hx || 0, p.hy || 0], 1);
    const sF = add(add(neck, r, pr.shF), u, -1.8), sB = add(add(neck, r, -pr.shB), u, -1.8);
    const hF = add(pel, r, 2.2), hB = add(pel, r, -2.2);
    const arm = (s, a) => { const e = add(s, dirA(a[0]), pr.uarm), w = add(e, dirA(a[0] + a[1]), pr.farm); return { s, e, w, fd: dirA(a[0] + a[1]), hand: a[2] || 'fist' }; };
    const leg = (h, l) => { const k = add(h, dirA(l[0]), pr.thigh), an = add(k, dirA(l[0] - l[1]), pr.shin); return { h, k, a: an, sd: dirA(l[0] - l[1]) }; };
    const J = { pel, neck, head, u, r, t, pr, aF: arm(sF, p.aF), aB: arm(sB, p.aB), lF: leg(hF, p.lF), lB: leg(hB, p.lB) };
    if (p.a2F) { J.a2F = arm(add(sF, u, -6.5), p.a2F); J.a2B = arm(add(sB, u, -6.5), p.a2B || p.a2F); }
    return J;
  }

  /* ---------- body parts ---------- */
  function hand(P, A, mat, o) {
    const [x, y] = A.w, [fx, fy] = A.fd; o = o || {};
    if (A.hand === 'pocket' || A.hand === 'hide') return;
    const f = { ...o, fam: o.fam ?? P.f, ord: P.o };
    if (A.hand === 'open') { P.capsule(x, y, x + fx * 3.4, y + fy * 3.4, 1.5, 1.2, mat, o); P.capsule(x + fx * 1, y + fy * 1 - .3, x + fx * 1.4 + fy * 1.6, y + fy * 1.4 - fx * 1.6, .5, .45, mat, f); }
    else if (A.hand === 'point') { P.ellipse(x + fx * 1.2, y + fy * 1.2, 1.9, 1.8, mat, o); P.capsule(x + fx * 1.5, y + fy * 1.5, x + fx * 5.2, y + fy * 5.2, .6, .5, mat, f); }
    else if (A.hand === 'sign') { P.ellipse(x + fx * 1.1, y + fy * 1.1, 1.8, 1.8, mat, o); P.capsule(x + fx * .8 - .4, y + fy * .8 - 1, x + fx * .8 - .3, y + fy * .8 - 4.8, .55, .5, mat, f); P.capsule(x + fx * .8 + .9, y + fy * .8 - 1, x + fx * .8 + 1.1, y + fy * .8 - 4.6, .55, .5, mat, f); }
    else if (A.hand === 'claw') { P.ellipse(x + fx * 1.4, y + fy * 1.4, 2.6, 2.4, mat, o); for (const a of [-40, 0, 40]) { const d = dirA(Math.atan2(fx, fy) / D2R + a); P.capsule(x + fx * 2.4, y + fy * 2.4, x + fx * 2.4 + d[0] * 5.5, y + fy * 2.4 + d[1] * 5.5, .8, .2, o.claw || mat, f); } }
    else { P.ellipse(x + fx * 1.2, y + fy * 1.2, 2, 1.9, mat, o); P.line(x + fx * 1.2 + fy * 1.1, y + fy * 1.2 - fx * 1.1, x + fx * 2.4 + fy * .4, y + fy * 2.4 - fx * .4, mat, 1, { ...f, w: .35 }); }
  }
  function limbArm(P, A, sleeve, skin, o) {
    o = o || {}; const b = o.bias || 0, r1 = o.r1 || 2.3, r2 = o.r2 || 2.05, r3 = o.r3 || 1.8, fam = P.fam();
    P.capsule(A.s[0], A.s[1], A.e[0], A.e[1], r1, r2, sleeve, { bias: b, fam });
    if (A.hand === 'pocket') { P.capsule(A.e[0], A.e[1], A.e[0] + A.fd[0] * 6.5, A.e[1] + A.fd[1] * 6.5, r2, r3, o.fore || sleeve, { bias: b, fam }); return; }
    P.capsule(A.e[0], A.e[1], A.w[0], A.w[1], r2, r3, o.fore || sleeve, { bias: b, fam });
    if (o.cuff) P.capsule(A.w[0] - A.fd[0] * 1.6, A.w[1] - A.fd[1] * 1.6, A.w[0] - A.fd[0] * .3, A.w[1] - A.fd[1] * .3, r3 + .35, r3 + .35, o.cuff, { bias: b - 1, fam });
    hand(P, A, skin, { bias: b, fam, claw: o.claw });
  }
  function limbLeg(P, Lg, pants, shoe, o) {
    o = o || {}; const b = o.bias || 0, fam = P.fam();
    P.capsule(Lg.h[0], Lg.h[1], Lg.k[0], Lg.k[1], o.t1 || 3.2, o.t2 || 2.8, pants, { bias: b, fam });
    P.capsule(Lg.k[0], Lg.k[1], Lg.a[0], Lg.a[1], o.t2 || 2.8, o.t3 || 2.2, o.shinMat || pants, { bias: b, fam });
    // knee crease and a fold line on baggy trousers
    P.line(Lg.k[0] - Lg.sd[1] * .6, Lg.k[1] + .2, Lg.k[0] + Lg.sd[1] * 1.2, Lg.k[1] + 1.2, o.shinMat || pants, 1, { fam, ord: P.o, w: .3 });
    if (o.cuff) P.capsule(Lg.a[0] - Lg.sd[0] * 1.6, Lg.a[1] - Lg.sd[1] * 1.6, Lg.a[0], Lg.a[1], (o.t3 || 2.2) + .7, (o.t3 || 2.2) + .4, o.cuff, { bias: b - 1, fam });
    const fx = Lg.sd[1], fy = -Lg.sd[0], fl = o.foot || 4.4, toe = [Lg.a[0] + fx * fl + Lg.sd[0] * 1.4, Lg.a[1] + fy * fl + Lg.sd[1] * 1.4];
    const ff = P.fam(); P.capsule(Lg.a[0] + Lg.sd[0] * .8 - fx * .7, Lg.a[1] + Lg.sd[1] * .8 - fy * .7, toe[0], toe[1], 1.7, 1.3, shoe, { bias: b, fam: ff });
    if (o.sock) P.capsule(Lg.a[0] - Lg.sd[0] * .2, Lg.a[1] - Lg.sd[1] * .2, Lg.a[0] + Lg.sd[0] * .9, Lg.a[1] + Lg.sd[1] * .9, 1.6, 1.6, o.sock, { bias: b, fam: ff });
    if (o.sandal) P.line(Lg.a[0] + Lg.sd[0] * 1.9 - fx * .4, Lg.a[1] + Lg.sd[1] * 1.9 - fy * .4, toe[0] + Lg.sd[0] * .6, toe[1] + Lg.sd[1] * .6, o.sandal, 0, { fam: ff, ord: P.o, w: .5 });
    P.line(Lg.a[0] + Lg.sd[0] * 2.3 - fx * .9, Lg.a[1] + Lg.sd[1] * 2.3 - fy * .9, toe[0] + Lg.sd[0] * 1.2, toe[1] + Lg.sd[1] * 1.2, shoe, 0, { fam: ff, ord: P.o, w: .35 });
  }
  function torso(P, J, mat, pr, o) {
    o = o || {}; const top = [J.neck[0] - J.u[0] * 1.2, J.neck[1] - J.u[1] * 1.2], low = [J.pel[0] + J.u[0] * 3, J.pel[1] + J.u[1] * 3];
    const fam = P.capsule(top[0], top[1], low[0], low[1], pr.chestW, pr.waistW, mat, { bias: o.bias || 0 });
    P.ellipse(J.pel[0] + J.r[0] * .3, J.pel[1] + 1, pr.hipW, 3.4, o.hipMat || mat, { fam, bias: o.bias || 0 });
    if (o.chest !== false) { const c = [J.neck[0] + J.r[0] * 1.5 - J.u[0] * 7, J.neck[1] - J.u[1] * 7]; P.line(c[0] - 2.5, c[1] + .3, c[0] + 2.8, c[1] + .9, o.lineMat || mat, 1, { fam, ord: P.o, w: .3 }); }
    return fam;
  }
  function sleeve(P, A, mat, drop, o) {
    const s = A.s, e = A.e, w = [A.e[0] + (A.w[0] - A.e[0]) * .78, A.e[1] + (A.w[1] - A.e[1]) * .78];
    const pts = [[s[0] - 2, s[1] - 1.6], [e[0], e[1] - 2.5], [w[0] + .5, w[1] - 2.5], [w[0] + .6, w[1] + 2.7], [w[0] - 1, w[1] + drop], [e[0] - 3, Math.max(e[1], w[1]) + drop - 1], [s[0] - 3, s[1] + drop * .7]];
    return P.poly(pts, mat, { bias: (o && o.bias) || 0, folds: 3, fo: 1 });
  }
  function skirt(P, J, mat, len, pr, o) {
    o = o || {}; const w = pr.waistW + 1.2, top = [J.pel[0] + J.u[0] * 2.5, J.pel[1] + J.u[1] * 2.5], wind = o.wind || 0;
    const kx0 = Math.min(J.lF.k[0], J.lB.k[0], J.lF.a[0], J.lB.a[0]), kx1 = Math.max(J.lF.k[0], J.lB.k[0], len > 22 ? J.lF.a[0] : -1e9), ky = J.pel[1] + len;
    const pts = [[top[0] - w - J.r[0], top[1]], [top[0] + w, top[1] + 1], [Math.max(kx1 + 1.6, top[0] + w + 1.2) - wind * 1, ky], [Math.min(kx0 - 1.6, top[0] - w - 1.4) - wind * 2.2, ky + 1 + wind * .4]];
    return P.poly(pts, mat, { bias: o.bias || 0, folds: o.folds || 3, fo: 2 });
  }
  function belt(P, J, mat, pr, tails) {
    const c = [J.pel[0] + J.u[0] * 3.4, J.pel[1] + J.u[1] * 3.4], w = pr.waistW + .8, fam = P.fam();
    P.poly([[c[0] - w, c[1] - 1.3], [c[0] + w, c[1] - 1.3], [c[0] + w, c[1] + 1.5], [c[0] - w, c[1] + 1.5]], mat, { fam, ny: -.1 });
    if (tails) { const k = [c[0] + w - 2, c[1]]; P.capsule(k[0], k[1], k[0] + .5, k[1] + 6.5, .8, .7, mat, { fam }); P.capsule(k[0] + 1.3, k[1], k[0] + 2.4, k[1] + 5.4, .8, .7, mat, { fam }); P.ellipse(k[0] + .6, k[1] + .3, 1.6, 1.4, mat, { fam }); }
  }
  function blade(P, from, ang, len, o) {
    o = o || {}; const d = dirA(ang), fam = P.fam(), s = [from[0] - d[0] * 4.5, from[1] - d[1] * 4.5];
    P.capsule(s[0], s[1], from[0], from[1], 1.05, 1.05, o.hilt || 'hilt', { fam });
    P.capsule(from[0] - d[1] * 1.9, from[1] + d[0] * 1.9, from[0] + d[1] * 1.9, from[1] - d[0] * 1.9, .7, .7, o.guard || 'hilt', { fam, flat: 3 });
    const tip = [from[0] + d[0] * len, from[1] + d[1] * len];
    P.capsule(from[0], from[1], tip[0], tip[1], o.w || .95, .3, o.mat || 'steel', { fam });
    P.line(from[0] + d[1] * .35, from[1] - d[0] * .35, tip[0] - d[0] * 2, tip[1] - d[1] * 2, o.mat || 'steel', 5, { fam, ord: P.o, w: .3 });
  }
  function pole(P, a, b, r, mat, o) { return P.capsule(a[0], a[1], b[0], b[1], r, r, mat, o || {}); }

  /* ---------- heads ---------- */
  const HB = 44, HOX = 14, HOY = 16, NECK = [6.8, 17.4];
  // eyes are drawn directly in output pixels so they stay crisp and detailed
  function eyes(P, X, Y, E, expr, fam, ord) {
    const k = P.k, o = { fam, ord }, put = (x, y, m, s = 3) => P.dot(x, y, m, s, o);
    if (E.style === 'none') return;
    if (E.style === 'blind') {
      P.poly([[.6, 8.3], [14.4, 7.6], [14.4, 11], [.6, 11.6]].map(([x, y]) => [X(x), Y(y)]), 'band', { fam, ord, ny: -.2 });
      P.poly([[-.4, 9], [-3.4, 12.6], [-1.6, 13.4], [.9, 11]].map(([x, y]) => [X(x), Y(y)]), 'band', { fam, ord }); return; }
    const one = (cx, cy, w, h, near) => {
      const x0 = Math.round(X(cx) * k), y0 = Math.round(Y(cy) * k), W = Math.max(3, Math.round(w * k)), H = Math.max(2, Math.round(h * k));
      if (expr === 'hurt' || E.style === 'closed') { for (let i = 0; i < W; i++) put(x0 + i, y0 + Math.round(H * .55) - (i === 0 || i === W - 1 ? 0 : 1), 'lash', 0); return; }
      const narrow = E.style === 'narrow' ? .5 : E.style === 'sharp' ? .78 : 1, hh = Math.max(2, Math.round(H * narrow)), top = y0 + (H - hh);
      const lid = expr === 'smirk' || E.style === 'tired' ? 1 : 0;
      if (E.style === 'hollow') { for (let j = 0; j < hh; j++) for (let i = 0; i < W; i++) { const ex = (i + .5) / W * 2 - 1, ey = (j + .5) / hh * 2 - 1; if (ex * ex + ey * ey <= 1.05) put(x0 + i, top + j, 'pupil', 0); }
        put(x0 + (W >> 1), top + (hh >> 1), 'hi', 3); return; }
      for (let j = 0; j < hh; j++) for (let i = 0; i < W; i++) { const ex = (i + .5) / W * 2 - 1, ey = (j + .5) / hh * 2 - 1; if (ex * ex * .9 + ey * ey * .55 > 1 && j > 0) continue; put(x0 + i, top + j, 'eyeW', 3); }
      // iris sits toward the nose (right): dark top, bright bottom, pupil and a highlight
      const iw = Math.max(2, Math.round(W * (near ? .62 : .8))), ix = x0 + W - iw, ih = hh;
      for (let j = 0; j < ih; j++) for (let i = 0; i < iw; i++) { const ex = (i + .5) / iw * 2 - 1, ey = (j + .5) / ih * 2 - 1; if (ex * ex + ey * ey * .7 > 1.15) continue;
        put(ix + i, top + j, j < ih * .38 ? 'irisD' : 'iris', j >= ih - 1 && ih > 3 ? 5 : 3); }
      if (E.style === 'sharp') for (let j = 1; j < ih; j++) put(ix + Math.floor(iw / 2), top + j, 'pupil', 0);
      else { put(ix + Math.floor(iw / 2), top + Math.floor(ih / 2), 'pupil', 0); if (iw > 2 && ih > 3) put(ix + Math.floor(iw / 2), top + Math.floor(ih / 2) + 1, 'pupil', 0); }
      put(ix, top + (ih > 3 ? 1 : 0), 'hi', 3); if (iw > 3 && ih > 3) put(ix + 1, top + 1, 'hi', 3);
      for (let i = -1; i <= W; i++) put(x0 + i, top - 1, 'lash', 0);
      if (lid) for (let i = 0; i < W; i++) put(x0 + i, top, 'lash', 1);
      if (near) { put(x0 - 1, top - 2, 'lash', 0); put(x0 - 2, top - 2, 'lash', 0); } else put(x0 + W, top - 2, 'lash', 0);
      if (E.lashTop) for (let i = 0; i < W; i++) put(x0 + i, top - 2, E.lashTop, 0);
      for (let i = 1; i < W - 1; i++) put(x0 + i, top + hh, 'skin', 2);
      if (E.style === 'tired') for (let i = 0; i < W; i++) put(x0 + i, top + hh + 1, 'skin', 1);
    };
    one(E.nx ?? 6.6, E.y, E.nw ?? 3.4, E.h ?? 3.2, true); one(E.fx ?? 11, E.y, E.fw ?? 2.1, E.h ?? 3.2, false);
    if (E.brow !== false) { const by = E.y - (E.browUp ?? 1.6) - (expr === 'shout' ? .5 : 0), ang = E.browAng ?? (expr === 'shout' ? .9 : .3);
      P.line(X(6.2), Y(by + ang * .3), X(9.6), Y(by - ang * .3), 'brow', 1, { fam, ord, w: E.browW || .55 }); P.line(X(10.8), Y(by - ang * .2), X(12.6), Y(by + ang * .2), 'brow', 1, { fam, ord, w: E.browW || .55 }); }
  }
  function renderHead(C, expr) {
    const k = KH, buf = new Buf(Math.ceil(HB * k), Math.ceil(HB * k)), P = new Painter(buf, C.mats, k), H = C.head, X = x => x + HOX, Y = y => y + HOY;
    const hc = [X(7), Y(6.5), 9.5];
    const L = (b, c, t, w, mat, o) => P.lock([X(b[0]), Y(b[1])], [X(c[0]), Y(c[1])], [X(t[0]), Y(t[1])], w, mat, hc, o);
    for (const kk of H.back || []) L(...kk);
    if (H.backFn) H.backFn(P, X, Y, hc);
    const skin = H.skin || 'skin', m = P.m(skin), fam = P.fam(), ord = ++P.o;
    const jaw = (H.jaw || [[1, 9.4], [13.6, 8.6], [13.6, 12], [12.7, 15], [11.1, 17], [8.4, 17.6], [5, 16], [2.4, 13.2]]).map(([x, y]) => [X(x), Y(y)]);
    const inJaw = (px, py) => { let c = false; for (let i = 0, j = jaw.length - 1; i < jaw.length; j = i++) { const [xi, yi] = jaw[i], [xj, yj] = jaw[j]; if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) c = !c; } return c; };
    const cc = [X(7.2), Y(7.4)], crx = H.crx || 6.8, cry = 7.2;
    P.span(X(-1), Y(-1), X(16), Y(19), (XX, YY, px, py) => {
      const ex = (px - cc[0]) / crx, ey = (py - cc[1]) / cry; if (ex * ex + ey * ey > 1 && !inJaw(px, py)) return;
      const nx = (px - X(8)) / 8.4, ny = (py - Y(9)) / 9.8, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      let s = shade6(nx, ny, nz, 0); if (py > Y(15.8) && px < X(9)) s = Math.max(0, s - 2);
      if (Math.abs(px - X(11.8)) < .8 && Math.abs(py - Y(13.4)) < .6) s = Math.min(5, s + 1);
      buf.put(XX, YY, m, s, ord, fam, nx, ny, nz); });
    P.ellipse(X(3.6), Y(11.2), 1.5, 2.1, skin, { fam, ord, bias: -1 }); P.line(X(3.4), Y(10.4), X(3.7), Y(12), skin, 0, { fam, ord, w: .35 });
    P.line(X(13.1), Y(10.6), X(13.6), Y(12.4), skin, 2, { fam, ord, w: .3 }); P.dot(Math.round(X(13.5) * k), Math.round(Y(12.4) * k), skin, 4, { fam, ord }); P.dot(Math.round(X(12.9) * k), Math.round(Y(12.9) * k), skin, 1, { fam, ord });
    if (H.faceFn) H.faceFn(P, X, Y, expr, fam, ord);
    eyes(P, X, Y, H.eyes, expr, fam, ord);
    const mo = H.mouth || [9.8, 14.8], mx = X(mo[0]), my = Y(mo[1]);
    if (expr === 'shout') { P.ellipse(mx + 1, my + .4, 1.5, 1.1, 'mouth', { fam, ord, flat: 0 }); P.line(mx, my - .5, mx + 2.1, my - .5, 'teeth', 5, { fam, ord, w: .35 }); }
    else if (expr === 'smirk') { P.line(mx, my, mx + 1.8, my, 'mouth', 1, { fam, ord, w: .4 }); P.line(mx + 1.8, my, mx + 2.4, my - .6, 'mouth', 1, { fam, ord, w: .4 }); }
    else if (expr === 'hurt') { P.line(mx, my, mx + 2.2, my + .3, 'mouth', 0, { fam, ord, w: .5 }); P.line(mx + .3, my - .2, mx + 1.9, my, 'teeth', 5, { fam, ord, w: .3 }); }
    else { P.line(mx, my, mx + 1.9, my - .1, 'mouth', 1, { fam, ord, w: .4 }); P.line(mx + .4, my + .7, mx + 1.4, my + .7, skin, 2, { fam, ord, w: .3 }); }
    if (H.cap) P.ellipse(X(H.cap[0]), Y(H.cap[1]), H.cap[2], H.cap[3], H.hair, {});
    for (const kk of H.front || []) L(...kk);
    if (H.topFn) H.topFn(P, X, Y, hc, expr);
    const hairM = [...new Set([...(H.front || []), ...(H.back || [])].map(q => q[4]).concat(H.hair ? [H.hair] : []))].map(n => P.m(n)), W = buf.w;
    for (let yy = buf.h - 1; yy > 1; yy--) for (let xx = 0; xx < W; xx++) { const i = yy * W + xx; if (buf.mat[i] === m && buf.fam[i] === fam && (hairM.includes(buf.mat[i - W]) || hairM.includes(buf.mat[i - 2 * W])) && buf.sh[i] > 1 && yy < Y(10.8) * k) buf.sh[i] = Math.max(1, buf.sh[i] - 2); }
    return buf;
  }
  function blitHead(frame, head, J, ordBase) {
    const dx = Math.round(J.head[0] * K - (NECK[0] + HOX) * KH), dy = Math.round(J.head[1] * K - (NECK[1] + HOY) * KH);
    for (let y = 0; y < head.h; y++) for (let x = 0; x < head.w; x++) { const i = y * head.w + x; if (head.mat[i] < 0) continue;
      frame.put(x + dx, y + dy, head.mat[i], head.sh[i], ordBase + head.ord[i], 1000 + head.fam[i], head.nx[i] / 127, head.ny[i] / 127, head.nz[i] / 127); }
  }

  /* ---------- final pass: separation lines, outline, colour + normal map ---------- */
  function finish(buf, mats, ctx, nctx, ox, oy) {
    const W = buf.w, H = buf.h, sh = Uint8Array.from(buf.sh), N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (buf.mat[i] < 0 || mats.noSep[buf.mat[i]]) continue;
      for (const [dx, dy] of N4) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const j = Y * W + X;
        if (buf.mat[j] >= 0 && buf.ord[j] < buf.ord[i] && buf.fam[j] !== buf.fam[i]) { sh[i] = Math.max(0, Math.min(sh[i], buf.sh[i] - 3)); break; } } }
    const img = ctx.createImageData(W, H), d = img.data, nimg = nctx.createImageData(W, H), nd = nimg.data, rgb = mats.ramps;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, o = i * 4;
      if (buf.mat[i] >= 0) { const c = rgb[buf.mat[i]][sh[i]]; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
        nd[o] = buf.nx[i] + 128; nd[o + 1] = 128 - buf.ny[i]; nd[o + 2] = Math.max(0, buf.nz[i]) + 128; nd[o + 3] = 255; continue; }
      let nb = -1, ndx = 0, ndy = 0; for (const [dx, dy] of N4) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; if (buf.mat[Y * W + X] >= 0) { nb = buf.mat[Y * W + X]; ndx -= dx; ndy -= dy; } }
      if (nb >= 0) { const c = rgb[nb][0]; d[o] = c[0] * .38 + 6; d[o + 1] = c[1] * .32 + 3; d[o + 2] = c[2] * .38 + 10; d[o + 3] = 255;
        const l = Math.hypot(ndx, ndy) || 1; nd[o] = 128 - ndx / l * 110; nd[o + 1] = 128 + ndy / l * 110; nd[o + 2] = 150; nd[o + 3] = 255; }
    }
    ctx.putImageData(img, ox, oy); nctx.putImageData(nimg, ox, oy);
  }

  /* ---------- poses ---------- */
  const FRAMES = ['idle0', 'idle1', 'idle2', 'idle3', 'run0', 'run1', 'run2', 'run3', 'run4', 'run5', 'fly0', 'fly1', 'dash', 'jab0', 'jab1', 'cross', 'kick0', 'kick1', 'castA', 'castB', 'castC', 'sign', 'guard', 'hurt', 'launch', 'victory'];
  const base = () => ({ px: 0, py: 0, lean: 5, hx: 0, hy: 0, expr: 'n', aF: [36, 78, 'fist'], aB: [22, 84, 'fist'], lF: [16, 10], lB: [-14, 6], wind: 0 });
  function pose(C, name) {
    const p = base(), st = C.stance || 'fight', S = C.poses || {}, set = o => Object.assign(p, o);
    if (name.startsWith('idle')) {
      const f = +name[4], b = [0, .6, 1, .5][f];
      if (st === 'pockets') set({ lean: 1, aF: [2, 32, 'pocket'], aB: [-6, 30, 'pocket'], lF: [7, 3], lB: [-6, 3], py: b * .6, expr: 'smirk' });
      else if (st === 'crossed') set({ lean: -1, aF: [34, 118, 'hide'], aB: [40, 112, 'hide'], backFront: 1, lF: [10, 2], lB: [-10, 2], py: b * .6, expr: 'smirk', a2F: [6, 30, 'fist'], a2B: [-4, 28, 'fist'] });
      else if (st === 'calm') set({ lean: -2, aF: [8, 24, 'open'], aB: [-4, 20, 'open'], lF: [8, 3], lB: [-8, 3], py: b * .5, expr: 'smirk' });
      else if (st === 'katana') set({ lean: 7, aF: [28, 58, 'fist'], aB: [34, 70, 'fist'], lF: [20, 12], lB: [-16, 6], py: b, weapon: 'guardLow' });
      else if (st === 'staff') set({ lean: 6, aF: [30, 60, 'fist'], aB: [30, 88, 'fist'], lF: [18, 12], lB: [-16, 6], py: b });
      else if (st === 'brute') set({ lean: 12, aF: [22, 30, 'claw'], aB: [14, 28, 'claw'], lF: [14, 8], lB: [-12, 6], py: b * 1.2 });
      else set({ py: b, aF: [36 + b * 2, 78, 'fist'] });
    } else if (name.startsWith('run')) {
      const ph = (+name[3]) / 6 * Math.PI * 2, s = Math.sin(ph), s2 = Math.sin(ph + Math.PI);
      set({ lean: 16, py: -Math.abs(Math.sin(ph * 2)) * 1.6, lF: [30 * s + 8, 14 + 42 * Math.max(0, Math.sin(ph + 1.4))], lB: [30 * s2 + 8, 14 + 42 * Math.max(0, Math.sin(ph + Math.PI + 1.4))],
        aF: [-34 * s + 12, 74, 'fist'], aB: [-34 * s2 + 12, 74, 'fist'], wind: 1 });
      if (st === 'crossed') set({ a2F: [-20 * s, 40, 'fist'], a2B: [-20 * s2, 40, 'fist'] });
    } else if (name === 'fly0' || name === 'fly1') {
      const k = name === 'fly1' ? 1 : 0;
      set({ air: 1, lean: 10, py: -1 - k, lF: [-8 - k * 3, 26 + k * 6], lB: [-26 - k * 3, 40 - k * 4], aF: [-18, 30, 'open'], aB: [-36, 26, 'open'], wind: 1 + k });
      if (st === 'pockets') set({ lean: 2, aF: [2, 32, 'pocket'], aB: [-6, 30, 'pocket'], lF: [-2, 8 + k * 3], lB: [-12, 16 + k * 3], expr: 'smirk' });
      if (st === 'crossed') set({ lean: 0, aF: [34, 118, 'hide'], aB: [40, 112, 'hide'], backFront: 1, lF: [-2, 6 + k * 2], lB: [-12, 14], expr: 'smirk', a2F: [4, 30, 'fist'], a2B: [-6, 28, 'fist'] });
      if (st === 'calm') set({ lean: -2, aF: [10, 26, 'open'], aB: [-4, 22, 'open'], lF: [-2, 8 + k * 2], lB: [-12, 14], expr: 'smirk' });
      if (st === 'brute') set({ lean: 20, aF: [-10, 30, 'claw'], aB: [-30, 26, 'claw'] });
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
    if (st === 'brute') { if (['fist', 'open', 'point'].includes(p.aF[2])) p.aF = [p.aF[0], p.aF[1], 'claw']; if (['fist', 'open'].includes(p.aB[2])) p.aB = [p.aB[0], p.aB[1], 'claw']; }
    if (S[name]) set(typeof S[name] === 'function' ? S[name](p) : S[name]);
    return p;
  }

  /* ---------- materials ---------- */
  const SK = { skin: ['#a86a5e', '#e0a58f', '#f7d0bc', '#fff0e6'], skinW: ['#9e5f55', '#d69a86', '#f0c6b0', '#ffe4d4'], skinT: ['#7a4630', '#b5724e', '#d99a72', '#f2c29c'], skinH: ['#8f5a4a', '#c78c74', '#e6b59a', '#f8d8c4'] };
  const flat = c => [c, c, c, c];
  const BLACKCLOTH = ['#06060b', '#10121c', '#1e2236', '#3a4260'], WHITECLOTH = ['#878ea9', '#c0c6d9', '#e9ecf4', '#ffffff'], SHOE = ['#050508', '#0e0e14', '#1d1d27', '#30303f'];
  const COMMON = { mouth: ['#4a1820', '#8a3a40', '#b86060', '#e09a9a'], teeth: flat('#fff6ee'), eyeW: flat('#f4f6ff'), hi: flat('#ffffff'), pupil: flat('#0c0810'), lash: flat('#1b1024'),
    steel: ['#4a5060', '#8e96a8', '#d4dcea', '#ffffff'], hilt: ['#120c10', '#241820', '#3a2a30', '#58444a'], mark: flat('#1d0a10'), band: ['#06060a', '#0f0f16', '#1c1c28', '#34344a'], gold: ['#7a5a18', '#b88a30', '#e8c060', '#fff0b0'] };

  /* ---------- characters ---------- */
  const eyesStd = o => Object.assign({ y: 9, style: 'normal' }, o || {});
  const CHARS = {
    gojo: { stance: 'pockets', pr: { torso: 22, neck: 2, thigh: 15, shin: 15, uarm: 12, farm: 11, chestW: 5.8, waistW: 4.6, hipW: 4.8, shF: 2.4, shB: 2.8 },
      mats: { skin: SK.skin, hair: ['#6c79a6', '#aebbe0', '#e9eeff', '#ffffff'], brow: flat('#c3cdee'), iris: flat('#7af4ff'), irisD: flat('#1b86d2'), lash: flat('#a8b4dc'),
        shirt: BLACKCLOTH, pants: WHITECLOTH, belt: ['#050508', '#0e0e14', '#1e1e28', '#383848'], shoe: SHOE },
      head: { hair: 'hair', cap: [7, 3.4, 7.8, 4.6],
        back: [[[4, 3], [0, 5], [-2.6, 9.5], 5.2, 'hair'], [[3.5, 6], [0.6, 10], [0.2, 14.6], 4.6, 'hair'], [[5, 1.5], [1, 0], [-2.2, 3], 4.6, 'hair'], [[2.5, 8], [0, 12], [2.2, 15.6], 3.4, 'hair']],
        front: [[[6, 0], [4, -2.5], [1.5, -4], 5, 'hair'], [[9, 0], [9.5, -3], [7.8, -5.2], 5, 'hair'], [[11.5, 1.5], [14, -.5], [16, -1.6], 4, 'hair'],
          [[5.5, 2.6], [4.4, 6], [3.2, 9.4], 3.8, 'hair'], [[7, 2.5], [7.2, 5], [6.8, 7.6], 3.8, 'hair'], [[8.6, 2.5], [9.4, 5.6], [10, 9.8], 3.4, 'hair'], [[10.8, 2.6], [12.6, 5.4], [13.8, 8.8], 3.2, 'hair']],
        eyes: eyesStd({ lashTop: 'brow' }) },
      draw(P, J, p, head) { const pr = J.pr;
        limbArm(P, J.aB, 'shirt', 'skin', { bias: -1 });
        limbLeg(P, J.lB, 'pants', 'shoe', { bias: -1, t1: 3.9, t2: 3.4, t3: 2.5, cuff: 'pants' }); limbLeg(P, J.lF, 'pants', 'shoe', { t1: 3.9, t2: 3.4, t3: 2.5, cuff: 'pants' });
        P.capsule(J.neck[0], J.neck[1], J.head[0], J.head[1], 2, 2, 'skin', { bias: -1 });
        torso(P, J, 'shirt', pr, { hipMat: 'pants' });
        P.capsule(J.neck[0] - J.u[0] * .6 - .6, J.neck[1] - J.u[1] * .6, J.neck[0] + .8, J.neck[1] - 1.4, 2.2, 2, 'shirt', {});
        belt(P, J, 'belt', pr, true); blitHead(P.b, head, J, 100);
        if (p.backFront) limbArm(P, J.aB, 'shirt', 'skin', { bias: -1 }); limbArm(P, J.aF, 'shirt', 'skin'); } },
    gojo0: { stance: 'pockets', pr: { torso: 22, neck: 2, thigh: 15, shin: 15, uarm: 12, farm: 11, chestW: 5.8, waistW: 4.6, hipW: 4.8, shF: 2.4, shB: 2.8 },
      mats: { skin: SK.skin, hair: ['#6c79a6', '#aebbe0', '#e9eeff', '#ffffff'], brow: flat('#c3cdee'),
        coat: ['#05060c', '#0e1120', '#1a1f38', '#303a60'], pants: ['#05060c', '#0e1120', '#1a1f38', '#303a60'], shoe: SHOE, zip: flat('#5a6488') },
      head: { hair: 'hair', cap: [7, 3.4, 7.6, 4.4],
        back: [[[4, 3], [0, 3], [-3, 1], 4.6, 'hair'], [[3, 6], [-.5, 7], [-3, 7.6], 4, 'hair']],
        front: [[[4.6, 1.5], [2.6, -3], [.6, -7.5], 4.6, 'hair'], [[7, 1], [6.4, -4.6], [5.2, -9.6], 5.2, 'hair'], [[9.4, 1], [10, -4], [10.6, -9], 5, 'hair'], [[11.6, 2.2], [13.4, -1.4], [15.4, -5.4], 4.2, 'hair'],
          [[12.6, 4], [15, 3], [17, 1.6], 3, 'hair'], [[6, 3], [5, 5.4], [4.2, 7.8], 3, 'hair'], [[9, 3.2], [10.6, 5.6], [12.4, 7.6], 2.6, 'hair']],
        eyes: { y: 9, style: 'blind', brow: false } },
      draw(P, J, p, head) { const pr = J.pr;
        limbArm(P, J.aB, 'coat', 'skin', { bias: -1 });
        limbLeg(P, J.lB, 'pants', 'shoe', { bias: -1, t1: 3.3, t2: 2.9, t3: 2.2 }); limbLeg(P, J.lF, 'pants', 'shoe', { t1: 3.3, t2: 2.9, t3: 2.2 });
        P.capsule(J.neck[0], J.neck[1], J.head[0], J.head[1], 2, 2, 'skin', { bias: -1 });
        const tf = torso(P, J, 'coat', pr, {}); skirt(P, J, 'coat', 18, pr, { wind: p.wind, folds: 4 });
        P.capsule(J.neck[0] - 2.6, J.neck[1] - 1.2, J.neck[0] + 2.4, J.neck[1] - 2.6, 2.4, 2.4, 'coat', { fam: tf });
        P.line(J.neck[0] + J.r[0] * 1.8, J.neck[1] + .5, J.pel[0] + J.r[0] * 1.8 + J.u[0] * 2, J.pel[1] + 4, 'zip', 3, { fam: tf, ord: ++P.o, w: .3 });
        blitHead(P.b, head, J, 100);
        if (p.backFront) limbArm(P, J.aB, 'coat', 'skin', { bias: -1 }); limbArm(P, J.aF, 'coat', 'skin'); } },
    sukuna: { stance: 'crossed', pr: { torso: 21, neck: 2, thigh: 14.5, shin: 14, uarm: 11.5, farm: 10.5, chestW: 5.8, waistW: 4.9, hipW: 5, shF: 2.4, shB: 2.8 },
      mats: { skin: SK.skinW, hair: ['#04050a', '#0e1019', '#1d2236', '#3b4462'], brow: flat('#0e1019'), iris: flat('#ff4636'), irisD: flat('#8a0f14'), lash: flat('#12060c'),
        kimono: ['#8c8578', '#cdc5b6', '#f0eadf', '#ffffff'], under: BLACKCLOTH, belt: ['#050508', '#0e0e14', '#1e1e28', '#383848'], shoe: SHOE },
      noSep: ['kimono'],
      head: { hair: 'hair', cap: [7, 3.2, 7.8, 5],
        back: [[[3, 4], [-1, 3], [-4, .6], 4.6, 'hair'], [[3, 7.5], [-.5, 8.5], [-3.2, 10.4], 4.2, 'hair'], [[5, 1.5], [2, -1.5], [-.4, -4.6], 4.6, 'hair'], [[3.2, 10], [1, 12.5], [1.6, 15], 3.2, 'hair']],
        front: [[[7, .5], [7.2, -3.5], [6, -7], 5.2, 'hair'], [[9.5, 1], [11.4, -2.4], [12, -5.6], 4.6, 'hair'], [[11.5, 2.5], [14.4, .4], [17, -1.6], 4.2, 'hair'],
          [[12, 4.2], [15, 4], [18, 4.6], 3.6, 'hair'], [[11, 4.4], [13.6, 6.6], [15.2, 8.6], 3, 'hair'], [[8.8, 3.6], [9.6, 6.6], [10.1, 9.4], 3, 'hair'], [[6.8, 3.6], [6.8, 5.8], [6.4, 7.6], 3.2, 'hair'], [[5.6, 4], [4.6, 7], [3.6, 9.6], 3.2, 'hair'], [[4.2, 1], [1.8, -2], [1, -5], 4.4, 'hair']],
        eyes: eyesStd({ style: 'sharp', browAng: .9 }),
        faceFn(P, X, Y) { for (const [a, b] of [[[6.2, 12.9], [9.6, 12.7]], [[10.8, 12.7], [12.8, 12.9]], [[5.8, 13.6], [5.4, 15]]]) P.line(X(a[0]), Y(a[1]), X(b[0]), Y(b[1]), 'mark', 0, { w: .5 }); } },
      draw(P, J, p, head) { const pr = J.pr;
        if (!p.backFront) { sleeve(P, J.aB, 'kimono', 7.5, { bias: -1 }); limbArm(P, J.aB, 'kimono', 'skin', { bias: -1 }); }
        limbLeg(P, J.lB, 'kimono', 'shoe', { bias: -1, t1: 4.1, t2: 3.7, t3: 3.1, sandal: 'belt' }); limbLeg(P, J.lF, 'kimono', 'shoe', { t1: 4.1, t2: 3.7, t3: 3.1, sandal: 'belt' });
        skirt(P, J, 'kimono', 11, pr, { wind: p.wind });
        P.capsule(J.neck[0], J.neck[1], J.head[0], J.head[1], 2, 2, 'skin', { bias: -1 });
        const tf = torso(P, J, 'kimono', pr, {});
        const n = [J.neck[0] + J.r[0] * 1.2, J.neck[1] + 1];
        P.poly([[n[0] - 2.6, n[1] - 1], [n[0] + 2.8, n[1] - 1], [n[0] + .6, n[1] + 6.5]], 'under', { fam: tf, ord: ++P.o });
        P.line(n[0] - 2.6, n[1] - 1, n[0] + .6, n[1] + 7, 'kimono', 2, { fam: tf, ord: P.o, w: .5 });
        belt(P, J, 'belt', pr, false); blitHead(P.b, head, J, 100);
        if (p.backFront) { sleeve(P, J.aB, 'kimono', 7.5, { bias: -1 }); limbArm(P, J.aB, 'kimono', 'skin', { bias: -1 }); }
        sleeve(P, J.aF, 'kimono', 7.5); limbArm(P, J.aF, 'kimono', 'skin'); } },
    sukunah: { stance: 'crossed', pr: { torso: 24, neck: 2, thigh: 16, shin: 15.5, uarm: 12.5, farm: 11.5, chestW: 6.6, waistW: 5.3, hipW: 5.4, shF: 2.6, shB: 3 },
      mats: { skin: SK.skinW, hair: ['#8a3f58', '#c77890', '#eaa2b4', '#ffd6e0'], brow: flat('#8a3f58'), iris: flat('#ff4636'), irisD: flat('#8a0f14'), lash: flat('#12060c'),
        hakama: ['#0c080e', '#1a121e', '#2c2230', '#463a4c'], obi: ['#8c8578', '#cdc5b6', '#f0eadf', '#ffffff'], shoe: SHOE },
      head: { hair: 'hair', cap: [6.4, 3.6, 7.4, 4.6],
        back: [[[5, 1.5], [1, -2], [-3, -3.6], 5.2, 'hair'], [[4, 4.5], [0, 3], [-4, 2.6], 4.8, 'hair'], [[3.4, 8], [0, 9.4], [-2.6, 11.6], 4.2, 'hair']],
        front: [[[8, .8], [6.5, -3.4], [3.6, -6.4], 5.2, 'hair'], [[10.6, 2], [10.6, -2.4], [9.2, -5.6], 4.6, 'hair'], [[12, 3.6], [13.4, .6], [13.6, -2.6], 3.6, 'hair'], [[12.6, 3.8], [13.8, 5.6], [14, 7.4], 2.4, 'hair']],
        eyes: eyesStd({ style: 'sharp', browAng: .9 }),
        faceFn(P, X, Y) { for (const [a, b] of [[[6.2, 12.9], [9.6, 12.7]], [[10.8, 12.7], [12.8, 12.9]], [[5.8, 13.6], [5.4, 15]], [[8, 6.2], [10.4, 6]], [[11.8, 6.4], [12.8, 7]]]) P.line(X(a[0]), Y(a[1]), X(b[0]), Y(b[1]), 'mark', 0, { w: .5 });
          for (const [x, y] of [[7.4, 13.8], [8.4, 13.8], [11.4, 13.8]]) P.px(X(x), Y(y), 'iris', 3); } },
      draw(P, J, p, head) { const pr = J.pr, bare = { r1: 2.5, r2: 2.3, r3: 1.9 };
        limbArm(P, J.aB, 'skin', 'skin', { bias: -1, ...bare }); if (J.a2B) limbArm(P, J.a2B, 'skin', 'skin', { bias: -1, ...bare });
        limbLeg(P, J.lB, 'hakama', 'shoe', { bias: -1, t1: 4.4, t2: 4, t3: 3.4 }); limbLeg(P, J.lF, 'hakama', 'shoe', { t1: 4.4, t2: 4, t3: 3.4 });
        P.capsule(J.neck[0], J.neck[1], J.head[0], J.head[1], 2.2, 2.2, 'skin', { bias: -1 });
        const tf = torso(P, J, 'skin', pr, { hipMat: 'hakama' }); const c = J.neck, u = J.u, r = J.r;
        for (const kk of [6, 10.5]) P.line(c[0] - r[0] * 4 - u[0] * kk, c[1] - u[1] * kk, c[0] + r[0] * 4 - u[0] * kk, c[1] - u[1] * kk + r[1] * 4, 'mark', 0, { fam: tf, ord: ++P.o, w: .45 });
        const m = [J.pel[0] + J.r[0] * 1.5 + J.u[0] * 9, J.pel[1] + J.u[1] * 9]; P.line(m[0] - 2.6, m[1], m[0] + 2.6, m[1], 'mark', 0, { fam: tf, ord: ++P.o, w: .5 });
        for (let i = -2; i <= 2; i++) P.line(m[0] + i, m[1] - .6, m[0] + i + .3, m[1] - .2, 'teeth', 5, { fam: tf, ord: P.o, w: .25 });
        belt(P, J, 'obi', pr, true); blitHead(P.b, head, J, 100);
        if (J.a2F) limbArm(P, J.a2F, 'skin', 'skin', bare); if (p.backFront) limbArm(P, J.aB, 'skin', 'skin', { bias: -1, ...bare }); limbArm(P, J.aF, 'skin', 'skin', bare);
        for (const A of [J.aF, J.a2F]) if (A && A.hand !== 'hide') P.line(A.w[0] - A.fd[0] * 3 - 1.5, A.w[1] - A.fd[1] * 3, A.w[0] - A.fd[0] * 3 + 1.5, A.w[1] - A.fd[1] * 3 + 1, 'mark', 0, { ord: ++P.o, w: .45 }); } },
    geto: { stance: 'calm', pr: { torso: 22.5, neck: 2.2, thigh: 15.5, shin: 15, uarm: 12.2, farm: 11, chestW: 6, waistW: 5, hipW: 5.2, shF: 2.4, shB: 2.8 },
      mats: { skin: SK.skinW, hair: ['#020306', '#0b0c14', '#191c2c', '#343a54'], brow: flat('#0b0c14'), iris: flat('#4a3a38'), irisD: flat('#1a1214'), lash: flat('#0a0610'),
        robe: ['#08070c', '#141320', '#232132', '#3e3c54'], kesa: ['#4a3a1c', '#7a6232', '#a88c50', '#d8c088'], sock: WHITECLOTH, shoe: SHOE, cloud: ['#3a0a10', '#6a1420', '#9a2030', '#d85a64'] },
      noSep: ['robe'],
      head: { hair: 'hair', cap: [7, 3.2, 7.8, 5],
        back: [[[3, 3], [-2, 9], [-3, 24], 6.4, 'hair'], [[4.4, 5], [0, 12], [0, 26], 5.4, 'hair'], [[2.4, 8], [1, 13], [2.6, 19], 4, 'hair']],
        backFn(P, X, Y) { P.ellipse(X(4), Y(-.4), 3.2, 3, 'hair', { bias: 0 }); },
        front: [[[10, 1], [6, -1], [2, 1], 5, 'hair'], [[11.6, 2.6], [8, .4], [3, 3], 3.8, 'hair'], [[11.6, 1.8], [13.8, 6], [13.2, 14.4], 2.6, 'hair']],
        eyes: eyesStd({ style: 'narrow', h: 3, browAng: .2, browW: .4 }),
        faceFn(P, X, Y, e, fam, ord) { P.ellipse(X(3.8), Y(13.6), 1.3, 1.3, 'gold', { fam, ord }); P.ellipse(X(3.8), Y(13.6), .6, .6, 'lash', { fam, ord, flat: 0 }); } },
      draw(P, J, p, head) { const pr = J.pr;
        if (!p.backFront) { sleeve(P, J.aB, 'robe', 9, { bias: -1 }); limbArm(P, J.aB, 'robe', 'skin', { bias: -1 }); }
        limbLeg(P, J.lB, 'robe', 'shoe', { bias: -1, t1: 4, t2: 3.8, t3: 3.4, sock: 'sock', sandal: 'shoe' }); limbLeg(P, J.lF, 'robe', 'shoe', { t1: 4, t2: 3.8, t3: 3.4, sock: 'sock', sandal: 'shoe' });
        skirt(P, J, 'robe', 32, pr, { wind: p.wind, folds: 4 });
        P.capsule(J.neck[0], J.neck[1], J.head[0], J.head[1], 2.1, 2.1, 'skin', { bias: -1 });
        const tf = torso(P, J, 'robe', pr, {}); const n = [J.neck[0] + J.r[0] * 1.2, J.neck[1] + 1];
        P.poly([[n[0] - 2.4, n[1] - 1], [n[0] + 2.6, n[1] - 1], [n[0] + .6, n[1] + 5]], 'skin', { fam: tf, ord: ++P.o });
        const s = [J.neck[0] - J.r[0] * 4, J.neck[1] - 1], h = [J.pel[0] + J.r[0] * 4.6, J.pel[1] + 2];
        P.poly([[s[0] - 1.6, s[1] - 1], [s[0] + 2.2, s[1] - 1.4], [h[0] + 1.6, h[1] - 1.4], [h[0] - .6, h[1] + 2]], 'kesa', { ord: ++P.o, folds: 3 });
        P.poly([[J.pel[0] - 5.6, J.pel[1] + 1], [J.pel[0] - 1.4, J.pel[1] + 1], [J.pel[0] - 1.8 - p.wind, J.pel[1] + 14], [J.pel[0] - 6.4 - p.wind * 2, J.pel[1] + 13]], 'kesa', { ord: ++P.o, folds: 3 });
        blitHead(P.b, head, J, 100);
        if (p.backFront) { sleeve(P, J.aB, 'robe', 9, { bias: -1 }); limbArm(P, J.aB, 'robe', 'skin', { bias: -1 }); }
        sleeve(P, J.aF, 'robe', 9); limbArm(P, J.aF, 'robe', 'skin');
        if (p.weapon === 'cloud' || (p.aF[0] > 60 && p.aF[2] === 'fist')) { const w = J.aF.w, d = dirA(p.aF[0] + p.aF[1] - 30);
          let a = [w[0] - d[0] * 3, w[1] - d[1] * 3]; for (let i = 0; i < 3; i++) { const b = [a[0] + d[0] * 8, a[1] + d[1] * 8 + i * 1.5]; pole(P, a, b, .9, 'cloud'); P.ellipse(b[0], b[1], 1.1, 1.1, 'gold', {}); a = [b[0] + d[0] * .8, b[1] + d[1] * .8]; } } } },
    yuji: { stance: 'fight', pr: { torso: 20, neck: 2, thigh: 14, shin: 13.5, uarm: 11, farm: 10, chestW: 5.8, waistW: 4.8, hipW: 4.8, shF: 2.4, shB: 2.8 },
      mats: { skin: ['#9a5e4e', '#d89a80', '#f2c6aa', '#ffe4d2'], hair: ['#8a3f4e', '#d0788a', '#f2a6b2', '#ffd8df'], under: ['#1a0f0e', '#2e1c1a', '#44302c', '#5e4640'], brow: flat('#6a3038'),
        iris: flat('#c07a48'), irisD: flat('#5a2e1c'), jacket: ['#07080f', '#111427', '#1d2340', '#303a60'], hood: ['#5e0c14', '#9a1824', '#cf2a36', '#f06a6a'], shoe: ['#7a7a88', '#c8c8d4', '#f0f0f6', '#ffffff'], gold2: flat('#e8b45a') },
      head: { hair: 'hair', cap: [7, 3.4, 7, 3.8], backFn(P, X, Y) { P.ellipse(X(3.2), Y(7.6), 2.6, 3.4, 'under', { bias: -1 }); },
        back: [[[3, 3], [0, 2], [-2.4, 1.6], 3.8, 'hair']],
        front: [[[4, 1], [3, -2.4], [1.6, -4], 3.8, 'hair'], [[7, 0], [7, -3], [6.2, -5], 4, 'hair'], [[10, 1], [11, -2], [11.4, -4.2], 3.8, 'hair'], [[12, 3], [14.2, 1.6], [15.6, .6], 3, 'hair'],
          [[8, 2.6], [8.6, 4.8], [8.2, 6.8], 3.4, 'hair'], [[10.5, 2.6], [12, 4.8], [12.4, 6.8], 3, 'hair'], [[6, 2.6], [5.4, 4.8], [4.6, 6.6], 3, 'hair']],
        eyes: eyesStd({ browW: .7, browAng: .7 }), faceFn(P, X, Y) { P.line(X(6.4), Y(13), X(8.2), Y(13.4), 'skin', 1, { w: .3 }); } },
      draw(P, J, p, head) { const pr = J.pr;
        limbArm(P, J.aB, 'jacket', 'skin', { bias: -1, cuff: 'jacket' }); limbLeg(P, J.lB, 'jacket', 'shoe', { bias: -1 }); limbLeg(P, J.lF, 'jacket', 'shoe', {});
        P.ellipse(J.neck[0] - J.r[0] * 3.5, J.neck[1] + 1.5, 3.6, 3, 'hood', { bias: -1 });
        P.capsule(J.neck[0], J.neck[1], J.head[0], J.head[1], 2, 2, 'skin', { bias: -1 });
        const tf = torso(P, J, 'jacket', pr, {}); skirt(P, J, 'jacket', 6, pr, { wind: p.wind });
        P.capsule(J.neck[0] - 3, J.neck[1] + .5, J.neck[0] + 2, J.neck[1] + .5, 1.6, 1.4, 'hood', { fam: tf });
        for (const kk of [3, 7, 11, 15]) P.px(J.neck[0] + J.r[0] * 2 - J.u[0] * kk, J.neck[1] - J.u[1] * kk, 'gold2', 3, { fam: tf, ord: ++P.o, fine: 1 });
        blitHead(P.b, head, J, 100); if (p.backFront) limbArm(P, J.aB, 'jacket', 'skin', { bias: -1, cuff: 'jacket' }); limbArm(P, J.aF, 'jacket', 'skin', { cuff: 'jacket' }); } },
    yuta: { stance: 'katana', pr: { torso: 21, neck: 2, thigh: 14.5, shin: 14, uarm: 11.5, farm: 10.5, chestW: 5.3, waistW: 4.5, hipW: 4.6, shF: 2.3, shB: 2.7 },
      mats: { skin: SK.skin, hair: ['#03040a', '#0c0e1a', '#1a1e30', '#343c58'], brow: flat('#0c0e1a'), iris: flat('#6a7aa0'), irisD: flat('#252a40'),
        coat: ['#8d93a6', '#c7ccda', '#eef0f6', '#ffffff'], pants: ['#8d93a6', '#c7ccda', '#eef0f6', '#ffffff'], shoe: SHOE, sheath: ['#0c0a10', '#1a1620', '#2a2430', '#453c4c'] },
      noSep: ['coat'],
      head: { hair: 'hair', cap: [7, 3.6, 7.6, 4.8],
        back: [[[4, 3], [0, 6], [-1, 11], 5, 'hair'], [[3, 7], [1, 11.5], [2, 15], 4, 'hair'], [[5, 1], [1.5, .5], [-1.8, 3], 4.4, 'hair']],
        front: [[[6, 0], [4.5, -2], [2.6, -3], 4.4, 'hair'], [[9, 0], [10, -2], [11, -3], 4.2, 'hair'], [[6, 2.8], [5, 6.4], [4, 9.8], 3.6, 'hair'], [[7.6, 2.8], [7.8, 5.4], [7.4, 7.8], 3.6, 'hair'], [[9.2, 2.8], [9.8, 6], [10.1, 9.8], 3.2, 'hair'], [[11.2, 3], [12.8, 5.8], [13.6, 8.6], 2.8, 'hair']],
        eyes: eyesStd({ style: 'tired', browAng: -.2 }) },
      draw(P, J, p, head) { const pr = J.pr;
        pole(P, [J.neck[0] - 7, J.neck[1] - 4], [J.pel[0] + 7, J.pel[1] + 2], .9, 'sheath', { bias: -1 });
        limbArm(P, J.aB, 'coat', 'skin', { bias: -1 }); limbLeg(P, J.lB, 'pants', 'shoe', { bias: -1 }); limbLeg(P, J.lF, 'pants', 'shoe', {});
        P.capsule(J.neck[0], J.neck[1], J.head[0], J.head[1], 2, 2, 'skin', { bias: -1 });
        const tf = torso(P, J, 'coat', pr, {}); skirt(P, J, 'coat', 13, pr, { wind: p.wind });
        P.line(J.neck[0] + J.r[0] * 1.6, J.neck[1] + .5, J.pel[0] + J.r[0] * 1.6 + J.u[0] * 2, J.pel[1] + 4, 'coat', 1, { fam: tf, ord: ++P.o, w: .3 });
        P.capsule(J.neck[0] - 2.6, J.neck[1] - .8, J.neck[0] + 2.6, J.neck[1] - .8, 1.7, 1.7, 'coat', { fam: tf });
        blitHead(P.b, head, J, 100); if (p.backFront) limbArm(P, J.aB, 'coat', 'skin', { bias: -1 }); limbArm(P, J.aF, 'coat', 'skin');
        if (p.weapon === 'guardLow' || p.aF[2] === 'fist' && p.aF[0] > 60) blade(P, J.aF.w, p.aF[0] > 60 ? p.aF[0] + p.aF[1] - 8 : 118, 22, {}); } },
    kashimo: { stance: 'staff', pr: { torso: 21, neck: 2, thigh: 14.5, shin: 14, uarm: 11.5, farm: 10.5, chestW: 5.5, waistW: 4.6, hipW: 4.8, shF: 2.4, shB: 2.8 },
      mats: { skin: SK.skin, hair: ['#3f6a94', '#76b0d8', '#b0e2ff', '#e8f8ff'], brow: flat('#3f6a94'), iris: flat('#8ac8ff'), irisD: flat('#23406a'),
        top: ['#0a1622', '#15283a', '#22405a', '#3a6282'], trim: ['#2a7aa8', '#4ab8e8', '#8ae0ff', '#dff8ff'], pants: BLACKCLOTH, shoe: SHOE, wood: ['#3a2412', '#6a4424', '#9a6a3a', '#c89a60'] },
      head: { hair: 'hair', cap: [7, 3.2, 7.4, 4.2],
        back: [[[3, 3], [-3, 8], [-6, 20], 5.4, 'hair'], [[4, 5], [-1, 12], [-2.6, 22], 4.4, 'hair']],
        front: [[[5, 1], [3, -4], [0, -8], 5, 'hair'], [[8, 0], [8, -5], [6.6, -9.4], 5.2, 'hair'], [[10.6, 1.4], [12.6, -2.6], [13.4, -6.4], 4.4, 'hair'], [[12.4, 3.4], [15, 2], [17.4, 1.6], 3.2, 'hair'],
          [[7.8, 2.6], [8.2, 5], [7.6, 7.2], 3.2, 'hair'], [[9.8, 2.6], [10.2, 5.6], [10.1, 8.6], 2.6, 'hair'], [[11.4, 2.8], [12.8, 5.2], [13.2, 7.4], 2.6, 'hair']],
        eyes: eyesStd({ browAng: .8 }) },
      draw(P, J, p, head) { const pr = J.pr, sb = J.aB.w, sd = dirA((p.aB[0] + p.aB[1]) + 90);
        pole(P, [sb[0] - sd[0] * 26, sb[1] - sd[1] * 26], [sb[0] + sd[0] * 24, sb[1] + sd[1] * 24], 1, 'wood', { bias: -1 });
        limbArm(P, J.aB, 'top', 'skin', { bias: -1 }); limbLeg(P, J.lB, 'pants', 'shoe', { bias: -1 }); limbLeg(P, J.lF, 'pants', 'shoe', {});
        P.capsule(J.neck[0], J.neck[1], J.head[0], J.head[1], 2, 2, 'skin', { bias: -1 });
        const tf = torso(P, J, 'top', pr, {}); skirt(P, J, 'top', 8, pr, { wind: p.wind });
        P.line(J.neck[0] - 2, J.neck[1], J.neck[0] + 2, J.neck[1] + 5, 'trim', 3, { fam: tf, ord: ++P.o, w: .5 }); belt(P, J, 'trim', pr, true);
        blitHead(P.b, head, J, 100); if (p.backFront) limbArm(P, J.aB, 'top', 'skin', { bias: -1 }); limbArm(P, J.aF, 'top', 'skin'); } },
    higuruma: { stance: 'fight', pr: { torso: 21.5, neck: 2, thigh: 15, shin: 14.5, uarm: 11.5, farm: 10.5, chestW: 5.6, waistW: 4.9, hipW: 4.8, shF: 2.4, shB: 2.8 },
      mats: { skin: SK.skinH, hair: ['#020306', '#0b0c12', '#181a24', '#30344a'], brow: flat('#0b0c12'), iris: flat('#6a5040'), irisD: flat('#2a1c14'), stub: flat('#b88870'),
        suit: ['#0e0f14', '#1b1d26', '#2c2f3c', '#454a5c'], shirt: WHITECLOTH, tie: ['#3a0a10', '#6a1420', '#9a2030', '#c84a58'], shoe: SHOE, badge: flat('#e8c860'), wood2: ['#3a2412', '#6a4424', '#9a6a3a', '#c89a60'] },
      head: { hair: 'hair', cap: [6.6, 3.4, 7.4, 3.8],
        back: [[[5, 2], [0, 2], [-2.6, 5], 5, 'hair'], [[3, 6], [0, 8], [0, 11.6], 4, 'hair']],
        front: [[[11, 1.8], [7, -1.2], [1, -.8], 5, 'hair'], [[12.4, 3.2], [9, .4], [3, .8], 3.6, 'hair'], [[10.4, 2.8], [11, 5.4], [10.1, 8.8], 1.8, 'hair']],
        eyes: eyesStd({ style: 'tired' }), faceFn(P, X, Y) { for (const [x, y] of [[7, 16], [8, 17], [9, 17], [10, 17], [11, 16], [12, 15], [10, 16]]) P.px(X(x), Y(y), 'stub', 0); } },
      draw(P, J, p, head) { const pr = J.pr;
        limbArm(P, J.aB, 'suit', 'skin', { bias: -1, cuff: 'shirt' }); limbLeg(P, J.lB, 'suit', 'shoe', { bias: -1 }); limbLeg(P, J.lF, 'suit', 'shoe', {});
        P.capsule(J.neck[0], J.neck[1], J.head[0], J.head[1], 2, 2, 'skin', { bias: -1 });
        const tf = torso(P, J, 'suit', pr, {}); const n = [J.neck[0] + J.r[0] * 1.4, J.neck[1] + 1];
        P.poly([[n[0] - 2.2, n[1] - 1.2], [n[0] + 2.4, n[1] - 1.2], [n[0] + .2, n[1] + 7.5]], 'shirt', { fam: tf, ord: ++P.o });
        P.poly([[n[0] - .6, n[1] - .6], [n[0] + 1, n[1] - .6], [n[0] + .9, n[1] + 6.6], [n[0] + .2, n[1] + 7.6], [n[0] - .5, n[1] + 6.6]], 'tie', { fam: tf, ord: ++P.o });
        P.ellipse(n[0] - 2.8, n[1] + 2.8, .6, .6, 'badge', { fam: tf, ord: P.o }); skirt(P, J, 'suit', 6, pr, { wind: p.wind });
        blitHead(P.b, head, J, 100); if (p.backFront) limbArm(P, J.aB, 'suit', 'skin', { bias: -1, cuff: 'shirt' }); limbArm(P, J.aF, 'suit', 'skin', { cuff: 'shirt' });
        if (p.aF[0] > 60 && p.aF[2] === 'fist') { const w = J.aF.w, d = dirA(p.aF[0] + p.aF[1] - 80); pole(P, w, [w[0] + d[0] * 6, w[1] + d[1] * 6], .8, 'wood2'); P.capsule(w[0] + d[0] * 6 - 3, w[1] + d[1] * 6 - 1, w[0] + d[0] * 6 + 3, w[1] + d[1] * 6 + 1, 2, 2, 'wood2', {}); } } },
    maki: { stance: 'katana', pr: { torso: 20, neck: 2, thigh: 15, shin: 14.5, uarm: 11, farm: 10, chestW: 5, waistW: 4.1, hipW: 4.8, shF: 2.2, shB: 2.6 },
      mats: { skin: SK.skin, hair: ['#08140f', '#122a20', '#1f4232', '#36644c'], brow: flat('#122a20'), iris: flat('#b07a50'), irisD: flat('#4a2a18'), scar: flat('#c98078'), suit: BLACKCLOTH, shoe: SHOE },
      head: { hair: 'hair', cap: [7, 3.6, 7.4, 4.6],
        back: [[[4, 3], [0.5, 6], [0, 11.4], 5, 'hair'], [[3, 6], [1.4, 10], [2.6, 13.2], 4, 'hair']],
        front: [[[6, 0], [4.5, -1.6], [2.6, -2.4], 4, 'hair'], [[9, 0], [10, -1.6], [11, -2.2], 4, 'hair'], [[5.8, 2.8], [5.2, 6], [4.4, 8.8], 3.4, 'hair'], [[7.8, 2.6], [8.2, 5], [7.8, 7.4], 3.6, 'hair'], [[9.8, 2.6], [10.4, 5.4], [10.1, 8.4], 3, 'hair'], [[12, 3.2], [13.4, 5.6], [13.8, 10.6], 2.4, 'hair']],
        eyes: eyesStd({ browAng: .6 }), faceFn(P, X, Y) { for (const [x, y] of [[6, 12], [6, 13], [7, 14], [8, 14], [9, 13], [6, 11], [5, 13]]) P.px(X(x), Y(y), 'scar', 0); } },
      draw(P, J, p, head) { const pr = J.pr;
        limbArm(P, J.aB, 'suit', 'skin', { bias: -1 }); limbLeg(P, J.lB, 'suit', 'shoe', { bias: -1, t1: 3, t2: 2.6, t3: 2.1 }); limbLeg(P, J.lF, 'suit', 'shoe', { t1: 3, t2: 2.6, t3: 2.1 });
        P.capsule(J.neck[0], J.neck[1], J.head[0], J.head[1], 1.9, 1.9, 'skin', { bias: -1 }); torso(P, J, 'suit', pr, {});
        P.capsule(J.neck[0] - 2, J.neck[1] - .4, J.neck[0] + 2, J.neck[1] - .4, 1.8, 1.8, 'suit', {});
        blitHead(P.b, head, J, 100); if (p.backFront) limbArm(P, J.aB, 'suit', 'skin', { bias: -1 }); limbArm(P, J.aF, 'suit', 'skin');
        blade(P, J.aF.w, p.aF[0] > 60 ? p.aF[0] + p.aF[1] - 6 : p.weapon === 'guardLow' ? 112 : 150, 25, { w: 1 }); } },
    maki0: { stance: 'katana', pr: { torso: 20, neck: 2, thigh: 15, shin: 14.5, uarm: 11, farm: 10, chestW: 5, waistW: 4.1, hipW: 4.9, shF: 2.2, shB: 2.6 },
      mats: { skin: SK.skin, hair: ['#08140f', '#122a20', '#1f4232', '#36644c'], brow: flat('#122a20'), iris: flat('#b07a50'), irisD: flat('#4a2a18'), frame: flat('#2a1a14'), glass: flat('#c8dcf0'),
        suit: ['#05060c', '#0e1120', '#1a1f38', '#303a60'], pants: ['#05060c', '#0e1120', '#1a1f38', '#303a60'], shoe: SHOE, wood: ['#3a2412', '#6a4424', '#9a6a3a', '#c89a60'] },
      head: { hair: 'hair', cap: [7, 3.6, 7.4, 4.6],
        back: [[[3.4, 1], [-3, 2], [-5.4, 12], 4.6, 'hair'], [[3, 2], [-2, 6], [-3.6, 15], 3.6, 'hair']],
        backFn(P, X, Y) { P.ellipse(X(2.4), Y(1.2), 1.8, 1.6, 'hair', {}); },
        front: [[[6, 0], [4.5, -1.6], [2.6, -2.4], 4, 'hair'], [[9, 0], [10, -1.6], [11, -2.2], 4, 'hair'], [[7.8, 2.6], [8.2, 5], [7.8, 7.2], 3.4, 'hair'], [[10, 2.6], [10.6, 5.2], [10.1, 7.8], 3, 'hair'], [[12, 3.2], [13.4, 5.6], [13.8, 9.6], 2.4, 'hair'], [[5.8, 2.8], [5, 6], [4.2, 8.6], 3, 'hair']],
        eyes: eyesStd({ browAng: .6 }),
        topFn(P, X, Y) { const o = { ord: 999, w: .4 }; for (const [a, b, c, d] of [[5.6, 8.2, 9.8, 8.2], [5.6, 8.2, 5.8, 12], [5.8, 12, 9.7, 12], [9.8, 8.2, 9.7, 12], [10.6, 8.3, 13, 8.3], [13, 8.3, 12.8, 12], [10.6, 12, 12.8, 12], [9.8, 9.4, 10.6, 9.4], [5.6, 9, 3.6, 10.2]]) P.line(X(a), Y(b), X(c), Y(d), 'frame', 0, o);
          P.px(X(6.2), Y(8.8), 'glass', 3, { ord: 999, fine: 1 }); } },
      draw(P, J, p, head) { const pr = J.pr, sp = p.aF[0] > 60 ? p.aF[0] + p.aF[1] - 6 : p.weapon === 'guardLow' ? 112 : 150, d = dirA(sp), w = J.aF.w;
        pole(P, [w[0] - d[0] * 14, w[1] - d[1] * 14], [w[0] + d[0] * 18, w[1] + d[1] * 18], .75, 'wood', { bias: -1 });
        limbArm(P, J.aB, 'suit', 'skin', { bias: -1 }); limbLeg(P, J.lB, 'pants', 'shoe', { bias: -1, t1: 3.5, t2: 3.2, t3: 2.6 }); limbLeg(P, J.lF, 'pants', 'shoe', { t1: 3.5, t2: 3.2, t3: 2.6 });
        P.capsule(J.neck[0], J.neck[1], J.head[0], J.head[1], 1.9, 1.9, 'skin', { bias: -1 }); torso(P, J, 'suit', pr, {}); skirt(P, J, 'suit', 5, pr, { wind: p.wind });
        P.capsule(J.neck[0] - 2.2, J.neck[1] - .8, J.neck[0] + 2.2, J.neck[1] - 1.2, 2, 2, 'suit', {});
        blitHead(P.b, head, J, 100); if (p.backFront) limbArm(P, J.aB, 'suit', 'skin', { bias: -1 }); limbArm(P, J.aF, 'suit', 'skin');
        blade(P, [w[0] + d[0] * 18, w[1] + d[1] * 18], sp, 8, { w: 1.3 }); } },
    todo: { stance: 'fight', pr: { torso: 22, neck: 2.4, thigh: 15, shin: 14, uarm: 12, farm: 11, chestW: 7.6, waistW: 6, hipW: 5.6, shF: 3.2, shB: 3.6 },
      mats: { skin: SK.skinT, hair: ['#020306', '#0b0c12', '#181a24', '#30344a'], brow: flat('#0b0c12'), iris: flat('#6a4a30'), irisD: flat('#2a1a10'), scar: flat('#8a4040'),
        tank: WHITECLOTH, pants: ['#0d0e16', '#1c1e2a', '#2e3142', '#474b60'], shoe: SHOE, wood: ['#3a2412', '#6a4424', '#9a6a3a', '#c89a60'] },
      head: { hair: 'hair', crx: 7, jaw: [[1, 9], [13.6, 8], [13.6, 12], [12.8, 15], [11, 17], [7.6, 17.4], [4.4, 15.8], [2.2, 12.8]],
        backFn(P, X, Y) { P.ellipse(X(6.8), Y(3.6), 6.6, 3.8, 'hair', { bias: -1 }); },
        front: [[[5, 1], [4.6, -2], [5.6, -4.4], 4.4, 'hair'], [[6.4, -1.4], [4, -3], [2.4, -1.2], 3.2, 'hair']], topFn(P, X, Y) { P.ellipse(X(5.6), Y(-3.4), 2.4, 2, 'hair', {}); },
        eyes: eyesStd({ browW: 1, browAng: .8 }), mouth: [9.8, 15.1], faceFn(P, X, Y) { P.line(X(8), Y(7), X(8.6), Y(14.4), 'scar', 0, { w: .5 }); } },
      draw(P, J, p, head) { const pr = J.pr, big = { r1: 3.1, r2: 2.8, r3: 2.3 };
        limbArm(P, J.aB, 'skin', 'skin', { bias: -1, ...big }); const w = J.aB.w; pole(P, w, [w[0] + J.aB.fd[0] * 4, w[1] + J.aB.fd[1] * 4], 1.6, 'wood'); P.ellipse(w[0] + J.aB.fd[0] * 7, w[1] + J.aB.fd[1] * 7, 1.4, 1.4, 'wood', {});
        limbLeg(P, J.lB, 'pants', 'shoe', { bias: -1, t1: 3.8, t2: 3.4, t3: 2.8 }); limbLeg(P, J.lF, 'pants', 'shoe', { t1: 3.8, t2: 3.4, t3: 2.8 });
        P.capsule(J.neck[0], J.neck[1], J.head[0], J.head[1], 2.8, 2.6, 'skin', { bias: -1 });
        const tf = torso(P, J, 'tank', pr, { hipMat: 'pants' });
        P.capsule(J.neck[0] - J.r[0] * 4.4, J.neck[1] + 1.2, J.neck[0] - J.r[0] * 4.4 - J.u[0] * 3, J.neck[1] + 4, 2.5, 2.5, 'skin', { fam: tf, bias: -1 }); P.capsule(J.neck[0] + J.r[0] * 4, J.neck[1] + 1.2, J.neck[0] + J.r[0] * 4 - J.u[0] * 3, J.neck[1] + 4, 2.5, 2.5, 'skin', { fam: tf });
        blitHead(P.b, head, J, 100); if (p.backFront) limbArm(P, J.aB, 'skin', 'skin', { bias: -1, ...big }); limbArm(P, J.aF, 'skin', 'skin', big); } },
    mahoraga: { stance: 'brute', pr: { torso: 30, neck: 3, thigh: 21, shin: 20, uarm: 16, farm: 15, chestW: 8.8, waistW: 6.4, hipW: 6.2, shF: 3.4, shB: 3.8 },
      mats: { skin: ['#5e5a62', '#9a969c', '#d2cec8', '#f4f0ea'], cloth: ['#120e14', '#221a26', '#342a3a', '#4e4256'], blade: ['#6a5a30', '#b8a470', '#ece2c4', '#ffffff'], wing: ['#6a6a88', '#b0b0c4', '#e8e8f0', '#ffffff'], brow: flat('#5e5a62') },
      head: { hair: 'wing', back: [[[3, 6], [-3, 2], [-7, -6], 4.4, 'wing'], [[3, 9], [-4, 7], [-9, 4], 3.8, 'wing']], front: [[[9, 3], [8, -3], [4, -9], 4.2, 'wing'], [[11, 4], [13, -2], [12, -7], 3.6, 'wing']],
        eyes: { y: 9, style: 'blind', brow: false } },
      draw(P, J, p, head) { const pr = J.pr, big = { r1: 4, r2: 3.6, r3: 3 };
        limbArm(P, J.aB, 'skin', 'skin', { bias: -1, ...big }); limbLeg(P, J.lB, 'skin', 'skin', { bias: -1, t1: 4.6, t2: 4, t3: 3.2, foot: 5 }); limbLeg(P, J.lF, 'skin', 'skin', { t1: 4.6, t2: 4, t3: 3.2, foot: 5 });
        P.capsule(J.neck[0], J.neck[1], J.head[0], J.head[1], 3.4, 3, 'skin', { bias: -1 }); torso(P, J, 'skin', pr, { hipMat: 'cloth' }); skirt(P, J, 'cloth', 14, pr, { wind: p.wind, folds: 4 });
        blitHead(P.b, head, J, 100); if (p.backFront) limbArm(P, J.aB, 'skin', 'skin', { bias: -1, ...big }); limbArm(P, J.aF, 'skin', 'skin', big);
        const e = J.aF.e, w = J.aF.w, d = J.aF.fd; P.capsule(e[0] + d[0] * 3, e[1] + d[1] * 3, w[0] + d[0] * 20, w[1] + d[1] * 20, 2, .5, 'blade', {}); } },
    rika: { stance: 'brute', pr: { torso: 26, neck: 3, thigh: 12, shin: 10, uarm: 17, farm: 16, chestW: 9.4, waistW: 5.6, hipW: 5.6, shF: 4, shB: 4.4 },
      mats: { skin: ['#4a4252', '#8a8296', '#c6c0cc', '#eeeaf2'], hair: ['#060508', '#141018', '#241e2c', '#3e3448'], claw: ['#2a2020', '#5a4a44', '#9a8a80', '#e8dcd0'], rag: ['#0c0a10', '#1c1620', '#2c2432', '#443a4c'], brow: flat('#141018') },
      head: { hair: 'hair', skin: 'skin', crx: 7.8,
        back: [[[3, 3], [-3, 10], [-5, 22], 5.4, 'hair'], [[5, 1], [0, 6], [-8, 12], 5, 'hair'], [[9, 1], [15, 6], [18, 16], 4.6, 'hair']],
        eyes: { y: 7.6, style: 'hollow', nw: 4.2, fw: 3, h: 3.6, brow: false }, mouth: [9, 14],
        faceFn(P, X, Y, e, fam, ord) { P.poly([[4.5, 12.4], [14, 11.4], [13.4, 15.6], [5, 16.2]].map(([x, y]) => [X(x), Y(y)]), 'hair', { fam, ord, flat: 0 });
          for (let i = 0; i < 9; i++) { P.line(X(5 + i), Y(12.2), X(5.5 + i), Y(13.4), 'claw', 5, { fam, ord, w: .4 }); P.line(X(5.2 + i), Y(16), X(5.6 + i), Y(15), 'claw', 5, { fam, ord, w: .4 }); } },
        front: [[[7, 1], [9, -3], [7, -8], 4, 'hair'], [[10, 1.4], [13, -1], [15, -5], 3.4, 'hair']] },
      draw(P, J, p, head) { const pr = J.pr, big = { r1: 4.2, r2: 3.6, r3: 3.2, claw: 'claw' };
        limbArm(P, J.aB, 'skin', 'skin', { bias: -1, ...big });
        P.capsule(J.neck[0], J.neck[1], J.head[0], J.head[1], 4, 3.4, 'skin', { bias: -1 }); torso(P, J, 'skin', pr, { hipMat: 'rag' }); skirt(P, J, 'rag', 24, pr, { wind: p.wind + 1, folds: 3 });
        blitHead(P.b, head, J, 100); if (p.backFront) limbArm(P, J.aB, 'skin', 'skin', { bias: -1, ...big }); limbArm(P, J.aF, 'skin', 'skin', big); } },
    kuchisake: { stance: 'fight', pr: { torso: 22, neck: 2.4, thigh: 16, shin: 15, uarm: 12.5, farm: 11.5, chestW: 5, waistW: 4.2, hipW: 4.8, shF: 2.2, shB: 2.6 },
      mats: { skin: ['#8a7a7a', '#c8b8b8', '#ecdede', '#fff4f4'], hair: ['#020306', '#0b0c12', '#181a24', '#30344a'], brow: flat('#0b0c12'), iris: flat('#c82030'), irisD: flat('#40080c'),
        coat: ['#4a3a24', '#7a6444', '#a88c66', '#d8c09a'], mask: WHITECLOTH, shoe: SHOE },
      head: { hair: 'hair', cap: [7, 3.4, 7.6, 4.8],
        back: [[[3, 3], [-2, 10], [-3, 26], 6, 'hair'], [[5, 2], [1, 12], [1, 27], 5, 'hair']],
        front: [[[8, 1], [11, 3], [13.6, 11], 3.4, 'hair'], [[6, 1.6], [5, 6], [4, 12], 3.4, 'hair']],
        eyes: eyesStd({ style: 'sharp', browAng: 1 }),
        faceFn(P, X, Y, e, fam, ord) { P.poly([[5.4, 12.2], [14, 11.4], [13.6, 15.6], [11, 17.6], [7, 17.2]].map(([x, y]) => [X(x), Y(y)]), 'mask', { fam, ord }); P.line(X(5.4), Y(12.4), X(3.4), Y(11.4), 'mask', 3, { fam, ord, w: .3 }); } },
      draw(P, J, p, head) { const pr = J.pr;
        limbArm(P, J.aB, 'coat', 'skin', { bias: -1 }); limbLeg(P, J.lB, 'coat', 'shoe', { bias: -1 }); limbLeg(P, J.lF, 'coat', 'shoe', {});
        P.capsule(J.neck[0], J.neck[1], J.head[0], J.head[1], 1.9, 1.9, 'skin', { bias: -1 }); torso(P, J, 'coat', pr, {}); skirt(P, J, 'coat', 24, pr, { wind: p.wind, folds: 4 }); belt(P, J, 'coat', pr, true);
        blitHead(P.b, head, J, 100); if (p.backFront) limbArm(P, J.aB, 'coat', 'skin', { bias: -1 }); limbArm(P, J.aF, 'coat', 'skin');
        const w = J.aF.w, a = p.aF[0] > 60 ? p.aF[0] + p.aF[1] - 10 : 150; blade(P, w, a, 17, { w: 1.4, hilt: 'steel' }); blade(P, w, a + 16, 15, { w: 1.2, hilt: 'steel' }); } }
  };
  CHARS.gojo.poses = { castA: { expr: 'smirk' }, sign: { aF: [58, 124, 'sign'], aB: [4, 30, 'pocket'], backFront: 0, expr: 'smirk' }, victory: { aF: [150, 10, 'sign'], aB: [-6, 30, 'pocket'], expr: 'smirk' } };
  CHARS.gojo0.poses = CHARS.gojo.poses;
  CHARS.sukuna.poses = { castA: { aF: [150, -34, 'open'], aB: [30, 110, 'hide'], expr: 'smirk' }, castC: { aF: [92, 0, 'fist'], aB: [84, 150, 'fist'], backFront: 1, expr: 'shout' }, victory: { expr: 'smirk' } };
  CHARS.sukunah.poses = { castA: { aF: [150, -34, 'open'], a2F: [100, 0, 'open'], expr: 'smirk' }, castC: { aF: [92, 0, 'fist'], aB: [84, 150, 'fist'], backFront: 1, a2F: [60, 60, 'fist'], expr: 'shout' }, sign: { a2F: [40, 110, 'sign'], a2B: [44, 108, 'sign'] }, victory: { expr: 'smirk' } };
  CHARS.geto.poses = { castA: { aF: [110, -10, 'open'], expr: 'smirk' }, castC: { aF: [100, 10, 'open'], aB: [60, 60, 'open'], backFront: 1, expr: 'smirk' }, jab1: { weapon: 'cloud' }, cross: { weapon: 'cloud' }, kick1: { weapon: 'cloud' }, victory: { aF: [40, 110, 'hide'], aB: [46, 106, 'hide'], backFront: 1, expr: 'smirk' } };
  CHARS.maki.poses = { idle0: { weapon: 'guardLow' }, idle1: { weapon: 'guardLow' }, idle2: { weapon: 'guardLow' }, idle3: { weapon: 'guardLow' } };
  CHARS.maki0.poses = CHARS.maki.poses;
  CHARS.rika.poses = { castA: { aF: [110, 10, 'claw'], expr: 'shout' }, castB: { aF: [100, 0, 'claw'], aB: [90, 10, 'claw'], expr: 'shout' }, castC: { aF: [96, 0, 'claw'], aB: [100, 10, 'claw'], expr: 'shout' } };

  function materials(C) { const names = [], ramps = []; for (const [k, v] of Object.entries({ ...COMMON, ...C.mats })) { names.push(k); ramps.push(six(v)); }
    const noSep = names.map(n => (C.noSep || []).includes(n) || ['eyeW', 'hi', 'mark', 'teeth', 'mouth', 'lash', 'pupil', 'iris', 'irisD', 'brow'].includes(n)); return { names, ramps, noSep }; }
  // variants: an existing rig with another head or palette
  const variant = (base, o) => Object.assign({}, CHARS[base], o, { mats: Object.assign({}, CHARS[base].mats, o.mats || {}) });
  CHARS.yutag = variant('yuta', { stance: 'pockets',     // Yuta in Gojo's body (Shinjuku, ch. 261): Gojo's head, Kenjaku-style stitches, Yuta's uniform
    head: Object.assign({}, CHARS.gojo.head, { topFn(P, X, Y) { P.line(X(2.6), Y(3.6), X(13.4), Y(3.2), 'mark', 0, { w: .45 });
      for (let x = 3.4; x < 13; x += 1.3) P.line(X(x), Y(2.8), X(x + .5), Y(4.2), 'mark', 0, { w: .3 }); } }),
    mats: { hair: CHARS.gojo.mats.hair, brow: CHARS.gojo.mats.brow, iris: CHARS.gojo.mats.iris, irisD: CHARS.gojo.mats.irisD, lash: CHARS.gojo.mats.lash } });
  CHARS.sukunay = variant('yuji', {                     // Sukuna in control of Yuji: swept-back hair, second eyes, red irises
    head: Object.assign({}, CHARS.yuji.head, { cap: CHARS.sukunah.head.cap, back: CHARS.sukunah.head.back, front: CHARS.sukunah.head.front, eyes: eyesStd({ style: 'sharp', browAng: .9 }), faceFn: CHARS.sukuna.head.faceFn }),
    mats: { iris: flat('#ff4636'), irisD: flat('#8a0f14'), lash: flat('#12060c') } });
  CHARS.megumi = variant('yuji', {                      // Megumi: spiky black hair, plain black uniform
    head: Object.assign({}, CHARS.sukuna.head, { faceFn: null, eyes: eyesStd({ browAng: .8 }) }),
    mats: { skin: SK.skinW, hair: CHARS.sukuna.mats.hair, brow: flat('#0e1019'), iris: flat('#4a5a80'), irisD: flat('#141c30'), hood: CHARS.yuji.mats.jacket, gold2: flat('#c8a050') } });
  CHARS.curse1 = variant('rika', { mats: { skin: ['#3a4a2a', '#6a8048', '#a4b878', '#dce8b8'], rag: ['#140e08', '#2a2014', '#40321e', '#5a4a30'], hair: ['#0a0c06', '#161a0c', '#262c16', '#3c4424'] } });
  CHARS.curse2 = variant('rika', { mats: { skin: ['#4a2a3e', '#80486a', '#b87aa0', '#e8b8d4'], rag: ['#0a0610', '#18101e', '#281c30', '#3c2c46'], hair: ['#08040a', '#140a18', '#221428', '#36223c'] } });
  const H = (base, o) => Object.assign({}, CHARS[base].head, o);
  CHARS.nobara = variant('maki0', { head: H('maki0', { topFn: null, backFn: null, back: [[[3.4, 1], [-.6, 4], [-1.4, 10.4], 4.6, 'hair'], [[3, 5], [.6, 9], [1.6, 12.6], 3.6, 'hair']] }),
    mats: { hair: ['#4a2210', '#8a4a24', '#c07844', '#eaa874'], brow: flat('#6a3418'), iris: flat('#a86a3a'), irisD: flat('#4a2410') } });
  CHARS.nanami = variant('higuruma', { head: H('higuruma', { faceFn: null, topFn(P, X, Y) { const o = { ord: 999, w: .45 };
      for (const [a, b, c, d] of [[5.4, 8.4, 13.2, 8.2], [5.4, 8.4, 5.8, 11.4], [5.8, 11.4, 9.4, 11.6], [9.4, 11.6, 10, 10], [10, 10, 10.8, 11.6], [10.8, 11.6, 13, 11.2], [13, 11.2, 13.2, 8.2]]) P.line(X(a), Y(b), X(c), Y(d), 'frame', 0, o);
      P.px(X(7), Y(9.4), 'glass', 4, { ord: 999, fine: 1 }); P.px(X(11.6), Y(9.4), 'glass', 4, { ord: 999, fine: 1 }); } }),
    mats: { hair: ['#8a6a20', '#c8a040', '#ecd070', '#fff0b0'], brow: flat('#a88030'), suit: ['#6a5a3a', '#a08a60', '#c8b488', '#ece0bc'], tie: ['#4a3a10', '#8a7020', '#c8a830', '#f0d860'], frame: flat('#1a1a14'), glass: flat('#8ad0a0') } });
  CHARS.mahito = variant('yuji', { head: H('geto', { eyes: eyesStd({ style: 'sharp', browAng: .3 }), faceFn(P, X, Y) { const o = { w: .35 };
      for (const [a, b, c, d] of [[4, 6, 12, 5], [8, 5.4, 9.6, 16], [3.4, 13, 7.6, 16.4]]) P.line(X(a), Y(b), X(c), Y(d), 'mark', 0, o); for (let t = 0; t < 1; t += .2) P.line(X(8.3 + t * 1.3 - .6), Y(5.4 + t * 10.6), X(8.3 + t * 1.3 + .6), Y(5.4 + t * 10.6), 'mark', 0, o); } }),
    mats: { skin: ['#7a7a8a', '#b8b8c8', '#e0e0ea', '#ffffff'], hair: ['#2a3448', '#4a5a78', '#7a8cae', '#b8c8e4'], brow: flat('#4a5a78'), iris: flat('#5a8ab0'), irisD: flat('#1a3050'),
      jacket: ['#2a3040', '#4a5468', '#6e7a92', '#a8b4c8'], hood: ['#2a3040', '#4a5468', '#6e7a92', '#a8b4c8'], gold2: flat('#a8b4c8') } });
  CHARS.junpei = variant('yuji', { head: H('yuta', { eyes: eyesStd({ style: 'tired', browAng: -.3 }) }),
    mats: { skin: SK.skinW, hair: ['#0a0808', '#1a1414', '#2c2424', '#463a3a'], brow: flat('#1a1414'), iris: flat('#4a3a30'), irisD: flat('#1a1210'), hood: CHARS.yuji.mats.jacket } });
  CHARS.choso = variant('geto', { head: H('geto', { back: [[[3.6, 1], [.6, -2.4], [-1.4, -4.6], 3.6, 'hair'], [[9.6, .4], [11.8, -2.6], [13, -5], 3.4, 'hair']], backFn: null,
      front: CHARS.yuji.head.front, eyes: eyesStd({ style: 'tired', browAng: .2 }), faceFn(P, X, Y) { P.line(X(5), Y(11.4), X(13.4), Y(11), 'blood', 0, { w: .7 }); } }),
    mats: { blood: flat('#8a1020'), robe: ['#1a1420', '#2e2438', '#463a54', '#6e5e80'], kesa: ['#2a2430', '#4a4054', '#6e627a', '#9a8ca8'] } });
  CHARS.hanami = variant('rika', { mats: { skin: ['#6a6a58', '#a8a890', '#dcdcc4', '#ffffff'], hair: ['#1a3a14', '#2e5a24', '#4a8a3a', '#8ac878'], rag: ['#2a1c10', '#4a3420', '#6a4e30', '#9a7a50'] } });
  CHARS.jogo = variant('rika', { mats: { skin: ['#6a5a4a', '#a08a70', '#d0b89a', '#f4e4cc'], hair: ['#2a1410', '#4a2418', '#6a3420', '#9a4a2a'], rag: ['#3a1a0c', '#6a3018', '#9a4a24', '#d8743a'] } });
  CHARS.eso = variant('kuchisake', { mats: { skin: ['#3a5a3a', '#6a9060', '#9ac088', '#d4ecc0'], coat: ['#3a0e10', '#6a1a1e', '#9a2a30', '#d05a5e'], mask: ['#3a5a3a', '#6a9060', '#9ac088', '#d4ecc0'] } });
  CHARS.kechizu = variant('rika', { mats: { skin: ['#5a2a2a', '#8a4a44', '#b8766a', '#e8b0a0'], hair: ['#1a0808', '#2e1010', '#461c1c', '#6a2c2c'], rag: ['#140a0a', '#2a1414', '#401e1e', '#5a2e2e'] } });
  CHARS.tfh = variant('rika', { mats: { skin: ['#4a4650', '#7a7482', '#a8a2b0', '#d8d2e0'], rag: ['#101014', '#1e1e26', '#2e2e3a', '#44445a'] } });
  CHARS.womb = variant('rika', { mats: { skin: ['#3a2a2a', '#6a4a44', '#9a7466', '#d0aa96'], hair: ['#0a0406', '#180a0e', '#281218', '#3e1e26'] } });
  function prep(key) { const C = CHARS[key]; if (!C.M) { C.mats.iris = C.mats.iris || flat('#333'); C.mats.irisD = C.mats.irisD || flat('#111'); C.mats.lash = C.mats.lash || flat('#1b1024'); C.M = materials(C); C.heads = {}; } return C; }
  function headOf(C, e) { return C.heads[e] || (C.heads[e] = renderHead({ mats: C.M, head: C.head }, e)); }
  function frameInto(C, name, ctx, nctx, x, y) { const p = pose(C, name), J = rig(C.pr, p), buf = new Buf(OW, OH), P = new Painter(buf, C.M, K);
    C.draw(P, J, p, headOf(C, p.expr || 'n')); finish(buf, C.M, ctx, nctx, x, y); return J; }
  const cache = {};
  function build(key) {
    if (cache[key]) return cache[key]; const C = prep(key);
    const mk = () => { const c = document.createElement('canvas'); c.width = ATW; c.height = ATH; return c; };
    const atlas = mk(), natlas = mk(), ctx = atlas.getContext('2d'), nctx = natlas.getContext('2d'), anchors = {};
    FRAMES.forEach((name, i) => { anchors[name] = frameInto(C, name, ctx, nctx, i * OW, 0).head; });
    { const p = pose(C, 'down'), sqP = Object.assign({}, p, { px: 34 }), J = rig(C.pr, sqP), S = 128 * K, sq = new Buf(S, S), P = new Painter(sq, C.M, K); C.draw(P, J, sqP, headOf(C, 'hurt'));
      let maxY = 0; const rot = new Buf(S, S);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const i = y * S + x; if (sq.mat[i] < 0) continue; const nx = y, ny = S - 1 - x; rot.put(nx, ny, sq.mat[i], sq.sh[i], sq.ord[i], sq.fam[i], -sq.ny[i] / 127, sq.nx[i] / 127, sq.nz[i] / 127); maxY = Math.max(maxY, ny); }
      const out = new Buf(S, S), dy = GY * K - 2 - maxY;
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const i = y * S + x; if (rot.mat[i] < 0) continue; out.put(x, y + dy, rot.mat[i], rot.sh[i], rot.ord[i], rot.fam[i], rot.nx[i] / 127, rot.ny[i] / 127, rot.nz[i] / 127); }
      finish(out, C.M, ctx, nctx, 0, OH); }
    return cache[key] = { key, canvas: atlas, ncanvas: natlas, frames: Object.fromEntries(FRAMES.map((n, i) => [n, i])), anchors };
  }
  function release(keep) { for (const k in cache) if (!keep.includes(k)) delete cache[k]; }
  function thumb(key) {
    const C = prep(key), c = document.createElement('canvas'), n = document.createElement('canvas'); c.width = n.width = OW; c.height = n.height = OH;
    const J = frameInto(C, 'idle0', c.getContext('2d'), n.getContext('2d'), 0, 0);
    const pc = document.createElement('canvas'); pc.width = pc.height = 128; const pg = pc.getContext('2d'); pg.imageSmoothingEnabled = false;
    const hx = Math.round(J.head[0] * K), hy = Math.round(J.head[1] * K); pg.drawImage(c, hx - 30, hy - 50, 64, 64, 0, 0, 128, 128);
    const fc = document.createElement('canvas'); fc.width = 128; fc.height = 200; const fg = fc.getContext('2d'); fg.imageSmoothingEnabled = false; fg.drawImage(c, 0, 50, 128, 200, 0, 0, 128, 200);
    return { portrait: pc.toDataURL(), full: fc.toDataURL() };
  }
  function wheel() { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), P = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const dx = x - 31.5, dy = y - 31.5, d = Math.hypot(dx, dy) / 2, a = Math.atan2(dy, dx);
      if (d > 9.5 && d < 12) P(x, y, d > 11.2 ? '#8a6a20' : d < 10.2 ? '#b88a30' : '#f0c850'); else if (d < 3) P(x, y, d < 1.6 ? '#fff0b0' : '#c89a30');
      else if (d <= 9.5 && Math.abs(Math.sin(a * 4)) < .16) P(x, y, '#e0b040'); if (d >= 12 && d < 15.5 && Math.abs(Math.sin(a * 4)) < .25) P(x, y, d > 14.6 ? '#8a6a20' : '#f0c850'); }
    return c; }
  return { build, thumb, release, CHARS, FRAMES, OW, OH, ATW, ATH, K, PXO: PX * K, GYO: GY * K, wheel };
})();
