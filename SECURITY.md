# SECURITY.md — Pre-Launch Checklist

Walk every box before pointing the domain at this site. Items marked **[code]**
are handled in this repository and verified by `node scripts/check.mjs`; the
rest are DNS, hosting and account tasks that cannot be done from a repo.

Run `node scripts/check.mjs --strict` before any production deploy — it fails
while form, analytics or origin configuration is still on placeholder values.

-----

## 1. The repo

- [x] Repository is **private** (or, if public, scanned with `gitleaks`, zero secrets)
- [x] **[code]** `.gitignore` excludes `.env`, `.env.*`, `node_modules`, `.DS_Store`, `dist/`
- [x] **[code]** No API keys, SMTP passwords or hosting tokens in the tree — feed credentials come from env vars only (`.env.example` documents them)
- [x] **[code]** No client URLs, commit hashes or internal notes in the output — `check.mjs` greps every built page for `TODO`, `FIXME`, `console.log`, `localhost`
- [x] Repo name is professional

> Note: `forms.accessKey` and `forms.turnstileSiteKey` in `data/site.json` are
> *public by design* — they are sent to the browser. They are not secrets. The
> DDF feed password is, and it is never committed.

## 2. Hosting & DNS

- [x] **[code]** Host supports custom headers — `dist/_headers` targets Cloudflare Pages / Netlify (NOT plain GitHub Pages)
- [ ] Cloudflare in front of the domain (free tier: WAF, DDoS, CDN)
- [ ] DNSSEC enabled at the registrar
- [ ] HTTPS enforced (HTTP → HTTPS redirect)
- [ ] SSL/TLS scores **A or A+** at [ssllabs.com/ssltest](https://www.ssllabs.com/ssltest/)

## 3. Email & domain

- [ ] Contact email on the custom domain (`hello@everlineproperty.ca`), not Gmail
- [ ] **SPF** record set
- [ ] **DKIM** record set
- [ ] **DMARC** set to at least `p=quarantine`
- [ ] Verified at [mxtoolbox.com](https://mxtoolbox.com)

## 4. Security headers

- [x] **[code]** `_headers` deployed with HSTS (2 years, preload), X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP, CORP and CSP
- [x] **[code]** CSP has **no `unsafe-inline` in `script-src`** — verified by `check.mjs`
- [x] **[code]** CSP is generated from `data/site.json`, so it lists only the third-party hosts actually in use (Google Fonts, Unsplash, Google Maps, the form processor, and whichever analytics vendor is configured)
- [x] **[code]** `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`
- [ ] Site scores **A or higher** at [securityheaders.com](https://securityheaders.com) *(verify after first deploy)*

> `style-src` still carries `'unsafe-inline'` for the handful of inline
> `style="--i:n"` stagger hooks in the mobile menu. Tighten with hashes if the
> threat model needs it.

## 5. Contact form

- [x] **[code]** Honeypot field on every form (`botcheck`, visually hidden, bots that fill it are dropped silently)
- [ ] Cloudflare Turnstile enabled — set `forms.turnstileSiteKey`; the markup and CSP wire themselves up when you do
- [ ] Rate limiting turned on in the form processor dashboard
- [x] **[code]** Forms submit over HTTPS only (`upgrade-insecure-requests`)
- [x] **[code]** `action` matches the CSP `form-action` directive — both come from the same config value
- [x] **[code]** Consent checkbox is required and links the privacy policy
- [x] **[code]** All fields carry `maxlength`; submissions are validated before send
- [ ] Test submission actually arrives in the right inbox

## 6. Legal & privacy

- [x] **[code]** Privacy policy exists and is linked from the footer
- [x] **[code]** It describes what is *actually* collected — form fields, page/referrer/campaign attribution, anonymous usage measurement — with PIPEDA rights, retention periods, and every third party named
- [x] **[code]** Terms of use covering listing accuracy, the calculator disclaimer and CREA trademarks
- [x] **[code]** No cookie banner, because no non-essential cookies are set — analytics uses local storage for an anonymous id and nothing else
- [x] **[code]** MLS®/REALTOR® trademark attribution and the "deemed reliable but not guaranteed" disclaimer in the footer and on listing pages

## 7. Performance & uptime

- [x] **[code]** No framework, no bundler; one 25 KB stylesheet and two small scripts, both `defer`
- [x] **[code]** Images lazy-loaded below the fold, `decoding="async"`, explicit `width`/`height` to prevent layout shift, `fetchpriority="high"` on each page's LCP image
- [x] **[code]** Fonts preconnected and `display=swap`
- [x] **[code]** Animations restricted to `transform`/`opacity`; `backdrop-filter` only on fixed elements
- [ ] Lighthouse 90+ across the board, mobile and desktop *(verify on the real host — local numbers lie)*
- [ ] Serve photography as WebP/AVIF from your own origin or an image CDN rather than Unsplash before launch
- [ ] Uptime monitoring — [UptimeRobot](https://uptimerobot.com) or [BetterStack](https://betterstack.com)
- [ ] Error tracking — [Sentry](https://sentry.io) free tier *(add its host to `script-src` and `connect-src` in `build.mjs` when you do)*

## 8. Backups & recovery

- [x] **[code]** The repo is the backup — `node build.mjs` rebuilds the entire site from JSON in under a second
- [x] **[code]** Listing data is version-controlled; every sync is a reviewable commit
- [ ] You have personally redeployed from a clean clone at least once
- [ ] DNS records documented outside the registrar

## 9. Accessibility & SEO

- [x] **[code]** Every image has meaningful `alt` (decorative ones `alt=""` + `aria-hidden`) — `check.mjs` fails on a missing attribute
- [x] **[code]** Semantic landmarks: `<header>`, `<nav aria-label>`, `<main id="main">`, `<footer>`, one `<h1>` per page, skip link
- [x] **[code]** Visible focus rings, `aria-expanded` on the menu, `aria-live` on filter results and form status, Escape closes the menu, `prefers-reduced-motion` honoured
- [x] **[code]** Contrast measured, not assumed: body `#3a3c33` on `#f7f5ef` is 10.3:1, muted `#6b6d61` is 4.8:1, the sage eyebrow on its wash is 4.8:1, and the lightest footer text is 5.0:1 — all pass WCAG AA
- [x] **[code]** `robots.txt` and `sitemap.xml` generated and cross-linked
- [x] **[code]** OpenGraph + Twitter card meta on every page
- [ ] Submit to Google Search Console and Bing Webmaster Tools

## 10. Final sweep

- [x] **[code]** `check.mjs` view-sources every built page for TODO, FIXME, console.log, localhost, dev URLs and placeholder copy
- [x] **[code]** No placeholder content — every string is real
- [x] **[code]** `target="_blank"` links carry `rel="noopener noreferrer"` (verified; currently none ship)
- [x] **[code]** `e2e.mjs` drives filters, sorting, deep links, the calculator, form validation and the mobile menu in a real browser
- [x] **[code]** No horizontal overflow at 390px — asserted in `scripts/shots.mjs`
- [ ] Send the live URL to someone on a different device and ask them to break it

-----

## Not applicable

This site has no logins, no payments, no database and no user accounts. The
extended checklist (password hashing, MFA, session cookies, CSRF tokens,
parameterized queries, OWASP ZAP against staging) applies only if you later add
a client portal. If you do, the whole threat model changes — re-scope before
building it.

Dependency surface: **zero runtime dependencies**. Playwright is the only
dev dependency, used by the test scripts and never shipped. `npm audit` has
almost nothing to report by construction.

-----

## Ongoing maintenance (monthly)

- [ ] `npm audit`
- [ ] Re-run [securityheaders.com](https://securityheaders.com) and [ssllabs.com](https://www.ssllabs.com/ssltest/)
- [ ] Rebuild from a clean clone to confirm recovery still works
- [ ] Review form submissions for spam spikes or scraping patterns
- [ ] Rotate the DDF feed password if older than 90 days
- [ ] Re-read the privacy policy against what the site actually collects — if you added a tool, the policy is now wrong

-----

*Adapted from the Ghosh Designs pre-launch checklist. Last reviewed 13 September 2026.*
