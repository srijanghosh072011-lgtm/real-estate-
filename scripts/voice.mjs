#!/usr/bin/env node
/**
 * Voice check — flags the habits that make copy read as machine-written.
 *
 *   node scripts/voice.mjs
 *
 * None of these are wrong on their own. It is the density that gives it away:
 * an em dash in every paragraph, no contractions anywhere, and the same stock
 * phrase recycled across pages.
 */

import { readFile } from 'node:fs/promises';

const FILES = ['data/site.json', 'data/listings.json', 'data/posts.json', 'data/landings.json'];

// Words that show up far more in generated marketing copy than in speech.
const TELLS = [
  'genuinely', 'simply put', 'that said', 'at the end of the day', 'when it comes to',
  'in today', 'delve', 'navigate the', 'unlock', 'elevate', 'seamless', 'robust',
  'leverage', 'furthermore', 'moreover', 'it is worth noting', 'crucially',
  'importantly', 'a testament to', 'nestled', 'boasts', 'in the realm of',
  'first and foremost', 'rest assured', 'look no further', 'dive into',
  'game-changer', 'transformative', 'holistic', 'curated', 'bespoke',
  'the perfect blend', 'whether you are', 'peace of mind',
];

// Contractions vs the long forms they replace.
const SHORT = /\b(it's|that's|you're|we're|don't|doesn't|isn't|won't|can't|there's|they're|we've|you've|here's|didn't|wouldn't|couldn't|aren't|let's|you'll|we'll|they'll|i'm)\b/gi;
const LONG = /\b(it is|that is|you are|we are|do not|does not|is not|will not|cannot|there is|they are|we have|you have|here is|did not|would not|could not|are not|you will|we will|they will)\b/gi;

const strings = [];
for (const f of FILES) {
  const walk = (v) => {
    if (typeof v === 'string') strings.push({ f, v });
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(JSON.parse(await readFile(f, 'utf8')));
}

// Skip short labels and URLs; only judge real prose.
const prose = strings.filter((s) => s.v.split(/\s+/).length >= 12 && !s.v.startsWith('http'));
const text = prose.map((s) => s.v).join('\n');
const words = text.split(/\s+/).length;

const per1k = (n) => (n / words) * 1000;
const count = (re) => (text.match(re) || []).length;

const emDash = count(/—/g);
const shortForms = count(SHORT);
const longForms = count(LONG);
const contractionRate = shortForms / (shortForms + longForms || 1);

console.log(`${words.toLocaleString()} words of prose across ${FILES.length} content files\n`);

const report = [];
const line = (ok, label, detail) => {
  report.push(ok);
  console.log(`${ok ? 'ok  ' : 'FLAG'}  ${label.padEnd(34)} ${detail}`);
};

line(per1k(emDash) <= 4, 'em dashes per 1000 words', `${per1k(emDash).toFixed(1)} (${emDash} total, target ≤ 4)`);
line(contractionRate >= 0.4, 'contraction rate', `${(contractionRate * 100).toFixed(0)}% (${shortForms} short / ${longForms} long, target ≥ 40%)`);

const found = TELLS.filter((t) => new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(text));
line(found.length === 0, 'stock marketing phrases', found.length ? found.join(', ') : 'none');

// Sentence-length variety: uniform sentences are the strongest tell of all.
const lengths = text.split(/(?<=[.!?])\s+/).map((s) => s.split(/\s+/).length).filter((n) => n > 2);
const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
const sd = Math.sqrt(lengths.reduce((a, b) => a + (b - mean) ** 2, 0) / lengths.length);
line(sd >= 7, 'sentence length variation', `mean ${mean.toFixed(1)}, sd ${sd.toFixed(1)} (target sd ≥ 7)`);
line(lengths.filter((n) => n <= 6).length / lengths.length >= 0.1, 'short sentences (≤6 words)',
  `${((lengths.filter((n) => n <= 6).length / lengths.length) * 100).toFixed(0)}% (target ≥ 10%)`);

// Phrases reused verbatim across the site read as a template, because they are.
const shingles = new Map();
for (const { v } of prose) {
  const w = v.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
  for (let i = 0; i + 6 <= w.length; i++) {
    const key = w.slice(i, i + 6).join(' ');
    shingles.set(key, (shingles.get(key) || 0) + 1);
  }
}
// Three or more is a template smell. Twice is usually just the same real fact
// mentioned in two places, which is what a person writing about their own
// market actually does.
const repeats = [...shingles.entries()].filter(([, n]) => n > 2);
line(repeats.length === 0, 'phrases reused 3+ times',
  repeats.length ? repeats.slice(0, 3).map(([k, n]) => `"${k}" ×${n}`).join('; ') : 'none');

console.log('');
const flagged = report.filter((r) => !r).length;
if (flagged) {
  console.log(`${flagged} of ${report.length} checks flagged`);
  process.exit(1);
}
console.log('voice checks passed');
