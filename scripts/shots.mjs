#!/usr/bin/env node
/** Dev-only: serve dist/ and screenshot key pages at desktop + phone widths. */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { chromium } from 'playwright';

const TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain', '.json': 'application/json',
};

const server = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  try {
    const buf = await readFile(join('dist', p));
    res.writeHead(200, { 'Content-Type': TYPES[extname(p)] || 'application/octet-stream' });
    res.end(buf);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end(await readFile('dist/404.html').catch(() => 'not found'));
  }
});

const PORT = 4173;
const PAGES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['/', '/listings/', '/listings/4118-sandpiper-crescent-east/', '/sell/', '/neighbourhoods/', '/guides/regina-market-report-september-2026/', '/contact/'];

await new Promise((r) => server.listen(PORT, r));
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const errors = [];

for (const [label, viewport] of [['desktop', { width: 1440, height: 1000 }], ['mobile', { width: 390, height: 844 }]]) {
  // reducedMotion disables the scroll-reveal transitions, otherwise a full-page
  // capture fires every IntersectionObserver at once and shoots mid-fade.
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  // Blocked third-party assets (fonts, Unsplash, maps) are environment noise,
  // not site defects — only surface script errors and layout problems.
  const NOISE = /Failed to load resource|ERR_TUNNEL|ERR_CONNECTION|net::/;
  page.on('console', (m) => {
    if (m.type() === 'error' && !NOISE.test(m.text())) errors.push(`${label} ${page.url()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`${label} ${page.url()}: ${e.message}`));

  for (const path of PAGES) {
    await page.goto(`http://127.0.0.1:${PORT}${path}`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(700);
    // Reveal animations are viewport-triggered; scroll through so nothing shoots blank.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight * 0.8) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(600);
    const name = (path === '/' ? 'home' : path.replace(/\//g, '-').replace(/^-|-$/g, '')).slice(0, 50);
    await page.screenshot({ path: `shots/${label}-${name}.png`, fullPage: true });

    // Horizontal overflow is the single most common responsive defect.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 2) errors.push(`${label} ${path}: horizontal overflow of ${overflow}px`);
  }
  await ctx.close();
}

await browser.close();
server.close();

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('screenshots written to shots/, no console errors, no horizontal overflow');
