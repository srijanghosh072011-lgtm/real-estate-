// Shared page shell: head, nav, footer, structured data.
// ponytail: template literals instead of a template engine. 4 pages' worth of
// markup does not justify a dependency. Swap to Eleventy if this passes ~30 pages.

export const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const money = (n) =>
  '$' + Number(n).toLocaleString('en-CA', { maximumFractionDigits: 0 });

export const num = (n) => Number(n).toLocaleString('en-CA');

export const dateLong = (iso) =>
  new Date(iso + (iso.length === 10 ? 'T12:00:00Z' : '')).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });

// Ultra-light 1.25-stroke line icons. No icon dependency.
const ICONS = {
  bed: '<path d="M3 17V7m0 10h18M3 17v3m18-3v3m0-3v-5a2 2 0 0 0-2-2h-9v7"/><circle cx="7" cy="11" r="2"/>',
  bath: '<path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-3Z"/><path d="M6 12V6a2 2 0 0 1 2-2h.5a2 2 0 0 1 2 2"/><path d="M7 19l-1 2m11-2 1 2"/>',
  area: '<path d="M4 4h16v16H4z"/><path d="M4 9h5V4m11 11h-5v5"/>',
  car: '<path d="M5 17h14M4 17v-4.2a2 2 0 0 1 .2-.9l1.9-3.8A2 2 0 0 1 7.9 7h8.2a2 2 0 0 1 1.8 1.1l1.9 3.8a2 2 0 0 1 .2.9V17"/><circle cx="7.5" cy="17" r="1.5"/><circle cx="16.5" cy="17" r="1.5"/>',
  pin: '<path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
  arrow: '<path d="M7 17 17 7M9 7h8v8"/>',
  chev: '<path d="m6 9 6 6 6-6"/>',
  phone: '<path d="M5 4h3l2 5-2.5 1.5a12 12 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 3 6.2 2 2 0 0 1 5 4Z"/>',
  mail: '<path d="M3 6h18v12H3z"/><path d="m3 7 9 6 9-6"/>',
  calendar: '<path d="M4 6h16v14H4z"/><path d="M4 10h16M9 4v4m6-4v4"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>',
  spark: '<path d="M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
  shield: '<path d="M12 3 5 6v6c0 4.4 2.9 7.9 7 9 4.1-1.1 7-4.6 7-9V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>',
  chart: '<path d="M4 20V9m5 11V4m5 16v-7m5 7V7"/>',
  quote: '<path d="M9 7c-2.8 0-4 2.2-4 5 0 2.5 1.6 4 3.5 4S12 14.5 12 12.5 10.6 9 9 9m10-2c-2.8 0-4 2.2-4 5 0 2.5 1.6 4 3.5 4S22 14.5 22 12.5 20.6 9 19 9"/>',
};

export const icon = (name, cls = '') =>
  `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;

const NAV = [
  { href: '/listings/', label: 'Listings' },
  { href: '/buy/', label: 'Buy' },
  { href: '/sell/', label: 'Sell' },
  { href: '/neighbourhoods/', label: 'Neighbourhoods' },
  { href: '/guides/', label: 'Guides' },
  { href: '/about/', label: 'About' },
];

function nav(site, path) {
  const links = NAV.map(
    (l) =>
      `<a href="${l.href}"${path.startsWith(l.href) ? ' aria-current="page"' : ''}>${l.label}</a>`
  ).join('');
  return `
<a class="skip" href="#main">Skip to content</a>
<header class="nav-wrap">
  <nav class="nav" aria-label="Primary">
    <a class="brand" href="/" aria-label="${esc(site.name)} home">
      <span class="brand-mark" aria-hidden="true">E</span>
      <span class="brand-text">${esc(site.shortName)}</span>
    </a>
    <div class="nav-links">${links}</div>
    <div class="nav-end">
      <a class="btn btn-dark btn-sm" href="/contact/" data-track="nav_cta">
        <span>Book a call</span><span class="btn-ic">${icon('arrow')}</span>
      </a>
      <button class="burger" type="button" aria-expanded="false" aria-controls="mobile-menu" aria-label="Open menu">
        <span></span><span></span>
      </button>
    </div>
  </nav>
</header>
<div class="sheet" id="mobile-menu" hidden>
  <div class="sheet-inner">
    ${NAV.map((l, i) => `<a style="--i:${i}" href="${l.href}">${l.label}</a>`).join('')}
    <a style="--i:${NAV.length}" href="/contact/">Contact</a>
    <a class="sheet-tel" style="--i:${NAV.length + 1}" href="tel:${esc(site.contact.phone)}">${esc(site.contact.phoneDisplay)}</a>
  </div>
</div>`;
}

function footer(site) {
  const year = new Date().getFullYear();
  const areas = site.serviceAreas.map((a) => `<li>${esc(a)}</li>`).join('');
  return `
<footer class="footer">
  <div class="shell">
    <div class="footer-top">
      <div class="footer-lead">
        <p class="eyebrow">Get in touch</p>
        <h2 class="display">Let's talk about<br>what you're actually trying to do.</h2>
        <p class="lede">No script, no pressure. A twenty-minute call where you ask questions and we answer them.</p>
        <div class="row">
          <a class="btn btn-dark" href="/contact/" data-track="footer_cta">
            <span>Book a call</span><span class="btn-ic">${icon('arrow')}</span>
          </a>
          <a class="btn btn-ghost" href="tel:${esc(site.contact.phone)}" data-track="footer_phone">
            ${icon('phone')}<span>${esc(site.contact.phoneDisplay)}</span>
          </a>
        </div>
      </div>
      <div class="footer-cols">
        <div>
          <h3>Explore</h3>
          <ul>
            <li><a href="/listings/">All listings</a></li>
            <li><a href="/buy/">Buying</a></li>
            <li><a href="/sell/">Selling</a></li>
            <li><a href="/sell/#valuation">Home valuation</a></li>
            <li><a href="/buy/#calculator">Mortgage calculator</a></li>
          </ul>
        </div>
        <div>
          <h3>Company</h3>
          <ul>
            <li><a href="/about/">About Everline</a></li>
            <li><a href="/neighbourhoods/">Neighbourhoods</a></li>
            <li><a href="/guides/">Guides &amp; market reports</a></li>
            <li><a href="/contact/">Contact</a></li>
            <li><a href="/privacy/">Privacy policy</a></li>
          </ul>
        </div>
        <div>
          <h3>Office</h3>
          <ul class="plain">
            <li>${esc(site.contact.street)}</li>
            <li>${esc(site.contact.locality)}, ${esc(site.region)} ${esc(site.contact.postalCode)}</li>
            <li><a href="mailto:${esc(site.contact.email)}">${esc(site.contact.email)}</a></li>
            <li>${esc(site.contact.hours)}</li>
          </ul>
        </div>
      </div>
    </div>
    <div class="footer-areas">
      <h3>Serving</h3>
      <ul>${areas}</ul>
    </div>
    <div class="footer-base">
      <p>&copy; ${year} ${esc(site.name)}. ${esc(site.agent.licence)}.</p>
      <p class="fine">MLS&reg;, REALTOR&reg; and the associated logos are trademarks of The Canadian Real Estate Association. Listing data is deemed reliable but is not guaranteed accurate.</p>
      <p><a href="/privacy/">Privacy</a> <span aria-hidden="true">·</span> <a href="/terms/">Terms</a> <span aria-hidden="true">·</span> <a href="/sitemap.xml">Sitemap</a></p>
    </div>
  </div>
</footer>`;
}

function analyticsTag(site) {
  const a = site.analytics || {};
  let out = '';
  if (a.ga4Id) {
    out += `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(a.ga4Id)}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${esc(a.ga4Id)}',{anonymize_ip:true});</script>`;
  }
  if (a.plausibleDomain) {
    out += `<script defer data-domain="${esc(a.plausibleDomain)}" src="https://plausible.io/js/script.outbound-links.js"></script>`;
  }
  return out;
}

/**
 * @param {object} o - title, description, path, body, site, schema[], ogImage, bodyClass
 */
export function page(o) {
  const { site } = o;
  const canonical = site.url + o.path;
  const ogImage =
    o.ogImage ||
    'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1200&q=70';

  const org = {
    '@type': 'RealEstateAgent',
    '@id': site.url + '#org',
    name: site.name,
    url: site.url,
    image: ogImage,
    description: site.description,
    telephone: site.contact.phone,
    email: site.contact.email,
    priceRange: '$$',
    foundingDate: site.founded,
    address: {
      '@type': 'PostalAddress',
      streetAddress: site.contact.street,
      addressLocality: site.contact.locality,
      addressRegion: site.region,
      postalCode: site.contact.postalCode,
      addressCountry: site.country,
    },
    geo: { '@type': 'GeoCoordinates', latitude: site.geo.lat, longitude: site.geo.lng },
    areaServed: site.serviceAreas.map((n) => ({ '@type': 'City', name: n })),
    sameAs: Object.values(site.social),
    employee: {
      '@type': 'Person',
      name: site.agent.name,
      jobTitle: site.agent.title,
      image: site.agent.photo,
    },
  };

  const graph = [org, ...(o.schema || [])];

  return `<!doctype html>
<html lang="en-CA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
<meta name="theme-color" content="#f7f5ef" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#14150f" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="${o.ogType || 'website'}">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:locale" content="${esc(site.locale)}">
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(o.description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:image:alt" content="${esc(o.ogAlt || site.name)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(o.title)}">
<meta name="twitter:description" content="${esc(o.description)}">
<meta name="twitter:image" content="${esc(ogImage)}">
<meta name="geo.region" content="CA-${esc(site.region)}">
<meta name="geo.placename" content="${esc(site.city)}">
<meta name="geo.position" content="${site.geo.lat};${site.geo.lng}">
<meta name="ICBM" content="${site.geo.lat}, ${site.geo.lng}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://images.unsplash.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap">
<link rel="stylesheet" href="/assets/styles.css">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="${esc(site.name)} guides" href="/feed.xml">
<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c')}</script>
${analyticsTag(site)}
</head>
<body class="${o.bodyClass || ''}">
${nav(site, o.path)}
<main id="main">
${o.body}
</main>
${footer(site)}
<script src="/assets/app.js" defer></script>
<script>window.__ANALYTICS__=${JSON.stringify({ endpoint: site.analytics.endpoint || '' })};</script>
<script src="/assets/analytics.js" defer></script>
</body>
</html>`;
}

export function breadcrumbs(site, trail) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      item: site.url + t.path,
    })),
  };
}
