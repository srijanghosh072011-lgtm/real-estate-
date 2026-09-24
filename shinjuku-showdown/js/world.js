'use strict';
/* Shinjuku and Tokyo Jujutsu High: maps, rendering pipeline (low-res + depth of field + bloom), time of day, destructible city. */
window.WORLD = (function () {
  const V3 = THREE.Vector3, rnd = (() => { let s = 20181224; return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();
  const R = (a, b) => a + rnd() * (b - a), pick = a => a[rnd() * a.length | 0], clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // two maps in one world, far apart: Shinjuku (2018) and Tokyo Jujutsu High (Season 0, 2017)
  const MAPS = { shinjuku: { x0: -480, x1: 440, z0: -280, z1: 280, ms: .26 }, jjh: { x0: 2350, x1: 2650, z0: -150, z1: 190, ms: .5 },
    sendai: { x0: 4720, x1: 5280, z0: -280, z1: 280, ms: .3 },
    suburb: { x0: 7220, x1: 7780, z0: -280, z1: 280, ms: .3 },
    shibuya: { x0: 9720, x1: 10280, z0: -280, z1: 280, ms: .3 },
    ikebukuro: { x0: 12220, x1: 12780, z0: -280, z1: 280, ms: .3 },
    canyon: { x0: 14820, x1: 15180, z0: -180, z1: 180, ms: .5 },
    // interiors and domains, where the fights actually happened (ceil = roof height the player can't pass)
    school: { x0: 19992, x1: 20128, z0: -18, z1: 6, ms: 1.6, ceil: 4.2 },
    womb: { x0: 20390, x1: 20610, z0: -110, z1: 110, ms: .7 },
    cinema: { x0: 20792, x1: 20868, z0: -34, z1: 34, ms: 2, ceil: 11 },
    gym: { x0: 21192, x1: 21288, z0: -30, z1: 30, ms: 1.6, ceil: 12 },
    platform: { x0: 21584, x1: 21776, z0: -14, z1: 14, ms: 1, ceil: 7.2 },
    court: { x0: 22200, x1: 22300, z0: -50, z1: 50, ms: 1.2 },
    ruins: { x0: 22596, x1: 22704, z0: -26, z1: 26, ms: 1.6, ceil: 4.6 },
    sewer: { x0: 22996, x1: 23204, z0: -8, z1: 8, ms: 1, ceil: 6 } };
  const INDOOR = ['school', 'womb', 'cinema', 'gym', 'platform', 'court', 'ruins', 'sewer'];
  const CITY = ['shinjuku', 'sendai', 'suburb', 'shibuya', 'ikebukuro'];
  const MAP = Object.assign({}, MAPS.shinjuku);

  /* ---------------- districts (first match wins) ---------------- */
  const D = [
    { id: 'cpark', name: 'Shinjuku Central Park', jp: '新宿中央公園', x0: -480, z0: -150, x1: -398, z1: 130, type: 1 },
    { id: 'honan', name: 'Nishi-Shinjuku 4-chōme', jp: '西新宿四丁目', x0: -480, z0: -280, x1: -398, z1: 280, cx: 41, cz: 45, sw: 10, h: [8, 26], styles: ['residential', 'office'], type: 0 },
    { id: 'tocho', name: 'Tokyo Metropolitan Government', jp: '東京都庁', x0: -398, z0: -137, x1: -318, z1: 130, type: 3 },
    { id: 'nishi', name: 'Nishi-Shinjuku', jp: '西新宿', x0: -318, z0: -137, x1: -50, z1: 130, cx: 67, cz: 65, sw: 14, h: [34, 72], styles: ['glass', 'office', 'granite', 'darkglass'], type: 0 },
    { id: 'nishin', name: 'Nishi-Shinjuku North', jp: '西新宿 北', x0: -398, z0: -280, x1: -50, z1: -137, cx: 58, cz: 48, sw: 12, h: [12, 40], styles: ['office', 'residential', 'glass'], type: 0 },
    { id: 'nishis', name: 'Nishi-Shinjuku South', jp: '西新宿 南', x0: -398, z0: 130, x1: -50, z1: 280, cx: 58, cz: 50, sw: 12, h: [12, 40], styles: ['office', 'residential', 'glass'], type: 0 },
    { id: 'station', name: 'Shinjuku Station', jp: '新宿駅', x0: -50, z0: -280, x1: 55, z1: 280, type: 2 },
    { id: 'gai', name: 'Golden Gai', jp: 'ゴールデン街', x0: 215, z0: -200, x1: 275, z1: -78, cx: 15, cz: 11, sw: 3.5, h: [3.5, 6.5], styles: ['neon', 'residential'], type: 0, neon: .5 },
    { id: 'kabuki', name: 'Kabukichō', jp: '歌舞伎町', x0: 55, z0: -280, x1: 215, z1: -78, cx: 40, cz: 34, sw: 8, h: [8, 24], styles: ['neon', 'neon', 'residential', 'office'], type: 0, neon: 1 },
    { id: 'shinjuku6', name: 'Shinjuku 6-chōme', jp: '新宿六丁目', x0: 215, z0: -280, x1: 440, z1: -66, cx: 50, cz: 45, sw: 10, h: [10, 30], styles: ['residential', 'office'], type: 0 },
    { id: 'sanchome', name: 'Shinjuku 3-chōme', jp: '新宿三丁目', x0: 55, z0: -66, x1: 260, z1: 110, cx: 46, cz: 44, sw: 12, h: [12, 32], styles: ['dept', 'office', 'glass', 'neon'], type: 0, neon: .35 },
    { id: 'gyoen', name: 'Shinjuku Gyoen', jp: '新宿御苑', x0: 260, z0: 10, x1: 440, z1: 280, type: 1 },
    { id: 'nichome', name: 'Shinjuku 2-chōme', jp: '新宿二丁目', x0: 260, z0: -66, x1: 440, z1: 10, cx: 45, cz: 38, sw: 10, h: [8, 24], styles: ['residential', 'neon', 'office'], type: 0, neon: .3 },
    { id: 'yoyogi', name: 'Yoyogi', jp: '代々木', x0: 55, z0: 110, x1: 260, z1: 280, cx: 48, cz: 44, sw: 12, h: [12, 34], styles: ['office', 'glass', 'residential'], type: 0 },
    // Jujutsu High: type 4 raked gravel, type 5 cedar-forest floor
    { id: 'jjhhall', name: 'Jujutsu High · Main Hall', jp: '呪術高専 本堂', x0: 2475, z0: -60, x1: 2535, z1: -20, type: 3 },
    { id: 'jjhpath', name: 'Jujutsu High · Approach', jp: '呪術高専 参道', x0: 2494, z0: -20, x1: 2516, z1: 200, type: 3 },
    { id: 'jjhdorm', name: 'Jujutsu High · Dormitories', jp: '呪術高専 学生寮', x0: 2540, z0: -60, x1: 2630, z1: 95, type: 4 },
    { id: 'jjhcourt', name: 'Jujutsu High · Courtyard', jp: '呪術高専 境内', x0: 2420, z0: -80, x1: 2600, z1: 95, type: 4 },
    { id: 'jjh', name: 'Jujutsu High · Cedar Forest', jp: '呪術高専 杉林', x0: 2100, z0: -400, x1: 2900, z1: 400, type: 5 },
    // Sendai, where Yuji's story starts (the town layout is ours)
    { id: 'sugisawa', name: 'Sugisawa Third High School', jp: '杉沢第三高校', x0: 4950, z0: -75, x1: 5070, z1: 40, type: 4 },
    { id: 'sendai', name: 'Sendai', jp: '仙台', x0: 4700, z0: -300, x1: 5300, z1: 300, cx: 26, cz: 24, sw: 6, h: [4.5, 8], styles: ['residential', 'residential', 'brown'], type: 0 },
    // the suburbs of the early arcs (layout is ours): the detention center, Junpei's school, a river crossed by Yasohachi Bridge
    { id: 'eishu', name: 'Eishū Juvenile Detention Center', jp: '英集少年院', x0: 7300, z0: -230, x1: 7420, z1: -110, type: 4 },
    { id: 'satozakura', name: 'Satozakura High School', jp: '里桜高校', x0: 7560, z0: -200, x1: 7680, z1: -90, type: 4 },
    { id: 'suburb', name: 'Suburbs', jp: '郊外', x0: 7200, z0: -300, x1: 7800, z1: 300, cx: 32, cz: 30, sw: 8, h: [5, 16], styles: ['residential', 'residential', 'brown', 'office'], type: 0 },
    // Shibuya, around the station (approximate real layout: the scramble crossing west of the station, 109 at the Dōgenzaka fork, Center Gai to the north-west)
    { id: 'scramble', name: 'Shibuya Scramble Crossing', jp: '渋谷スクランブル交差点', x0: 9925, z0: -60, x1: 9990, z1: 5, type: 3 },
    { id: 'shibuyasta', name: 'Shibuya Station', jp: '渋谷駅', x0: 9990, z0: -300, x1: 10035, z1: 300, type: 2 },
    { id: 'centergai', name: 'Center Gai', jp: 'センター街', x0: 9820, z0: -200, x1: 9925, z1: -30, cx: 26, cz: 22, sw: 6, h: [8, 22], styles: ['neon', 'neon', 'dept'], type: 0, neon: 1 },
    { id: 'dogenzaka', name: 'Dōgenzaka', jp: '道玄坂', x0: 9780, z0: 5, x1: 9990, z1: 200, cx: 34, cz: 30, sw: 8, h: [10, 30], styles: ['neon', 'office', 'dept'], type: 0, neon: .5 },
    { id: 'shibuyae', name: 'Shibuya East', jp: '渋谷東', x0: 10035, z0: -300, x1: 10300, z1: 300, cx: 44, cz: 40, sw: 12, h: [16, 50], styles: ['glass', 'office', 'darkglass'], type: 0 },
    { id: 'shibuya', name: 'Shibuya', jp: '渋谷', x0: 9700, z0: -300, x1: 9990, z1: 300, cx: 38, cz: 34, sw: 10, h: [12, 34], styles: ['office', 'dept', 'neon', 'glass'], type: 0, neon: .3 },
    // Ikebukuro, inside Tokyo Colony No. 1 (Higuruma's theater, Sunshine 60)
    { id: 'sunshine', name: 'Sunshine 60', jp: 'サンシャイン60', x0: 12560, z0: -70, x1: 12650, z1: 20, type: 3 },
    { id: 'theater', name: "Theater · Higuruma's base", jp: '劇場', x0: 12390, z0: 40, x1: 12470, z1: 110, type: 3 },
    { id: 'ikestation', name: 'Ikebukuro Station', jp: '池袋駅', x0: 12320, z0: -300, x1: 12365, z1: 300, type: 2 },
    { id: 'ikebukuro', name: 'Ikebukuro · Tokyo Colony No. 1', jp: '池袋 · 東京第一結界', x0: 12200, z0: -300, x1: 12800, z1: 300, cx: 36, cz: 32, sw: 10, h: [14, 40], styles: ['office', 'dept', 'neon', 'glass'], type: 0, neon: .3 },
    // Yasohachi Bridge: a stone bridge high over Koinokuchi Canyon, forest roads at both ends, a small river far below
    { id: 'canyonriver', name: 'Yasohachi Bridge', jp: '八十八橋', x0: 14700, z0: -24, x1: 15300, z1: 24, type: 6 },
    { id: 'canyon', name: 'Koinokuchi Canyon', jp: '恋の口渓谷', x0: 14700, z0: -300, x1: 15300, z1: 300, type: 5 },
    { id: 'school4f', name: 'Sugisawa Third High · 4th floor', jp: '杉沢第三高校 四階', x0: 19980, z0: -30, x1: 20140, z1: 20, type: 7 },
    { id: 'wombdomain', name: "The Cursed Womb's Innate Domain", jp: '呪胎の生得領域', x0: 20380, z0: -130, x1: 20620, z1: 130, type: 11 },
    { id: 'cinemain', name: 'Cinema · Screen 3', jp: '映画館 三番スクリーン', x0: 20780, z0: -40, x1: 20880, z1: 40, type: 10 },
    { id: 'gymin', name: 'Satozakura High · Gymnasium', jp: '里桜高校 体育館', x0: 21180, z0: -40, x1: 21300, z1: 40, type: 8 },
    { id: 'platformin', name: 'Shibuya Station · B5F Fukutoshin Line', jp: '渋谷駅 地下五階 副都心線', x0: 21570, z0: -20, x1: 21790, z1: 20, type: 9 },
    { id: 'courtin', name: 'Domain Expansion · Deadly Sentencing', jp: '領域展開 誅伏賜死', x0: 22180, z0: -70, x1: 22320, z1: 70, type: 12 },
    { id: 'ruinsin', name: 'Roppongi · abandoned building', jp: '六本木 廃ビル', x0: 22580, z0: -40, x1: 22720, z1: 40, type: 13 },
    { id: 'sewerwater', name: "Sewers · Mahito's hideout", jp: '下水道', x0: 22980, z0: -2.2, x1: 23220, z1: 2.2, type: 6 },
    { id: 'sewerin', name: "Sewers · Mahito's hideout", jp: '下水道', x0: 22980, z0: -20, x1: 23220, z1: 20, type: 13 },
    // outskirts past the edge of each city map (not walkable): one building per block, so the skyline carries on
    { id: 'shinjukuout', name: 'Shinjuku', jp: '新宿', x0: -760, z0: -560, x1: 720, z1: 560, cx: 52, cz: 48, sw: 12, h: [14, 60], styles: ['office', 'glass', 'residential', 'granite'], type: 0, out: 1 },
    { id: 'sendaiout', name: 'Sendai', jp: '仙台', x0: 4460, z0: -540, x1: 5540, z1: 540, cx: 30, cz: 28, sw: 6, h: [4.5, 9], styles: ['residential', 'residential', 'brown'], type: 0, out: 1 },
    { id: 'suburbout', name: 'Suburbs', jp: '郊外', x0: 6960, z0: -540, x1: 8040, z1: 540, cx: 34, cz: 32, sw: 8, h: [5, 14], styles: ['residential', 'residential', 'brown', 'office'], type: 0, out: 1 },
    { id: 'shibuyaout', name: 'Shibuya', jp: '渋谷', x0: 9460, z0: -540, x1: 10540, z1: 540, cx: 44, cz: 40, sw: 10, h: [14, 44], styles: ['office', 'glass', 'dept', 'darkglass'], type: 0, out: 1 },
    { id: 'ikebukuroout', name: 'Ikebukuro', jp: '池袋', x0: 11960, z0: -540, x1: 13040, z1: 540, cx: 44, cz: 40, sw: 10, h: [12, 40], styles: ['office', 'dept', 'glass', 'residential'], type: 0, out: 1 }
  ];
  const AVE = [{ x0: 55, z0: -78, x1: 440, z1: -66, name: 'Yasukuni-dōri' }];
  function district(x, z) { for (const d of D) if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d; return D[3]; }

  /* ---------------- renderer + post ---------------- */
  const canvas = document.getElementById('cv');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.3, 4000);
  scene.fog = new THREE.FogExp2(0xb9c9d8, 0.004);
  let W = 960, H = 540, pixel = 540;
  const mkRT = (w, h, depth) => { const t = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: !!depth });
    if (depth) { t.depthTexture = new THREE.DepthTexture(w, h); t.depthTexture.type = THREE.UnsignedIntType; } return t; };
  let rtMain, rtA, rtB, rtQA, rtQB;
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), quadScene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); quad.frustumCulled = false; quadScene.add(quad);
  const VS = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }';
  const blurM = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, d: { value: new THREE.Vector2() } }, vertexShader: VS, depthTest: false, depthWrite: false,
    fragmentShader: 'uniform sampler2D t; uniform vec2 d; varying vec2 vUv; void main(){ vec4 c=texture2D(t,vUv)*.2270; c+=(texture2D(t,vUv+d*1.3846)+texture2D(t,vUv-d*1.3846))*.3162; c+=(texture2D(t,vUv+d*3.2308)+texture2D(t,vUv-d*3.2308))*.0703; gl_FragColor=c; }' });
  const brightM = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, th: { value: .72 } }, vertexShader: VS, depthTest: false, depthWrite: false,
    fragmentShader: 'uniform sampler2D t; uniform float th; varying vec2 vUv; void main(){ vec3 c=texture2D(t,vUv).rgb; float l=max(c.r,max(c.g,c.b)); gl_FragColor=vec4(c*smoothstep(th,th+.35,l),1.); }' });
  const copyM = new THREE.ShaderMaterial({ uniforms: { t: { value: null } }, vertexShader: VS, depthTest: false, depthWrite: false, fragmentShader: 'uniform sampler2D t; varying vec2 vUv; void main(){ gl_FragColor=texture2D(t,vUv); }' });
  const compM = new THREE.ShaderMaterial({
    uniforms: { tC: { value: null }, tD: { value: null }, tB: { value: null }, tG: { value: null }, near: { value: .3 }, far: { value: 4000 }, focus: { value: 20 }, dof: { value: 1 },
      bloom: { value: .8 }, grade: { value: new V3(1, 1, 1) }, sat: { value: 1.08 }, vig: { value: .35 }, lift: { value: new V3(0, 0, 0) } },
    vertexShader: VS, depthTest: false, depthWrite: false,
    fragmentShader: `uniform sampler2D tC,tD,tB,tG; uniform float near,far,focus,dof,bloom,sat,vig; uniform vec3 grade,lift; varying vec2 vUv;
      float lin(float z){ z=z*2.-1.; return 2.*near*far/(far+near-z*(far-near)); }
      void main(){ vec3 c=texture2D(tC,vUv).rgb; float d=lin(texture2D(tD,vUv).r);
        float coc=smoothstep(focus*.35,focus*1.6,abs(d-focus));
        coc=max(coc, smoothstep(.62,1.,abs(vUv.y-.46)*2.)*.55);
        c=mix(c,texture2D(tB,vUv).rgb,clamp(coc*dof,0.,1.));
        c+=texture2D(tG,vUv).rgb*bloom;
        float l=dot(c,vec3(.299,.587,.114)); c=mix(vec3(l),c,sat); c=c*grade+lift;
        c*=1.-vig*smoothstep(.45,.9,distance(vUv,vec2(.5,.5)));
        gl_FragColor=vec4(c,1.); }` });
  function resize() {
    const s = Math.max(1, Math.round(innerHeight / pixel)); W = Math.ceil(innerWidth / s); H = Math.ceil(innerHeight / s);
    renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
    for (const t of [rtMain, rtA, rtB, rtQA, rtQB]) if (t) t.dispose();
    rtMain = mkRT(W, H, true); rtA = mkRT(W >> 1, H >> 1); rtB = mkRT(W >> 1, H >> 1); rtQA = mkRT(W >> 2, H >> 2); rtQB = mkRT(W >> 2, H >> 2);
  }
  function pass(mat, target) { quad.material = mat; renderer.setRenderTarget(target); renderer.render(quadScene, quadCam); }
  function blur(src, tmp, w, h) { blurM.uniforms.t.value = src.texture; blurM.uniforms.d.value.set(1 / w, 0); pass(blurM, tmp); blurM.uniforms.t.value = tmp.texture; blurM.uniforms.d.value.set(0, 1 / h); pass(blurM, src); }
  function render(focusDist) {
    renderer.setRenderTarget(rtMain); renderer.render(scene, camera);
    copyM.uniforms.t.value = rtMain.texture; pass(copyM, rtA); blur(rtA, rtB, W >> 1, H >> 1);
    brightM.uniforms.t.value = rtMain.texture; pass(brightM, rtQA); blur(rtQA, rtQB, W >> 2, H >> 2); blur(rtQA, rtQB, W >> 2, H >> 2);
    const u = compM.uniforms; u.tC.value = rtMain.texture; u.tD.value = rtMain.depthTexture; u.tB.value = rtA.texture; u.tG.value = rtQA.texture; u.near.value = camera.near; u.far.value = camera.far; u.focus.value = focusDist;
    pass(compM, null);
  }

  /* ---------------- sky, sun, time of day ---------------- */
  const skyU = { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sun: { value: new V3(0, .5, .8) }, sunC: { value: new THREE.Color() }, night: { value: 0 }, cloud: { value: 1 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(2500, 32, 16), new THREE.ShaderMaterial({ uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vD; void main(){ vD=normalize(position); vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position=p.xyww; }',
    fragmentShader: `uniform vec3 top,mid,hor,sunC,sun; uniform float night,cloud; varying vec3 vD;
      float h(vec2 p){ p=fract(p*vec2(443.8,441.4)); p+=dot(p,p+19.19); return fract(p.x*p.y); }
      float n(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
      void main(){ float y=vD.y; vec3 c=mix(hor,mid,smoothstep(0.,.25,y)); c=mix(c,top,smoothstep(.2,.9,y)); if(y<0.) c=hor*.85;
        float s=max(dot(vD,normalize(sun)),0.); c+=sunC*(pow(s,900.)*3.+pow(s,16.)*.35+pow(s,4.)*.08);
        vec2 sp=vD.xz/(y+.35); float cl=n(sp*3.)*.6+n(sp*7.)*.3+n(sp*15.)*.1; cl=smoothstep(.55,.85,cl)*smoothstep(.02,.25,y)*cloud;
        c=mix(c,mix(hor,vec3(1.),.55)*(1.-night*.8)+sunC*.15,cl*.7);
        if(night>0.){ vec2 g=floor(vD.xz/(y+.3)*140.); c+=step(.996,h(g))*night*smoothstep(.08,.35,y)*(1.-cl); }
        gl_FragColor=vec4(c,1.); }` }));
  sky.frustumCulled = false; scene.add(sky);
  const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x6b6259, .8); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff3dd, 1.1); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -75, right: 75, top: 75, bottom: -75, near: 1, far: 700 }); sun.shadow.bias = -0.0015; sun.shadow.normalBias = 0.14;
  scene.add(sun, sun.target);
  const fuji = new THREE.Group(); { const m = new THREE.MeshBasicMaterial({ color: 0x7d8fb0, fog: false }), s = new THREE.MeshBasicMaterial({ color: 0xf2f4fa, fog: false });
    const c = new THREE.Mesh(new THREE.ConeGeometry(620, 240, 24, 1, true), m); c.position.y = 60; const cap = new THREE.Mesh(new THREE.ConeGeometry(160, 62, 24, 1, true), s); cap.position.y = 151;
    fuji.add(c, cap); fuji.position.set(-1900, 0, 700); fuji.userData = { m, s }; scene.add(fuji); }
  const TIMES = {
    noon: { top: '#2f6fc4', mid: '#8db6e6', hor: '#dde8f0', sunC: '#fff2d6', sunI: 1.25, sun: [0.08, 0.55, 0.83], hs: '#cfe0ff', hg: '#6d655c', hI: .78, fog: '#b8c8d8', fogD: .0026, night: 0, grade: [1.02, 1, .98], lift: [0, 0, 0], sprite: '#ffffff', lamps: 0, bloomTh: .8, fuji: '#8fa3c4' },
    afternoon: { top: '#3569b4', mid: '#9ab2d6', hor: '#f0d6b4', sunC: '#ffdca6', sunI: 1.15, sun: [-0.5, 0.34, 0.8], hs: '#ffe4c8', hg: '#5e5048', hI: .72, fog: '#d8c8b8', fogD: .003, night: 0, grade: [1.05, 1, .94], lift: [.01, 0, 0], sprite: '#fff4e6', lamps: 0, bloomTh: .78, fuji: '#9aa0bc' },
    sunset: { top: '#27336e', mid: '#a45e78', hor: '#ffa45a', sunC: '#ffab66', sunI: 1.05, sun: [-0.86, 0.12, 0.5], hs: '#ffc2a2', hg: '#4a3040', hI: .66, fog: '#cc8e84', fogD: .0036, night: .3, grade: [1.1, .96, .9], lift: [.02, 0, .01], sprite: '#ffd8c0', lamps: .5, bloomTh: .7, fuji: '#6a4a78' },
    dusk: { top: '#0e1030', mid: '#3a2458', hor: '#9a4a62', sunC: '#ff8a70', sunI: .5, sun: [-0.9, 0.05, 0.4], hs: '#9a8ac8', hg: '#3a2840', hI: .78, fog: '#3a2848', fogD: .0045, night: .85, grade: [1, .95, 1.08], lift: [.01, 0, .03], sprite: '#c8b8e8', lamps: 1, bloomTh: .62, fuji: '#2a2448' },
    night: { top: '#04050e', mid: '#0e1430', hor: '#26244a', sunC: '#9fb4ff', sunI: .5, sun: [0.35, 0.7, -0.4], hs: '#6a7ab8', hg: '#2a2230', hI: .8, fog: '#1c2440', fogD: .0045, night: 1, grade: [.95, .98, 1.12], lift: [0, .005, .03], sprite: '#a8b4e0', lamps: 1, bloomTh: .55, fuji: '#12142a' },
    indoor: { top: '#141418', mid: '#18181e', hor: '#1e1e24', sunC: '#fff4e4', sunI: .55, sun: [0.15, 1, 0.1], hs: '#f2eee6', hg: '#8a847c', hI: 1.05, fog: '#1c1c22', fogD: .006, night: 0, grade: [1.02, 1, .98], lift: [0, 0, 0], sprite: '#ffffff', lamps: 1, bloomTh: .78, fuji: '#141418' },
    indoorNight: { top: '#05060c', mid: '#080a14', hor: '#0c0e1a', sunC: '#8fa4e0', sunI: .32, sun: [0.3, 1, 0.5], hs: '#8a98c8', hg: '#2a2a3a', hI: .95, fog: '#0c0f1a', fogD: .012, night: 1, grade: [.95, .98, 1.1], lift: [0, .005, .03], sprite: '#b8c0e8', lamps: 1, bloomTh: .6, fuji: '#05060c' },
    canyon: { top: '#34427e', mid: '#b87a78', hor: '#ffc88a', sunC: '#ffd2a0', sunI: 1.15, sun: [-0.92, 0.42, 0.12], hs: '#ffe0c4', hg: '#6a5e4c', hI: 1, fog: '#d8a88e', fogD: .0022, night: .1, grade: [1.06, .99, .93], lift: [.02, .01, 0], sprite: '#ffe6d0', lamps: .2, bloomTh: .74, fuji: '#7a5a78' },
    domain: { top: '#020103', mid: '#0a0406', hor: '#1a0a0c', sunC: '#ffd8b0', sunI: .7, sun: [0.1, 1, 0.3], hs: '#b8a8a0', hg: '#2a1814', hI: .8, fog: '#0a0406', fogD: .012, night: 1, grade: [1.05, .96, .94], lift: [.01, 0, 0], sprite: '#ffffff', lamps: 0, bloomTh: .6, fuji: '#020103' }
  };
  const U = { power: { value: 1 }, night: { value: 0 }, cut: { value: [new THREE.Vector4(), new THREE.Vector4()] }, time: { value: 0 } };
  let TOD = TIMES.noon;
  function setTime(k) {
    TOD = TIMES[k] || TIMES.noon; const t = TOD;
    skyU.top.value.set(t.top); skyU.mid.value.set(t.mid); skyU.hor.value.set(t.hor); skyU.sunC.value.set(t.sunC); skyU.sun.value.set(...t.sun).normalize(); skyU.night.value = t.night;
    sun.color.set(t.sunC); sun.intensity = t.sunI; hemi.color.set(t.hs); hemi.groundColor.set(t.hg); hemi.intensity = t.hI;
    scene.fog.color.set(t.fog); scene.fog.density = t.fogD; U.night.value = t.night; compM.uniforms.grade.value.set(...t.grade); compM.uniforms.lift.value.set(...t.lift); brightM.uniforms.th.value = t.bloomTh;
    fuji.userData.m.color.set(t.fuji); ridgeM[0].color.set(t.fuji).lerp(new THREE.Color(t.hor), .25); ridgeM[1].color.set(t.fuji).lerp(new THREE.Color('#1c2a1e'), .45); fuji.userData.s.color.set(t.night > .5 ? '#5a6080' : '#f0f2f8');
    lampMat.color.set(t.lamps > .2 ? '#ffd9a0' : '#8a8a90'); lampMat.color.multiplyScalar(t.lamps > .2 ? 1.6 : 1);
    snow.visible = k === 'night'; ash.visible = true; if (typeof rain !== 'undefined') rain.visible = false; ash.material.color.set(t.night > .5 ? 0xff6a7a : 0x9a8a88); ash.material.size = t.night > .5 ? .16 : .12;
  }

  /* ---------------- shader helpers ---------------- */
  const GLSL_HASH = 'float hh(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }\nfloat vn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hh(i),hh(i+vec2(1,0)),f.x),mix(hh(i+vec2(0,1)),hh(i+vec2(1,1)),f.x),f.y); }\n';
  const CUT_FRAG = `uniform vec4 uCut[2];\nfloat bayer4(vec2 p){ vec2 q=mod(floor(p),4.); float i=q.x+q.y*4.; return mod(i*5.+mod(i,4.)*2.,16.)/16.; }\n`;
  const CUT_CODE = `for(int i=0;i<2;i++){ vec4 c=uCut[i]; if(c.z<=0.) continue; float dd=distance(gl_FragCoord.xy,c.xy); if(dd<c.z && gl_FragCoord.z<c.w){ if(bayer4(gl_FragCoord.xy)>pow(dd/c.z,2.)*1.1-.05) discard; } }\n`;
  function buildingMat(tex, tile, key, shop) {
    const m = new THREE.MeshLambertMaterial({ map: tex });
    m.onBeforeCompile = sh => {
      sh.uniforms.uNight = U.night; sh.uniforms.uPower = U.power; sh.uniforms.uCut = U.cut; sh.uniforms.uTile = { value: tile };
      sh.vertexShader = 'varying vec2 vFUV; varying float vRoof, vSeed, vH, vTop; varying vec3 vWP;\nuniform vec2 uTile;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
        mat4 IM = mat4(1.0);
        #ifdef USE_INSTANCING
        IM = instanceMatrix;
        #endif
        mat4 MM = modelMatrix * IM; vec3 sc = vec3(length(MM[0].xyz), length(MM[1].xyz), length(MM[2].xyz)); vec3 lp = position;
        vFUV = (abs(normal.x) > .5 ? vec2(lp.z * sc.z * sign(normal.x), (lp.y + .5) * sc.y) : vec2(-lp.x * sc.x * sign(normal.z), (lp.y + .5) * sc.y)) / uTile;
        vRoof = normal.y; vH = (lp.y + .5) * sc.y; vTop = (.5 - lp.y) * sc.y; vSeed = fract(MM[3].x * .137 + MM[3].z * .311); vWP = (MM * vec4(lp, 1.)).xyz;`);
      sh.fragmentShader = `#define SHOP ${shop ? '1.' : '0.'}\n#define ROOFC ${key === 'rock' ? 'vec3(.2,.3,.14)' : 'vec3(.46,.45,.47)'}\nvarying vec2 vFUV; varying float vRoof, vSeed, vH, vTop; varying vec3 vWP; uniform float uNight, uPower;\n` + GLSL_HASH + CUT_FRAG + sh.fragmentShader
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + CUT_CODE)
        .replace('#include <map_fragment>', `float lit = 0.; float seed = floor(vSeed * 997. + .5);   // snap: interpolation jitter in a varying seed made facades sparkle
          if (vRoof > .5) { diffuseColor.rgb *= ROOFC * (.8 + .35 * hh(floor(vWP.xz * 1.3))); }
          else if (vRoof > -.5) {
            float far = smoothstep(220., 700., distance(vWP, cameraPosition)); vec4 fac = texture2D(map, vFUV); diffuseColor.rgb *= mix(fac.rgb, texture2D(map, vFUV, 4.).rgb, far * .8);
            vec2 cell = floor(vFUV * 2.); lit = mix(step(.75, fac.a) * step(.58, hh(cell + seed * .0917)), .3, far);
            if (vH < 1.8 && SHOP > .5) { float s = hh(vec2(floor(vFUV.x * 1.5), seed * .013)); diffuseColor.rgb = mix(vec3(.16,.18,.22), vec3(.55,.42,.3) * mix(.45, 1., uPower), s) * (vH < 1.35 ? 1. : .55); lit = step(.4, s) * step(vH, 1.35) * .8; }
            if (vTop < .38) diffuseColor.rgb *= .7;
          }`)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.,.8,.52) * lit * uNight * uPower * .9;');
    };
    m.customProgramCacheKey = () => 'bld' + key;
    return m;
  }
  function facadeTex(kind) {
    const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'), id = g.createImageData(32, 32), d = id.data;
    const set = (x, y, r, gg, b, a) => { const o = (y * 32 + x) * 4; d[o] = r; d[o + 1] = gg; d[o + 2] = b; d[o + 3] = a; };
    const P = { glass: [[92, 130, 150], [150, 190, 205]], office: [[150, 150, 152], [60, 72, 90]], granite: [[178, 170, 158], [70, 80, 96]], darkglass: [[40, 44, 52], [60, 70, 86]],
      residential: [[205, 196, 178], [70, 84, 100]], neon: [[70, 64, 72], [50, 56, 70]], dept: [[184, 160, 132], [80, 86, 96]], brown: [[128, 96, 76], [60, 66, 80]],
      temple: [[226, 220, 206], [214, 196, 160]], plaster: [[218, 212, 198], [74, 70, 66]], stone: [[150, 146, 138], [150, 146, 138]], rock: [[112, 104, 92], [112, 104, 92]],
      schoolwall: [[214, 208, 190], [40, 52, 74]], concrete: [[116, 114, 110], [116, 114, 110]], woodwall: [[196, 180, 150], [110, 72, 40]], tilewall: [[206, 204, 198], [156, 94, 49]], school: [[228, 226, 216], [70, 90, 116]] }[kind], WOOD = [58, 40, 30];
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const fy = y % 16, fx = x % 16; let win = false, c0 = P[0], n = (((x >> 3) * 7 + (y >> 4) * 13) % 5) * 2;
      if (kind === 'glass' || kind === 'darkglass') { win = fy > 2 && fx !== 0 && fx !== 8; if (fy <= 2) c0 = kind === 'glass' ? [70, 96, 112] : [26, 28, 34]; }
      else if (kind === 'office') win = fy >= 6 && fy <= 12;
      else if (kind === 'granite' || kind === 'brown') win = fy >= 4 && fy <= 12 && (fx % 8 >= 2 && fx % 8 <= 5);
      else if (kind === 'residential') { win = fy >= 3 && fy <= 11 && fx >= 2 && fx <= 12; if (fy === 12 || fy === 13) c0 = [120, 116, 110]; }
      else if (kind === 'neon') win = fy >= 5 && fy <= 11 && fx % 8 >= 2 && fx % 8 <= 6;
      else if (kind === 'dept') win = fy >= 9 && fy <= 12 && fx >= 3 && fx <= 12;
      // temple: dark timber posts and beams, white plaster above, paper shoji below (they glow at night)
      else if (kind === 'temple') { if (fx === 0 || fy <= 1 || fy === 6 || fy === 7) c0 = WOOD; else if (fy >= 8) { win = true; if (fx % 4 === 0 || fy % 4 === 0) { set(x, y, WOOD[0] + 20, WOOD[1] + 16, WOOD[2] + 12, 255); continue; } } }
      else if (kind === 'plaster') { if (fy <= 1 || fx === 0) c0 = WOOD; else win = fy >= 5 && fy <= 11 && fx >= 4 && fx <= 11; }
      else if (kind === 'schoolwall') { if (fy >= 3 && fy <= 10 && fx % 8 >= 1) { win = false; c0 = fx % 8 === 4 || fy === 6 ? [150, 150, 146] : [36, 48, 70]; } else if (fy >= 13) c0 = [110, 118, 104]; }
      else if (kind === 'school') { win = fy >= 4 && fy <= 11 && fx % 8 !== 0 && fx % 8 !== 4; if (fy === 13 || fy === 14) c0 = [196, 194, 184]; }
      else if (kind === 'concrete') { if (fy % 8 === 0 || fx % 16 === 0) c0 = [96, 94, 90]; }
      else if (kind === 'woodwall') { if (fy >= 8) c0 = [120 + (fx % 3) * 8, 80, 44]; if (fy === 8) c0 = [70, 44, 24]; }
      else if (kind === 'tilewall') { if (fy === 9 || fy === 10) c0 = P[1]; else if (fx % 4 === 0 || fy % 4 === 0) c0 = [176, 176, 170]; }
      else if (kind === 'rock') { const band = Math.sin(y * .9 + Math.sin(x * .4) * 1.4); c0 = band > .5 ? [128, 118, 102] : band < -.6 ? [84, 78, 70] : [104, 96, 86]; if ((x * 7 + y * 3) % 11 === 0) c0 = [70, 88, 58]; }
      else if (kind === 'stone') { if (fy % 8 === 0 || (fx + (fy >> 3) * 8) % 16 === 0) c0 = [112, 108, 102]; }
      if (win) { const w = P[1], sky = kind === 'glass' ? (16 - fy) * 2 : 0; set(x, y, w[0] + sky + n, w[1] + sky + n, w[2] + sky + n, 255); }
      else set(x, y, c0[0] + n - 5, c0[1] + n - 5, c0[2] + n - 5, 128);
    }
    g.putImageData(id, 0, 0); const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }

  /* ---------------- ground ---------------- */
  const groundMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  groundMat.onBeforeCompile = sh => {
    const dd = D.map(d => new THREE.Vector4(d.x0, d.z0, d.x1, d.z1)), gg = D.map(d => new THREE.Vector4(d.cx || 1, d.cz || 1, d.sw || 0, d.type));
    while (dd.length < 52) { dd.push(new THREE.Vector4(0, 0, -1, -1)); gg.push(new THREE.Vector4(1, 1, 0, 0)); }
    const aa = AVE.map(a => new THREE.Vector4(a.x0, a.z0, a.x1, a.z1)); while (aa.length < 4) aa.push(new THREE.Vector4(0, 0, -1, -1));
    Object.assign(sh.uniforms, { uD: { value: dd }, uG: { value: gg }, uA: { value: aa }, uCut: U.cut, uT: U.time });
    sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvWP = (modelMatrix * vec4(position,1.)).xyz;');
    sh.fragmentShader = 'varying vec3 vWP; uniform vec4 uD[52]; uniform vec4 uG[52]; uniform vec4 uA[4]; uniform float uT;\n' + GLSL_HASH + `
      vec3 asph(vec2 p){ return vec3(.2,.2,.22) + hh(floor(p*5.))*.05 + vn(p*.25)*.05; }
      vec3 pave(vec2 p){ vec2 t=fract(p*.8); float g=step(t.x,.08)+step(t.y,.08); return mix(vec3(.55,.53,.5)+hh(floor(p*.8))*.06, vec3(.38,.37,.36), clamp(g,0.,1.)); }
      vec3 lot(vec2 p){ return vec3(.34,.33,.32)+hh(floor(p*2.))*.04; }
      vec3 grass(vec2 p){ float n=vn(p*.12)*.55+hh(floor(p*3.))*.2; vec3 c=mix(vec3(.19,.3,.13),vec3(.3,.4,.17),n);
        float path=abs(sin(p.x*.031+sin(p.y*.02)*2.)*28.-p.y*.18-mod(p.x*.2,40.)*0.); if(abs(fract((p.x*.7+p.y)/90.)-.5)*90.<2.2) c=vec3(.52,.46,.36)+hh(floor(p*4.))*.05; return c; }
      vec3 plaza(vec2 p){ vec2 t=fract(p/3.); float g=step(t.x,.04)+step(t.y,.04); vec3 c=mix(vec3(.6,.57,.53),vec3(.52,.5,.47),step(.5,hh(floor(p/3.)))); return mix(c,vec3(.42,.4,.38),clamp(g,0.,1.)); }
      vec3 gravel(vec2 p){ return vec3(.5,.49,.46)+hh(floor(p*6.))*.06-vn(p*.3)*.07; }
      vec3 forest(vec2 p){ float n=vn(p*.15)*.6+hh(floor(p*3.))*.22; return mix(vec3(.14,.17,.09),vec3(.27,.23,.14),n); }
      vec3 rails(vec2 p){ if(p.x<-36.||p.x>38.) return plaza(p*1.5); float tx=mod(p.x+36.,4.6); vec3 c=vec3(.33,.3,.28)+hh(floor(p*5.))*.1;
        if(abs(tx-2.3)<1.25 && fract(p.y/.75)<.38) c=vec3(.3,.23,.18); if(abs(abs(tx-2.3)-.55)<.07) c=vec3(.66,.64,.64); if(tx>4.) c=vec3(.45,.44,.43); return c; }
      vec3 urban(vec2 p, vec4 d, vec4 g){ vec2 f=mod(p-d.xy,g.xy); float sw=g.z; bool vs=f.x<sw, hs=f.y<sw;
        if(vs||hs){ vec3 c=asph(p); if(vs&&hs) return c;
          if(vs){ if(f.y<sw+3.2||f.y>g.y-3.2){ if(fract(f.x)<.5&&f.x>.7&&f.x<sw-.7) c=vec3(.82,.82,.8); } else if(sw>9.&&abs(f.x-sw*.5)<.1) c=vec3(.86,.72,.22); else if(sw>9.&&abs(abs(f.x-sw*.5)-sw*.25)<.08&&fract(p.y/5.)<.5) c=vec3(.8); }
          else { if(f.x<sw+3.2||f.x>g.x-3.2){ if(fract(f.y)<.5&&f.y>.7&&f.y<sw-.7) c=vec3(.82,.82,.8); } else if(sw>9.&&abs(f.y-sw*.5)<.1) c=vec3(.86,.72,.22); else if(sw>9.&&abs(abs(f.y-sw*.5)-sw*.25)<.08&&fract(p.x/5.)<.5) c=vec3(.8); }
          return c; }
        if(f.x<sw+2.6||f.y<sw+2.6||f.x>g.x-2.6||f.y>g.y-2.6){ vec3 c=pave(p); if(f.x<sw+.35||f.y<sw+.35||f.x>g.x-.35||f.y>g.y-.35) c=vec3(.62,.61,.59); return c; }
        return lot(p); }
      vec3 groundAt(vec2 p){
        for(int i=0;i<4;i++){ vec4 a=uA[i]; if(a.z<=a.x) continue; if(p.x>a.x&&p.x<a.z&&p.y>a.y&&p.y<a.w){ vec3 c=asph(p); float m=(a.y+a.w)*.5; if(abs(p.y-m)<.25&&abs(p.y-m)>.08) c=vec3(.86,.72,.22); else if(abs(abs(p.y-m)-3.)<.08&&fract(p.x/5.)<.5) c=vec3(.8); return c; } }
        for(int i=0;i<52;i++){ vec4 d=uD[i]; if(d.z<=d.x) continue; if(p.x<d.x||p.x>=d.z||p.y<d.y||p.y>=d.w) continue; vec4 g=uG[i];
          if(g.w<.5) return urban(p,d,g); if(g.w<1.5) return grass(p); if(g.w<2.5) return rails(p); if(g.w<3.5) return plaza(p); if(g.w<4.5) return gravel(p); if(g.w<5.5) return forest(p);
          if(g.w>6.5){ vec2 t=fract(p*.5); float seam=step(t.x,.04)+step(t.y,.04);
            if(g.w<7.5) return mix(vec3(.46,.5,.46)+hh(floor(p*.5))*.03, vec3(.36,.38,.36), clamp(seam,0.,1.));
            if(g.w<8.5){ vec3 c=vec3(.56,.4,.24)*(.88+hh(vec2(floor(p.x*1.2),floor(p.y*.25+floor(p.x*1.2)*.37)))*.2); vec2 q=p-(d.xy+d.zw)*.5; float l=abs(length(q)-8.); if(l<.12||abs(q.x)<.08||abs(abs(q.x)-(d.z-d.x)*.5+8.)<.1&&abs(q.y)<12.) c=vec3(.85,.85,.8); return c; }
            if(g.w<9.5){ vec3 c=vec3(.52,.52,.5)+hh(floor(p*2.))*.04; if(abs(abs(p.y-(d.y+d.w)*.5)-4.)<.25) c=vec3(.86,.72,.16); return c; }
            if(g.w<10.5) return vec3(.3,.07,.1)*(.8+step(.5,fract((p.x+p.y)*.7))*.2);
            if(g.w<11.5) return vec3(.18,.08,.08)+vn(p*.2)*.08;
            if(g.w<12.5) return vec3(.32,.2,.12)*(.85+hh(floor(p*vec2(1.,.3)))*.2);
            return vec3(.34,.33,.3)+vn(p*.4)*.08-hh(floor(p*3.))*.05; }
          float bank=abs(p.y-(d.y+d.w)*.5); return bank<18.? vec3(.14,.24,.3)+vn(p*.3+vec2(0.,uT))*.06 : mix(vec3(.3,.36,.2),vec3(.42,.4,.3),hh(floor(p*3.))*.5); }
        return lot(p); }
      ` + CUT_FRAG.replace('uniform vec4 uCut[2];', 'uniform vec4 uCut[2];') + sh.fragmentShader.replace('#include <map_fragment>', 'diffuseColor.rgb *= groundAt(vWP.xz);');
  };
  groundMat.customProgramCacheKey = () => 'ground';
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(MAP.x1 - MAP.x0 + 800, MAP.z1 - MAP.z0 + 800), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.set((MAP.x0 + MAP.x1) / 2, 0, (MAP.z0 + MAP.z1) / 2); ground.receiveShadow = true; scene.add(ground);
  const ground2 = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), groundMat); ground2.rotation.x = -Math.PI / 2; ground2.position.set(2500, 0, 0); ground2.receiveShadow = true;

  /* ---------------- buildings ---------------- */
  const STY = ['glass', 'office', 'granite', 'darkglass', 'residential', 'neon', 'dept', 'brown', 'temple', 'plaster', 'stone', 'rock', 'schoolwall', 'concrete', 'woodwall', 'tilewall', 'school'],
    JJH_STY = ['temple', 'plaster', 'stone', 'rock', 'schoolwall', 'concrete', 'woodwall', 'tilewall'];
  const STY_MAPS = { temple: ['jjh'], plaster: ['jjh'], stone: ['jjh', 'canyon', 'court'], rock: ['canyon', 'womb'], schoolwall: ['school'], concrete: ['womb', 'platform', 'gym', 'ruins', 'sewer'], woodwall: ['cinema', 'gym', 'court'], tilewall: ['platform'] };   // everything else belongs to the city maps
  const TILE = { glass: [4, 3.4], office: [5, 3.4], granite: [4, 3.4], darkglass: [4, 3.4], residential: [4.4, 3], neon: [4, 3], dept: [6, 4], brown: [4, 3.4], temple: [8, 9], plaster: [7, 6], stone: [2.4, 1.1], rock: [14, 9], schoolwall: [8, 4.2], concrete: [8, 4], woodwall: [4, 5], tilewall: [4, 4], school: [4, 3.6] };
  const MATS = {}; for (const s of STY) MATS[s] = buildingMat(facadeTex(s), new THREE.Vector2(...TILE[s]), s, !JJH_STY.includes(s) && s !== 'school');
  const B = [], plan = {}; for (const s of STY) plan[s] = [];
  const RES = [];   // reserved rects (landmarks, plazas)
  const reserve = (x0, z0, x1, z1) => RES.push([x0, z0, x1, z1]);
  const reserved = (x0, z0, x1, z1) => RES.some(r => x0 < r[2] && x1 > r[0] && z0 < r[3] && z1 > r[1]) || AVE.some(a => x0 < a.x1 && x1 > a.x0 && z0 < a.z1 && z1 > a.z0);
  function addB(style, x, z, w, d, h, o) { o = o || {}; const b = { style, x, z, w, d, h, h0: h, base: o.base || 0, rot: o.rot || 0, tint: o.tint || R(.82, 1.08), lm: o.lm || null, hp: 0, alive: true, neon: o.neon || 0, map: o.map || null };
    const c = Math.abs(Math.cos(b.rot)), s = Math.abs(Math.sin(b.rot)); b.hw = (w * c + d * s) / 2; b.hd = (w * s + d * c) / 2; b.hp = b.hp0 = 30 + w * d * .6 + h * 4; plan[style].push(b); B.push(b); return b; }

  // landmarks (Nishi-Shinjuku skyscrapers, Tochō, Kabukichō, Yoyogi)
  const LM = {}, specials = [];
  function landmarks() {
    const lm = (name, x, z) => (LM[name] = [x, 0, z]);
    // Tochō No.1: podium, twin towers with rotated crowns; No.2 stepped; Citizens' Plaza colonnade
    lm('tocho', -372, -8); reserve(-398, -60, -318, 90);
    addB('granite', -372, -8, 26, 46, 56, { lm: 'tocho', tint: .95 });
    addB('granite', -372, -22, 22, 16, 34, { base: 56, lm: 'tocho' }); addB('granite', -372, 6, 22, 16, 34, { base: 56, lm: 'tocho' });
    addB('granite', -372, -22, 14, 14, 8, { base: 90, rot: Math.PI / 4, lm: 'tocho' }); addB('granite', -372, 6, 14, 14, 8, { base: 90, rot: Math.PI / 4, lm: 'tocho' });
    addB('office', -372, -22, 6, 6, 4, { base: 98, lm: 'tocho' }); addB('office', -372, 6, 6, 6, 4, { base: 98, lm: 'tocho' });
    addB('granite', -372, 58, 30, 30, 40, { lm: 'tocho2' }); addB('granite', -372, 58, 22, 22, 18, { base: 40, lm: 'tocho2' }); addB('granite', -372, 58, 14, 14, 8, { base: 58, lm: 'tocho2' });
    addB('granite', -336, -48, 20, 18, 16, { lm: 'assembly' });
    for (let i = 0; i <= 14; i++) { const a = -Math.PI / 2 + i / 14 * Math.PI; addB('granite', -350 + Math.cos(a) * 22, -8 + Math.sin(a) * 22, 1.2, 1.2, 9, { lm: 'colonnade', tint: 1 }); }
    // Nishi-Shinjuku towers
    lm('keio', -277, -40); reserve(-301, -70, -253, -9); addB('office', -284, -40, 40, 13, 71, { lm: 'keio', tint: 1.08 }); addB('office', -268, -52, 22, 12, 40, { lm: 'keio', tint: 1.05 });
    lm('sumitomo', -210, -40); reserve(-235, -70, -186, -9);
    lm('nomura', -143, -40); reserve(-168, -70, -119, -9); addB('darkglass', -143, -40, 30, 22, 84, { lm: 'nomura' });
    lm('subaru', -76, -40); reserve(-101, -70, -52, -9); addB('office', -76, -42, 36, 34, 24, { lm: 'subaru' });
    lm('ns', -277, 32); reserve(-301, 9, -253, 56); addB('brown', -277, 32, 34, 34, 54, { lm: 'ns', tint: 1.1 });
    lm('mitsui', -210, 32); reserve(-235, 9, -186, 56); addB('darkglass', -210, 32, 36, 20, 90, { lm: 'mitsui', tint: .8 }); addB('darkglass', -210, 48, 30, 8, 10, { lm: 'mitsui' });
    lm('center', -143, 32); reserve(-168, 9, -119, 56); addB('brown', -143, 32, 32, 26, 89, { lm: 'center' });
    lm('cocoon', -76, 32); reserve(-101, 9, -52, 56); addB('glass', -76, 32, 30, 30, 8, { lm: 'cocoon' });
    lm('parktower', -277, 90); reserve(-301, 60, -253, 121);
    for (const [x, z, h] of [[-290, 80, 70], [-272, 101, 82], [-262, 78, 94]]) addB('granite', x, z, 18, 18, h, { lm: 'parktower', tint: .85 });
    // Station: west department stores, east Lumine, Omoide Yokocho
    lm('station', 0, 0);
    addB('dept', -44, -12, 12, 56, 24, { lm: 'odakyu' }); addB('dept', -44, 40, 12, 36, 20, { lm: 'keio-dept' }); addB('dept', 46, 0, 16, 50, 18, { lm: 'lumine' });
    for (let i = 0; i < 9; i++) { addB('neon', -46.5, -84 + i * 3.4, 5, 3.1, R(4, 5.5), { lm: 'omoide', neon: 1 }); addB('neon', -39.5, -84 + i * 3.4, 5, 3.1, R(4, 5.5), { lm: 'omoide', neon: 1 }); }
    lm('omoide', -43, -70);
    // Kabukichō: Studio Alta, Toho building with the kaiju head, Cinema City plaza
    lm('alta', 77, -40); reserve(68, -52, 100, -24); addB('dept', 80, -40, 22, 22, 18, { lm: 'alta', tint: .9 });
    lm('toho', 119, -124); reserve(104, -135, 134, -113); addB('dept', 119, -124, 26, 18, 52, { lm: 'toho', tint: .75 });
    lm('kabukiplaza', 119, -158); reserve(104, -169, 134, -147);
    lm('kabuki', 99, -80);
    // Yoyogi: NTT Docomo tower
    lm('docomo', 133, 182); reserve(117, 168, 149, 196);
    addB('granite', 133, 182, 24, 20, 40, { lm: 'docomo', tint: .9 }); addB('granite', 133, 182, 18, 15, 28, { base: 40, lm: 'docomo', tint: .9 }); addB('granite', 133, 182, 12, 10, 18, { base: 68, lm: 'docomo', tint: .9 }); addB('granite', 133, 182, 9, 8, 8, { base: 86, lm: 'docomo', tint: .95 });
    lm('gyoen', 350, 150); lm('cpark', -440, -10); lm('gai', 245, -140);
  }
  landmarks();
  // Tokyo Jujutsu High: a temple compound in the forested hills on the edge of Tokyo (layout is ours; the anime shows
  // timber halls on stone platforms, a five-storey pagoda, stone lanterns and cedar woods)
  const JR = [];   // roofs to build for these buildings
  reserve(4945, -80, 5075, 45); reserve(4855, -178, 4905, -122);   // Sendai: school grounds, hospital
  reserve(7295, -235, 7425, -105); reserve(7555, -205, 7685, -85); reserve(7200, 165, 7800, 235); reserve(7430, 40, 7475, 85);   // suburbs
  reserve(9880, -30, 9925, 10); reserve(10040, -45, 10080, 5); reserve(9920, -95, 9960, -60);   // Shibuya: 109, Hikarie, QFront
  reserve(12555, -75, 12655, 25); reserve(12385, 35, 12475, 115);   // Ikebukuro: Sunshine 60, the theater
  { const J = (st, x, z, w, d, h, o = {}) => addB(st, x, z, w, d, h, Object.assign({ map: 'jjh', tint: R(.94, 1.04) }, o));
    for (let k = 0; k < 3; k++) J('stone', 2505, -40, 54 - k * 4, 34 - k * 4, .55, { base: k * .55 });   // walkable steps
    JR.push({ b: J('temple', 2505, -40, 38, 18, 9, { base: 1.65 }), eave: 4, rh: 8 });
    JR.push({ b: J('plaster', 2440, -30, 14, 40, 8), eave: 2, rh: 4 });                     // lecture hall
    JR.push({ b: J('plaster', 2610, -30, 14, 36, 7.5), eave: 2, rh: 4 });                   // dormitory
    JR.push({ b: J('plaster', 2588, 62, 16, 28, 7), eave: 1.6, rh: 3.6 });                  // east dorm and the storehouse
    JR.push({ b: J('plaster', 2552, 62, 10, 16, 5.5, { tint: 1.08 }), eave: 1.2, rh: 2.6 }); //   frame a narrow back alley
    J('stone', 2448, 55, 11, 11, .9);                                                        // five-storey pagoda
    for (let k = 0; k < 5; k++) { const w = 7.4 - k * .65; JR.push({ b: J('temple', 2448, 55, w, w, 3, { base: .9 + k * 3 }), eave: 2.4 - k * .1, rh: 1.3, y: -.6, spire: k === 4 }); }
    JR.push({ b: J('temple', 2487, 92, 6, 6, 6), eave: 1.2, rh: 2.2 }); JR.push({ b: J('temple', 2513, 92, 6, 6, 6), eave: 1.2, rh: 2.2 });   // gate pavilions
  }
  // procedural blocks
  for (const d of D) {
    if (d.type !== 0) continue;
    for (let ox = d.x0; ox < d.x1 - 4; ox += d.cx) for (let oz = d.z0; oz < d.z1 - 4; oz += d.cz) {
      const x0 = ox + d.sw + 2.8, x1 = Math.min(ox + d.cx, d.x1) - 2.8, z0 = oz + d.sw + 2.8, z1 = Math.min(oz + d.cz, d.z1) - 2.8;
      if (x1 - x0 < 3 || z1 - z0 < 3 || reserved(x0, z0, x1, z1) || (d.out && district((x0 + x1) / 2, (z0 + z1) / 2) !== d)) continue;
      const lotMin = d.out ? 99 : d.id === 'gai' ? 3 : d.id === 'kabuki' ? 7 : 11, nx = Math.max(1, Math.min(3, Math.floor((x1 - x0) / lotMin * R(.5, 1)))), nz = Math.max(1, Math.min(2, Math.floor((z1 - z0) / lotMin * R(.5, 1))));
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        const lx0 = x0 + (x1 - x0) * i / nx, lx1 = x0 + (x1 - x0) * (i + 1) / nx, lz0 = z0 + (z1 - z0) * j / nz, lz1 = z0 + (z1 - z0) * (j + 1) / nz;
        const m = d.id === 'gai' ? .15 : .6, w = lx1 - lx0 - m * 2, dp = lz1 - lz0 - m * 2; if (w < 2 || dp < 2) continue;
        const t = rnd(), h = d.h[0] + (d.h[1] - d.h[0]) * t * t * (d.id === 'nishi' ? .8 : 1) + (d.id === 'nishi' && rnd() < .3 ? R(10, 30) : 0);
        const st = pick(d.styles), b = addB(st, (lx0 + lx1) / 2, (lz0 + lz1) / 2, w, dp, h, { neon: d.neon && rnd() < d.neon ? 1 : 0 });
        if (h > 26 && rnd() < .45) addB(st, b.x + R(-1, 1), b.z + R(-1, 1), w * R(.5, .75), dp * R(.5, .75), h * R(.1, .25), { base: h, tint: b.tint });
      }
    }
  }
  // Sugisawa Third High: the classroom block the curse climbs, the gym, and the hospital where Yuji's grandfather died
  const S = (st, x, z, w, d, h, o = {}) => addB(st, x, z, w, d, h, Object.assign({ map: 'sendai', tint: R(.95, 1.05) }, o));
  S('school', 5010, -56, 72, 14, 14.4, { lm: 'school', tint: 1 }); S('school', 5010, -48, 10, 4, 18, { lm: 'school-tower', tint: 1 }); S('brown', 4968, -30, 22, 26, 11, { lm: 'gym' });
  S('office', 4880, -150, 36, 24, 20, { lm: 'hospital', tint: 1.1 });
  const SB = (st, x, z, w, d, h, o = {}) => addB(st, x, z, w, d, h, Object.assign({ map: 'suburb', tint: R(.95, 1.05) }, o));
  for (const [x, z, w, d] of [[7330, -190, 40, 14], [7385, -190, 14, 40], [7340, -140, 30, 12]]) SB('residential', x, z, w, d, 12, { lm: 'eishu', tint: .9 });   // cell blocks
  for (const [x, z, w, d] of [[7360, -229, 124, 1.2], [7326, -111, 56, 1.2], [7394, -111, 56, 1.2], [7299, -170, 1.2, 118], [7421, -170, 1.2, 118]]) SB('granite', x, z, w, d, 5, { lm: 'eishu-wall' });
  for (const x of [7353, 7367]) SB('granite', x, -111, 2, 2, 6.2, { lm: 'eishu-gate' });
  SB('residential', 7620, -180, 90, 14, 14, { lm: 'satozakura', tint: 1.05 }); SB('brown', 7580, -130, 24, 30, 10, { lm: 'satozakura-gym' });   // the gym hosts the assembly
  SB('dept', 7452, 62, 36, 36, 12, { lm: 'cinema', tint: .85 });
  const IN = (map, st, x, z, w, d, h, o = {}) => addB(st, x, z, w, d, h, Object.assign({ map, tint: 1 }, o));
  // Sugisawa Third High, 4th floor at night: a long hallway, windows on the yard side, classrooms behind sliding-door gaps
  IN('school', 'schoolwall', 20060, 4.6, 124, .6, 4.2); IN('school', 'schoolwall', 19998, -6, .6, 22, 4.2); IN('school', 'schoolwall', 20122, -6, .6, 22, 4.2); IN('school', 'schoolwall', 20060, -16.6, 124, .6, 4.2);
  for (let x = 20000; x < 20120; x += 24) { IN('school', 'schoolwall', x + 9, -4.3, 14, .5, 4.2); IN('school', 'schoolwall', x + 21.5, -4.3, 3, .5, 4.2); if (x > 20000) IN('school', 'schoolwall', x, -10.4, .5, 12, 4.2); }
  // the womb's innate domain: a warped maze of concrete fragments, some hanging in the air
  for (let i = 0; i < 46; i++) { const x = 20500 + R(-95, 95), z = R(-95, 95); if (Math.hypot(x - 20500, z - 60) < 14 || Math.hypot(x - 20500, z) < 16) continue;
    IN('womb', i % 3 ? 'concrete' : 'rock', x, z, R(4, 14), R(4, 14), R(4, 26), { base: rnd() < .25 ? R(4, 12) : 0, rot: R(-.5, .5), tint: R(.5, .8) }); }
  // Screen 3: stepped rows of seats rising away from the screen
  IN('cinema', 'woodwall', 20830, -32.6, 76, .6, 11); IN('cinema', 'woodwall', 20830, 32.6, 76, .6, 11); IN('cinema', 'woodwall', 20792.4, 0, .6, 66, 11); IN('cinema', 'woodwall', 20867.6, 0, .6, 66, 11);
  for (let r = 0; r < 12; r++) IN('cinema', 'woodwall', 20830, -8 + r * 3, 60, 3, .45 * (r + 1), { tint: .45 });
  // Satozakura High's gymnasium: court, stage, high windows
  IN('gym', 'woodwall', 21240, -30.6, 96, .6, 12); IN('gym', 'woodwall', 21240, 30.6, 96, .6, 12); IN('gym', 'concrete', 21192.4, 0, .6, 60, 12); IN('gym', 'concrete', 21287.6, 0, .6, 60, 12);
  IN('gym', 'woodwall', 21240, -26, 44, 8, 1.3, { tint: .7 });
  // Shibuya Station, B5F: an island platform between the Fukutoshin Line tracks, tiled walls, columns down the middle
  IN('platform', 'concrete', 21680, 0, 190, 12, 1.1, { tint: .9 }); IN('platform', 'tilewall', 21680, -14.6, 196, .6, 7.2); IN('platform', 'tilewall', 21680, 14.6, 196, .6, 7.2);
  IN('platform', 'tilewall', 21584.4, 0, .6, 30, 7.2); IN('platform', 'tilewall', 21775.6, 0, .6, 30, 7.2);
  for (let x = 21596; x < 21770; x += 12) IN('platform', 'concrete', x, 0, .9, .9, 7.2, { tint: 1.1 });
  const train = IN('platform', 'concrete', 21660, 9.5, 120, 3.2, 4.2); train.hidden = true;
  // Deadly Sentencing: a courtroom in the dark, the judge's bench, two stands
  IN('court', 'woodwall', 22250, -22, 30, 5, 4.5); IN('court', 'woodwall', 22238, 2, 5, 3, 1.4); IN('court', 'woodwall', 22262, 2, 5, 3, 1.4); IN('court', 'woodwall', 22250, 12, 40, .8, 1.2); IN('court', 'woodwall', 22250, -25, 36, .8, 9, { tint: .7 });
  for (let r = 0; r < 4; r++) for (const x of [22236, 22264]) IN('court', 'woodwall', x, 18 + r * 3.2, 18, .9, .9, { tint: .8 });
  // Roppongi: an abandoned office floor, rooms off a corridor, some walls broken through
  for (const [x, z, w, d] of [[22650, -24.6, 104, .6], [22650, 24.6, 104, .6], [22598, 0, .6, 50], [22702, 0, .6, 50], [22625, -12, 30, .5], [22672, -12, 36, .5], [22630, 10, 40, .5], [22682, 10, 24, .5], [22640, -18, .5, 12], [22662, 17, .5, 14]])
    IN('ruins', 'concrete', x, z, w, d, 4.6, { tint: .75 });
  // the sewers under the city where Mahito hides: a long tunnel, a channel of water down the middle
  IN('sewer', 'concrete', 23100, -7.3, 204, .6, 6, { tint: .6 }); IN('sewer', 'concrete', 23100, 7.3, 204, .6, 6, { tint: .6 }); IN('sewer', 'concrete', 22998, 0, .6, 15, 6, { tint: .6 }); IN('sewer', 'concrete', 23202, 0, .6, 15, 6, { tint: .6 });
  const IK = (st, x, z, w, d, h, o = {}) => addB(st, x, z, w, d, h, Object.assign({ map: 'ikebukuro', tint: R(.95, 1.05) }, o));
  IK('darkglass', 12605, -25, 34, 34, 112, { lm: 'sunshine', tint: .95 }); IK('office', 12605, -25, 60, 60, 10, { lm: 'sunshine-podium' }); IK('dept', 12430, 72, 36, 28, 16, { lm: 'theater', tint: .8 });
  // canyon walls: uneven blocks of rock either side of the gorge, forest on top; the bridge deck crosses at the rim
  const CANYON = []; for (const side of [-1, 1]) for (let x = 14720; x < 15290; x += 38) { const z0 = 24 + R(0, 6), h = Math.abs(x + 19 - 15000) < 34 ? 28.6 : R(27, 33); CANYON.push(addB('rock', x + 19, side * (z0 + 90), 40, 180, h, { map: 'canyon', tint: R(.9, 1.1) })); }
  addB('stone', 15000, 0, 9, 72, 1.4, { base: 28.6, map: 'canyon', lm: 'yasohachi' });  const SH = (st, x, z, w, d, h, o = {}) => addB(st, x, z, w, d, h, Object.assign({ map: 'shibuya', tint: R(.95, 1.05) }, o));
  SH('glass', 10060, -20, 34, 44, 72, { lm: 'hikarie', tint: 1.05 }); SH('dept', 9940, -78, 34, 30, 22, { lm: 'qfront', tint: .8 }); SH('office', 9955, 30, 40, 18, 24, { lm: 'markcity' });
  const b109 = SH('darkglass', 9902, -10, 16, 16, 34, { lm: '109' }); b109.hidden = true;
  // instanced meshes
  const box = new THREE.BoxGeometry(1, 1, 1), M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), S3 = new V3(), P3 = new V3(), COL = new THREE.Color();
  const inst = {};
  function writeB(b) { if (b.hidden) { inst[b.style].setMatrixAt(b.i, M4.makeScale(0, 0, 0)); return; } const h = Math.max(.001, b.h); P3.set(b.x, b.base + h / 2, b.z); Q.setFromAxisAngle(new V3(0, 1, 0), b.rot); S3.set(b.w, h, b.d);
    M4.compose(P3, Q, S3); inst[b.style].setMatrixAt(b.i, M4); COL.setScalar(b.tint * (b.alive ? 1 : .55)); if (!b.alive) COL.r *= 1.05; inst[b.style].setColorAt(b.i, COL); }
  for (const s of STY) { const list = plan[s], m = new THREE.InstancedMesh(box, MATS[s], Math.max(1, list.length)); m.castShadow = m.receiveShadow = true; m.frustumCulled = false; m.userData.sty = s;
    list.forEach((b, i) => { b.i = i; }); inst[s] = m; scene.add(m); list.forEach(writeB); m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  const PI4 = Math.PI / 4;
  const inside = (b, x, z, r) => x > b.x - b.hw - r && x < b.x + b.hw + r && z > b.z - b.hd - r && z < b.z + b.hd + r;
  // collision grid
  const GC = 24, grid = new Map(), gk = (i, j) => i * 10007 + j;
  for (const b of B) { for (let i = Math.floor((b.x - b.hw) / GC); i <= Math.floor((b.x + b.hw) / GC); i++) for (let j = Math.floor((b.z - b.hd) / GC); j <= Math.floor((b.z + b.hd) / GC); j++) { const k = gk(i, j); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(b); } }
  function near(x, z, r) { const out = new Set(); for (let i = Math.floor((x - r) / GC); i <= Math.floor((x + r) / GC); i++) for (let j = Math.floor((z - r) / GC); j <= Math.floor((z + r) / GC); j++) { const c = grid.get(gk(i, j)); if (c) for (const b of c) out.add(b); } return out; }

  /* ---------------- special landmark shapes ---------------- */
  function special(geo, mat, x, y, z, sx, sy, sz, ry) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); if (ry) m.rotation.y = ry; m.castShadow = m.receiveShadow = true; scene.add(m); specials.push(m); return m; }
  { // Sumitomo triangle, Park Tower pyramids, Cocoon Tower, Docomo spire
    const tri = special(new THREE.CylinderGeometry(.5, .5, 1, 3), MATS.granite, -210, 42, -40, 44, 84, 44, Math.PI / 6); tri.userData.b = addB('granite', -210, -40, 30, 30, 84, { lm: 'sumitomo-core' });
    tri.userData.b.hidden = true; tri.userData.core = 1; tri.userData.b.spec = tri;
    const pyr = new THREE.ConeGeometry(.72, 1, 4); pyr.rotateY(Math.PI / 4);
    for (const [x, z, h] of [[-290, 80, 70], [-272, 101, 82], [-262, 78, 94]]) { const sp = special(pyr, MATS.darkglass, x, h + 5, z, 18, 10, 18); const b = B.find(q => q.lm === 'parktower' && q.x === x); if (b) b.spec = sp; }
    const prof = []; for (let i = 0; i <= 16; i++) { const t = i / 16; prof.push(new THREE.Vector2(Math.sin(Math.PI * Math.pow(t, .85)) * .5 + .04, t)); }
    const cocTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); g.fillStyle = '#4a6a86'; g.fillRect(0, 0, 32, 32);
      g.fillStyle = '#6f93b0'; for (let y = 0; y < 32; y += 4) g.fillRect(0, y, 32, 1); g.strokeStyle = '#e8eef4'; g.lineWidth = 1.2; for (let k = -32; k < 64; k += 11) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 18, 32); g.stroke(); g.beginPath(); g.moveTo(k + 18, 0); g.lineTo(k, 32); g.stroke(); }
      const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(8, 14); return t; })();
    const coc = special(new THREE.LatheGeometry(prof, 24), new THREE.MeshLambertMaterial({ map: cocTex }), -76, 8, 32, 30, 80, 30); coc.userData.lm = 'cocoon';
    { const sp = special(new THREE.ConeGeometry(.5, 1, 8), MATS.granite, 133, 104, 182, 4, 20, 4); B.find(q => q.lm === 'docomo' && q.base === 86).spec = sp; }
    const clk = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); g.fillStyle = '#e8e4d8'; g.beginPath(); g.arc(16, 16, 14, 0, 7); g.fill(); g.strokeStyle = '#2a2a30'; g.lineWidth = 2; g.stroke();
      g.beginPath(); g.moveTo(16, 16); g.lineTo(16, 6); g.moveTo(16, 16); g.lineTo(23, 16); g.stroke(); const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; return t; })();
    for (const [dx, dz, ry] of [[0, 4.05, 0], [0, -4.05, Math.PI], [4.55, 0, Math.PI / 2], [-4.55, 0, -Math.PI / 2]]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), new THREE.MeshBasicMaterial({ map: clk, transparent: true })); p.position.set(133 + dx, 90, 182 + dz); p.rotation.y = ry; scene.add(p); }
  }
  // kaiju head on the Toho building, Kabukichō gate, Alta screen, Shinjuku Eye, torii
  const toriiM = new THREE.MeshLambertMaterial({ color: 0xc8302a });
  function torii(parent, x, z, ry, s = 1) { const t = new THREE.Group(); for (const dx of [-1.8, 1.8]) { const p = new THREE.Mesh(box, toriiM); p.scale.set(.4, 5, .4); p.position.set(dx, 2.5, 0); t.add(p); }
    const k = new THREE.Mesh(box, toriiM); k.scale.set(5.6, .45, .5); k.position.y = 5.1; t.add(k); const n = new THREE.Mesh(box, toriiM); n.scale.set(4.6, .3, .35); n.position.y = 4.2; t.add(n);
    t.traverse(o => o.castShadow = true); t.position.set(x, 0, z); t.rotation.y = ry; t.scale.setScalar(s); parent.add(t); return t; }
  function canvasTex(w, h, draw, nearest = true) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); if (nearest) t.magFilter = THREE.NearestFilter; return t; }
  {
    const hm = new THREE.MeshLambertMaterial({ color: 0x4a5048 }), g = new THREE.Group(); g.position.set(108, 52, -124);
    const part = (w, h, d, x, y, z, rz) => { const m = new THREE.Mesh(box, hm); m.scale.set(w, h, d); m.position.set(x, y, z); if (rz) m.rotation.z = rz; m.castShadow = true; g.add(m); };
    part(8, 7, 7, 0, 3.5, 0); part(9, 3.5, 5, -6, 4, 0, .15); part(8, 1.6, 4.6, -6.5, 1.2, 0, -.1); for (let i = 0; i < 5; i++) part(1.2, 2.2, 1, 3.5 - i * 1.6, 8, 0, .3);
    const eye = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: 0xffe070 })); eye.scale.set(.8, .6, 7.2); eye.position.set(-3.6, 5.2, 0); g.add(eye); scene.add(g);
    const gate = canvasTex(128, 16, (c, w, h) => { c.fillStyle = '#1a0608'; c.fillRect(0, 0, w, h); c.fillStyle = '#ff3a3a'; c.font = 'bold 13px sans-serif'; c.textAlign = 'center'; c.fillText('歌舞伎町一番街', w / 2, 13); }, false);
    const gm = new THREE.MeshLambertMaterial({ color: 0x8a1a1e }); for (const x of [94.5, 103.5]) { const p = new THREE.Mesh(box, gm); p.scale.set(.5, 7, .5); p.position.set(x, 3.5, -81); scene.add(p); }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.6), new THREE.MeshBasicMaterial({ map: gate, side: THREE.DoubleSide })); sign.position.set(99, 7, -81); scene.add(sign);
    const alta = canvasTex(96, 48, (c, w, h) => { c.fillStyle = '#081830'; c.fillRect(0, 0, w, h); c.fillStyle = '#ff3040'; c.fillRect(0, 0, w, 10); c.fillStyle = '#fff'; c.font = 'bold 9px sans-serif'; c.fillText('避難指示 EVACUATION', 4, 8);
      c.font = 'bold 12px sans-serif'; c.fillStyle = '#ffd24a'; c.fillText('新宿区 全域', 6, 26); c.font = '8px sans-serif'; c.fillStyle = '#9ad0ff'; c.fillText('SHINJUKU WARD · 2018.12.24', 4, 40); }, false);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), new THREE.MeshBasicMaterial({ map: alta })); scr.position.set(68.9, 12, -40); scr.rotation.y = -Math.PI / 2; scene.add(scr);
    const eyeT = canvasTex(32, 16, (c) => { c.fillStyle = '#f2c230'; c.beginPath(); c.ellipse(16, 8, 15, 7, 0, 0, 7); c.fill(); c.fillStyle = '#fff6d0'; c.beginPath(); c.ellipse(16, 8, 9, 5, 0, 0, 7); c.fill(); c.fillStyle = '#2a2014'; c.beginPath(); c.arc(16, 8, 3.4, 0, 7); c.fill(); });
    const se = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), new THREE.MeshBasicMaterial({ map: eyeT, transparent: true })); se.position.set(-76, 5, -24.9); scene.add(se);
    torii(scene, -452, -112, 0); torii(scene, -452, -100, 0); addB('brown', -452, -124, 8, 6, 4, { lm: 'kumano', tint: .7 });
  }
  // rewrite instance buffers for the late additions (Sumitomo core, shrine)
  for (const s of STY) { const list = plan[s]; if (inst[s].count < list.length) { const old = inst[s]; scene.remove(old); const m = new THREE.InstancedMesh(box, MATS[s], list.length); m.castShadow = m.receiveShadow = true; m.frustumCulled = false; m.userData.sty = s; inst[s] = m; scene.add(m); list.forEach((b, i) => b.i = i); } list.forEach(writeB); inst[s].instanceMatrix.needsUpdate = true; if (inst[s].instanceColor) inst[s].instanceColor.needsUpdate = true; }
    grid.clear(); for (const b of B) { for (let i = Math.floor((b.x - b.hw) / GC); i <= Math.floor((b.x + b.hw) / GC); i++) for (let j = Math.floor((b.z - b.hd) / GC); j <= Math.floor((b.z + b.hd) / GC); j++) { const k = gk(i, j); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(b); } }

  /* ---------------- props ---------------- */
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  function instanced(geo, mat, list, fn, shadow) { const m = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length)); list.forEach((it, i) => { fn(it, M4, COL); m.setMatrixAt(i, M4); if (m.instanceColor || it.c) m.setColorAt(i, COL); });
    m.frustumCulled = false; m.castShadow = !!shadow; m.receiveShadow = true; scene.add(m); return m; }
  const lamps = [], cars = [], trees = [], vend = [], signs = [];
  for (const d of D) {
    if (d.out) continue;   // the outskirts are skyline only
    if (d.type === 1) { const n = (d.x1 - d.x0) * (d.z1 - d.z0) / 180; for (let i = 0; i < n; i++) { const x = R(d.x0 + 3, d.x1 - 3), z = R(d.z0 + 3, d.z1 - 3); if (d.id === 'gyoen' && Math.hypot(x - 350, z - 150) < 30) continue; trees.push([x, z, R(3, 6.5)]); } continue; }
    if (d.type !== 0) continue;
    for (let ox = d.x0; ox < d.x1 - 4; ox += d.cx) for (let oz = d.z0; oz < d.z1 - 4; oz += d.cz) {
      if (d.sw > 5) { lamps.push([ox + d.sw + 1.2, oz + d.sw + 1.2]); if (rnd() < .5) lamps.push([ox + d.sw + 1.2, oz + d.cz / 2]); }
      if (d.sw > 5 && rnd() < .55) { const alongZ = rnd() < .5; cars.push(alongZ ? [ox + d.sw * R(.25, .75), oz + R(d.sw + 4, d.cz - 4), R(-.4, .4)] : [ox + R(d.sw + 4, d.cx - 4), oz + d.sw * R(.25, .75), Math.PI / 2 + R(-.4, .4)]); }
      if (rnd() < .35) vend.push([ox + d.sw + 2.2, oz + R(d.sw + 4, d.cz - 4), rnd() < .5 ? Math.PI / 2 : -Math.PI / 2]);
      if (d.id === 'nishi' || d.id === 'yoyogi') for (let k = 0; k < 2; k++) trees.push([ox + d.sw + 1.3, oz + R(d.sw + 4, d.cz - 4), R(2.5, 4)]);
    }
  }
  for (let i = 0; i < 26; i++) trees.push([R(-395, -322), R(-130, 125), R(3, 5.5)]);
  { const free = ([x, z]) => !RES.some(r => x > r[0] && x < r[2] && z > r[1] && z < r[3]); for (const L of [lamps, cars, vend]) { const k = L.filter(free); L.length = 0; L.push(...k); } }
  const poleG = new THREE.BoxGeometry(.18, 6, .18); poleG.translate(0, 3, 0); const headG = new THREE.BoxGeometry(.9, .22, .4); headG.translate(.35, 6, 0);
  const lampFn = ([x, z], m) => m.compose(P3.set(x, 0, z), Q.identity(), S3.set(1, 1, 1));
  instanced(poleG, new THREE.MeshLambertMaterial({ color: 0x3a3c44 }), lamps, lampFn, true); instanced(headG, lampMat, lamps, lampFn);
  const carCols = [0xf0f0f0, 0x16161a, 0xb8bcc4, 0x9a1a1e, 0x1e3a28, 0xe8c040, 0x2a3a6a];
  const carG = new THREE.BoxGeometry(1.8, .75, 4.3); carG.translate(0, .55, 0); const cabG = new THREE.BoxGeometry(1.6, .65, 2.3); cabG.translate(0, 1.25, -.2);
  const carFn = ([x, z, r], m, c) => { m.compose(P3.set(x, 0, z), Q.setFromAxisAngle(new V3(0, 1, 0), r), S3.set(1, 1, 1)); c.setHex(carCols[(Math.abs(x * 7 + z * 13) | 0) % carCols.length]); };
  const carL = cars.map(c => Object.assign(c, { c: 1 })); instanced(carG, new THREE.MeshLambertMaterial({ color: 0xffffff }), carL, carFn, true); instanced(cabG, new THREE.MeshLambertMaterial({ color: 0x9aa8b8 }), cars, ([x, z, r], m) => m.compose(P3.set(x, 0, z), Q.setFromAxisAngle(new V3(0, 1, 0), r), S3.set(1, 1, 1)), true);
  const trunkG = new THREE.CylinderGeometry(.18, .26, 1, 5); trunkG.translate(0, .5, 0); const leafG = new THREE.IcosahedronGeometry(1, 0);
  instanced(trunkG, new THREE.MeshLambertMaterial({ color: 0x4a3426 }), trees, ([x, z, s], m) => m.compose(P3.set(x, 0, z), Q.identity(), S3.set(1, s * .55, 1)), true);
  const leafL = trees.map(t => Object.assign(t, { c: 1 }));
  instanced(leafG, new THREE.MeshLambertMaterial({ color: 0xffffff, }), leafL, ([x, z, s], m, c) => { m.compose(P3.set(x, s * .72, z), Q.setFromEuler(new THREE.Euler(0, x, 0)), S3.set(s * .5, s * .45, s * .5)); c.setRGB(.22 + (x % 3) * .03, .36 + (z % 5) * .02, .18); }, true);
  const vendT = canvasTex(8, 16, c => { c.fillStyle = '#e8ecf2'; c.fillRect(0, 0, 8, 16); c.fillStyle = '#9ad0ff'; c.fillRect(1, 1, 6, 8); const cols = ['#e03030', '#30a0e0', '#f0c030', '#40c060']; for (let y = 2; y < 9; y += 2) for (let x = 1; x < 7; x += 1.5) { c.fillStyle = cols[(x + y) % 4 | 0]; c.fillRect(x, y, 1, 1); } c.fillStyle = '#20242c'; c.fillRect(2, 11, 4, 2); });
  instanced(new THREE.BoxGeometry(.9, 1.85, .75).translate(0, .93, 0), new THREE.MeshBasicMaterial({ map: vendT }), vend, ([x, z, r], m) => m.compose(P3.set(x, 0, z), Q.setFromAxisAngle(new V3(0, 1, 0), r), S3.set(1, 1, 1)));
  // pond and greenhouse in Gyoen, platforms and trains in the rail yard
  { const pond = new THREE.Mesh(new THREE.CircleGeometry(26, 28), new THREE.MeshLambertMaterial({ color: 0x3a5a78 })); pond.rotation.x = -Math.PI / 2; pond.position.set(350, .06, 150); scene.add(pond);
    const gh = new THREE.Mesh(new THREE.SphereGeometry(10, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xbcd8e4, transparent: true, opacity: .75 })); gh.position.set(300, 0, 58); scene.add(gh);
    const plat = [], roof = [], pil = []; for (let x = -31; x <= 31; x += 9.2) { plat.push([x]); roof.push([x]); for (let z = -170; z <= 170; z += 20) pil.push([x, z]); }
    instanced(new THREE.BoxGeometry(3.2, .9, 380), new THREE.MeshLambertMaterial({ color: 0x8a8680 }), plat, ([x], m) => m.compose(P3.set(x, .45, 0), Q.identity(), S3.set(1, 1, 1)), false);
    instanced(new THREE.BoxGeometry(4, .3, 340), new THREE.MeshLambertMaterial({ color: 0x5a6068 }), roof, ([x], m) => m.compose(P3.set(x, 5.2, 0), Q.identity(), S3.set(1, 1, 1)), true);
    instanced(new THREE.BoxGeometry(.3, 4.8, .3), new THREE.MeshLambertMaterial({ color: 0x4a4e56 }), pil, ([x, z], m) => m.compose(P3.set(x, 2.8, z), Q.identity(), S3.set(1, 1, 1)), true);
    for (const [col, xs] of [['#7ac142', [-26.5, -8.1]], ['#f07a20', [1.1, 19.5]]]) { const t = canvasTex(8, 32, c => { c.fillStyle = '#c8ccd2'; c.fillRect(0, 0, 8, 32); c.fillStyle = col; c.fillRect(0, 18, 8, 3); c.fillStyle = '#2a3440'; for (let y = 4; y < 30; y += 6) c.fillRect(0, y, 8, 3); });
      const cars2 = []; for (const x of xs) { let z = R(-150, -60); for (let k = 0; k < 8; k++) { cars2.push([x, z]); z += 20.6; } }
      instanced(new THREE.BoxGeometry(2.9, 3.6, 20).translate(0, 2.2, 0), new THREE.MeshLambertMaterial({ map: t }), cars2, ([x, z], m) => m.compose(P3.set(x, 0, z), Q.identity(), S3.set(1, 1, 1)), true); }
  }
  // neon signboards on Kabukichō, Golden Gai and 3-chōme buildings (one atlas, per-instance UVs)
  const SIGNS = ['カラオケ', '居酒屋', 'ラーメン', 'ホテル', '焼肉', 'パチンコ', 'BAR', '歌舞伎', '寿司', '喫茶', 'ゲーム', 'スナック', '麻雀', '漫画', '占い', '中華'];
  const signT = canvasTex(256, 256, (c) => { const cols = ['#ff3a8a', '#3af0ff', '#ffe23a', '#5aff7a', '#ff6a2a', '#c86aff'];
    SIGNS.forEach((s, i) => { const x = (i % 8) * 32, y = (i >> 3) * 128, col = cols[i % cols.length]; c.fillStyle = '#12080e'; c.fillRect(x + 2, y + 2, 28, 124); c.strokeStyle = col; c.lineWidth = 2; c.strokeRect(x + 4, y + 4, 24, 120);
      c.fillStyle = col; c.shadowColor = col; c.shadowBlur = 6; c.font = 'bold 20px sans-serif'; c.textAlign = 'center'; const ch = [...s]; ch.forEach((k, j) => c.fillText(k, x + 16, y + 28 + j * 24)); c.shadowBlur = 0; }); }, false);
  const signMat = new THREE.MeshBasicMaterial({ map: signT, transparent: true, alphaTest: .3 });
  signMat.onBeforeCompile = sh => { sh.vertexShader = 'attribute vec4 aUV;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_INSTANCING\nvUv = vUv * aUV.zw + aUV.xy;\n#endif'); };
  signMat.customProgramCacheKey = () => 'signs';
  for (const b of B) if (b.neon && b.base === 0) { const n = b.w > 8 ? 2 : 1; for (let k = 0; k < n; k++) { const side = pick([[1, 0], [-1, 0], [0, 1], [0, -1]]), hgt = Math.min(b.h - 1, R(3.5, 9));
    signs.push({ b, x: b.x + side[0] * (b.w / 2 + .25) + (side[1] ? R(-b.w / 3, b.w / 3) : 0), z: b.z + side[1] * (b.d / 2 + .25) + (side[0] ? R(-b.d / 3, b.d / 3) : 0), y: hgt, ry: Math.atan2(side[0], side[1]), s: rnd() * 16 | 0 }); } }
  const signGeo = new THREE.PlaneGeometry(1.1, 4.2), signUV = new Float32Array(Math.max(1, signs.length) * 4);
  signs.forEach((s, i) => signUV.set([(s.s % 8) / 8, s.s >> 3 ? 0 : .5, 1 / 8, .5], i * 4)); signGeo.setAttribute('aUV', new THREE.InstancedBufferAttribute(signUV, 4));
  const signMesh = instanced(signGeo, signMat, signs, (s, m) => m.compose(P3.set(s.x, s.y, s.z), Q.setFromAxisAngle(new V3(0, 1, 0), s.ry), S3.set(1, 1, 1)));
  // paper lanterns in Omoide Yokochō and Golden Gai
  const lanT = canvasTex(8, 8, c => { c.fillStyle = '#ff4a2a'; c.beginPath(); c.ellipse(4, 4, 3.2, 3.8, 0, 0, 7); c.fill(); c.fillStyle = '#ffd08a'; c.fillRect(3, 2, 2, 4); });
  const lanP = []; for (let i = 0; i < 40; i++) lanP.push(-43 + R(-1.5, 1.5), R(3.2, 4.2), -84 + i * .75); for (let i = 0; i < 60; i++) lanP.push(R(218, 272), R(2.8, 3.8), R(-196, -82));
  const lanG = new THREE.BufferGeometry(); lanG.setAttribute('position', new THREE.Float32BufferAttribute(lanP, 3));
  scene.add(new THREE.Points(lanG, new THREE.PointsMaterial({ map: lanT, size: .7, transparent: true, alphaTest: .4 })));

  // things standing on a roof vanish with it: {m, i, M} instances attached to a building
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  function writeAtt(b) { if (!b.att) return; for (const a of b.att) { a.m.setMatrixAt(a.i, b.h >= b.h0 - .5 ? a.M : ZERO); a.m.instanceMatrix.needsUpdate = true; } }
  function attachAll(m, list) { list.forEach((it, i) => { const M = new THREE.Matrix4(); m.getMatrixAt(i, M); (it.b.att || (it.b.att = [])).push({ m, i, M }); }); }
  const upsOf = b => b._ups || (b._ups = [...near(b.x, b.z, Math.max(b.hw, b.hd) + 1)].filter(u => u !== b && u.base >= b.base + b.h0 - .05 && inside(b, u.x, u.z, 0)));
  // rooftop clutter: condenser units and water tanks
  { const ac = [], tank = [];
    for (const b of B) { if (b.map || b.lm || b.hidden || b.h < 6 || district(b.x, b.z).out || upsOf(b).length || district(b.x, b.z).id === 'sendai') continue; const top = b.base + b.h, n = Math.min(4, 1 + (b.w * b.d / 90 | 0));
      for (let k = 0; k < n; k++) ac.push({ b, x: b.x + R(-.35, .35) * b.w, z: b.z + R(-.35, .35) * b.d, y: top, s: R(.8, 1.4), r: pick([0, Math.PI / 2]) });
      if (b.style !== 'glass' && b.style !== 'darkglass' && rnd() < .45) tank.push({ b, x: b.x + R(-.3, .3) * b.w, z: b.z + R(-.3, .3) * b.d, y: top, s: R(.8, 1.3) }); }
    const place = (it, m) => m.compose(P3.set(it.x, it.y, it.z), Q.setFromAxisAngle(new V3(0, 1, 0), it.r || 0), S3.setScalar(it.s));
    attachAll(instanced(new THREE.BoxGeometry(1.3, .8, .9).translate(0, .4, 0), new THREE.MeshLambertMaterial({ color: 0x9a9ca2 }), ac, place, true), ac);
    attachAll(instanced(new THREE.CylinderGeometry(.75, .75, 1.3, 8).translate(0, 1.35, 0), new THREE.MeshLambertMaterial({ color: 0x8aa6b8 }), tank, place, true), tank);
    attachAll(instanced(new THREE.BoxGeometry(1.2, .7, 1.2).translate(0, .35, 0), new THREE.MeshLambertMaterial({ color: 0x4a4c52 }), tank, place), tank); }
  // rooftop billboards around Kabukichō and 3-chōme (made-up ads, one atlas)
  { const ADS = [['カラオケ', '24H', '#ff3a8a', '#1a0a1e'], ['ラーメン', '新宿', '#ffd23a', '#3a0e08'], ['SALE', '冬の大売出し', '#ffffff', '#c0182a'], ['牛丼', '並 ¥380', '#ff7a1a', '#101418']];
    const T = canvasTex(128, 64, c => ADS.forEach(([a, b2, fg, bg], i) => { const x = (i % 2) * 64, y = (i >> 1) * 32; c.fillStyle = bg; c.fillRect(x, y, 64, 32); c.fillStyle = fg; c.textAlign = 'center';
      c.font = 'bold 15px sans-serif'; c.fillText(a, x + 32, y + 16); c.font = 'bold 9px sans-serif'; c.fillText(b2, x + 32, y + 28); c.strokeStyle = fg; c.strokeRect(x + 1.5, y + 1.5, 61, 29); }), false);
    const bb = []; for (const b of B) { if (b.map || b.lm || b.base > 0 || b.h < 10 || b.h > 32 || !['kabuki', 'sanchome', 'nichome'].includes(district(b.x, b.z).id) || upsOf(b).length || rnd() > .3) continue;
      bb.push({ b, x: b.x, z: b.z, y: b.base + b.h, ry: pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]), s: rnd() * 4 | 0 }); }
    const g = new THREE.PlaneGeometry(7, 3.5).translate(0, 3.3, .2), uv = new Float32Array(Math.max(1, bb.length) * 4);
    bb.forEach((it, i) => uv.set([(it.s % 2) / 2, it.s >> 1 ? 0 : .5, .5, .5], i * 4)); g.setAttribute('aUV', new THREE.InstancedBufferAttribute(uv, 4));
    const mat = new THREE.MeshBasicMaterial({ map: T }); mat.onBeforeCompile = signMat.onBeforeCompile; mat.customProgramCacheKey = () => 'billboard';
    const place = (it, m) => m.compose(P3.set(it.x, it.y, it.z), Q.setFromAxisAngle(new V3(0, 1, 0), it.ry), S3.set(1, 1, 1));
    attachAll(instanced(g, mat, bb, place), bb);
    attachAll(instanced(new THREE.BoxGeometry(7.4, 3.9, .3).translate(0, 3.3, 0), new THREE.MeshLambertMaterial({ color: 0x2a2a30 }), bb, place, true), bb);
    attachAll(instanced(new THREE.BoxGeometry(.3, 1.6, .3).translate(0, .8, 0), new THREE.MeshLambertMaterial({ color: 0x3a3c44 }), bb, place), bb); }
  // utility poles and sagging wires on the low-rise streets
  { const poles = [], wp = [];
    for (const d of D) { if (!['honan', 'nishin', 'nishis', 'shinjuku6', 'nichome', 'gai', 'kabuki'].includes(d.id)) continue;
      for (let ox = d.x0; ox < d.x1 - 4; ox += d.cx) { let prev = null; const x = ox + d.sw + .9;
        for (let z = d.z0 + d.sw + 3; z < d.z1 - 2; z += 11) { if ((z - d.z0) % d.cz < d.sw + 1) continue; if (prev && z - prev > 26) prev = null;
          poles.push([x, z]); if (prev) for (const [dx, h] of [[-.55, 7.9], [.55, 7.9], [0, 8.4]]) { const m = (prev + z) / 2; wp.push(x + dx, h, prev, x + dx, h - .55, m, x + dx, h - .55, m, x + dx, h, z); } prev = z; } } }
    const pole = ([x, z], m) => m.compose(P3.set(x, 0, z), Q.identity(), S3.set(1, 1, 1));
    instanced(new THREE.CylinderGeometry(.11, .14, 8.6, 5).translate(0, 4.3, 0), new THREE.MeshLambertMaterial({ color: 0x6a6660 }), poles, pole, true);
    instanced(new THREE.BoxGeometry(1.5, .12, .12).translate(0, 7.9, 0), new THREE.MeshLambertMaterial({ color: 0x3a3a3e }), poles, pole);
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3)); scene.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x18181c }))); }

  // suburbs + Shibuya: ground planes, 109, signs and the big screens
  for (const x of [7500, 10000]) { const g = new THREE.Mesh(new THREE.PlaneGeometry(1500, 1500), groundMat); g.rotation.x = -Math.PI / 2; g.position.set(x, 0, 0); g.receiveShadow = true; scene.add(g); }
  { const t = special(new THREE.CylinderGeometry(.5, .5, 1, 20), MATS.office, 9902, 17, -10, 18, 34, 18); t.userData.core = 1; const b = B.find(q => q.lm === '109'); b.spec = t; t.userData.b = b;
    const sg = (w, h, draw, x, y, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: canvasTex(w * 12, h * 12, draw, false), side: THREE.DoubleSide })); m.position.set(x, y, z); m.rotation.y = ry || 0; scene.add(m); return m; };
    sg(9, 3, (c, w, h) => { c.fillStyle = '#101010'; c.fillRect(0, 0, w, h); c.fillStyle = '#f2f2f2'; c.font = 'bold 26px sans-serif'; c.textAlign = 'center'; c.fillText('SHIBUYA109', w / 2, 27); }, 9902, 30, .2, 0);
    sg(16, 9, (c, w, h) => { const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#ff6a1a'); g.addColorStop(1, '#6a1aff'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = 'bold 30px sans-serif'; c.textAlign = 'center'; c.fillText('HALLOWEEN', w / 2, 50); c.font = 'bold 20px sans-serif'; c.fillText('10.31 SHIBUYA', w / 2, 80); }, 9940, 14, -62.8, 0);
    sg(6, 2, (c, w, h) => { c.fillStyle = '#1a3a6a'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = 'bold 16px sans-serif'; c.textAlign = 'center'; c.fillText('渋谷駅 SHIBUYA', w / 2, 16); }, 9989, 7, -20, Math.PI / 2);
    sg(10, 2.4, (c, w, h) => { c.fillStyle = '#20202a'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffd24a'; c.font = 'bold 15px sans-serif'; c.textAlign = 'center'; c.fillText('映画館 CINEMA', w / 2, 21); }, 7452, 10, 80.2, 0);
    const hachi = new THREE.Mesh(box, new THREE.MeshLambertMaterial({ color: 0x6a5a3a })); hachi.scale.set(.6, 1.2, 1.4); hachi.position.set(9978, .6, -12); scene.add(hachi);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(600, 36), new THREE.MeshLambertMaterial({ color: 0x2a4a60, transparent: true, opacity: .85 })); water.rotation.x = -Math.PI / 2; water.position.set(7500, .08, 200); scene.add(water); }
  // Sendai is a low-rise town: tiled hip roofs on the houses, a running track and a clock at the school
  { const roofs = B.filter(b => !b.map && !b.lm && ['sendai', 'sendaiout'].includes(district(b.x, b.z).id) && b.base === 0).map(b => ({ b, c: [0x3a4658, 0x4a3a34, 0x5a2a28, 0x39424a][(b.x * 3 + b.z) & 3] }));
    const rg = new THREE.ConeGeometry(.74, 1, 4, 1).rotateY(PI4).translate(0, .5, 0);
    const m = instanced(rg, new THREE.MeshLambertMaterial({ color: 0xffffff }), roofs.map(r => Object.assign(r, { c: 1, col: r.c })), (r, M, c) => { M.compose(P3.set(r.b.x, r.b.h - .1, r.b.z), Q.identity(), S3.set(r.b.w * 1.1, Math.min(3.2, r.b.w * .3), r.b.d * 1.1)); c.setHex(r.col); }, true);
    attachAll(m, roofs);
    const track = new THREE.Mesh(new THREE.RingGeometry(20, 25, 40), new THREE.MeshLambertMaterial({ color: 0x8a4a38 })); track.rotation.x = -Math.PI / 2; track.scale.set(1.9, 1, 1); track.position.set(5010, .05, 5); scene.add(track);
    const clock = new THREE.Mesh(new THREE.CircleGeometry(1.6, 20), new THREE.MeshBasicMaterial({ map: canvasTex(32, 32, c => { c.fillStyle = '#f2efe6'; c.beginPath(); c.arc(16, 16, 15, 0, 7); c.fill(); c.strokeStyle = '#222'; c.lineWidth = 2; c.stroke(); c.beginPath(); c.moveTo(16, 16); c.lineTo(16, 5); c.moveTo(16, 16); c.lineTo(24, 18); c.stroke(); }) }));
    clock.position.set(5010, 12.6, -48.9); scene.add(clock); }
  // Sendai: ground, school gate and signs
  { const g3 = new THREE.Mesh(new THREE.PlaneGeometry(1500, 1500), groundMat); g3.rotation.x = -Math.PI / 2; g3.position.set(5000, 0, 0); g3.receiveShadow = true; scene.add(g3);
    const sign = (w, h, draw, x, y, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: canvasTex(w * 16, h * 16, draw, false), side: THREE.DoubleSide })); m.position.set(x, y, z); m.rotation.y = ry || 0; scene.add(m); };
    const gm = new THREE.MeshLambertMaterial({ color: 0x9a9690 }); for (const x of [5004, 5016]) { const p = new THREE.Mesh(box, gm); p.scale.set(1, 3, 1); p.position.set(x, 1.5, 42); p.castShadow = true; scene.add(p); }
    sign(2.4, .6, (c, w, h) => { c.fillStyle = '#e8e4da'; c.fillRect(0, 0, w, h); c.fillStyle = '#1a1a1a'; c.font = 'bold 12px serif'; c.textAlign = 'center'; c.fillText('杉沢第三高校', w / 2, 11); }, 5003.4, 2.2, 42.6);
    sign(8, 3, (c, w, h) => { c.fillStyle = '#f2f2f2'; c.fillRect(0, 0, w, h); c.fillStyle = '#d02020'; c.fillRect(8, 10, 28, 8); c.fillRect(18, 0, 8, 28); c.fillStyle = '#203050'; c.font = 'bold 22px sans-serif'; c.fillText('仙台総合病院', 42, 30); }, 4880, 16, -137.9); }

  /* ---------------- Tokyo Jujutsu High set dressing ---------------- */
  const cityList = scene.children.filter(o => ![sky, hemi, sun, sun.target, fuji].includes(o) && !JJH_STY.includes(o.userData.sty));
  const jjh = new THREE.Group(); jjh.visible = false; scene.add(jjh); jjh.add(ground2);
  // map-specific set pieces, shown only on their own map
  const MAPG = {}; for (const k of ['shibuya', 'ikebukuro', 'canyon', ...INDOOR]) { MAPG[k] = new THREE.Group(); MAPG[k].visible = false; scene.add(MAPG[k]); }
  const dome = (r, col, op, x, z) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false, fog: false })); m.position.set(x, 0, z); return m; };
  // Shibuya, October 31: the curtain over the station (centered on the Tokyu Department Store), Halloween lights in the streets
  { const g = MAPG.shibuya; g.add(dome(200, 0x05030a, .42, 10010, -40), dome(203, 0x3a1a5a, .12, 10010, -40));
    const lanT = canvasTex(8, 8, c => { c.fillStyle = '#ff8a1a'; c.beginPath(); c.arc(4, 4, 3.4, 0, 7); c.fill(); c.fillStyle = '#ffe0a0'; c.fillRect(3, 3, 2, 2); });
    const pts = []; for (let i = 0; i < 260; i++) { const street = i % 3; pts.push(street === 0 ? 9870 + R(-40, 40) : street === 1 ? 9958 + R(-30, 30) : 9900 + R(-10, 90), R(4, 7), street === 0 ? R(-160, -40) : street === 1 ? R(-60, 5) : R(10, 140)); }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.add(new THREE.Points(pg, new THREE.PointsMaterial({ map: lanT, size: .8, transparent: true, alphaTest: .4 }))); }
  // Ikebukuro inside the colony barrier; the theater Higuruma uses as his base
  { const g = MAPG.ikebukuro; g.add(dome(260, 0x14061e, .2, 12500, 0), dome(263, 0x8a3aff, .1, 12500, 0));
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(12, 2.6), new THREE.MeshBasicMaterial({ map: canvasTex(144, 32, (c, w, h) => { c.fillStyle = '#2a0e10'; c.fillRect(0, 0, w, h); c.fillStyle = '#f2d27a'; c.font = 'bold 20px serif'; c.textAlign = 'center'; c.fillText('劇場 THEATER', w / 2, 23); }, false) }));
    sg.position.set(12430, 13, 86.2); g.add(sg);
    const gr = new THREE.Mesh(new THREE.PlaneGeometry(1500, 1500), groundMat); gr.rotation.x = -Math.PI / 2; gr.position.set(12500, 0, 0); gr.receiveShadow = true; g.add(gr); }
  const roofM = new THREE.MeshLambertMaterial({ color: 0x3c4452 }), jjhTreeGeo = {};
  function hipRoof(w, d, h) {   // concave hip roof (shallow at the eaves, steep at the ridge), ridge along the long side
    const swap = d > w; if (swap) [w, d] = [d, w]; const N = 4, pos = [];
    const ring = k => { const t = k / N, i = t * d / 2, y = h * Math.pow(t, 1.7); return [[-w / 2 + i, y, d / 2 - i], [w / 2 - i, y, d / 2 - i], [w / 2 - i, y, -d / 2 + i], [-w / 2 + i, y, -d / 2 + i]]; };
    for (let k = 0; k < N; k++) { const a = ring(k), c = ring(k + 1); for (let q = 0; q < 4; q++) { const q2 = (q + 1) % 4; pos.push(...a[q], ...a[q2], ...c[q2], ...a[q], ...c[q2], ...c[q]); } }
    const r0 = ring(0); pos.push(...r0[0], ...r0[3], ...r0[2], ...r0[0], ...r0[2], ...r0[1]);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); if (swap) g.rotateY(Math.PI / 2); return g; }
  for (const r of JR) { const b = r.b, g = new THREE.Group(), m = new THREE.Mesh(hipRoof(b.w + r.eave * 2, b.d + r.eave * 2, r.rh), roofM); m.castShadow = m.receiveShadow = true; g.add(m);
    if (r.spire) { const sp = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, 6, 5).translate(0, 3 + r.rh * .8, 0), roofM); g.add(sp);
      for (let k = 0; k < 6; k++) { const ring = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .12, 8), roofM); ring.position.y = r.rh + 1.4 + k * .55; g.add(ring); } }
    g.position.set(b.x, b.base + b.h + (r.y || -.2), b.z); g.rotation.y = b.rot; jjh.add(g); b.spec = g; }
  torii(jjh, 2500, 106, 0, 1.7); torii(jjh, 2500, 150, 0, 1.7);
  { const lan = []; for (let z = 100; z <= 184; z += 12) lan.push([2484, z], [2516, z]); lan.push([2480, -12], [2530, -12], [2470, 40], [2530, 40]);
    const stoneM = new THREE.MeshLambertMaterial({ color: 0x8a867e }), at = ([x, z], m) => m.compose(P3.set(x, 0, z), Q.identity(), S3.set(1, 1, 1));
    instanced(new THREE.BoxGeometry(.9, .35, .9).translate(0, .18, 0), stoneM, lan, at, true); instanced(new THREE.CylinderGeometry(.18, .22, 1.3, 6).translate(0, 1, 0), stoneM, lan, at, true);
    instanced(new THREE.BoxGeometry(.55, .5, .55).translate(0, 1.9, 0), lampMat, lan, at); instanced(new THREE.ConeGeometry(.7, .55, 4).rotateY(Math.PI / 4).translate(0, 2.42, 0), stoneM, lan, at, true);
    jjh.add(...scene.children.slice(-4)); }
  { // cedar woods all around; a clearing for the courtyard, the approach and the buildings
    const trees2 = [], clear = (x, z) => (x > 2415 && x < 2605 && z > -85 && z < 100) || (x > 2476 && x < 2524 && z > 80) || B.some(b => b.map && inside(b, x, z, 3));
    for (let i = 0; i < 3400; i++) { const x = R(2230, 2770), z = R(-270, 270); if (clear(x, z)) continue; trees2.push([x, z, R(10, 17)]); }
    const cones = jjhTreeGeo.cones = [[.38, .5, .5], [.3, .42, .72], [.19, .34, .9]].map(([r, h, y]) => new THREE.ConeGeometry(r, h, 7).translate(0, y, 0).toNonIndexed());
    const fol = new THREE.BufferGeometry(), arr = []; for (const c of cones) arr.push(...c.attributes.position.array); fol.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); fol.computeVertexNormals();
    const tr = jjhTreeGeo.tr = new THREE.CylinderGeometry(.03, .05, 1, 5).translate(0, .5, 0); jjhTreeGeo.fol = fol;
    const at = ([x, z, h], m) => m.compose(P3.set(x, 0, z), Q.setFromAxisAngle(new V3(0, 1, 0), x * 3.1), S3.set(h * .6, h, h * .6));
    const a = instanced(tr, new THREE.MeshLambertMaterial({ color: 0x4a3024 }), trees2, at, true), f = instanced(fol, new THREE.MeshLambertMaterial({ color: 0xffffff }), trees2.map(t => Object.assign(t, { c: 1 })),
      (t, m, c) => { at(t, m); c.setRGB(.13 + (t[0] % 3) * .012, .24 + (t[1] % 5) * .012, .12); }, true);
    jjh.add(a, f); }
  // distant mountain ridges (flat colour, tinted by the time of day)
  const ridgeM = [0, 1].map(() => new THREE.MeshBasicMaterial({ color: 0x556070, fog: false, side: THREE.DoubleSide }));
  [[1500, 260, 0], [900, 150, 1]].forEach(([r, hMax, li]) => { const N = 120, pos = [], hgt = a => hMax * (.45 + .3 * Math.sin(a * 3 + li * 2) + .15 * Math.sin(a * 7.3 + 1) + .1 * Math.sin(a * 17 + li));
    for (let i = 0; i < N; i++) { const a0 = i / N * Math.PI * 2, a1 = (i + 1) / N * Math.PI * 2, p = (a, y) => [2500 + Math.cos(a) * r, y, Math.sin(a) * r];
      pos.push(...p(a0, -40), ...p(a1, -40), ...p(a1, hgt(a1)), ...p(a0, -40), ...p(a1, hgt(a1)), ...p(a0, hgt(a0))); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); const m = new THREE.Mesh(g, ridgeM[li]); m.frustumCulled = false; jjh.add(m); });
  // Koinokuchi Canyon: forest on both rims, a stone arch under Yasohachi Bridge, a river far below, mountains around
  { const g = MAPG.canyon, gr = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), groundMat); gr.rotation.x = -Math.PI / 2; gr.position.set(15000, 0, 0); gr.receiveShadow = true; g.add(gr);
    const stoneM = new THREE.MeshLambertMaterial({ color: 0x8a867e });
    const arch = new THREE.Mesh(new THREE.TorusGeometry(25, 2.2, 8, 28, Math.PI), stoneM); arch.rotation.y = Math.PI / 2; arch.position.set(15000, 3.2, 0); arch.castShadow = true; g.add(arch);
    for (const dx of [-4.3, 4.3]) { const rail = new THREE.Mesh(box, stoneM); rail.scale.set(.5, 1, 72); rail.position.set(15000 + dx, 30.5, 0); g.add(rail); }
    const water = new THREE.Mesh(new THREE.PlaneGeometry(700, 16), new THREE.MeshLambertMaterial({ color: 0x2a4a5a, transparent: true, opacity: .85 })); water.rotation.x = -Math.PI / 2; water.position.set(15000, .1, 0); g.add(water);
    const tr = []; for (let i = 0; i < 1500; i++) { const x = R(14700, 15300), z = (rnd() < .5 ? -1 : 1) * R(34, 300); if (Math.abs(x - 15000) < 7 && Math.abs(z) < 60) continue; tr.push([x, z, R(8, 15), surfaceY(x, z, 999)]); }
    const fol = jjhTreeGeo.fol, at = ([x, z, h, y], M) => M.compose(P3.set(x, y, z), Q.setFromAxisAngle(new V3(0, 1, 0), x), S3.set(h * .6, h, h * .6));
    const a = instanced(jjhTreeGeo.tr, new THREE.MeshLambertMaterial({ color: 0x4a3024 }), tr, at, true), f = instanced(fol, new THREE.MeshLambertMaterial({ color: 0xffffff }), tr.map(t => Object.assign(t, { c: 1 })), (t, M, c) => { at(t, M); c.setRGB(.12 + (t[0] % 3) * .012, .22 + (t[1] % 5) * .012, .11); }, true);
    g.add(a, f); }
  // Koinokuchi Canyon floor: boulders in and along the river, scrub under the cliffs
  { const g = MAPG.canyon, bl = [], sh = [];
    for (let i = 0; i < 160; i++) { const z = (rnd() < .5 ? -1 : 1) * R(6, 22); bl.push([R(14790, 15210), z, R(.3, 1.1), rnd()]); }
    for (let i = 0; i < 220; i++) sh.push([R(14790, 15210), (rnd() < .5 ? -1 : 1) * R(17, 24), R(.6, 1.4)]);
    const bm = instanced(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: 0xffffff }), bl.map(b => Object.assign(b, { c: 1 })), ([x, z, k, r], M, c) => { M.compose(P3.set(x, k * .3, z), Q.setFromEuler(new THREE.Euler(r, r * 7, 0)), S3.set(k * 1.3, k * .8, k)); c.setRGB(.36 + r * .1, .34 + r * .08, .3 + r * .06); }, true);
    const sm = instanced(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: 0xffffff }), sh.map(b => Object.assign(b, { c: 1 })), ([x, z, k], M, c) => { M.compose(P3.set(x, k * .5, z), Q.identity(), S3.set(k * 1.2, k * .8, k * 1.2)); c.setRGB(.2 + (x % 3) * .02, .32 + (z % 2) * .03, .14); }, true);
    g.add(bm, sm); }
  // Eishū: gate sign, floodlights over the yard
  { const t = canvasTex(96, 20, (c, w, h) => { c.fillStyle = '#e8e4da'; c.fillRect(0, 0, w, h); c.fillStyle = '#1a1a1a'; c.font = 'bold 14px serif'; c.textAlign = 'center'; c.fillText('英集少年院', w / 2, 15); }, false);
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(3.6, .75), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide })); sg.position.set(7350.9, 4.2, -109.9); scene.add(sg);
    const fl = [[7310, -120], [7410, -120], [7310, -220], [7410, -220]], at = ([x, z], M) => M.compose(P3.set(x, 0, z), Q.identity(), S3.set(1, 1, 1));
    instanced(new THREE.CylinderGeometry(.14, .18, 11, 6).translate(0, 5.5, 0), new THREE.MeshLambertMaterial({ color: 0x5a5c60 }), fl, at, true);
    instanced(new THREE.BoxGeometry(1.4, .5, .8).translate(0, 11.1, 0), lampMat, fl, at); cityList.push(sg, ...scene.children.slice(-2)); }
  /* ---------------- interiors: floors, ceilings with lights, furniture, signs ---------------- */
  { const plane = (g, w, h, x, y, z, mat, rx, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); if (rx) m.rotation.x = rx; if (ry) m.rotation.y = ry; g.add(m); return m; };
    const tex = (w, h, draw) => canvasTex(w, h, draw, false), basic = t => new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }), lam = c => new THREE.MeshLambertMaterial({ color: c });
    const floor = (g, x, z) => { const gr = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), groundMat); gr.rotation.x = -Math.PI / 2; gr.position.set(x, 0, z); gr.receiveShadow = true; g.add(gr); };
    const ceiling = (g, w, d, x, y, z, draw) => { const t = tex(64, 64, draw); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(w / 8, d / 8); plane(g, w, d, x, y, z, new THREE.MeshBasicMaterial({ map: t }), Math.PI / 2); };
    const lightsTex = (bg, lamp) => (c, w, h) => { c.fillStyle = bg; c.fillRect(0, 0, w, h); c.fillStyle = lamp; c.fillRect(8, 28, 48, 6); c.fillStyle = '#00000033'; for (let i = 0; i < w; i += 16) c.fillRect(i, 0, 1, h); };
    const put = (g, geo, mat, list, fn) => { const m = instanced(geo, mat, list, fn, true); g.add(m); return m; };
    const at = (x, y, z, ry = 0, sx = 1, sy = 1, sz = 1) => (it, M) => M.compose(P3.set(...it.slice(0, 3)), Q.setFromAxisAngle(new V3(0, 1, 0), it[3] || 0), S3.set(sx, sy, sz));
    // school
    { const g = MAPG.school; floor(g, 20060, -6); ceiling(g, 124, 22, 20060, 4.2, -6, lightsTex('#5a5a58', '#9aa0a8'));
      const desks = []; for (let x = 20000; x < 20120; x += 24) for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) desks.push([x + 5 + i * 3.4, 0, -8 - j * 2.6]);
      put(g, new THREE.BoxGeometry(1.2, .1, .8).translate(0, .75, 0), lam(0xb88a58), desks, at()); put(g, new THREE.BoxGeometry(1.1, .72, .1).translate(0, .36, .35), lam(0x6a6e78), desks, at());
      put(g, new THREE.BoxGeometry(.5, .45, .5).translate(0, .22, .8), lam(0x8a6a48), desks, at());
      for (let x = 20000; x < 20120; x += 24) { plane(g, 8, 2.2, x + 12, 2, -16.25, lam(0x2a4a38)); const n = (x - 20000) / 24 + 1;
        plane(g, 1.2, .5, x + 20, 3.3, -4.02, basic(tex(48, 20, (c, w, h) => { c.fillStyle = '#f2efe6'; c.fillRect(0, 0, w, h); c.fillStyle = '#222'; c.font = 'bold 14px sans-serif'; c.textAlign = 'center'; c.fillText('4-' + n, w / 2, 15); }))); }
      const moon = plane(g, 124, 2.6, 20060, 2.3, 4.25, new THREE.MeshBasicMaterial({ color: 0x3a4a70, transparent: true, opacity: .35 })); moon.userData.keep = 1; }
    // womb's domain: a red-black floor, drifting embers
    { const g = MAPG.womb; floor(g, 20500, 0); }
    // cinema
    { const g = MAPG.cinema; floor(g, 20830, 0); ceiling(g, 76, 66, 20830, 11, 0, lightsTex('#1a1418', '#4a3a30'));
      plane(g, 50, 13, 20830, 7, -32.2, new THREE.MeshBasicMaterial({ map: tex(96, 26, (c, w, h) => { const g2 = c.createLinearGradient(0, 0, w, h); g2.addColorStop(0, '#2a3a5a'); g2.addColorStop(1, '#6a3a4a'); c.fillStyle = g2; c.fillRect(0, 0, w, h); c.fillStyle = '#e8e0d0'; c.font = 'bold 9px sans-serif'; c.textAlign = 'center'; c.fillText('NOW SHOWING', w / 2, 15); }) }));
      const seats = []; for (let r = 0; r < 12; r++) for (let x = -27; x <= 27; x += 1.6) if (Math.abs(x) > 1.2) seats.push([20830 + x, .45 * (r + 1), -8 + r * 3 + .4]);
      put(g, new THREE.BoxGeometry(1.2, .5, .9).translate(0, .25, 0), lam(0x8a1a24), seats, at()); put(g, new THREE.BoxGeometry(1.2, 1, .2).translate(0, .6, .55), lam(0x7a1620), seats, at());
      plane(g, 2, .7, 20866.9, 8, 20, basic(tex(40, 14, (c, w, h) => { c.fillStyle = '#1a8a3a'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = 'bold 10px sans-serif'; c.fillText('EXIT', 8, 11); })), 0, -Math.PI / 2); }
    // gym
    { const g = MAPG.gym; floor(g, 21240, 0); ceiling(g, 96, 60, 21240, 12, 0, lightsTex('#6a6660', '#e8e8e0'));
      plane(g, 40, 7, 21240, 5, -30.2, lam(0x6a1418)); plane(g, 30, 2, 21240, 10, -30.25, basic(tex(120, 16, (c, w, h) => { c.fillStyle = '#f2efe6'; c.fillRect(0, 0, w, h); c.fillStyle = '#222'; c.font = 'bold 12px serif'; c.textAlign = 'center'; c.fillText('里桜高校 全校集会', w / 2, 12); })));
      const chairs = []; for (let r = 0; r < 7; r++) for (let x = -20; x <= 20; x += 1.25) if (Math.abs(x) > 1.5) chairs.push([21240 + x, 0, -19 + r * 1.7]);
      put(g, new THREE.BoxGeometry(.5, .06, .5).translate(0, .46, 0), lam(0x3a4a6a), chairs, at()); put(g, new THREE.BoxGeometry(.5, .5, .06).translate(0, .72, .24), lam(0x3a4a6a), chairs, at()); put(g, new THREE.BoxGeometry(.04, .46, .04).translate(0, .23, 0), lam(0x9a9aa0), chairs, at());
      for (const z of [-30.2, 30.2]) plane(g, 90, 1.6, 21240, 10, z * .99, new THREE.MeshBasicMaterial({ color: 0xd8e0e8 }), 0, z > 0 ? Math.PI : 0);
      for (const x of [21196, 21284]) { plane(g, 3.6, 2.4, x + (x < 21240 ? .5 : -.5), 5.2, 0, lam(0xf2f2f2), 0, Math.PI / 2); const rim = new THREE.Mesh(new THREE.TorusGeometry(.45, .05, 6, 16), lam(0xd05020)); rim.rotation.x = Math.PI / 2; rim.position.set(x + (x < 21240 ? 1.1 : -1.1), 4.4, 0); g.add(rim); } }
    // Shibuya Station B5F
    { const g = MAPG.platform; floor(g, 21680, 0); ceiling(g, 196, 30, 21680, 7.2, 0, lightsTex('#8a8c90', '#f4f6ff'));
      const rails = []; for (const z of [-10.2, -8.8, 8.8, 10.2]) rails.push([21680, .12, z]); put(g, new THREE.BoxGeometry(192, .24, .18), lam(0x8a8a90), rails, at());
      const trainT = tex(64, 32, (c, w, h) => { c.fillStyle = '#d8dce2'; c.fillRect(0, 0, w, h); c.fillStyle = '#9c5e31'; c.fillRect(0, 20, w, 4); c.fillStyle = '#1a2230'; for (let x = 4; x < w; x += 16) c.fillRect(x, 6, 10, 10); c.fillStyle = '#9aa0a8'; c.fillRect(30, 4, 6, 24); });
      trainT.wrapS = THREE.RepeatWrapping; trainT.repeat.set(8, 1); const tr = new THREE.Mesh(new THREE.BoxGeometry(120, 4.2, 3.2), new THREE.MeshLambertMaterial({ map: trainT })); tr.position.set(21660, 2.1, 9.5); tr.castShadow = true; g.add(tr);
      for (let x = 21600; x < 21770; x += 36) for (const z of [-14.25, 14.25]) plane(g, 6, 1.4, x, 4.6, z, basic(tex(96, 22, (c, w, h) => { c.fillStyle = '#20242c'; c.fillRect(0, 0, w, h); c.fillStyle = '#9c5e31'; c.beginPath(); c.arc(11, 11, 8, 0, 7); c.fill(); c.fillStyle = '#fff'; c.font = 'bold 9px sans-serif'; c.fillText('F16', 4, 14); c.font = 'bold 12px sans-serif'; c.fillText('渋谷 Shibuya', 24, 15); })), 0, z > 0 ? Math.PI : 0);
      const benches = []; for (let x = 21602; x < 21770; x += 24) benches.push([x, 1.1, -3.5]); put(g, new THREE.BoxGeometry(3, .45, .7).translate(0, .45, 0), lam(0x5a6a7a), benches, at()); }
    // Roppongi's abandoned building: grimy ceiling, bare lights, rubble
    { const g = MAPG.ruins; floor(g, 22650, 0); ceiling(g, 104, 50, 22650, 4.6, 0, lightsTex('#3a3834', '#6a6658'));
      const rub = []; for (let i = 0; i < 60; i++) rub.push([22605 + rnd() * 92, 0, -22 + rnd() * 44, rnd() * 3]); put(g, new THREE.BoxGeometry(.8, .4, .6).translate(0, .2, 0), lam(0x6a6660), rub, at()); }
    // sewers: pipes along the walls, dim lamps
    { const g = MAPG.sewer; floor(g, 23100, 0); ceiling(g, 204, 15, 23100, 6, 0, lightsTex('#262a24', '#8a9a6a'));
      const pipes = []; for (const z of [-6.6, 6.6]) for (const y of [3.8, 4.6]) pipes.push([23100, y, z]); put(g, new THREE.CylinderGeometry(.25, .25, 200, 8).rotateZ(Math.PI / 2), lam(0x4a5a4a), pipes, at()); }
    // Deadly Sentencing
    { const g = MAPG.court; floor(g, 22250, 0);
      for (const [x, z] of [[22250, -22], [22238, 2], [22262, 2]]) { const c = new THREE.Mesh(new THREE.ConeGeometry(5, 26, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: .08, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); c.position.set(x, 13, z); g.add(c); }
      plane(g, 12, 2, 22250, 6, -24.6, basic(tex(120, 20, (c, w, h) => { c.fillStyle = '#1a0a08'; c.fillRect(0, 0, w, h); c.fillStyle = '#e8c860'; c.font = 'bold 16px serif'; c.textAlign = 'center'; c.fillText('誅 伏 賜 死', w / 2, 16); }))); } }

  let mapK = 'shinjuku';
  function setMap(k) { if (!MAPS[k]) k = 'shinjuku'; mapK = k; Object.assign(MAP, { ceil: 0 }, MAPS[k]); const city = CITY.includes(k);   // every city map shares the city meshes
    for (const o of cityList) o.visible = city; for (const s of STY) inst[s].visible = STY_MAPS[s] ? STY_MAPS[s].includes(k) : city; jjh.visible = k === 'jjh';
    for (const [m, g] of Object.entries(MAPG)) g.visible = m === k;
    // draw only this map's buildings: each style's instances are reordered so the nearby ones come first, and the rest are skipped
    const cx = (MAP.x0 + MAP.x1) / 2, hw = (MAP.x1 - MAP.x0) / 2 + 600;
    for (const s of STY) { const m = inst[s]; if (!m.visible) continue; const near = [], far = []; for (const b of plan[s]) (Math.abs(b.x - cx) < hw ? near : far).push(b);
      near.concat(far).forEach((b, i) => { b.i = i; writeB(b); }); m.count = near.length; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    mini.width = Math.ceil((MAP.x1 - MAP.x0) * MAP.ms); mini.height = Math.ceil((MAP.z1 - MAP.z0) * MAP.ms); drawMini(); }

  /* ---------------- domain set pieces ---------------- */
  const domain = new THREE.Group(); scene.add(domain);
  const stars = (() => { const n = 2600, p = new Float32Array(n * 3), c = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const v = new V3(R(-1, 1), R(-1, 1), R(-1, 1)).normalize().multiplyScalar(R(40, 500)); p.set([v.x, v.y, v.z], i * 3);
    const k = rnd(); c.set(k < .3 ? [.6, .8, 1] : k < .5 ? [1, .85, 1] : [1, 1, 1], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true, fog: false })); pts.visible = false; domain.add(pts); return pts; })();
  const shrine = new THREE.Group(); { const dk = new THREE.MeshLambertMaterial({ color: 0x2a1418 }), rd = new THREE.MeshLambertMaterial({ color: 0x6a1420 }), bone = new THREE.MeshLambertMaterial({ color: 0xa89e8e });
    const add = (w, h, d, x, y, z, m) => { const o = new THREE.Mesh(box, m); o.scale.set(w, h, d); o.position.set(x, y, z); o.castShadow = true; shrine.add(o); return o; };
    add(22, 2, 14, 0, 1, 0, dk); for (const x of [-9, -3, 3, 9]) for (const z of [-5, 5]) add(1.4, 16, 1.4, x, 10, z, rd);
    add(26, 1.5, 18, 0, 18.5, 0, dk); add(20, 1.4, 14, 0, 20, 0, rd); add(14, 1.4, 10, 0, 21.4, 0, dk); add(8, 6, 1.4, 0, 12, 5.8, dk);
    for (let i = 0; i < 28; i++) add(.45, 6.4, .45, -5 + i * .37, 5, 6.2, bone);
    for (let i = 0; i < 90; i++) { const s = R(.6, 1.6), a = R(-1.4, 1.4), r = R(6, 14); add(s, s, s, Math.sin(a) * r, s / 2 + R(0, 2), Math.cos(a) * r + 4, bone).rotation.set(R(0, 3), R(0, 3), 0); } }
  shrine.visible = false; domain.add(shrine);
  const swords = new THREE.Group(); { const bl = new THREE.MeshLambertMaterial({ color: 0xd0d8e4 }), hd = new THREE.MeshLambertMaterial({ color: 0x2a2030 });
    for (let i = 0; i < 160; i++) { const a = R(0, 6.28), r = R(4, 60), g = new THREE.Group(), b = new THREE.Mesh(box, bl); b.scale.set(.08, 2.4, .3); b.position.y = 1.2; const h = new THREE.Mesh(box, hd); h.scale.set(.12, .8, .14); h.position.y = 2.8; g.add(b, h);
      g.position.set(Math.cos(a) * r, -.3, Math.sin(a) * r); g.rotation.set(R(-.35, .35), R(0, 3), R(-.35, .35)); swords.add(g); } }
  swords.visible = false; domain.add(swords);
  const MOODS = {
    void: { sky: ['#000006', '#04102e', '#1a4a9a'], fog: '#06102a', fogD: .004, grade: [.9, 1, 1.2], hide: true },
    shrine: { sky: ['#140004', '#4a0610', '#c01424'], fog: '#3a060c', fogD: .012, grade: [1.2, .86, .86] },
    womb: { sky: ['#0c0406', '#3a1216', '#6a2a24'], fog: '#2a1012', fogD: .02, grade: [1.15, .9, .88] },
    love: { sky: ['#1a1628', '#6a5a80', '#f0e0f0'], fog: '#b0a0c0', fogD: .01, grade: [1.05, 1, 1.08] },
    yuji: { sky: ['#1a1030', '#7a3a50', '#ffae5a'], fog: '#8a5a48', fogD: .008, grade: [1.12, 1, .9] },
    judge: { sky: ['#020204', '#101018', '#2a2838'], fog: '#0c0c12', fogD: .025, grade: [1, 1, 1.05], hide: true }
  };
  let mood = null; const cityObjs = () => scene.children.filter(o => o !== sky && o !== domain && o !== hemi && o !== sun && o !== sun.target && !o.userData.keep && o.type !== 'Sprite' && !(o.isPoints && o.userData.fx));
  let hidden = [];
  function setMood(k, center, face) {
    for (const o of hidden) o.visible = true; hidden = [];
    stars.visible = shrine.visible = swords.visible = false;
    if (!k) { mood = null; setTime(curTime); return; }
    const m = MOODS[k]; mood = k;
    skyU.top.value.set(m.sky[0]); skyU.mid.value.set(m.sky[1]); skyU.hor.value.set(m.sky[2]); skyU.night.value = k === 'void' ? 1 : 0;
    scene.fog.color.set(m.fog); scene.fog.density = m.fogD; compM.uniforms.grade.value.set(...m.grade);
    if (m.hide) { for (const o of cityObjs()) { if (o.visible) { o.visible = false; hidden.push(o); } } }
    if (k === 'void') { stars.visible = true; stars.position.copy(center); }
    if (k === 'shrine') { shrine.visible = true; shrine.position.copy(center.clone().setY(0)); if (face) shrine.lookAt(face.x, 0, face.z); }
    if (k === 'love') { swords.visible = true; swords.position.copy(center.clone().setY(0)); }
  }
  let curTime = 'noon'; const setTimeK = k => { curTime = k; setTime(k); };

  /* ---------------- particles: debris, dust, fire, decals, weather ---------------- */
  const DEB = 500, debM = new THREE.InstancedMesh(new THREE.BoxGeometry(.4, .4, .4), new THREE.MeshLambertMaterial({ color: 0xffffff }), DEB); debM.frustumCulled = false; debM.castShadow = true; scene.add(debM);
  const deb = []; for (let i = 0; i < DEB; i++) { deb.push({ p: new V3(0, -99, 0), v: new V3(), r: new V3(), life: 0, s: 1 }); debM.setMatrixAt(i, M4.makeScale(0, 0, 0)); debM.setColorAt(i, COL.setRGB(.6, .6, .6)); }
  let debI = 0;
  function debris(p, n, col, spd = 10) { for (let k = 0; k < n; k++) { const d = deb[debI]; debI = (debI + 1) % DEB; d.p.copy(p).add(new V3(R(-1, 1), R(-.5, 1), R(-1, 1)));
    d.v.set(R(-1, 1), R(.3, 1.4), R(-1, 1)).multiplyScalar(spd * R(.4, 1)); d.r.set(R(-6, 6), R(-6, 6), R(-6, 6)); d.life = R(1.5, 3.5); d.s = R(.35, 1.6); d.rot = new THREE.Euler();
    COL.set(col || pick(['#8a8680', '#6a6660', '#a09a90', '#5a6a7a'])); debM.setColorAt((debI + DEB - 1) % DEB, COL); } if (debM.instanceColor) debM.instanceColor.needsUpdate = true; }
  const smokeT = [0, 1, 2].map(k => canvasTex(16, 16, c => { for (let i = 0; i < 9; i++) { c.fillStyle = `rgba(255,255,255,${.35 + rnd() * .5})`; c.beginPath(); c.arc(4 + rnd() * 8, 4 + rnd() * 8, 2 + rnd() * 3.5, 0, 7); c.fill(); } }));
  const flameT = [0, 1, 2, 3].map(f => canvasTex(16, 24, c => { for (let y = 0; y < 24; y++) for (let x = 0; x < 16; x++) { const cx = 8 + Math.sin(y * .5 + f * 1.6) * 1.5 * (1 - y / 24), w = Math.pow(y / 24, .8) * 6.5, dd = Math.abs(x - cx) / w; if (dd > 1 || y < 2) continue;
    const ht = (y / 24) * (1 - dd); c.fillStyle = ht > .5 ? '#fff2b0' : ht > .3 ? '#ffc040' : ht > .15 ? '#ff7a20' : '#d02a20'; c.fillRect(x, y, 1, 1); } }));
  const dust = [], fires = [], FIRE_MAX = 70, DUST_MAX = 140;
  function dustAt(p, s, col, life, vel) { if (dust.length >= DUST_MAX) { const o = dust.shift(); scene.remove(o.o); }
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: pick(smokeT), color: col || (TOD.night > .5 ? 0x6a6878 : 0xb8b0a4), transparent: true, depthWrite: false, opacity: .85 }));
    sp.position.copy(p); sp.scale.setScalar(s); sp.material.rotation = R(0, 6); scene.add(sp); dust.push({ o: sp, life: life || R(2.5, 4.5), max: 0, s, v: vel || new V3(R(-.6, .6), R(.4, 1.4), R(-.6, .6)) }); dust[dust.length - 1].max = dust[dust.length - 1].life; }
  function fireAt(p, s = 3, life = 40) { if (fires.length >= FIRE_MAX) { const o = fires.shift(); scene.remove(o.o); }
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameT[0], blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); sp.center.set(.5, 0);
    sp.position.copy(p); sp.scale.set(s * .7, s, 1); scene.add(sp); fires.push({ o: sp, life, max: life, s, ph: R(0, 4) }); }
  const decT = canvasTex(32, 32, c => { for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { const d = Math.hypot(x - 15.5, y - 15.5) / 16 + (rnd() - .5) * .12; if (d > 1) continue;
    c.fillStyle = d > .82 ? 'rgba(60,56,52,.8)' : d > .6 ? 'rgba(28,24,24,.85)' : 'rgba(12,10,12,.9)'; c.fillRect(x, y, 1, 1); } });
  const DEC = 100, decM = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: decT, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), DEC);
  decM.frustumCulled = false; decM.receiveShadow = true; for (let i = 0; i < DEC; i++) decM.setMatrixAt(i, M4.makeScale(0, 0, 0)); scene.add(decM); let decI = 0;
  function crater(p, r) { decM.setMatrixAt(decI, M4.compose(P3.set(p.x, .05 + decI * .0005, p.z), Q.setFromAxisAngle(new V3(0, 1, 0), R(0, 6)), S3.set(r * 2, 1, r * 2))); decM.instanceMatrix.needsUpdate = true; decI = (decI + 1) % DEC; }
  const mkPts = (n, spread, col, size) => { const p = new Float32Array(n * 3); for (let i = 0; i < n; i++) p.set([R(-spread, spread), R(0, 40), R(-spread, spread)], i * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); const pt = new THREE.Points(g, new THREE.PointsMaterial({ color: col, size, transparent: true, opacity: .9, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    pt.userData.fx = 1; pt.frustumCulled = false; scene.add(pt); return pt; };
  const ash = mkPts(500, 45, 0xff6a7a, .14), snow = mkPts(1400, 45, 0xffffff, .12); snow.material.blending = THREE.NormalBlending; snow.visible = false;
  const rain = mkPts(2600, 40, 0x9ab4d8, .09); rain.material.blending = THREE.NormalBlending; rain.material.opacity = .6; rain.visible = false; let weather = null;
  function setWeather(k) { weather = k; rain.visible = k === 'rain'; if (k === 'rain') { ash.visible = snow.visible = false; scene.fog.density *= 1.6; } if (k === 'indoor') ash.visible = snow.visible = false; }
  const lights = [0, 1, 2, 3].map(() => { const l = new THREE.PointLight(0xff8a3a, 0, 26, 1.6); scene.add(l); return l; });
  const chunks = [];

  /* ---------------- destruction ---------------- */
  function setH(b, h, quiet) { b.h = Math.max(0, h); writeB(b); writeAtt(b); if (b.spec) { if (b.spec.userData.core) { b.spec.scale.y = Math.max(.01, b.h); b.spec.position.y = b.h / 2; } else b.spec.visible = b.h >= b.h0 - .5; } inst[b.style].instanceMatrix.needsUpdate = true; if (inst[b.style].instanceColor) inst[b.style].instanceColor.needsUpdate = true;
    if (b.h < b.h0 - .5) for (const u of upsOf(b)) if (u.h > 0) { if (!quiet) chunk(u, 0, u.h); u.alive = false; setH(u, 0, quiet); } }
  function chunk(b, from, hgt) { if (chunks.length > 8 || hgt < 1) return; const m = new THREE.Mesh(box, MATS[b.style]); m.scale.set(b.w, hgt, b.d); m.position.set(b.x, b.base + from + hgt / 2, b.z); m.rotation.y = b.rot; m.castShadow = true; scene.add(m);
    chunks.push({ m, v: new V3(R(-3, 3), R(0, 2), R(-3, 3)), w: new V3(R(-.5, .5), 0, R(-.5, .5)), b }); }
  let solid = false;
  function collapse(b, quiet) { if (solid && !quiet) return; if (!b.alive || b.h < 2.5) return; const keep = Math.max(1.6, b.h * R(.1, .3)); b.alive = false;
    if (!quiet) { chunk(b, keep, b.h - keep); const c = new V3(b.x, b.base + keep, b.z); for (let k = 0; k < 6; k++) dustAt(c.clone().add(new V3(R(-b.w, b.w) * .6, R(0, 3), R(-b.d, b.d) * .6)), R(6, 12)); debris(c, 26, null, 12); }
    setH(b, keep, quiet); signs.forEach((s, i) => { if (s.b === b) { signMesh.setMatrixAt(i, M4.makeScale(0, 0, 0)); signMesh.instanceMatrix.needsUpdate = true; } }); if (rnd() < .7) fireAt(new V3(b.x + R(-b.w, b.w) * .35, b.base + keep, b.z + R(-b.d, b.d) * .35), R(2.5, 5)); }
  function cutB(b, y, quiet) { if (solid && !quiet) { debris(new V3(b.x, y, b.z), 4, null, 7); return; } const local = y - b.base; if (local < 2 || local > b.h - 1.5) { hitB(b, 40, new V3(b.x, y, b.z)); return; }
    if (!quiet) chunk(b, local, b.h - local); setH(b, local, quiet); b.hp *= .6; if (!quiet) { debris(new V3(b.x, y, b.z), 10, null, 6); for (let k = 0; k < 3; k++) dustAt(new V3(b.x + R(-b.w, b.w) * .5, y, b.z + R(-b.d, b.d) * .5), R(4, 7)); } }
  function hitB(b, dmg, p) { if (b.h < .5) return; b.hp -= dmg; debris(p, 4, null, 7); if (b.hp <= 0) collapse(b); }
  function erase(b) { if (solid || b.h < .5) return; const c = new V3(b.x, b.base + b.h / 2, b.z); b.alive = false; setH(b, .4, true); dustAt(c, 10, 0x8a5ac8); crater(new V3(b.x, 0, b.z), Math.max(b.w, b.d) * .7); }
  function ruin(id, frac) { U.power.value = 0; for (const b of B) { if (b.map && b.map !== mapK) continue; if (b.lm && b.lm !== 'omoide') { if (rnd() < frac * .4 && b.base === 0 && !b.spec && !['parktower', 'docomo', 'tocho'].includes(b.lm)) cutB(b, b.base + b.h * R(.4, .8), true); continue; }
    const d = district(b.x, b.z); if (d.id === id && rnd() < frac) { if (b.base > 0) setH(b, 0); else collapse(b, true); } }
    for (let i = 0; i < 26; i++) { const b = pick(B.filter(q => !q.alive && !q.map)); if (b) fireAt(new V3(b.x, b.base + b.h, b.z), R(2.5, 5), 1e9); } }
  function reset() { U.power.value = 1; for (const b of B) { b.h = b.h0; b.alive = true; b.hp = b.hp0; if (!b.hidden) writeB(b); writeAtt(b); if (b.spec) { b.spec.visible = true; if (b.spec.userData.core) { b.spec.scale.y = b.h0; b.spec.position.y = b.h0 / 2; } } } for (const s of STY) { inst[s].instanceMatrix.needsUpdate = true; if (inst[s].instanceColor) inst[s].instanceColor.needsUpdate = true; }
    for (const f of fires) scene.remove(f.o); fires.length = 0; for (const d of dust) scene.remove(d.o); dust.length = 0; for (const c of chunks) scene.remove(c.m); chunks.length = 0;
    for (const d of deb) d.life = 0; signs.forEach((s, i) => signMesh.setMatrixAt(i, M4.compose(P3.set(s.x, s.y, s.z), Q.setFromAxisAngle(new V3(0, 1, 0), s.ry), S3.set(1, 1, 1)))); signMesh.instanceMatrix.needsUpdate = true; drawMini(); for (let i = 0; i < DEC; i++) decM.setMatrixAt(i, M4.makeScale(0, 0, 0)); decM.instanceMatrix.needsUpdate = true; setMood(null); }

  /* ---------------- collision queries ---------------- */
  function collide(p, r, prevY) {   // p = feet position; returns {b, landed} after pushing p out of buildings
    let res = null;
    for (const b of near(p.x, p.z, r + 2)) { if (b.h < .5 || !inside(b, p.x, p.z, r)) continue; const top = b.base + b.h; if (p.y >= top || p.y + 1.8 < b.base) continue;
      if (prevY >= top - .6) { p.y = top; res = { b, landed: true }; continue; }
      const dx1 = (b.x + b.hw + r) - p.x, dx0 = p.x - (b.x - b.hw - r), dz1 = (b.z + b.hd + r) - p.z, dz0 = p.z - (b.z - b.hd - r), m = Math.min(dx0, dx1, dz0, dz1);
      if (m === dx0) p.x -= dx0; else if (m === dx1) p.x += dx1; else if (m === dz0) p.z -= dz0; else p.z += dz1;
      res = { b, landed: false, n: m === dx0 ? [-1, 0] : m === dx1 ? [1, 0] : m === dz0 ? [0, -1] : [0, 1] }; }
    return res;
  }
  function surfaceY(x, z, y) { let s = 0; for (const b of near(x, z, 1)) if (b.h > .5 && inside(b, x, z, 0)) { const t = b.base + b.h; if (t <= y + .3) s = Math.max(s, t); } return s; }
  function segment(a, bpt, r) { // buildings touched by a thick segment
    const out = [], len = a.distanceTo(bpt), steps = Math.ceil(len / 4), seen = new Set();
    for (let i = 0; i <= steps; i++) { const t = i / steps, x = a.x + (bpt.x - a.x) * t, y = a.y + (bpt.y - a.y) * t, z = a.z + (bpt.z - a.z) * t;
      for (const b of near(x, z, r + 2)) { if (seen.has(b) || b.h < .5) continue; if (inside(b, x, z, r) && y > b.base - r && y < b.base + b.h + r) { seen.add(b); out.push({ b, p: new V3(x, y, z) }); } } }
    return out; }
  function within(p, r) { const out = []; for (const b of near(p.x, p.z, r)) { if (b.h < .5) continue; const dx = Math.max(Math.abs(p.x - b.x) - b.hw, 0), dz = Math.max(Math.abs(p.z - b.z) - b.hd, 0); if (Math.hypot(dx, dz) < r) out.push(b); } return out; }
  function occluded(a, bpt) { for (const { b } of segment(a, bpt, 0)) if (b.base + b.h > Math.min(a.y, bpt.y)) return b; return null; }

  /* ---------------- per-frame ---------------- */
  let T = 0, smokeCd = 0;
  function update(dt, focus) {
    T += dt; U.time.value = T * .4;
    // smoke columns drifting up from burning buildings near the camera
    if ((smokeCd -= dt) <= 0 && fires.length) { smokeCd = .16; const f = fires[Math.random() * fires.length | 0];
      if (f.life > 4 && f.o.position.distanceToSquared(camera.position) < 62500) dustAt(f.o.position.clone().add(new V3(R(-1, 1), f.s * .8, R(-1, 1))), R(5, 9), TOD.night > .5 ? 0x2c2830 : 0x55504e, R(6, 9), new V3(R(.2, 1.2), R(3.5, 5.5), R(-.5, .5))); }
    const cam = camera.position;
    sky.position.copy(cam); fuji.position.set(cam.x - 1900, 0, cam.z + 700);
    sun.position.copy(focus).addScaledVector(skyU.sun.value, 300); sun.target.position.copy(focus);
    // debris
    let any = false;
    for (let i = 0; i < DEB; i++) { const d = deb[i]; if (d.life <= 0) continue; any = true; d.life -= dt; d.v.y -= 22 * dt; d.p.addScaledVector(d.v, dt);
      if (d.p.y < .15) { d.p.y = .15; d.v.y *= -.3; d.v.x *= .6; d.v.z *= .6; } d.rot.x += d.r.x * dt; d.rot.y += d.r.y * dt;
      const s = d.life < .5 ? d.s * d.life * 2 : d.s; debM.setMatrixAt(i, M4.compose(d.p, Q.setFromEuler(d.rot), S3.setScalar(s))); if (d.life <= 0) debM.setMatrixAt(i, M4.makeScale(0, 0, 0)); }
    if (any) debM.instanceMatrix.needsUpdate = true;
    for (let i = dust.length - 1; i >= 0; i--) { const d = dust[i]; d.life -= dt; const k = 1 - d.life / d.max; d.o.position.addScaledVector(d.v, dt); d.o.scale.setScalar(d.s * (1 + k * 1.2)); d.o.material.opacity = .85 * (1 - k);
      if (d.life <= 0) { scene.remove(d.o); dust.splice(i, 1); } }
    for (let i = fires.length - 1; i >= 0; i--) { const f = fires[i]; f.life -= dt; f.o.material.map = flameT[((T * 10 + f.ph) | 0) % 4]; const k = f.life < 3 ? f.life / 3 : 1; f.o.scale.set(f.s * .7 * k, f.s * k * (1 + Math.sin(T * 9 + f.ph) * .06), 1);
      if (f.life <= 0) { scene.remove(f.o); fires.splice(i, 1); } }
    for (let i = chunks.length - 1; i >= 0; i--) { const c = chunks[i]; c.v.y -= 20 * dt; c.m.position.addScaledVector(c.v, dt); c.m.rotation.x += c.w.x * dt; c.m.rotation.z += c.w.z * dt;
      if (c.m.position.y - c.m.scale.y / 2 < 0) { const p = c.m.position.clone().setY(1); for (let k = 0; k < 7; k++) dustAt(p.clone().add(new V3(R(-8, 8), R(0, 4), R(-8, 8))), R(7, 13)); debris(p, 30, null, 13); crater(p, Math.max(c.b.w, c.b.d) * .6);
        scene.remove(c.m); chunks.splice(i, 1); if (window.GAME) GAME.onCrash(p, c.m.scale.x * c.m.scale.y); } }
    // point lights follow the fires nearest the camera
    if ((T * 4 | 0) !== ((T - dt) * 4 | 0)) { const s = fires.slice().sort((a, b) => a.o.position.distanceToSquared(focus) - b.o.position.distanceToSquared(focus));
      lights.forEach((l, i) => { const f = s[i]; if (f && f.o.position.distanceTo(focus) < 60) { l.position.copy(f.o.position).add(new V3(0, 2, 0)); l.intensity = 1.4; } else l.intensity = 0; }); }
    for (const l of lights) if (l.intensity > 0) l.intensity = 1.2 + Math.sin(T * 13 + l.id) * .2;
    // weather around the camera
    for (const pt of [ash, snow, rain]) { if (!pt.visible) continue; const a = pt.geometry.attributes.position.array, sp = pt === snow ? -2.2 : pt === rain ? -34 : 1.4;
      for (let i = 0; i < a.length; i += 3) { a[i + 1] += sp * dt * (1 + (i % 7) * .08); a[i] += Math.sin(T + i) * dt * .5;
        if (a[i + 1] > 40 || a[i + 1] < 0) { a[i + 1] = sp > 0 ? 0 : 40; } if (Math.abs(a[i] + pt.position.x - cam.x) > 45) a[i] = cam.x - pt.position.x + R(-40, 40); if (Math.abs(a[i + 2] + pt.position.z - cam.z) > 45) a[i + 2] = cam.z - pt.position.z + R(-40, 40); }
      pt.position.set(0, Math.max(0, cam.y - 25), 0); pt.geometry.attributes.position.needsUpdate = true; }
    if (stars.visible) stars.rotation.y += dt * .02;
  }

  /* ---------------- minimap ---------------- */
  const mini = document.createElement('canvas'); mini.width = Math.ceil((MAP.x1 - MAP.x0) * MAP.ms); mini.height = Math.ceil((MAP.z1 - MAP.z0) * MAP.ms);
  function drawMini() { const g = mini.getContext('2d'), MS = MAP.ms; g.fillStyle = '#1c1a22'; g.fillRect(0, 0, mini.width, mini.height);
    const X = x => (x - MAP.x0) * MS, Z = z => (z - MAP.z0) * MS;
    for (const d of [...D].reverse()) { g.fillStyle = ['#2a2832', '#23422a', '#3a3640', '#4a4650', '#4e4a44', '#1d3320', '#23405a'][d.type]; g.fillRect(X(d.x0), Z(d.z0), (d.x1 - d.x0) * MS, (d.z1 - d.z0) * MS);
      if (d.type === 0) { g.fillStyle = '#4a4854'; for (let x = d.x0; x < d.x1; x += d.cx) g.fillRect(X(x), Z(d.z0), Math.max(1, d.sw * MS), (d.z1 - d.z0) * MS); for (let z = d.z0; z < d.z1; z += d.cz) g.fillRect(X(d.x0), Z(z), (d.x1 - d.x0) * MS, Math.max(1, d.sw * MS)); }
      if (d.type === 2) { g.fillStyle = '#6a6470'; for (let x = -34; x < 36; x += 4.6) g.fillRect(X(x), Z(d.z0), 1, (d.z1 - d.z0) * MS); } }
    for (const a of AVE) { g.fillStyle = '#5a5866'; g.fillRect(X(a.x0), Z(a.z0), (a.x1 - a.x0) * MS, (a.z1 - a.z0) * MS); }
    for (const b of B) { if (b.base > 0 || b.hidden) continue; g.fillStyle = b.lm ? '#a8a0c0' : b.alive ? '#6c6a7c' : '#3e3a44'; g.fillRect(X(b.x - b.hw), Z(b.z - b.hd), Math.max(1, b.hw * 2 * MS), Math.max(1, b.hd * 2 * MS)); }
    g.fillStyle = '#6a6a7c'; g.beginPath(); g.moveTo(X(-210), Z(-62)); g.lineTo(X(-229), Z(-29)); g.lineTo(X(-191), Z(-29)); g.fill(); }
  drawMini();

  function setPixel(n) { if (n !== pixel) { pixel = n; resize(); } }
  function degrade(level) { if (level === 1) { pixel = Math.min(pixel, 360); resize(); } else { renderer.shadowMap.enabled = false; sun.castShadow = false; scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); } }
  function setCut(i, x, y, r, depth) { U.cut.value[i].set(x, y, r, depth); }
  resize();
  setTime('noon');
  return { scene, camera, renderer, render, resize, update, setTime: setTimeK, setMood, get mood() { return mood; }, TIMES, get TOD() { return TOD; },
    district, D, MAP, LM, B, setMap, setWeather, get map() { return mapK; }, collide, surfaceY, segment, within, occluded, near,
    hitB, cutB, collapse, erase, ruin, reset, degrade, debris, dustAt, fireAt, crater, setCut, setPixel, set solid(v) { solid = v; }, mini, drawMini, get MS() { return MAP.ms; }, compM, get W() { return W; }, get H() { return H; } };
})();
