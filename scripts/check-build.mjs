#!/usr/bin/env node
/**
 * Pre-launch sweep over dist/. Run after `npm run build`.
 * Covers the mechanical half of SECURITY.md §9 and §10 so nobody has to
 * remember it: dead links, missing alt text, broken JSON-LD, leftover dev
 * strings, heading structure, thin meta descriptions.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
if (!existsSync(DIST)) {
  console.error('dist/ not found — run `npm run build` first.');
  process.exit(1);
}

const files = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    statSync(p).isDirectory() ? walk(p) : files.push(p);
  }
})(DIST);

const pages = files.filter((f) => f.endsWith('.html') && !f.includes('/admin/'));
const problems = [];
const warnings = [];
const add = (f, msg) => problems.push(`${f.replace(DIST + '/', '')}: ${msg}`);
const warn = (f, msg) => warnings.push(`${f.replace(DIST + '/', '')}: ${msg}`);

for (const file of pages) {
  const html = readFileSync(file, 'utf8');

  for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      JSON.parse(m[1]);
    } catch (e) {
      add(file, `invalid JSON-LD (${e.message})`);
    }
  }

  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    if (!/\balt=/.test(m[0])) add(file, `img without alt: ${m[0].slice(0, 80)}`);
  }

  for (const m of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) {
    if (!/noopener/.test(m[0])) add(file, 'target="_blank" without rel="noopener noreferrer"');
  }

  for (const leak of ['TODO', 'FIXME', 'Lorem ipsum', 'console.log', 'localhost']) {
    if (html.includes(leak)) add(file, `leftover string "${leak}"`);
  }

  // Not a build failure — a launch blocker. See SECURITY-CHECKLIST.md §5.
  if (html.includes('REPLACE_ME')) warn(file, 'form endpoint is still the placeholder');

  const h1s = (html.match(/<h1\b/g) || []).length;
  if (h1s !== 1) add(file, `${h1s} <h1> elements (expected exactly 1)`);

  if (!/<meta name="description" content="[^"]{50,}"/.test(html)) add(file, 'missing or thin meta description');
  if (!/<link rel="canonical"/.test(html)) add(file, 'missing canonical link');
}

// Internal links must resolve to something that was built.
const routes = new Set(pages.map((f) => '/' + f.replace(`${DIST}/`, '').replace(/\.html$/, '').replace(/^index$/, '')));
routes.add('/');
for (const file of pages) {
  for (const m of readFileSync(file, 'utf8').matchAll(/href="(\/[^"#?]*)"/g)) {
    const href = m[1].replace(/\/$/, '') || '/';
    if (routes.has(href) || existsSync(join(DIST, href.slice(1)))) continue;
    add(file, `dead internal link ${href}`);
  }
}

const uniqueWarnings = [...new Set(warnings)];
if (uniqueWarnings.length) {
  console.warn(`${uniqueWarnings.length} warning(s) — fix before launch:\n` + uniqueWarnings.join('\n') + '\n');
}

const unique = [...new Set(problems)];
if (unique.length) {
  console.error(`${unique.length} problem(s):\n` + unique.join('\n'));
  process.exit(1);
}
console.log(`ok — ${pages.length} pages checked.`);
