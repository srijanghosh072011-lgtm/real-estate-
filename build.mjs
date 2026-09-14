#!/usr/bin/env node
// Static site build. No dependencies — node >= 18 only.
// Usage: node build.mjs                      (output: dist/, served at /)
//        BASE_PATH=/repo-name node build.mjs (served from a subdirectory)

import { readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { page, esc } from './src/layout.mjs';
import * as P from './src/pages.mjs';

const OUT = 'dist';
const json = async (p) => JSON.parse(await readFile(p, 'utf8'));
const today = () => new Date().toISOString().slice(0, 10);

// Templates always write root-absolute links (/assets/…, /listings/…). Two
// deploy shapes need something else, so the finished HTML is rewritten once.
// ponytail: one regex at the end beats threading a base path through 3 modules.
//
//   BASE_PATH=/repo   GitHub Pages project site, served from a subdirectory
//   RELATIVE=1        no server at all — open dist/index.html by double-clicking
const BASE = (process.env.BASE_PATH || '').replace(/\/+$/, '');
const RELATIVE = !!process.env.RELATIVE;

const LINK = /\b(href|src|action)="\/(?!\/)([^"]*)"/g;

/**
 * @param {string} html
 * @param {string} file - output path, e.g. "listings/foo/index.html"
 */
function rebase(html, file) {
  if (RELATIVE) {
    // "listings/foo/index.html" sits two directories deep, so root is "../../".
    const depth = file.split('/').length - 1;
    const up = depth ? '../'.repeat(depth) : '';
    return html.replace(LINK, (_, attr, rest) => {
      // Split off ?query / #fragment so only the path part gets index.html.
      const cut = rest.search(/[?#]/);
      let path = cut === -1 ? rest : rest.slice(0, cut);
      const tail = cut === -1 ? '' : rest.slice(cut);
      // A directory URL has no file to open over file://; name it explicitly.
      if (path === '' || path.endsWith('/')) path += 'index.html';
      return `${attr}="${up}${path}${tail}"`;
    });
  }
  return BASE ? html.replace(LINK, (_, attr, rest) => `${attr}="${BASE}/${rest}"`) : html;
}

async function emit(path, html) {
  const file = join(OUT, path);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, rebase(html, path));
}

const render = (site, spec) => page({ ...spec, site });

/** Cloudflare Pages / Netlify `_headers`. CSP lists only hosts the site really uses. */
function headers(site) {
  const formHost = new URL(site.forms.endpoint).origin;
  const connect = ["'self'", formHost];
  const script = ["'self'"];
  const frame = ['https://www.google.com'];

  if (site.analytics.endpoint) connect.push(new URL(site.analytics.endpoint).origin);
  if (site.analytics.ga4Id) {
    script.push('https://www.googletagmanager.com');
    connect.push('https://www.google-analytics.com', 'https://region1.google-analytics.com');
  }
  if (site.analytics.plausibleDomain) {
    script.push('https://plausible.io');
    connect.push('https://plausible.io');
  }
  if (site.forms.turnstileSiteKey) {
    script.push('https://challenges.cloudflare.com');
    frame.push('https://challenges.cloudflare.com');
  }

  const csp = [
    "default-src 'self'",
    `script-src ${script.join(' ')}`,
    // ponytail: 'unsafe-inline' for style-src only. Removing it means hashing the
    // handful of inline `style="--i:n"` stagger hooks; not worth a build step yet.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https://images.unsplash.com https://maps.gstatic.com https://*.googleapis.com",
    `connect-src ${connect.join(' ')}`,
    `frame-src ${frame.join(' ')}`,
    `form-action 'self' ${formHost}`,
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');

  return `/*
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), camera=(), microphone=(), payment=(), usb=(), interest-cohort=()
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin
  Content-Security-Policy: ${csp}

/assets/*
  Cache-Control: public, max-age=31536000, immutable
`;
}

function sitemap(site, urls) {
  const body = urls
    .map(
      (u) =>
        `  <url><loc>${esc(site.url + u.path)}</loc><lastmod>${u.lastmod}</lastmod><changefreq>${u.freq}</changefreq><priority>${u.pri}</priority></url>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

function robots(site) {
  return `User-agent: *
Allow: /
Disallow: /404.html

# Answer engines and AI crawlers are welcome on the public content.
User-agent: GPTBot
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Google-Extended
Allow: /

Sitemap: ${site.url}/sitemap.xml
`;
}

/** llms.txt — a plain-text brief for answer engines (GEO/AEO). */
function llms(site, listings, posts, landings = []) {
  const active = listings.filter((l) => l.status === 'for-sale');
  return `# ${site.name}

> ${site.description}

${site.name} is a real estate brokerage in ${site.city}, ${site.region}, Canada, founded ${site.founded}.
Broker of record: ${site.agent.name}, ${site.agent.title}. ${site.agent.licence}.
Phone: ${site.contact.phoneDisplay}. Email: ${site.contact.email}.
Office: ${site.contact.street}, ${site.contact.locality}, ${site.region} ${site.contact.postalCode}.
Areas served: ${site.serviceAreas.join(', ')}.

## Key pages
- [Regina MLS listings](${site.url}/listings/): ${active.length} active properties, filterable by price, type, bedrooms and neighbourhood.
- [Buying a home in Regina](${site.url}/buy/): the six-stage process, timelines, and a Canadian mortgage calculator.
- [Selling a home in Regina](${site.url}/sell/): free comparable-based valuation, published commission schedule, what marketing is included.
- [Neighbourhood guide](${site.url}/neighbourhoods/): ${site.neighbourhoods.map((n) => n.name).join(', ')}, with median prices and honest trade-offs.
- [Guides and market reports](${site.url}/guides/): ${posts.length} articles, ungated.
- [Contact](${site.url}/contact/)

## Search landing pages
${landings.map((l) => `- [${l.h1.replace(/&amp;/g, '&')}](${site.url}/regina/${l.slug}/): ${l.description}`).join('\n')}

## Facts worth citing
${site.stats.map((s) => `- ${s.value} — ${s.label}`).join('\n')}
- No land transfer tax in Saskatchewan; title registration fee instead.
- Median prices by area: ${site.neighbourhoods.map((n) => `${n.name} $${n.medianPrice.toLocaleString('en-CA')}`).join('; ')}.

## Common questions
${site.faqs.map((f) => `### ${f.q}\n${f.a}`).join('\n\n')}

## Terms
Listing data originates from the MLS® System and is deemed reliable but not guaranteed.
MLS®, REALTOR® and associated logos are trademarks of The Canadian Real Estate Association.
`;
}

function feed(site, posts) {
  const items = posts
    .map(
      (p) => `  <item>
    <title>${esc(p.title)}</title>
    <link>${site.url}/guides/${p.slug}/</link>
    <guid isPermaLink="true">${site.url}/guides/${p.slug}/</guid>
    <pubDate>${new Date(p.date + 'T12:00:00Z').toUTCString()}</pubDate>
    <category>${esc(p.category)}</category>
    <description>${esc(p.excerpt)}</description>
  </item>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>${esc(site.name)} — Guides &amp; Market Reports</title>
  <link>${site.url}/guides/</link>
  <description>${esc(site.description)}</description>
  <language>en-ca</language>
${items}
</channel></rss>
`;
}

const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="14" fill="#14150f"/>
<path d="M20 44V24l12-8 12 8v20" fill="none" stroke="#c9d4bd" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M26 44V34h12v10" fill="none" stroke="#c9d4bd" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

async function main() {
  const site = await json('data/site.json');
  const { listings } = await json('data/listings.json');
  const posts = (await json('data/posts.json')).sort((a, b) => b.date.localeCompare(a.date));
  const landings = await json('data/landings.json');
  // The footer links these sitewide, so every landing page is one hop from any page.
  site.landings = landings;

  // Where the site will actually live. Drives canonicals, OpenGraph, the sitemap
  // and the JSON-LD graph, so it has to be the real public URL including any
  // subdirectory. SITE_URL overrides data/site.json without editing content.
  site.url = (process.env.SITE_URL || site.url).replace(/\/+$/, '');

  // Newest first, sold last: the default order the listings page ships with.
  const rank = { 'for-sale': 0, pending: 1, sold: 2 };
  listings.sort((a, b) => rank[a.status] - rank[b.status] || b.listedOn.localeCompare(a.listedOn));

  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const urls = [];
  const write = async (spec, freq = 'monthly', pri = '0.6', lastmod = today()) => {
    const path = spec.path === '/404.html' ? '/404.html' : spec.path;
    const file = path === '/404.html' ? '404.html' : path.replace(/^\//, '') + 'index.html';
    await emit(file, render(site, spec));
    if (path !== '/404.html') urls.push({ path, freq, pri, lastmod });
  };

  await write(P.home(site, listings, posts), 'daily', '1.0');
  await write(P.listingsIndex(site, listings), 'hourly', '0.9');
  await write(P.buy(site, listings), 'monthly', '0.8');
  await write(P.sell(site, listings), 'monthly', '0.8');
  await write(P.neighbourhoods(site, listings), 'monthly', '0.7');
  await write(P.guidesIndex(site, posts), 'weekly', '0.7');
  await write(P.about(site), 'yearly', '0.6');
  await write(P.contact(site), 'yearly', '0.6');
  await write(P.privacy(site), 'yearly', '0.2');
  await write(P.terms(site), 'yearly', '0.2');
  await write(P.notFound(site, listings));

  for (const l of listings) {
    await write(P.listingDetail(site, l, listings), 'daily', l.featured ? '0.8' : '0.7', l.listedOn);
  }
  for (const p of posts) {
    await write(P.guideDetail(site, p, posts), 'monthly', '0.6', p.updated);
  }
  for (const l of landings) {
    await write(P.landing(site, l, listings, landings), 'weekly', '0.8');
  }

  await cp('public', OUT, { recursive: true });
  await writeFile(join(OUT, 'assets/favicon.svg'), FAVICON);
  await writeFile(join(OUT, 'sitemap.xml'), sitemap(site, urls));
  await writeFile(join(OUT, 'robots.txt'), robots(site));
  await writeFile(join(OUT, 'llms.txt'), llms(site, listings, posts, landings));
  await writeFile(join(OUT, 'feed.xml'), feed(site, posts));
  await writeFile(join(OUT, '_headers'), headers(site));
  await writeFile(join(OUT, '_redirects'), '/home  /  301\n/index.html  /  301\n/blog/*  /guides/:splat  301\n');
  // Without this GitHub Pages runs Jekyll, which silently drops _headers.
  await writeFile(join(OUT, '.nojekyll'), '');

  console.log(`built ${urls.length + 1} pages -> ${OUT}/${BASE ? ` (base path ${BASE}/)` : ''}`);
  if (site.forms.accessKey.startsWith('REPLACE_')) {
    console.warn('WARNING: data/site.json still has a placeholder form access key. Forms will not deliver.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
