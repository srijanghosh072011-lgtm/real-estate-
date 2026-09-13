#!/usr/bin/env node
/**
 * Build smoke test. Run after `node build.mjs`.
 * Fails loudly on the things that quietly break a live site: missing pages,
 * broken internal links, images without alt text, placeholder text shipped to
 * production, and wrong mortgage arithmetic.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import assert from 'node:assert/strict';

const OUT = 'dist';
let failures = 0;
const fail = (msg) => {
  console.error('FAIL  ' + msg);
  failures++;
};
const pass = (msg) => console.log('ok    ' + msg);

async function walk(dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p, out);
    else out.push(p);
  }
  return out;
}

/* ---------------------------------------------- Canadian mortgage math --- */
// Semi-annual compounding. $400,000 at 20% down, 4.49%, 25 years ≈ $1,772/mo.
function payment(principal, annualRate, years) {
  const n = years * 12;
  if (annualRate <= 0) return principal / n;
  const i = Math.pow(1 + annualRate / 100 / 2, 1 / 6) - 1;
  return (principal * i) / (1 - Math.pow(1 + i, -n));
}

{
  const m = payment(320000, 4.49, 25);
  assert.ok(Math.abs(m - 1772) < 12, `expected ~$1772/mo, got ${m.toFixed(2)}`);
  assert.equal(payment(120000, 0, 10).toFixed(2), (1000).toFixed(2));
  pass('mortgage payment uses semi-annual compounding');
}

/* -------------------------------------------------------------- pages --- */
const files = await walk(OUT);
const html = files.filter((f) => f.endsWith('.html'));

const REQUIRED = [
  'index.html',
  'listings/index.html',
  'buy/index.html',
  'sell/index.html',
  'neighbourhoods/index.html',
  'guides/index.html',
  'about/index.html',
  'contact/index.html',
  'privacy/index.html',
  'terms/index.html',
  '404.html',
  'sitemap.xml',
  'robots.txt',
  'llms.txt',
  'feed.xml',
  '_headers',
  'assets/styles.css',
  'assets/app.js',
  'assets/analytics.js',
  'assets/favicon.svg',
];

for (const r of REQUIRED) {
  if (!files.includes(join(OUT, r))) fail(`missing ${r}`);
}
if (!failures) pass(`${REQUIRED.length} required files present (${html.length} pages total)`);

/* ------------------------------------------------------ per-page rules --- */
const PLACEHOLDERS = /lorem ipsum|your name here|TODO|FIXME|console\.log|localhost|dev\.local/i;
const pages = new Map();

for (const f of html) {
  pages.set(f, await readFile(f, 'utf8'));
}

for (const [f, src] of pages) {
  const name = relative(OUT, f);

  if (!/<title>[^<]{10,}<\/title>/.test(src)) fail(`${name}: missing or short <title>`);
  if (!/<meta name="description" content="[^"]{50,}"/.test(src)) fail(`${name}: weak meta description`);
  if (!src.includes('<link rel="canonical"')) fail(`${name}: no canonical link`);
  if (!src.includes('og:image')) fail(`${name}: no OpenGraph image`);
  if (!src.includes('application/ld+json')) fail(`${name}: no structured data`);
  if ((src.match(/<h1/g) || []).length !== 1) fail(`${name}: expected exactly one <h1>`);
  if (!src.includes('<main id="main">')) fail(`${name}: no <main> landmark`);

  const hit = src.match(PLACEHOLDERS);
  if (hit) fail(`${name}: placeholder or debug text "${hit[0]}"`);

  // Every <img> needs an alt attribute; decorative ones use alt="".
  for (const tag of src.match(/<img\b[^>]*>/g) || []) {
    if (!/\salt=/.test(tag)) fail(`${name}: <img> without alt — ${tag.slice(0, 90)}`);
  }

  // target="_blank" must carry rel="noopener".
  for (const tag of src.match(/<a\b[^>]*target="_blank"[^>]*>/g) || []) {
    if (!/rel="[^"]*noopener/.test(tag)) fail(`${name}: target=_blank without rel=noopener`);
  }

  // Structured data must parse.
  for (const block of src.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || []) {
    const body = block.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
    try {
      JSON.parse(body.replace(/\\u003c/g, '<'));
    } catch (e) {
      fail(`${name}: invalid JSON-LD — ${e.message}`);
    }
  }
}
if (!failures) pass('every page has title, description, canonical, OG, JSON-LD, one h1, alt text');

/* ------------------------------------------------------ internal links --- */
const exists = async (p) => {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
};

const checked = new Set();
let linkCount = 0;
// When built for a subdirectory the prefix is part of every link but not of
// the on-disk path, so strip it before resolving.
const BASE = (process.env.BASE_PATH || '').replace(/\/+$/, '');
const unbase = (h) => (BASE && h.startsWith(BASE + '/') ? h.slice(BASE.length) : h);

for (const [f, src] of pages) {
  for (const m of src.matchAll(/href="(\/[^"#?]*)/g)) {
    const href = m[1];
    if (checked.has(href)) continue;
    checked.add(href);
    linkCount++;
    const path = unbase(href);
    const target = path.endsWith('/') ? join(OUT, path, 'index.html') : join(OUT, path);
    if (!(await exists(target))) fail(`broken internal link: ${href} (first seen in ${relative(OUT, f)})`);
  }
}
if (!failures) pass(`${linkCount} unique internal links all resolve`);

/* ------------------------------------------------------------- headers --- */
{
  const h = await readFile(join(OUT, '_headers'), 'utf8');
  for (const directive of [
    'Strict-Transport-Security',
    'X-Content-Type-Options',
    'X-Frame-Options',
    'Referrer-Policy',
    'Permissions-Policy',
    'Content-Security-Policy',
  ]) {
    if (!h.includes(directive)) fail(`_headers missing ${directive}`);
  }
  if (h.includes("script-src 'self' 'unsafe-inline'")) fail("_headers: script-src allows 'unsafe-inline'");
  if (!h.includes("frame-ancestors 'none'")) fail('_headers: no frame-ancestors');
  if (!failures) pass('security headers present and script-src has no unsafe-inline');
}

/* -------------------------------------------------------------- sitemap --- */
{
  const xml = await readFile(join(OUT, 'sitemap.xml'), 'utf8');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.ok(locs.length >= 20, `sitemap has only ${locs.length} urls`);
  for (const loc of locs) {
    if (!/^https:\/\//.test(loc)) fail(`sitemap url is not https: ${loc}`);
    if (loc.includes('404')) fail('sitemap lists the 404 page');
  }
  const robots = await readFile(join(OUT, 'robots.txt'), 'utf8');
  if (!robots.includes('Sitemap:')) fail('robots.txt does not point at the sitemap');
  if (!failures) pass(`sitemap lists ${locs.length} https urls, robots.txt links it`);
}

/* ------------------------------------------------------------ listings --- */
{
  const { listings } = JSON.parse(await readFile('data/listings.json', 'utf8'));
  const slugs = new Set();
  for (const l of listings) {
    if (slugs.has(l.slug)) fail(`duplicate listing slug: ${l.slug}`);
    slugs.add(l.slug);
    if (!/^[a-z0-9-]+$/.test(l.slug)) fail(`unsafe slug: "${l.slug}"`);
    if (!(await exists(join(OUT, 'listings', l.slug, 'index.html')))) fail(`no page built for ${l.slug}`);
    if (l.status === 'sold' && !l.soldPrice) fail(`${l.slug}: sold with no soldPrice`);
    if (!l.images.length) fail(`${l.slug}: no images`);
  }
  if (!failures) pass(`${listings.length} listings each have a page, unique safe slug, and photos`);
}

/* ------------------------------------------------- pre-launch blockers --- */
// These are configuration, not code defects, so they are reported once and
// only fail the run under `--strict` (what CI uses before a production deploy).
{
  const site = JSON.parse(await readFile('data/site.json', 'utf8'));
  const blockers = [];
  if (site.forms.accessKey.startsWith('REPLACE_'))
    blockers.push('data/site.json forms.accessKey is a placeholder — no form will deliver');
  if (!site.forms.turnstileSiteKey)
    blockers.push('no Turnstile site key — forms rely on the honeypot alone for spam defence');
  if (!site.analytics.endpoint && !site.analytics.ga4Id && !site.analytics.plausibleDomain)
    blockers.push('no analytics destination configured — events are collected but discarded');
  if (site.url.includes('example') || !site.url.startsWith('https://'))
    blockers.push('site.url is not a real https origin');

  if (blockers.length) {
    console.log('');
    for (const b of blockers) console.log('TODO  ' + b);
    if (process.argv.includes('--strict')) {
      console.error(`\n${blockers.length} pre-launch item(s) unresolved (--strict)`);
      process.exit(1);
    }
  } else {
    pass('pre-launch configuration complete');
  }
}

/* ----------------------------------------------------------------------- */
console.log('');
if (failures) {
  console.error(`${failures} check(s) failed`);
  process.exit(1);
}
console.log('all checks passed');
