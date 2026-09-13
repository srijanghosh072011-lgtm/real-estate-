#!/usr/bin/env node
/**
 * Build a hosted-preview copy of the site.
 *
 * The published sandbox only allows images from the page's own origin, so the
 * Unsplash photography cannot load there. Rather than show broken boxes, every
 * photo is swapped for generated SVG art in the brand palette. Layout, type,
 * colour and all interactions are the real thing.
 *
 * The real build (`node build.mjs`) keeps the real photography.
 *
 *   RELATIVE=1 node build.mjs && node scripts/artifact-build.mjs
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const OUT = 'dist';

/* ------------------------------------------------------------ SVG art --- */

const PALETTE = [
  ['#e6ece0', '#c9d4bd', '#5c6b4e'], // sage
  ['#f1eee5', '#ddd6c4', '#8a7f63'], // sand
  ['#e4e7e9', '#c6ccd0', '#5d6b73'], // slate
  ['#f0e6df', '#dcc6b6', '#b4785c'], // clay
];

// Stable hash so the same photo always becomes the same artwork.
const hash = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

/** Abstract architectural composition — rooflines, apertures, horizon. */
function art(seed, w = 1200, h = 900) {
  const n = hash(seed);
  const [bg, mid, ink] = PALETTE[n % PALETTE.length];
  const variant = Math.floor(n / 7) % 3;
  const horizon = h * (0.58 + ((n >> 3) % 12) / 100);

  const roof =
    variant === 0
      ? `<path d="M${w * 0.18} ${horizon} L${w * 0.18} ${h * 0.34} L${w * 0.5} ${h * 0.16} L${w * 0.82} ${h * 0.34} L${w * 0.82} ${horizon} Z" fill="${mid}"/>`
      : variant === 1
        ? `<rect x="${w * 0.2}" y="${h * 0.26}" width="${w * 0.34}" height="${horizon - h * 0.26}" fill="${mid}"/>
           <rect x="${w * 0.56}" y="${h * 0.4}" width="${w * 0.26}" height="${horizon - h * 0.4}" fill="${ink}" opacity=".28"/>`
        : `<path d="M${w * 0.14} ${horizon} L${w * 0.14} ${h * 0.42} L${w * 0.38} ${h * 0.24} L${w * 0.62} ${h * 0.42} L${w * 0.62} ${horizon} Z" fill="${mid}"/>
           <rect x="${w * 0.64}" y="${h * 0.36}" width="${w * 0.22}" height="${horizon - h * 0.36}" fill="${ink}" opacity=".22"/>`;

  // Windows: a quiet grid of apertures, offset per variant.
  let windows = '';
  const cols = 3 + (n % 3);
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < 2; j++) {
      const x = w * (0.24 + i * 0.11);
      const y = h * (0.46 + j * 0.13);
      if (x < w * 0.8) windows += `<rect x="${x}" y="${y}" width="${w * 0.055}" height="${h * 0.075}" rx="3" fill="${ink}" opacity=".${3 + ((i + j) % 4)}"/>`;
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="${mid}" stop-opacity=".55"/>
</linearGradient></defs>
<rect width="${w}" height="${h}" fill="url(#g)"/>
<circle cx="${w * (0.72 + ((n >> 5) % 10) / 100)}" cy="${h * 0.2}" r="${h * 0.07}" fill="${ink}" opacity=".12"/>
${roof}${windows}
<rect y="${horizon}" width="${w}" height="${h - horizon}" fill="${ink}" opacity=".16"/>
<rect y="${horizon}" width="${w}" height="2" fill="${ink}" opacity=".25"/>
</svg>`;

  return 'data:image/svg+xml,' + encodeURIComponent(svg.replace(/\n\s*/g, ' '));
}

/* ------------------------------------------------------------- rewrite --- */

async function walk(dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p, out);
    else if (p.endsWith('.html')) out.push(p);
  }
  return out;
}

const files = await walk(OUT);
let swapped = 0;

for (const f of files) {
  let src = await readFile(f, 'utf8');

  // Every Unsplash photo becomes generated art at a sensible intrinsic size.
  src = src.replace(/(src|content)="https:\/\/images\.unsplash\.com\/([^"]*)"/g, (_, attr, rest) => {
    swapped++;
    const portrait = /w=600|w=300|h=700/.test(rest);
    return `${attr}="${art(rest, portrait ? 600 : 1200, portrait ? 700 : 900)}"`;
  });

  // The host serves the entry page at the root and reserves the name
  // "index.html", so links to the *home* page must address the directory.
  // Links that carry a path segment ("../listings/index.html") are real
  // published files and stay exactly as they are.
  src = src.replace(/href="((?:\.\.\/)*)index\.html"/g, (_, up) => `href="${up || './'}"`);

  // The embedded Google Maps iframes cannot load in the sandbox either.
  src = src.replace(
    /<iframe[^>]*src="https:\/\/www\.google\.com\/maps[^"]*"[^>]*><\/iframe>/g,
    '<div class="map-stub"><p>Interactive map — live on the deployed site</p></div>'
  );

  await writeFile(f, src);
}

// Style the map stand-in so it reads as intentional, not missing.
const cssPath = join(OUT, 'assets/styles.css');
await writeFile(
  cssPath,
  (await readFile(cssPath, 'utf8')) +
    `\n/* hosted preview only */\n.map-stub{display:grid;place-items:center;aspect-ratio:16/7;` +
    `background:var(--sage-wash);border-radius:calc(var(--r-lg) - var(--pad-shell));}\n` +
    `.map-stub p{margin:0;font-size:.85rem;color:var(--sage);letter-spacing:.04em;}\n`
);

/* --------------------------------------------- artifact entry document --- */
// The host wraps the primary file in its own <html>/<head>/<body>, so hand it
// body content with the title and stylesheet links hoisted to the top.
const home = await readFile(join(OUT, 'index.html'), 'utf8');
const title = home.match(/<title>([^<]*)<\/title>/)[1];
const links = [...home.matchAll(/<link rel="stylesheet"[^>]*>/g)].map((m) => m[0]).join('\n');
const body = home.match(/<body[^>]*>([\s\S]*)<\/body>/)[1];

await writeFile(
  join(OUT, 'preview-entry.html'),
  `<title>${title}</title>\n${links}\n${body}`
);

console.log(`preview build ready: ${swapped} photos replaced with generated art across ${files.length} pages`);
