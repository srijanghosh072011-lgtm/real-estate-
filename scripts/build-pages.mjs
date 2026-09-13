#!/usr/bin/env node
/**
 * Build the site and copy it to the repository root, where GitHub Pages
 * serves it in "Deploy from a branch" mode.
 *
 *   npm run pages
 *
 * Uses relative links, so the same files work at a user site
 * (user.github.io), a project site (user.github.io/repo/), and from the
 * filesystem by double-clicking index.html. Nothing to configure.
 *
 * Source lives in data/, src/, public/ and scripts/. Everything this writes
 * is generated — never hand-edit the copies at the root, they are overwritten
 * on the next run.
 */

import { cp, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const OUT = 'dist';
const ROOT = '.';

// Anything at the root that is source, config or tooling. Never touched.
const KEEP = new Set([
  '.git', '.github', '.gitignore', '.env', '.env.example',
  'README.md', 'SECURITY.md', 'package.json', 'package-lock.json',
  'build.mjs', 'src', 'data', 'scripts', 'public', 'node_modules',
  'dist', 'shots', '.claude', '.agents', 'skills-lock.json',
]);

const entries = await readdir(OUT, { withFileTypes: true });

// Clear the previous publish so a deleted page does not linger at the root.
const MANIFEST = '.pages-manifest';
let previous = [];
try {
  previous = (await import('node:fs')).readFileSync(MANIFEST, 'utf8').split('\n').filter(Boolean);
} catch {
  /* first run */
}
for (const name of previous) {
  if (KEEP.has(name)) continue;
  await rm(join(ROOT, name), { recursive: true, force: true });
}

const copied = [];
for (const e of entries) {
  if (KEEP.has(e.name)) {
    console.warn(`skipped ${e.name}: name collides with repository source`);
    continue;
  }
  await cp(join(OUT, e.name), join(ROOT, e.name), { recursive: true });
  copied.push(e.name);
}

await writeFile(MANIFEST, copied.sort().join('\n') + '\n');

console.log(`published ${copied.length} entries to the repository root`);
console.log('commit them and GitHub Pages (branch mode) will serve the site');
