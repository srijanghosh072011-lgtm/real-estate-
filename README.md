# Everline Property Group — real estate site

A static, zero-dependency real estate website for a Regina, SK brokerage.
Content lives in JSON, `build.mjs` turns it into plain HTML, and the output is a
folder you can drop on Cloudflare Pages, Netlify or Vercel.

No framework, no bundler, no CMS to patch. 27 pages build in well under a second.

```bash
node build.mjs          # -> dist/
node scripts/check.mjs  # SEO, links, a11y, headers, listing integrity
node scripts/e2e.mjs    # browser checks (filters, calculator, forms, menu)
npm run serve           # build + serve on :4173
```

## Seeing the site

**It is served by GitHub Pages from this branch.** The built pages are
committed at the repository root — `index.html`, `assets/`, `listings/`,
`buy/`, `sell/` and the rest — which is what Pages serves in its default
"Deploy from a branch" mode. No workflow, no settings to change.

Those root files are **generated**. Never hand-edit them; they are overwritten.
Source lives in `data/`, `src/`, `public/` and `scripts/`. After changing any
of it:

```bash
npm run pages     # rebuild and refresh the copies at the repository root
git add -A && git commit -m "rebuild" && git push
```

`scripts/build-pages.mjs` tracks what it wrote in `.pages-manifest`, so a page
you delete is removed from the root on the next run instead of lingering.

Links are relative, so the same files work at `user.github.io`, at
`user.github.io/repo/`, and by double-clicking `index.html` with no server.

GitHub Pages cannot serve the `_headers` file, so HSTS and the CSP are **not**
applied there — it is fine for viewing and sharing, but see `SECURITY.md`
before treating it as the production host.

## Other ways to run it

**Locally:** `npm run serve`, then open <http://localhost:4173>. Nothing else needed.

**With no server at all:** build with relative links and double-click the result.

```bash
RELATIVE=1 node build.mjs      # then open dist/index.html in a browser
```

Every root-absolute link becomes a relative one computed from the page's depth,
and directory URLs get an explicit `index.html`, so the whole site clicks
through straight off the filesystem.

**As a shareable hosted preview:** `node scripts/artifact-build.mjs` (after a
`RELATIVE=1` build) produces a copy for a sandbox that only serves same-origin
images — the Unsplash photography is swapped for generated SVG art in the brand
palette and the map embeds become styled placeholders. Layout, type and every
interaction are the real thing; the photography is not. The normal build keeps
the real photography.

**On GitHub Pages:** `.github/workflows/pages.yml` builds and publishes on every
push to `main` or a `claude/**` branch. Enable it once at **Settings → Pages →
Source → GitHub Actions**, then the URL appears in the workflow run.

If Pages shows this README instead of the site, Pages is set to
"Deploy from a branch" — it finds no `index.html` at the repo root (the build
output is `dist/`, which is gitignored) and falls back to rendering `README.md`.
Switching the source to GitHub Actions fixes it.

A project repo is served from `https://<user>.github.io/<repo>/`, not from the
origin root, so the build takes a `BASE_PATH`:

```bash
BASE_PATH=/real-estate- node build.mjs   # rewrites every root-absolute href/src
```

The workflow derives that from the repository name automatically. Without it
every stylesheet, script and link 404s and you get an unstyled wall of text.
`check.mjs`, `e2e.mjs` and `shots.mjs` all honour `BASE_PATH` too, so the
subdirectory build is tested exactly as it deploys.

GitHub Pages is a **preview only** — it cannot serve the `_headers` file, so
HSTS and the CSP are not applied there. Production belongs on Cloudflare Pages
or Netlify, which is what `sync-and-deploy.yml` targets.

## Layout

```
data/site.json          brand, contact, stats, testimonials, FAQs, neighbourhoods
data/listings.json      every property — the only file a listing sync touches
data/posts.json         guides and market reports
src/layout.mjs          <head>, nav, footer, JSON-LD graph
src/components.mjs      cards, FAQ, testimonials, lead forms
src/pages.mjs           one function per page type
build.mjs               renders dist/, sitemap, robots, llms.txt, feed, _headers
public/assets/          styles.css, app.js, analytics.js (copied verbatim)
scripts/sync-listings.mjs   pulls listings from a CREA DDF® / IDX feed
scripts/check.mjs       build verification
scripts/e2e.mjs         browser verification
scripts/shots.mjs       screenshots at 1440px and 390px
```

## Pages

Home, listings index (client-side filtering), a page per listing, buy, sell,
neighbourhoods, guides index, a page per guide, about, contact, privacy, terms, 404.

## How listings get onto the site

Three options, in ascending order of automation.

**1. By hand.** Edit `data/listings.json`, run the build, deploy. Fine for an
agent carrying fewer than a dozen of their own listings. The shape is documented
by the existing entries; `scripts/check.mjs` will tell you if you break one.

**2. Automatically, from the MLS® (recommended).** Canadian listing data comes
from two places:

- **CREA DDF®** — the national Data Distribution Facility. Any REALTOR® can
  enable it from their CREA account and push their own listings (plus the
  national pool that other brokerages have opted in) to third-party sites. This
  is the cheap, simple path and it is what most single-agent sites use.
- **Board IDX/VOW** — a direct feed from the Saskatchewan REALTORS® Association,
  which carries the full local board inventory rather than the opt-in pool. More
  complete, more paperwork, a per-board fee.

Either way you end up with an HTTPS endpoint returning listing records.
`scripts/sync-listings.mjs` fetches it, maps the fields, validates, and rewrites
`data/listings.json`:

```bash
DDF_URL=... DDF_USER=... DDF_PASS=... node scripts/sync-listings.mjs
```

Point `mapRecord()` at whatever field names your vendor actually returns —
that function is the only thing that changes between feed providers.

**3. On a schedule.** `.github/workflows/sync-and-deploy.yml` runs the sync at
:05 and :35 past every hour (matching how often DDF boards refresh), commits any
change to `data/listings.json`, rebuilds, runs the verification suite, and
deploys. Add `DDF_URL` as a repository variable and `DDF_USER` / `DDF_PASS` as
secrets and it runs itself. With no feed configured the workflow skips the sync
step and simply builds and deploys on push.

Listings marked `"featured": true` by hand keep that flag across syncs — the
sync will not clobber a manual curation decision.

## What else is automated

| Thing | How |
|---|---|
| Listing data | DDF/IDX sync on a cron, auto-commit, auto-deploy |
| Sitemap, robots, RSS, `llms.txt` | Regenerated from content on every build |
| Structured data | Derived from the JSON; no hand-written schema markup |
| Lead delivery | Form processor → office inbox, with page/referrer/campaign attribution attached |
| Property alerts | Captured on the listings page, fulfilled from the criteria field |
| Deploy | Push to `main`, or the cron job |
| Verification | `check.mjs` + `e2e.mjs` run in CI before anything ships |

What is deliberately *not* automated: listing descriptions and photography.
Feed remarks are usually poor and the honest write-ups are the reason this site
converts.

## SEO, AEO and GEO

- Per-page `<title>`, meta description, canonical, OpenGraph and Twitter cards.
- A single JSON-LD `@graph` per page: `RealEstateAgent` plus `WebSite`,
  `BreadcrumbList`, `ItemList`, `Residence`/`Product` with `Offer`, `FAQPage`,
  `HowTo`, `Article`, `Person` as appropriate.
- Geo meta (`geo.region`, `geo.position`, ICBM) and `areaServed` for local search.
- `sitemap.xml` with per-page change frequency and priority, `robots.txt`
  explicitly welcoming GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot and
  Google-Extended, and `feed.xml`.
- `llms.txt` — a plain-text brief of the brokerage, its key pages, citable
  figures and every FAQ answer, so answer engines quote the site accurately
  rather than paraphrasing a page they half-parsed.
- Content written to be quotable: specific numbers, real trade-offs, direct
  answers under question-shaped headings. That is what gets cited.
- Semantic HTML, one `h1` per page, breadcrumbs, descriptive alt text.
  `check.mjs` fails the build if any of that regresses.

## Analytics

`public/assets/analytics.js` is first-party and cookie-free. It records:

- pageviews, time on page, scroll depth at 25/50/75/100%
- which sections were actually reached (`section_view`)
- listing clicks, guide clicks, FAQ opens, gallery interactions, phone and
  email taps, outbound clicks
- filter combinations and how many results they returned
- form starts vs. submissions vs. failures, per form

Events batch and flush via `sendBeacon`. Set `analytics.endpoint` in
`data/site.json` to receive them; set `analytics.ga4Id` or
`analytics.plausibleDomain` and the same events mirror there. Do Not Track and
Global Privacy Control are honoured — with either set, nothing is recorded.

The useful reports this gives you: which neighbourhoods people filter for
(build content for those), where on a listing page people stop scrolling, which
forms get started and abandoned, and which guide drives the most showing requests.

Call `window.track('name', { ... })` to add an event anywhere.

## Configuration

Everything the browser needs is in `data/site.json`. Before launch:

- `forms.accessKey` — Web3Forms (or swap `forms.endpoint` for Formspree/Netlify)
- `forms.turnstileSiteKey` — Cloudflare Turnstile; the honeypot works without it
- `analytics.endpoint` / `ga4Id` / `plausibleDomain`
- `url` — the real origin; it drives canonicals, the sitemap and schema

`scripts/check.mjs --strict` fails while any of those is unset, so a
half-configured site cannot deploy. Feed credentials go in `.env` (see
`.env.example`) and never in `data/site.json`.

`build.mjs` generates `_headers` from that config, so the Content-Security-Policy
lists exactly the third-party hosts in use and nothing more. Adding an analytics
vendor updates the CSP automatically.

## Before launch

See `SECURITY.md`. The items the code already handles are ticked; the rest are
DNS, hosting and account tasks that cannot be done from a repository.
