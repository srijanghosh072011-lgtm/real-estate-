# Harbor Lane Realty — real estate agent site

A production-ready marketing and lead-generation site for a residential real estate
brokerage. Static output (Astro + Tailwind v4), no database, no server to patch.
Built to be re-skinned per client: everything brand-specific lives in
`src/data/site.ts` and `src/content/`.

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # → dist/
npm run preview
npm run import -- exports/listings.csv   # CSV → listing pages
```

---

## What is in here

| Page | Job it does |
|---|---|
| `/` | Hero, proof stats, services, featured listings, prep-cost argument, process, recent sales, neighborhoods, testimonials, guides, FAQ |
| `/sell` | Three-step valuation tool with an **instant estimate**, neighborhood price table, seller FAQ |
| `/buy` | Mortgage + closing-cost calculator, buying sequence, off-market alert signup, buyer FAQ |
| `/listings` | Filterable inventory (search, type, beds, max price), deep-linkable via `?q=&type=&beds=&max=` |
| `/listings/[slug]` | Full listing: gallery, spec table, highlights, payment estimate, sticky enquiry form, nearby homes |
| `/neighborhoods` + `/[slug]` | Local-SEO pages with real market figures per area |
| `/guides` + `/[slug]` | Articles with per-article FAQ blocks (the AEO/GEO engine) |
| `/about`, `/contact` | Team, licensing, fair-housing disclosure, map, hours |
| `/privacy`, `/terms`, `/accessibility` | Written to match what the site actually does |
| `/404`, `/thanks` | Recovery and post-conversion pages |
| `/llms.txt`, `/robots.txt`, `/sitemap-index.xml` | Machine-readable surface |

---

## How listings get added (the part clients always ask about)

Four routes, cheapest first. They all end at the same place: a markdown file in
`src/content/listings/`, validated against the schema in `src/content.config.ts`.

### 1. The agent fills in a form — `/admin`

[Sveltia CMS](https://github.com/sveltia/sveltia-cms) is wired up at `/admin`
(`public/admin/config.yml`). The agent signs in with GitHub, clicks **New listing**,
fills in price/beds/baths/photos, hits publish. That writes the markdown file, the
host rebuilds, and the listing is live in about a minute. No code, no deploy step,
no CMS server to keep patched.

To switch it on:

1. Set `backend.repo` in `public/admin/config.yml` to your `owner/repo`.
2. Public repo → Sveltia's hosted OAuth works out of the box.
   Private repo → deploy the one-file [Cloudflare Worker OAuth relay](https://github.com/sveltia/sveltia-cms-auth)
   and add `base_url` to the config.
3. Invite the agents as repo collaborators. Their edits land as commits, so every
   price change has an author and a timestamp.

### 2. Bulk import from a CSV — `npm run import`

`scripts/import-listings.mjs` turns any CSV export into listing files. Header names
are matched loosely, so `List Price`, `list_price` and `ListPrice` all work, and the
alias table at the top of the script is where you add anything unusual from your MLS,
Follow Up Boss, kvCORE or Sierra export.

```bash
npm run import -- exports/listings.csv --dry   # show what would change
npm run import -- exports/listings.csv          # write the files
node scripts/import-listings.mjs --selftest     # parser check
```

Rows that already match on disk are skipped, so re-running produces an empty diff.

### 3. Fully automated nightly sync — GitHub Actions

`.github/workflows/listings-sync.yml` runs the importer every morning against
whatever URL you put in the `LISTINGS_CSV_URL` secret and commits the diff. Until that
secret exists the job exits immediately, so it costs nothing.

A Google Sheet published to CSV (**File → Share → Publish to web → CSV**) is the
laziest real feed: the agent edits a spreadsheet, the site updates itself overnight.

### 4. Live MLS/IDX feed

When the brokerage wants true MLS syndication rather than a hand-maintained list,
point the same importer at a feed instead of a CSV. In the US that means one of:

- **RESO Web API** — the modern standard, an OData JSON feed from your MLS. Ask your
  MLS for Web API credentials; a vendor account is usually required.
- **Bridge Interactive** or **Spark API** (Zillow Group / FBS) — resell RESO feeds
  with friendlier auth and a free tier for single brokerages.
- **IDX Broker / Showcase IDX / Realtyna** — hosted widgets. Fastest to launch,
  but the listing pages live on their domain or in an iframe, so the SEO value
  goes to them, not to you. Use them only for full-market search, and keep your own
  listings native like they are here.

Write a `scripts/import-reso.mjs` alongside the CSV importer that fetches, maps and
writes the same markdown. Nightly is enough for most brokerages; hourly is trivial
if the MLS allows it. **Check your MLS IDX rules before syndicating** — most require
attribution, a disclaimer and a maximum refresh interval, and some prohibit indexing
other brokers' listings.

---

## What else is automated

| Automation | How it works here | What to wire up |
|---|---|---|
| Lead capture | Every form posts to `site.formEndpoint` with a honeypot, a sub-3-second submit trap and a consent checkbox | Formspree / Web3Forms / Netlify Forms — turn rate limiting on in their dashboard |
| Lead routing | Form provider emails the office inbox | Add a Zapier/Make hook: form → CRM (Follow Up Boss, kvCORE, HubSpot) → SMS to the on-duty agent |
| Instant valuation | Calculated in the browser from neighborhood $/sq ft and condition, and submitted with the lead so the agent sees what the visitor was told | Nothing — but keep the `pricePerSqft` figures current |
| Auto-responder | Form provider's own autoresponder | Two-minute "we got it" email, then a human reply |
| Listing pages | Markdown → static pages → sitemap → search engines | Nothing |
| Deploys | Push to `main` → host builds | Netlify / Cloudflare Pages / Vercel |
| Market figures | `src/content/neighborhoods/*.md` | Refresh monthly from your MLS report — 10 minutes |
| Analytics | `window.track()` fires on CTA clicks, phone/email taps, filter use, calculator use, valuation steps, form submits, scroll depth and 30s engagement | Set `analytics.plausibleDomain` or `analytics.ga4Id` |
| Uptime | — | UptimeRobot / BetterStack free tier on the homepage |
| Reviews | — | Post-closing Zapier: closing date + 3 days → review request email |

---

## SEO, AEO and GEO

**Technical SEO.** Canonical URLs, per-page titles and descriptions, OpenGraph and
Twitter cards, `sitemap-index.xml`, semantic landmarks, one `<h1>` per page,
descriptive alt text, 90+ Lighthouse structure, self-hosted fonts (no third-party
font domain), lazy-loaded below-the-fold images with explicit dimensions.

**Structured data** (JSON-LD, one `@graph` per page): `RealEstateAgent` with NAP,
hours, service areas and `AggregateRating`; `WebSite` with `SearchAction`;
`BreadcrumbList`; `SingleFamilyResidence` + `Offer` per listing; `Place` per
neighborhood; `Article` + `FAQPage` per guide; `Service` on buy/sell; `Person` per
agent.

**AEO (answer engines).** Every FAQ answer is written to be lifted verbatim: a direct
answer in the first sentence, then the number or caveat. FAQ blocks are on the home,
buy, sell and guide pages, and all of them emit `FAQPage` schema.

**GEO (generative engines).** `/llms.txt` is generated at build time from the same
content the site renders — figures, current listings, neighborhood stats, FAQs and
explicit caveats for models ("this is an estimate, not an appraisal"; "we do not
provide demographic characterisations"). `robots.txt` explicitly welcomes GPTBot,
ClaudeBot, PerplexityBot, OAI-SearchBot and Google-Extended, and blocks the SEO
scrapers that only take.

**Local.** City and neighborhood pages carry real numbers, `geo.*` meta tags,
service-area lists in the footer and schema. Pair with a Google Business Profile
using the identical NAP string — inconsistent NAP is the most common local-SEO
self-inflicted wound.

Post-launch, in order: verify in Google Search Console, submit the sitemap, claim
the Google Business Profile, then Bing Webmaster Tools.

---

## Analytics

`src/components/Analytics.astro` loads Plausible (cookieless, GDPR-friendly, no
banner needed) and/or GA4, then installs one event layer that feeds whichever is
present:

| Event | Fires on |
|---|---|
| `CTA click` | Any `[data-track]` button, with a label |
| `Phone click` / `Email click` | `tel:` and `mailto:` links anywhere |
| `Listing click` | A listing card title |
| `Listing filter` | Filter changes on `/listings` |
| `Calculator used` | Mortgage calculator interaction |
| `Valuation step` / `Valuation estimate` | Progress through the valuation tool |
| `Lead submitted` / `Lead confirmed` | Form submit, and the `/thanks` page |
| `Scroll depth` | 25 / 50 / 75 / 100% |
| `Engaged 30s` | 30 seconds on a page |

Add your own with `data-track="Event name" data-track-label="…"` on any element.
Nothing personal is sent: names and emails typed into forms never pass through this
layer.

---

## Security

Follow `SECURITY.md`. Status of each item is in `SECURITY-CHECKLIST.md` — what the
code already handles, and what only you can do (DNS, DMARC, host settings).

Shipped here: CSP and the full header set in `public/_headers` (Netlify / Cloudflare
Pages) and `vercel.json`, honeypot + timing trap on every form, `rel="noopener
noreferrer"` on external links, no secrets in the repo, `.gitignore` covering `.env`,
privacy policy that matches actual data collection, and an accessibility statement
the build actually lives up to.

The one deliberate CSP compromise: `script-src` allows `'unsafe-inline'`, because
the JSON-LD blocks and the small progressive-enhancement scripts are inline and this
is a static host with no request-time nonce. Upgrade path when you move to a host
with edge functions: emit a per-request nonce, or hash the inline blocks at build
time.

---

## Re-skinning this for another client

1. `src/data/site.ts` — name, NAP, hours, licence, service areas, socials, form
   endpoint, analytics IDs, stats, services, process, differentiators, testimonials,
   team, FAQs.
2. `src/styles/global.css` — the `@theme` block is the whole design system: colours,
   two fonts, radii, easing. Change those eight colour tokens and the site changes
   character without touching a component.
3. `src/content/` — listings, neighborhoods, guides.
4. `public/favicon.svg`, `public/og-cover.png`, `public/robots.txt` (sitemap URL).
5. `astro.config.mjs` — or set `SITE_URL` in the host's environment.

Photography is referenced by URL in content files. Replace the Unsplash placeholders
with the brokerage's own photography before launch — listing photos are the single
biggest conversion lever on a real estate site, and stock interiors read as fake to
local buyers. If you self-host them, drop them in `public/` and add nothing to the
CSP; if you keep a remote host, add that domain to `img-src`.
