# Pre-launch status against SECURITY.md

`[x]` = handled in this repo. `[ ]` = needs you, outside the code (DNS, host dashboard,
registrar, an account somewhere). Nothing is ticked that the code does not actually do.

## 1. The repo
- [x] `.gitignore` excludes `.env*`, `node_modules`, `.DS_Store`, build output
- [x] No API keys, SMTP passwords or tokens anywhere in the tree — `src/data/site.ts` holds public business details only
- [x] No internal paths, commit hashes or dev URLs rendered into the HTML (checked against `dist/`)
- [ ] Make the repository private, or run `gitleaks detect` before making it public
- [ ] Rename to something professional if the repo name is a placeholder

## 2. Hosting & DNS
- [x] Header files ship for Netlify / Cloudflare Pages (`public/_headers`) and Vercel (`vercel.json`) — plain GitHub Pages cannot serve these, do not use it
- [ ] Put Cloudflare in front of the domain (free tier: WAF, DDoS, CDN)
- [ ] Enable DNSSEC at the registrar
- [ ] Force HTTPS, HSTS is already sent with `preload` — submit at hstspreload.org once you are sure
- [ ] Confirm A/A+ at ssllabs.com

## 3. Email & domain
- [x] Site uses a domain mailbox (`hello@…`), never a personal Gmail
- [ ] SPF, DKIM and DMARC (`p=quarantine` minimum) on the sending domain
- [ ] Verify at mxtoolbox.com

## 4. Security headers
- [x] HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP, CORP and CSP all set
- [x] CSP lists only what the site uses: self, `images.unsplash.com`, Plausible/GA (when enabled), the OpenStreetMap iframe, the form endpoint
- [x] `/admin` gets its own wider policy plus `X-Robots-Tag: noindex`
- [ ] Re-run securityheaders.com after you change the form or analytics provider
- [ ] Known compromise: `script-src 'unsafe-inline'` (JSON-LD + inline enhancement scripts on a static host). Move to nonces or build-time hashes if you deploy behind edge functions.

## 5. Contact form
- [x] Honeypot field plus a sub-3-second submit trap on every form
- [x] Consent checkbox, required, with a link to the privacy policy
- [x] Posts over HTTPS only, and the endpoint matches the CSP `form-action`
- [ ] Replace `formEndpoint` in `src/data/site.ts` with the real endpoint
- [ ] Turn on rate limiting in the form provider's dashboard
- [ ] Add Turnstile/hCaptcha if spam gets through the honeypot
- [ ] Send a test submission and confirm it lands in the right inbox

## 6. Legal & privacy
- [x] Privacy policy, terms of use and accessibility statement, all linked in the footer
- [x] Privacy policy describes the data this site actually collects — no template placeholders
- [x] No cookie banner, because no non-essential cookies are set (keep it that way, or add one with GA4)
- [x] Fair housing and licensing disclosures on `/about` and `/terms`
- [ ] Have the brokerage's broker-in-charge read the legal pages before launch — state advertising rules vary

## 7. Performance & uptime
- [x] Self-hosted variable fonts, immutable cache headers on hashed assets, ~10 KB gzipped CSS, no JS framework shipped
- [x] Images lazy-loaded below the fold with explicit `width`/`height`; hero images use `fetchpriority="high"`
- [ ] Run Lighthouse against the deployed URL (local runs miss CDN and image delivery)
- [ ] Replace the Unsplash placeholders with real photography, served as WebP/AVIF
- [ ] UptimeRobot or BetterStack on the homepage
- [ ] Sentry only if you add meaningful client JS — the current scripts are small and defensive

## 8. Backups & recovery
- [x] The git repo is the whole site: `npm ci && npm run build` restores it from scratch in minutes
- [x] Content lives in the repo as markdown, so listings are versioned with the code
- [ ] Test a clean-clone rebuild once
- [ ] Document DNS records outside the registrar

## 9. Accessibility & SEO basics
- [x] Meaningful alt text on every image (enforced by the content schema — `heroAlt` is required)
- [x] Semantic HTML: one `<h1>` per page, `<nav>`, `<main>`, `<footer>`, `<address>`, real `<table>` markup, skip link
- [x] Visible focus rings, full keyboard operation, `prefers-reduced-motion` respected
- [x] `robots.txt` and `sitemap-index.xml` correct, OG + Twitter cards set
- [ ] Update the sitemap URL in `public/robots.txt` to the real domain
- [ ] Submit to Google Search Console and Bing Webmaster Tools
- [ ] Re-check colour contrast if you change the palette tokens

## 10. Final sweep
- [x] No TODO, FIXME, `console.log`, localhost or placeholder copy in the built output (automated check run against `dist/`)
- [x] Every `target="_blank"` carries `rel="noopener noreferrer"`
- [x] All internal links resolve to a built page (automated check)
- [ ] Hand the URL to someone on another device and ask them to break it

## Extended checklist
Not applicable: no logins, no payments, no user accounts, no database. If the
brokerage later adds a client portal or takes deposits online, the extended section of
`SECURITY.md` starts applying from day one of that work.

## Ongoing
- Monthly: `npm audit`, re-run securityheaders.com and ssllabs.com, skim form
  submissions for spam patterns
- Quarterly: refresh neighborhood market figures, re-check the FAQ answers against
  current rules, update `dependencies`
