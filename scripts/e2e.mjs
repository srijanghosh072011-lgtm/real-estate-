#!/usr/bin/env node
/**
 * Browser checks for the behaviour that static analysis cannot see:
 * the mobile menu, listing filters, the mortgage calculator, and form
 * validation. Run after `node build.mjs`.
 *
 *   CHROME_PATH=/path/to/chrome node scripts/e2e.mjs
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
// Mirror a subdirectory deploy: links carry the prefix, dist/ does not.
const BASE = (process.env.BASE_PATH || '').replace(/\/+$/, '');
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (BASE && p.startsWith(BASE + '/')) p = p.slice(BASE.length);
  if (p.endsWith('/')) p += 'index.html';
  try {
    const buf = await readFile(join('dist', p));
    res.writeHead(200, { 'Content-Type': TYPES[extname(p)] || 'text/plain' });
    res.end(buf);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

const PORT = 4175;
const url = (p) => `http://127.0.0.1:${PORT}${BASE}${p}`;
await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

// External assets are irrelevant to behaviour and may be blocked; drop them.
await page.route('**://*/**', (route) =>
  new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort()
);

const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

const ok = (m) => console.log('ok    ' + m);

/* ------------------------------------------------------------- filters --- */
await page.goto(url('/listings/'), { waitUntil: 'load' });
const total = Number(await page.locator('#count').textContent());
assert.ok(total >= 10, `expected 10+ listings, saw ${total}`);

await page.selectOption('#filters select[name="type"]', 'condo');
await page.waitForFunction((t) => Number(document.querySelector('#count').textContent) < t, total);
const condos = Number(await page.locator('#count').textContent());
assert.ok(condos > 0 && condos < total, `condo filter gave ${condos} of ${total}`);
const visibleTypes = await page.$$eval('.listing-card:not([hidden])', (els) => els.map((e) => e.dataset.type));
assert.deepEqual([...new Set(visibleTypes)], ['condo'], 'condo filter leaked other property types');
assert.ok(new URL(page.url()).searchParams.get('type') === 'condo', 'filter state not written to the URL');
ok(`filters narrow ${total} listings to ${condos} condos and update the URL`);

// Impossible combination must show the empty state, not a blank grid.
await page.selectOption('#filters select[name="beds"]', '5');
await page.selectOption('#filters select[name="price"]', '0-250000');
await page.waitForSelector('#empty:not([hidden])');
ok('empty state appears when nothing matches');

await page.click('#filters button[type="reset"]');
await page.waitForFunction((t) => Number(document.querySelector('#count').textContent) === t, total);
ok('reset restores every listing');

// A deep link from the neighbourhood page must pre-seed the filters.
await page.goto(url('/listings/?hood=Cathedral'), { waitUntil: 'load' });
assert.equal(await page.inputValue('#filters select[name="hood"]'), 'Cathedral');
const hoods = await page.$$eval('.listing-card:not([hidden])', (els) => els.map((e) => e.dataset.hood));
assert.ok(hoods.length && hoods.every((h) => h === 'Cathedral'), 'hood deep link did not filter');
ok('?hood= deep links pre-seed the filters');

/* -------------------------------------------------------- price sorting --- */
await page.goto(url('/listings/'), { waitUntil: 'load' });
await page.selectOption('#filters select[name="sort"]', 'price-asc');
await page.waitForTimeout(150);
const prices = await page.$$eval('.listing-card:not([hidden])', (els) => els.map((e) => +e.dataset.price));
assert.deepEqual(prices, [...prices].sort((a, b) => a - b), 'price-asc did not sort ascending');
ok('sorting reorders the grid');

/* ---------------------------------------------------------- calculator --- */
await page.goto(url('/buy/'), { waitUntil: 'load' });
const readOut = () => page.locator('.calc [data-calc-out]').textContent();
const first = await readOut();
assert.match(first, /\$[\d,]+ \/ mo/, `calculator did not render a payment: ${first}`);
// $400k, 20% down, 4.49%, 25yr -> ~$1,772/mo on semi-annual compounding.
assert.ok(Math.abs(Number(first.replace(/[^0-9]/g, '')) - 1772) < 15, `unexpected payment ${first}`);

await page.fill('.calc [data-calc="rate"]', '7');
await page.waitForFunction((prev) => document.querySelector('.calc [data-calc-out]').textContent !== prev, first);
const higher = Number((await readOut()).replace(/[^0-9]/g, ''));
assert.ok(higher > 1772, 'raising the rate did not raise the payment');
ok(`calculator: ${first.trim()} at 4.49%, $${higher}/mo at 7%`);

/* --------------------------------------------------------------- forms --- */
await page.goto(url('/contact/'), { waitUntil: 'load' });
await page.click('#general-contact button[type="submit"]');
await page.waitForSelector('#general-contact .form-status.err');
assert.match(await page.locator('#general-contact .form-status').textContent(), /highlighted field/);
assert.equal(await page.getAttribute('#general-contact [name="name"]', 'aria-invalid'), 'true');
ok('empty form is blocked client-side and the bad field is marked');

// Hidden context fields must be populated for lead attribution.
assert.ok(
  (await page.inputValue('#general-contact [data-fill="page"]')).endsWith('/contact/'),
  'lead form did not record the submitting page'
);
ok('lead forms carry page attribution');

/* ---------------------------------------------------------- mobile nav --- */
const mob = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mpage = await mob.newPage();
await mpage.route('**://*/**', (route) =>
  new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort()
);
await mpage.goto(url('/'), { waitUntil: 'load' });
assert.ok(await mpage.locator('#mobile-menu').isHidden(), 'menu should start closed');
await mpage.click('.burger');
await mpage.waitForSelector('#mobile-menu:not([hidden])');
assert.equal(await mpage.getAttribute('.burger', 'aria-expanded'), 'true');
await mpage.keyboard.press('Escape');
await mpage.locator('#mobile-menu').waitFor({ state: 'hidden' });
assert.equal(await mpage.getAttribute('.burger', 'aria-expanded'), 'false');
ok('mobile menu opens, sets aria-expanded, and closes on Escape');

/* ------------------------------------------------------------ cleanup --- */
await browser.close();
server.close();

if (errors.length) {
  console.error('\nUncaught page errors:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('\nall browser checks passed');
