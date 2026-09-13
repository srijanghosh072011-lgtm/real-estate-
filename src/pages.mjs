import { esc, money, num, icon, dateLong, breadcrumbs } from './layout.mjs';
import {
  listingCard,
  sectionHead,
  faqSection,
  faqSchema,
  testimonials,
  ctaBanner,
  postCard,
  leadForm,
  STATUS_LABEL,
  TYPE_LABEL,
} from './components.mjs';

const PRICE_BANDS = [
  ['', 'Any price'],
  ['0-250000', 'Under $250k'],
  ['250000-400000', '$250k – $400k'],
  ['400000-600000', '$400k – $600k'],
  ['600000-850000', '$600k – $850k'],
  ['850000-99000000', '$850k+'],
];

function searchBar(site, { compact = false } = {}) {
  const hoods = site.neighbourhoods.map((n) => `<option value="${esc(n.name)}">${esc(n.name)}</option>`).join('');
  const types = Object.entries(TYPE_LABEL)
    .map(([k, v]) => `<option value="${esc(k)}">${esc(v)}</option>`)
    .join('');
  const bands = PRICE_BANDS.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
  return `
<form class="search${compact ? ' search-compact' : ''}" action="/listings/" method="get" role="search" aria-label="Property search" data-track="search_submit">
  <div class="search-shell">
    <p class="search-title">Find the right place</p>
    <div class="search-row">
      <label class="sf"><span>Looking for</span>
        <select name="status">
          <option value="for-sale">For sale</option>
          <option value="pending">Pending</option>
          <option value="sold">Recently sold</option>
          <option value="">Anything</option>
        </select>
      </label>
      <label class="sf"><span>Type</span><select name="type"><option value="">Any type</option>${types}</select></label>
      <label class="sf"><span>Area</span><select name="hood"><option value="">All of Regina</option>${hoods}</select></label>
      <label class="sf"><span>Bedrooms</span>
        <select name="beds"><option value="">Any</option><option value="1">1+</option><option value="2">2+</option><option value="3">3+</option><option value="4">4+</option><option value="5">5+</option></select>
      </label>
      <label class="sf"><span>Price</span><select name="price">${bands}</select></label>
      <button class="btn btn-dark search-go" type="submit">${icon('search')}<span>Search</span></button>
    </div>
  </div>
</form>`;
}

/* ---------------------------------------------------------------- home --- */

export function home(site, listings, posts) {
  const featured = listings.filter((l) => l.featured).slice(0, 6);
  const stats = site.stats
    .map((s) => `<div class="stat"><p class="stat-v">${esc(s.value)}</p><p class="stat-l">${esc(s.label)}</p></div>`)
    .join('');

  const hoodCards = site.neighbourhoods
    .slice(0, 3)
    .map(
      (n) => `
    <a class="hood-mini" href="/neighbourhoods/#${esc(n.slug)}">
      <img src="${esc(n.image)}" alt="${esc(n.name)}, Regina" loading="lazy" decoding="async" width="600" height="400">
      <span><strong>${esc(n.name)}</strong><em>Median ${money(n.medianPrice)}</em></span>
    </a>`
    )
    .join('');

  const body = `
<section class="hero">
  <div class="hero-frame">
    <img class="hero-img" src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=2000&q=72"
         alt="A contemporary Regina home at dusk with warm interior light" fetchpriority="high" decoding="async" width="2000" height="1200">
    <div class="hero-veil" aria-hidden="true"></div>
    <div class="hero-copy">
      <p class="eyebrow eyebrow-light">Regina &amp; area · Since ${esc(site.founded)}</p>
      <h1 class="display hero-h1">Build your future,<br>one property at a time.</h1>
      <p class="hero-lede">${esc(site.description)}</p>
    </div>
    ${searchBar(site)}
  </div>
</section>

<section class="shell sec" aria-labelledby="value-h">
  ${sectionHead({
    eyebrow: 'Why Everline',
    title: 'Most of buying a house<br>is just knowing what happens next.',
    lede: 'Three things we do differently, and all three are boring on purpose.',
  })}
  <div class="bento">
    <article class="bento-a">
      <div class="card-shell">
        <img src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=70"
             alt="Kitchen and living area of a Regina listing prepared for photography" loading="lazy" decoding="async" width="1200" height="900">
        <div class="bento-a-copy">
          <h3>Priced on evidence, not optimism.</h3>
          <p>Every valuation we give you comes with the three to five comparable sales it was built from, and the adjustments we made to each one. If you disagree with the number, you can see exactly where.</p>
        </div>
      </div>
    </article>
    <article class="bento-b">
      <div class="card-shell">
        ${icon('shield', 'bento-ic')}
        <h3>Same-day answers.</h3>
        <p>Email, text or call. If we cannot answer properly the same day, you get a holding reply telling you when you will hear back.</p>
      </div>
    </article>
    <article class="bento-c">
      <div class="card-shell">
        ${icon('chart', 'bento-ic')}
        <h3>The numbers before the offer.</h3>
        <p>Carrying costs, taxes from the SAMA assessment, condo reserve health, realistic rent. You sign after you have seen the math.</p>
      </div>
    </article>
    <article class="bento-d">
      <div class="card-shell price-badge">
        <p class="eyebrow">Currently listed from</p>
        <p class="price-big">${money(Math.min(...listings.filter((l) => l.status === 'for-sale').map((l) => l.price)))}</p>
        <a class="btn btn-ghost btn-sm" href="/listings/"><span>Browse listings</span><span class="btn-ic">${icon('arrow')}</span></a>
      </div>
    </article>
  </div>
</section>

<section class="band" aria-label="Track record">
  <div class="shell stats">${stats}</div>
</section>

<section class="shell sec" aria-labelledby="hood-h">
  <div class="split">
    <div class="split-media">
      <div class="card-shell">
        <img src="https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?auto=format&fit=crop&w=1200&q=70"
             alt="Aerial view of a residential Regina neighbourhood" loading="lazy" decoding="async" width="1200" height="900">
      </div>
      <div class="hood-minis">${hoodCards}</div>
    </div>
    <div class="split-copy">
      <p class="eyebrow">Neighbourhoods</p>
      <h2 class="display" id="hood-h">The same house is worth<br>three different numbers<br>in three parts of this city.</h2>
      <p class="lede">We keep a running read on every Regina neighbourhood and the commuter belt around it: what is selling, what is sitting, and what a street actually feels like on a Tuesday evening.</p>
      <a class="btn btn-dark" href="/neighbourhoods/" data-track="home_hoods">
        <span>Compare neighbourhoods</span><span class="btn-ic">${icon('arrow')}</span>
      </a>
    </div>
  </div>
</section>

<section class="shell sec" aria-labelledby="feat-h">
  ${sectionHead({
    eyebrow: 'Current inventory',
    title: 'Featured Regina listings',
    lede: 'Updated from the MLS&reg; system. Every property below is one we have walked ourselves.',
    action: `<a class="btn btn-ghost" href="/listings/" data-track="home_all_listings"><span>See all ${listings.filter((l) => l.status !== 'sold').length} listings</span><span class="btn-ic">${icon('arrow')}</span></a>`,
  })}
  <div class="grid-3">${featured.map((l, i) => listingCard(l, { eager: i < 3 })).join('')}</div>
</section>

<section class="shell sec" aria-labelledby="val-h">
  <div class="valuation">
    <div class="valuation-copy">
      <p class="eyebrow">Free, no obligation</p>
      <h2 class="display" id="val-h">What is your<br>home worth today?</h2>
      <p class="lede">Answer four questions and get a comparable-based range for your address within one business day, plus the sales it was built from.</p>
      <ul class="ticks">
        <li>${icon('spark')}Built from sales in the last 90 days</li>
        <li>${icon('spark')}No sign on your lawn, no follow-up sequence</li>
        <li>${icon('spark')}Delivered as a PDF you can keep</li>
      </ul>
    </div>
    <div class="valuation-form">
      ${leadForm(site, {
        id: 'home-valuation',
        kind: 'valuation',
        heading: 'Request a valuation',
        sub: 'One business day turnaround.',
        cta: 'Get my range',
        fields: [
          { name: 'address', label: 'Property address', required: true, wide: true, placeholder: '123 Example Street, Regina', autocomplete: 'street-address' },
          { name: 'property_type', label: 'Property type', type: 'select', options: Object.values(TYPE_LABEL) },
          { name: 'timeline', label: 'Timeline', type: 'select', options: ['Just curious', 'Within 3 months', '3–6 months', '6–12 months'] },
        ],
      })}
    </div>
  </div>
</section>

${faqSection(site.faqs.slice(0, 5))}

${testimonials(site.testimonials)}

<section class="shell sec" aria-labelledby="guide-h">
  ${sectionHead({
    eyebrow: 'Guides',
    title: 'Read before you sign anything.',
    action: `<a class="btn btn-ghost" href="/guides/"><span>All guides</span><span class="btn-ic">${icon('arrow')}</span></a>`,
  })}
  <div class="grid-3">${posts.slice(0, 3).map(postCard).join('')}</div>
</section>

${ctaBanner()}`;

  return {
    title: `${site.name} | Regina Real Estate Agents & MLS® Listings`,
    description: site.description,
    path: '/',
    body,
    schema: [
      {
        '@type': 'WebSite',
        '@id': site.url + '#website',
        url: site.url,
        name: site.name,
        publisher: { '@id': site.url + '#org' },
        potentialAction: {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: site.url + '/listings/?q={search_term_string}' },
          'query-input': 'required name=search_term_string',
        },
      },
      faqSchema(site.faqs.slice(0, 5)),
    ],
  };
}

/* ------------------------------------------------------------ listings --- */

export function listingsIndex(site, listings) {
  const hoods = site.neighbourhoods.map((n) => `<option value="${esc(n.name)}">${esc(n.name)}</option>`).join('');
  const types = Object.entries(TYPE_LABEL).map(([k, v]) => `<option value="${esc(k)}">${esc(v)}</option>`).join('');
  const bands = PRICE_BANDS.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');

  const body = `
<section class="shell page-head">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span aria-hidden="true">/</span> <span aria-current="page">Listings</span></nav>
  <h1 class="display">Regina homes for sale</h1>
  <p class="lede">${listings.length} properties across Regina and the surrounding commuter belt. Filters apply instantly — nothing reloads.</p>
</section>

<section class="shell sec-tight" aria-label="Filter listings">
  <form class="filters" id="filters" role="search">
    <label class="sf"><span>Status</span>
      <select name="status"><option value="">Any</option><option value="for-sale">For sale</option><option value="pending">Pending</option><option value="sold">Sold</option></select>
    </label>
    <label class="sf"><span>Type</span><select name="type"><option value="">Any type</option>${types}</select></label>
    <label class="sf"><span>Area</span><select name="hood"><option value="">All areas</option>${hoods}</select></label>
    <label class="sf"><span>Beds</span><select name="beds"><option value="">Any</option><option value="1">1+</option><option value="2">2+</option><option value="3">3+</option><option value="4">4+</option><option value="5">5+</option></select></label>
    <label class="sf"><span>Baths</span><select name="baths"><option value="">Any</option><option value="1">1+</option><option value="2">2+</option><option value="3">3+</option></select></label>
    <label class="sf"><span>Price</span><select name="price">${bands}</select></label>
    <label class="sf"><span>Sort</span>
      <select name="sort"><option value="new">Newest</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="sqft">Largest</option></select>
    </label>
    <button class="btn btn-ghost btn-sm" type="reset">Reset</button>
  </form>
  <p class="result-count" role="status" aria-live="polite"><span id="count">${listings.length}</span> properties</p>
</section>

<section class="shell sec-tight">
  <div class="grid-3" id="listing-grid">${listings.map((l, i) => listingCard(l, { eager: i < 3 })).join('')}</div>
  <p class="empty" id="empty" hidden>No properties match those filters. <button type="button" class="linkish" data-clear>Clear them</button> and try a wider search.</p>
</section>

<section class="shell sec">
  <div class="alert-box">
    <div>
      <p class="eyebrow">Property alerts</p>
      <h2 class="display">Be first, without checking daily.</h2>
      <p class="lede">Tell us what you are looking for and you get an email the morning anything matching hits the MLS&reg;. Unsubscribe in one click.</p>
    </div>
    ${leadForm(site, {
      id: 'alerts',
      kind: 'property_alert',
      heading: 'Set up an alert',
      cta: 'Start alerts',
      fields: [
        { name: 'criteria', label: 'What are you looking for?', type: 'textarea', required: true, placeholder: '3 bed bungalow, Lakeview or Cathedral, under $480k, garage essential' },
      ],
    })}
  </div>
</section>

${ctaBanner()}`;

  return {
    title: `Regina MLS® Listings & Homes for Sale | ${site.shortName}`,
    description: `Browse ${listings.length} homes, condos, townhouses and acreages for sale in Regina and area. Filter by price, bedrooms, neighbourhood and property type.`,
    path: '/listings/',
    body,
    schema: [
      breadcrumbs(site, [
        { name: 'Home', path: '/' },
        { name: 'Listings', path: '/listings/' },
      ]),
      {
        '@type': 'ItemList',
        name: 'Regina homes for sale',
        numberOfItems: listings.length,
        itemListElement: listings.map((l, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `${site.url}/listings/${l.slug}/`,
          name: l.title,
        })),
      },
    ],
  };
}

export function listingDetail(site, l, all) {
  const gallery = l.images
    .map(
      (src, i) => `
    <button type="button" class="gal-thumb${i ? '' : ' is-active'}" data-gal="${i}" aria-label="View photo ${i + 1} of ${l.images.length}">
      <img src="${esc(src)}" alt="${esc(l.title)}, photo ${i + 1}" loading="lazy" decoding="async" width="400" height="300">
    </button>`
    )
    .join('');

  const facts = [
    ['Price', money(l.status === 'sold' ? l.soldPrice : l.price)],
    ['MLS® number', l.mls],
    ['Property type', TYPE_LABEL[l.type]],
    ['Bedrooms', l.beds],
    ['Bathrooms', l.baths],
    ['Living area', num(l.sqft) + ' ft²'],
    l.lotSqft ? ['Lot size', num(l.lotSqft) + ' ft²'] : null,
    ['Year built', l.yearBuilt],
    l.garage ? ['Garage', l.garage + ' vehicle'] : null,
    ['Annual taxes', money(l.taxes)],
    l.condoFee ? ['Condo fee', money(l.condoFee) + ' / month'] : null,
    ['Neighbourhood', l.neighbourhood],
    ['Listed', dateLong(l.listedOn)],
    l.soldOn ? ['Sold', dateLong(l.soldOn)] : null,
  ].filter(Boolean);

  const similar = all
    .filter((o) => o.slug !== l.slug && (o.neighbourhood === l.neighbourhood || o.type === l.type))
    .slice(0, 3);

  const mapQ = encodeURIComponent(`${l.address}, ${l.city}, SK`);

  const body = `
<section class="shell page-head">
  <nav class="crumbs" aria-label="Breadcrumb">
    <a href="/">Home</a> <span aria-hidden="true">/</span>
    <a href="/listings/">Listings</a> <span aria-hidden="true">/</span>
    <span aria-current="page">${esc(l.title)}</span>
  </nav>
</section>

<section class="shell">
  <div class="gal">
    <div class="gal-main card-shell">
      <img id="gal-img" src="${esc(l.images[0])}" alt="${esc(l.title)}, ${TYPE_LABEL[l.type]} in ${esc(l.neighbourhood)}, ${esc(l.city)}" fetchpriority="high" decoding="async" width="1600" height="1000">
      <span class="chip chip-${esc(l.status)} chip-lg">${STATUS_LABEL[l.status]}</span>
    </div>
    ${l.images.length > 1 ? `<div class="gal-rail">${gallery}</div>` : ''}
  </div>
</section>

<section class="shell sec-tight">
  <div class="detail">
    <div class="detail-main">
      <p class="eyebrow">${esc(l.neighbourhood)} · MLS® ${esc(l.mls)}</p>
      <h1 class="display">${esc(l.title)}</h1>
      <p class="detail-price">${money(l.status === 'sold' ? l.soldPrice : l.price)}${l.status === 'sold' ? ` <span class="was">listed ${money(l.price)}</span>` : ''}</p>
      <p class="detail-sub">${icon('pin')}${esc(l.address)}, ${esc(l.city)}, ${esc(site.region)} ${esc(l.postalCode)}</p>

      <ul class="spec-row">
        <li>${icon('bed')}<strong>${l.beds}</strong> bedrooms</li>
        <li>${icon('bath')}<strong>${l.baths}</strong> bathrooms</li>
        <li>${icon('area')}<strong>${num(l.sqft)}</strong> ft²</li>
        <li>${icon('car')}<strong>${l.garage || 0}</strong> garage</li>
        <li>${icon('calendar')}<strong>${l.yearBuilt}</strong> built</li>
      </ul>

      <h2>About this property</h2>
      <p class="prose">${esc(l.description)}</p>

      <h2>Highlights</h2>
      <ul class="ticks two-col">${l.highlights.map((h) => `<li>${icon('spark')}${esc(h)}</li>`).join('')}</ul>

      <h2>Property facts</h2>
      <dl class="facts">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>

      <h2>Location</h2>
      <div class="map card-shell">
        <iframe title="Map showing ${esc(l.address)}, ${esc(l.city)}"
          src="https://www.google.com/maps?q=${mapQ}&output=embed"
          loading="lazy" referrerpolicy="no-referrer-when-downgrade" width="1200" height="450"></iframe>
      </div>
      <p class="fine">Approximate location. Verify boundaries, measurements and school catchments independently.</p>
    </div>

    <aside class="detail-side">
      <div class="sticky">
        ${leadForm(site, {
          id: 'book-showing',
          kind: 'showing_request',
          heading: 'Book a showing',
          sub: `${l.title} · MLS® ${l.mls}`,
          cta: 'Request showing',
          fields: [
            { name: 'listing', label: 'Property', required: true, wide: true, placeholder: l.title },
            { name: 'preferred', label: 'Preferred day', type: 'date' },
            { name: 'message', label: 'Anything we should know?', type: 'textarea' },
          ],
        })}
        <div class="agent-card card-shell">
          <img src="${esc(site.agent.photo)}" alt="${esc(site.agent.name)}, ${esc(site.agent.title)}" loading="lazy" decoding="async" width="300" height="300">
          <div>
            <p><strong>${esc(site.agent.name)}</strong><br><span>${esc(site.agent.title)}</span></p>
            <a class="linkish" href="tel:${esc(site.contact.phone)}" data-track="detail_phone">${esc(site.contact.phoneDisplay)}</a>
          </div>
        </div>
        <div class="calc-mini card-shell">
          <h3>Payment estimate</h3>
          <p class="calc-out" data-calc-out>—</p>
          <label class="fld"><span>Down payment (%)</span><input type="number" data-calc="down" value="20" min="5" max="100" step="1"></label>
          <label class="fld"><span>Rate (%)</span><input type="number" data-calc="rate" value="4.49" min="0.1" max="20" step="0.01"></label>
          <label class="fld"><span>Amortization (years)</span><input type="number" data-calc="years" value="25" min="5" max="30" step="1"></label>
          <input type="hidden" data-calc="price" value="${l.price}">
          <p class="fine">Principal and interest only. Not an offer of credit.</p>
        </div>
      </div>
    </aside>
  </div>
</section>

${similar.length ? `
<section class="shell sec" aria-labelledby="sim-h">
  ${sectionHead({ eyebrow: 'Nearby', title: 'Similar properties' })}
  <div class="grid-3">${similar.map((s) => listingCard(s)).join('')}</div>
</section>` : ''}`;

  return {
    title: `${l.title}, ${l.city} | ${money(l.status === 'sold' ? l.soldPrice : l.price)} | MLS® ${l.mls}`,
    description: `${TYPE_LABEL[l.type]} for sale in ${l.neighbourhood}, ${l.city}. ${l.beds} bed, ${l.baths} bath, ${num(l.sqft)} sq ft, built ${l.yearBuilt}. ${l.description.slice(0, 110)}…`,
    path: `/listings/${l.slug}/`,
    ogType: 'article',
    ogImage: l.images[0],
    ogAlt: `${l.title}, ${l.city}`,
    body,
    schema: [
      breadcrumbs(site, [
        { name: 'Home', path: '/' },
        { name: 'Listings', path: '/listings/' },
        { name: l.title, path: `/listings/${l.slug}/` },
      ]),
      {
        '@type': ['Residence', 'Product'],
        name: l.title,
        description: l.description,
        image: l.images,
        sku: l.mls,
        numberOfRooms: l.beds,
        numberOfBathroomsTotal: l.baths,
        yearBuilt: l.yearBuilt,
        floorSize: { '@type': 'QuantitativeValue', value: l.sqft, unitCode: 'FTK' },
        address: {
          '@type': 'PostalAddress',
          streetAddress: l.address,
          addressLocality: l.city,
          addressRegion: site.region,
          postalCode: l.postalCode,
          addressCountry: site.country,
        },
        geo: { '@type': 'GeoCoordinates', latitude: l.lat, longitude: l.lng },
        offers: {
          '@type': 'Offer',
          price: l.status === 'sold' ? l.soldPrice : l.price,
          priceCurrency: 'CAD',
          availability:
            l.status === 'for-sale'
              ? 'https://schema.org/InStock'
              : l.status === 'pending'
                ? 'https://schema.org/LimitedAvailability'
                : 'https://schema.org/SoldOut',
          url: `${site.url}/listings/${l.slug}/`,
          seller: { '@id': site.url + '#org' },
        },
      },
    ],
  };
}

/* ------------------------------------------------------------------ buy --- */

export function buy(site, listings) {
  const steps = [
    ['Pre-approval', 'Before anything else. A written pre-approval fixes your budget and your rate hold, and it is the difference between an offer a seller takes seriously and one they do not.'],
    ['The needs list', 'We write down what you actually need versus what you would like, and we both sign it. It stops the third-weekend drift where every house starts looking the same.'],
    ['Showings', 'Typically eight to fifteen properties. We tell you what is wrong with each one, including the ones you like.'],
    ['The offer', 'Price, possession date, inclusions, and conditions for financing and inspection. We walk you through every clause before you initial it.'],
    ['Conditions', 'Seven to ten business days. Inspection, lender appraisal, condo documents if applicable, insurance quote. This is where problems surface and where you can still walk.'],
    ['Possession', 'Lawyer, title transfer, funds, keys. We do a final walkthrough with you the morning of.'],
  ]
    .map(
      (s, i) => `
    <li class="step">
      <span class="step-n">${String(i + 1).padStart(2, '0')}</span>
      <div><h3>${esc(s[0])}</h3><p>${esc(s[1])}</p></div>
    </li>`
    )
    .join('');

  const body = `
<section class="shell page-head">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span aria-hidden="true">/</span> <span aria-current="page">Buy</span></nav>
  <p class="eyebrow">Buying in Regina</p>
  <h1 class="display">Nobody should sign the<br>largest contract of their life<br>and still be guessing.</h1>
  <p class="lede">Here is the whole process, start to finish, with the parts most people find out about too late written down in advance.</p>
</section>

<section class="shell sec-tight">
  <div class="card-shell hero-strip">
    <img src="https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1800&q=70"
         alt="A family touring a bright Regina home" loading="lazy" decoding="async" width="1800" height="800">
  </div>
</section>

<section class="shell sec" aria-labelledby="steps-h">
  ${sectionHead({ eyebrow: 'The process', title: 'Six stages, roughly sixty days.' })}
  <ol class="steps">${steps}</ol>
</section>

<section class="shell sec" id="calculator" aria-labelledby="calc-h">
  <div class="valuation">
    <div class="valuation-copy">
      <p class="eyebrow">Tools</p>
      <h2 class="display" id="calc-h">Mortgage calculator</h2>
      <p class="lede">Principal and interest on a Canadian semi-annual compounded mortgage. Add roughly ${money(350)} a month for taxes and insurance on a median Regina home.</p>
      <ul class="ticks">
        <li>${icon('spark')}Saskatchewan has no land transfer tax</li>
        <li>${icon('spark')}Under 20% down requires default insurance</li>
        <li>${icon('spark')}Budget 1.5% of price for closing costs</li>
      </ul>
    </div>
    <div class="valuation-form">
      <div class="calc card-shell">
        <div class="calc-head">
          <p class="eyebrow">Estimated monthly</p>
          <p class="calc-out calc-out-lg" data-calc-out>—</p>
        </div>
        <div class="form-grid">
          <label class="fld"><span>Purchase price ($)</span><input type="number" data-calc="price" value="400000" min="50000" max="5000000" step="1000"></label>
          <label class="fld"><span>Down payment (%)</span><input type="number" data-calc="down" value="20" min="5" max="100" step="1"></label>
          <label class="fld"><span>Interest rate (%)</span><input type="number" data-calc="rate" value="4.49" min="0.1" max="20" step="0.01"></label>
          <label class="fld"><span>Amortization (years)</span><input type="number" data-calc="years" value="25" min="5" max="30" step="1"></label>
        </div>
        <dl class="calc-break">
          <div><dt>Mortgage amount</dt><dd data-calc-amount>—</dd></div>
          <div><dt>Total interest</dt><dd data-calc-interest>—</dd></div>
        </dl>
        <p class="fine">Estimate only. Confirm figures with a licensed mortgage professional.</p>
      </div>
    </div>
  </div>
</section>

<section class="shell sec" aria-labelledby="buy-listings-h">
  ${sectionHead({
    eyebrow: 'Available now',
    title: 'On the market this week',
    action: `<a class="btn btn-ghost" href="/listings/"><span>All listings</span><span class="btn-ic">${icon('arrow')}</span></a>`,
  })}
  <div class="grid-3">${listings.filter((l) => l.status === 'for-sale').slice(0, 3).map(listingCard).join('')}</div>
</section>

${faqSection(site.faqs.filter((f) => /buy|invest|agent|tour|process/i.test(f.q)), { title: 'Buyer questions' })}

<section class="shell sec">
  <div class="alert-box">
    <div>
      <p class="eyebrow">Start here</p>
      <h2 class="display">Tell us what you're looking for.</h2>
      <p class="lede">We will send back a shortlist, honestly annotated, including the ones we would talk you out of.</p>
    </div>
    ${leadForm(site, {
      id: 'buyer-intake',
      kind: 'buyer_intake',
      heading: 'Buyer enquiry',
      cta: 'Send my brief',
      fields: [
        { name: 'budget', label: 'Budget', type: 'select', options: PRICE_BANDS.map((b) => b[1]) },
        { name: 'timeline', label: 'Timeline', type: 'select', options: ['ASAP', 'Within 3 months', '3–6 months', 'Just researching'] },
        { name: 'preapproved', label: 'Pre-approved?', type: 'select', options: ['Yes', 'Not yet', 'Need a referral'] },
        { name: 'message', label: 'What matters most?', type: 'textarea', placeholder: 'Garage, school catchment, basement suite, quiet street…' },
      ],
    })}
  </div>
</section>`;

  return {
    title: `Buying a Home in Regina: The Full Process | ${site.shortName}`,
    description:
      'A step-by-step guide to buying a home in Regina: pre-approval, showings, offers, condition periods and possession, plus a Canadian mortgage calculator.',
    path: '/buy/',
    body,
    schema: [
      breadcrumbs(site, [{ name: 'Home', path: '/' }, { name: 'Buy', path: '/buy/' }]),
      faqSchema(site.faqs.filter((f) => /buy|invest|agent|tour|process/i.test(f.q))),
      {
        '@type': 'HowTo',
        name: 'How to buy a home in Regina',
        step: [
          'Get a written mortgage pre-approval',
          'Write a needs list and agree it with your agent',
          'Tour eight to fifteen properties',
          'Write an offer with financing and inspection conditions',
          'Complete the condition period',
          'Close with your lawyer and take possession',
        ].map((name, i) => ({ '@type': 'HowToStep', position: i + 1, name })),
      },
    ],
  };
}

/* ----------------------------------------------------------------- sell --- */

export function sell(site, listings) {
  const sold = listings.filter((l) => l.status === 'sold');
  const included = [
    ['Professional photography', 'Wide-angle interiors, twilight exterior, and a drone shot where the lot is the selling point.'],
    ['Measured floor plans', 'Buyers spend longer on a listing with a floor plan than one without. Every listing gets one.'],
    ['Staging consultation', 'A walkthrough with a stager before photos. Usually it is furniture removal, not rental.'],
    ['MLS® and portal syndication', 'REALTOR.ca plus the major portals, populated from one source so nothing goes stale.'],
    ['Paid social campaign', 'Geo-targeted to Regina and the commuter belt for the first fourteen days, when it matters.'],
    ['Weekly written reporting', 'Views, saves, showings, and what feedback actually said. Every Monday, in writing.'],
  ]
    .map((i) => `<li class="inc"><h3>${icon('spark')}${esc(i[0])}</h3><p>${esc(i[1])}</p></li>`)
    .join('');

  const body = `
<section class="shell page-head">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span aria-hidden="true">/</span> <span aria-current="page">Sell</span></nav>
  <p class="eyebrow">Selling in Regina</p>
  <h1 class="display">The first fourteen days<br>decide what you get.</h1>
  <p class="lede">Every buyer already working in your price band sees your listing in the first two weeks. Price it wrong and you spend the same weeks and end lower. Here is how we avoid that.</p>
</section>

<section class="shell sec-tight">
  <div class="card-shell hero-strip">
    <img src="https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1800&q=70"
         alt="A staged Regina living room photographed for a listing" loading="lazy" decoding="async" width="1800" height="800">
  </div>
</section>

<section class="shell sec" id="valuation" aria-labelledby="val2-h">
  <div class="valuation">
    <div class="valuation-copy">
      <p class="eyebrow">Step one</p>
      <h2 class="display" id="val2-h">What is your home<br>actually worth?</h2>
      <p class="lede">A comparable-based range for your address inside one business day, with the three to five sales it was built from and every adjustment we made. No sign on your lawn, no drip campaign.</p>
      <ul class="ticks">
        <li>${icon('spark')}Sales from the last 90 days only</li>
        <li>${icon('spark')}Adjusted for garage, basement, lot and condition</li>
        <li>${icon('spark')}Delivered as a PDF you keep either way</li>
      </ul>
    </div>
    <div class="valuation-form">
      ${leadForm(site, {
        id: 'seller-valuation',
        kind: 'valuation',
        heading: 'Request your valuation',
        sub: 'One business day. No obligation.',
        cta: 'Get my range',
        fields: [
          { name: 'address', label: 'Property address', required: true, wide: true, placeholder: '123 Example Street, Regina', autocomplete: 'street-address' },
          { name: 'property_type', label: 'Property type', type: 'select', options: Object.values(TYPE_LABEL) },
          { name: 'beds', label: 'Bedrooms', type: 'select', options: ['1', '2', '3', '4', '5+'] },
          { name: 'timeline', label: 'Timeline', type: 'select', options: ['Just curious', 'Within 3 months', '3–6 months', '6–12 months'] },
          { name: 'message', label: 'Renovations or anything unusual?', type: 'textarea' },
        ],
      })}
    </div>
  </div>
</section>

<section class="shell sec" aria-labelledby="inc-h">
  ${sectionHead({
    eyebrow: 'Included, not billed back',
    title: 'What the commission covers.',
    lede: 'Published in writing before you sign, including exactly what the co-operating brokerage receives.',
  })}
  <ul class="grid-3 includes">${included}</ul>
</section>

${sold.length ? `
<section class="shell sec" aria-labelledby="sold-h">
  ${sectionHead({ eyebrow: 'Recent results', title: 'Sold by Everline' })}
  <div class="grid-3">${sold.map((l) => listingCard(l)).join('')}</div>
</section>` : ''}

${faqSection(site.faqs.filter((f) => /sell|cost|valuation|worth/i.test(f.q)), { title: 'Seller questions' })}

${ctaBanner()}`;

  return {
    title: `Sell Your Regina Home | Free Home Valuation | ${site.shortName}`,
    description:
      'Free comparable-based home valuation for Regina and area, a published commission schedule, professional photography and floor plans included, and weekly written reporting.',
    path: '/sell/',
    body,
    schema: [
      breadcrumbs(site, [{ name: 'Home', path: '/' }, { name: 'Sell', path: '/sell/' }]),
      faqSchema(site.faqs.filter((f) => /sell|cost|valuation|worth/i.test(f.q))),
    ],
  };
}

/* -------------------------------------------------------- neighbourhoods --- */

export function neighbourhoods(site, listings) {
  const cards = site.neighbourhoods
    .map((n) => {
      const count = listings.filter((l) => l.neighbourhood === n.name && l.status !== 'sold').length;
      return `
    <article class="hood" id="${esc(n.slug)}">
      <div class="card-shell">
        <div class="hood-media"><img src="${esc(n.image)}" alt="Homes in ${esc(n.name)}, Regina area" loading="lazy" decoding="async" width="1200" height="800"></div>
        <div class="hood-body">
          <p class="eyebrow">${esc(n.vibe)}</p>
          <h2>${esc(n.name)}</h2>
          <p>${esc(n.blurb)}</p>
          <dl class="hood-stats">
            <div><dt>Median price</dt><dd>${money(n.medianPrice)}</dd></div>
            <div><dt>Active listings</dt><dd>${count}</dd></div>
          </dl>
          <a class="btn btn-ghost btn-sm" href="/listings/?hood=${encodeURIComponent(n.name)}" data-track="hood_listings" data-track-id="${esc(n.slug)}">
            <span>See ${esc(n.name)} listings</span><span class="btn-ic">${icon('arrow')}</span>
          </a>
        </div>
      </div>
    </article>`;
    })
    .join('');

  const body = `
<section class="shell page-head">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span aria-hidden="true">/</span> <span aria-current="page">Neighbourhoods</span></nav>
  <p class="eyebrow">Regina &amp; area</p>
  <h1 class="display">Six neighbourhoods,<br>honestly described.</h1>
  <p class="lede">Including the trade-off nobody mentions during the showing. Median prices are rolling twelve-month figures for the area, updated monthly.</p>
</section>

<section class="shell sec-tight"><div class="hood-list">${cards}</div></section>

${ctaBanner()}`;

  return {
    title: `Regina Neighbourhood Guide: Prices, Commutes & Trade-offs | ${site.shortName}`,
    description:
      'Harbour Landing, Cathedral, Lakeview, The Greens on Gardiner, White City and downtown Regina compared on median price, character, commute and the honest trade-offs.',
    path: '/neighbourhoods/',
    body,
    schema: [
      breadcrumbs(site, [{ name: 'Home', path: '/' }, { name: 'Neighbourhoods', path: '/neighbourhoods/' }]),
      {
        '@type': 'ItemList',
        name: 'Regina neighbourhoods',
        itemListElement: site.neighbourhoods.map((n, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: n.name,
          url: `${site.url}/neighbourhoods/#${n.slug}`,
        })),
      },
    ],
  };
}

/* --------------------------------------------------------------- guides --- */

export function guidesIndex(site, posts) {
  const body = `
<section class="shell page-head">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span aria-hidden="true">/</span> <span aria-current="page">Guides</span></nav>
  <p class="eyebrow">Guides &amp; market reports</p>
  <h1 class="display">Written so you can<br>argue with us.</h1>
  <p class="lede">Regina market data, buyer and seller guides, and the numbers behind the advice. No gated PDFs, no email wall.</p>
</section>

<section class="shell sec-tight"><div class="grid-3">${posts.map(postCard).join('')}</div></section>

${ctaBanner()}`;

  return {
    title: `Regina Real Estate Guides & Market Reports | ${site.shortName}`,
    description:
      'Monthly Regina market reports, a first-time buyer guide, pricing strategy for sellers, and an honest neighbourhood comparison. Free, ungated.',
    path: '/guides/',
    body,
    schema: [breadcrumbs(site, [{ name: 'Home', path: '/' }, { name: 'Guides', path: '/guides/' }])],
  };
}

export function guideDetail(site, p, posts) {
  const sections = p.body
    .map((s) => `<h2 id="${esc(slugify(s.h))}">${esc(s.h)}</h2><p>${esc(s.p)}</p>`)
    .join('');
  const toc = p.body.map((s) => `<li><a href="#${esc(slugify(s.h))}">${esc(s.h)}</a></li>`).join('');
  const more = posts.filter((o) => o.slug !== p.slug).slice(0, 3);

  const body = `
<section class="shell page-head">
  <nav class="crumbs" aria-label="Breadcrumb">
    <a href="/">Home</a> <span aria-hidden="true">/</span>
    <a href="/guides/">Guides</a> <span aria-hidden="true">/</span>
    <span aria-current="page">${esc(p.title)}</span>
  </nav>
  <p class="eyebrow">${esc(p.category)} · ${p.readMinutes} min read</p>
  <h1 class="display">${esc(p.title)}</h1>
  <p class="lede">${esc(p.excerpt)}</p>
  <p class="byline">By ${esc(site.agent.name)}, ${esc(site.agent.title)} ·
    <time datetime="${esc(p.date)}">${dateLong(p.date)}</time>${p.updated !== p.date ? ` · updated <time datetime="${esc(p.updated)}">${dateLong(p.updated)}</time>` : ''}</p>
</section>

<section class="shell sec-tight">
  <div class="card-shell hero-strip">
    <img src="${esc(p.image)}" alt="${esc(p.title)}" fetchpriority="high" decoding="async" width="1800" height="800">
  </div>
</section>

<section class="shell sec-tight">
  <div class="article">
    <aside class="article-toc"><div class="sticky"><h2>On this page</h2><ul>${toc}</ul></div></aside>
    <article class="article-body prose">${sections}</article>
  </div>
</section>

<section class="shell sec" aria-labelledby="more-h">
  ${sectionHead({ eyebrow: 'Keep reading', title: 'More guides' })}
  <div class="grid-3">${more.map(postCard).join('')}</div>
</section>

${ctaBanner()}`;

  return {
    title: `${p.title} | ${site.shortName}`,
    description: p.excerpt,
    path: `/guides/${p.slug}/`,
    ogType: 'article',
    ogImage: p.image,
    ogAlt: p.title,
    body,
    schema: [
      breadcrumbs(site, [
        { name: 'Home', path: '/' },
        { name: 'Guides', path: '/guides/' },
        { name: p.title, path: `/guides/${p.slug}/` },
      ]),
      {
        '@type': 'Article',
        headline: p.title,
        description: p.excerpt,
        image: p.image,
        datePublished: p.date,
        dateModified: p.updated,
        articleSection: p.category,
        author: { '@type': 'Person', name: site.agent.name, jobTitle: site.agent.title },
        publisher: { '@id': site.url + '#org' },
        mainEntityOfPage: `${site.url}/guides/${p.slug}/`,
      },
    ],
  };
}

const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* ---------------------------------------------------------------- about --- */

export function about(site) {
  const body = `
<section class="shell page-head">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span aria-hidden="true">/</span> <span aria-current="page">About</span></nav>
  <p class="eyebrow">About</p>
  <h1 class="display">A brokerage built<br>around one idea.</h1>
  <p class="lede">A client should never have to guess what happens next. Everything else follows from that.</p>
</section>

<section class="shell sec-tight">
  <div class="split">
    <div class="split-media">
      <div class="card-shell">
        <img src="${esc(site.agent.photo)}" alt="${esc(site.agent.name)}, ${esc(site.agent.title)} at ${esc(site.name)}" loading="lazy" decoding="async" width="900" height="1100">
      </div>
    </div>
    <div class="split-copy">
      <p class="eyebrow">${esc(site.agent.title)}</p>
      <h2 class="display">${esc(site.agent.name)}</h2>
      <p class="lede">${esc(site.agent.bio)}</p>
      <p class="prose">Before real estate, Avery spent nine years in commercial underwriting, which is where the habit of showing the arithmetic comes from. Everline has four agents and deliberately stays small: every file is handled by the person you met, not passed to a coordinator you have never spoken to.</p>
      <p class="prose">We are members of the Saskatchewan REALTORS® Association and abide by the CREA REALTOR® Code. ${esc(site.agent.licence)}.</p>
      <div class="row">
        <a class="btn btn-dark" href="/contact/"><span>Book a call</span><span class="btn-ic">${icon('arrow')}</span></a>
        <a class="btn btn-ghost" href="tel:${esc(site.contact.phone)}">${icon('phone')}<span>${esc(site.contact.phoneDisplay)}</span></a>
      </div>
    </div>
  </div>
</section>

<section class="band" aria-label="Track record">
  <div class="shell stats">${site.stats.map((s) => `<div class="stat"><p class="stat-v">${esc(s.value)}</p><p class="stat-l">${esc(s.label)}</p></div>`).join('')}</div>
</section>

${testimonials(site.testimonials)}

${faqSection(site.faqs)}

${ctaBanner()}`;

  return {
    title: `About ${site.name} | Regina Real Estate Brokerage`,
    description: `${site.agent.name} and the ${site.name} team have closed more than 640 Regina transactions since ${site.founded}. Small on purpose, and every file stays with the person you met.`,
    path: '/about/',
    body,
    schema: [
      breadcrumbs(site, [{ name: 'Home', path: '/' }, { name: 'About', path: '/about/' }]),
      {
        '@type': 'Person',
        name: site.agent.name,
        jobTitle: site.agent.title,
        image: site.agent.photo,
        worksFor: { '@id': site.url + '#org' },
        description: site.agent.bio,
      },
      faqSchema(site.faqs),
    ],
  };
}

/* -------------------------------------------------------------- contact --- */

export function contact(site) {
  const body = `
<section class="shell page-head">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span aria-hidden="true">/</span> <span aria-current="page">Contact</span></nav>
  <p class="eyebrow">Contact</p>
  <h1 class="display">Ask us something<br>specific.</h1>
  <p class="lede">Same-day answers on weekdays. If we cannot answer properly the same day, you get a holding reply telling you when.</p>
</section>

<section class="shell sec-tight">
  <div class="contact-grid">
    <div class="contact-info">
      <div class="card-shell contact-card">
        <h2>Everline Property Group</h2>
        <ul class="plain">
          <li>${icon('pin')}${esc(site.contact.street)}<br><span class="ind">${esc(site.contact.locality)}, ${esc(site.region)} ${esc(site.contact.postalCode)}</span></li>
          <li>${icon('phone')}<a href="tel:${esc(site.contact.phone)}" data-track="contact_phone">${esc(site.contact.phoneDisplay)}</a></li>
          <li>${icon('mail')}<a href="mailto:${esc(site.contact.email)}" data-track="contact_email">${esc(site.contact.email)}</a></li>
          <li>${icon('calendar')}${esc(site.contact.hours)}</li>
        </ul>
      </div>
      <div class="map card-shell">
        <iframe title="Map showing the ${esc(site.name)} office"
          src="https://www.google.com/maps?q=${encodeURIComponent(site.contact.street + ', ' + site.contact.locality + ', SK')}&output=embed"
          loading="lazy" referrerpolicy="no-referrer-when-downgrade" width="900" height="400"></iframe>
      </div>
    </div>
    <div class="contact-form">
      ${leadForm(site, {
        id: 'general-contact',
        kind: 'general',
        heading: 'Send a message',
        sub: 'We read every one of these ourselves.',
        cta: 'Send message',
        fields: [
          { name: 'topic', label: 'What is this about?', type: 'select', options: ['Buying', 'Selling', 'Both', 'Investment property', 'Something else'] },
          { name: 'message', label: 'Message', type: 'textarea', required: true, placeholder: 'Tell us what you are trying to do.' },
        ],
      })}
    </div>
  </div>
</section>`;

  return {
    title: `Contact ${site.name} | Regina, SK`,
    description: `Reach ${site.name} in Regina at ${site.contact.phoneDisplay} or ${site.contact.email}. Same-day answers on weekdays.`,
    path: '/contact/',
    body,
    schema: [
      breadcrumbs(site, [{ name: 'Home', path: '/' }, { name: 'Contact', path: '/contact/' }]),
      { '@type': 'ContactPage', name: 'Contact', mainEntity: { '@id': site.url + '#org' } },
    ],
  };
}

/* ---------------------------------------------------------------- legal --- */

export function privacy(site) {
  const body = `
<section class="shell page-head">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span aria-hidden="true">/</span> <span aria-current="page">Privacy</span></nav>
  <h1 class="display">Privacy policy</h1>
  <p class="lede">Last updated 13 September 2026. This describes what this website actually collects, which is less than most.</p>
</section>
<section class="shell sec-tight"><div class="article-body prose narrow">
  <h2>Who we are</h2>
  <p>${esc(site.name)}, ${esc(site.contact.street)}, ${esc(site.contact.locality)}, ${esc(site.region)} ${esc(site.contact.postalCode)}. Questions about this policy or about your data go to <a href="mailto:${esc(site.contact.email)}">${esc(site.contact.email)}</a>.</p>

  <h2>What we collect when you submit a form</h2>
  <p>Your name, email address, and optionally your phone number, plus whatever you type into the message, address or criteria fields. We also record which page the form was submitted from, the referring site, and any campaign parameter in the URL, so we know which marketing is worth paying for. Nothing else.</p>
  <p>We use this to answer you and, if you ask for property alerts, to send those alerts. We do not sell it, rent it, or hand it to a third-party marketing list. Form submissions are transmitted over HTTPS to our form processor and delivered to our office email.</p>

  <h2>What we collect automatically</h2>
  <p>Anonymous usage measurement: pages viewed, how far down a page you scrolled, which listings and buttons were clicked, approximate time on page, screen size, and referrer. A random identifier is stored in your browser's local storage so repeat visits in the same browser can be grouped into a session. It is not linked to your name or email unless you submit a form, it is not shared across sites, and it contains nothing about you personally.</p>
  <p>We do not set advertising cookies and we do not run cross-site trackers. That is why there is no cookie banner on this site.</p>

  <h2>Third parties</h2>
  <ul>
    <li><strong>Google Fonts</strong> — serves the typefaces used on this site.</li>
    <li><strong>Unsplash</strong> — serves photography.</li>
    <li><strong>Google Maps</strong> — renders the embedded maps on listing and contact pages. Google receives your IP address when a map loads.</li>
    <li><strong>Our form processor</strong> — receives and relays form submissions.</li>
    <li><strong>Cloudflare</strong> — serves this site and filters abusive traffic.</li>
  </ul>

  <h2>How long we keep it</h2>
  <p>Enquiries are kept for 24 months from your last contact with us, then deleted. Records we are required to retain under Saskatchewan real estate legislation or the REALTOR® Code are kept for the period that legislation requires. Anonymous usage measurement is retained for 14 months in aggregate.</p>

  <h2>Your rights</h2>
  <p>Under PIPEDA you can ask us what personal information we hold about you, ask for it to be corrected, ask for it to be deleted, and withdraw consent to be contacted at any time. Email us and we will action it within 30 days at no charge. If you are not satisfied with our response, you may complain to the Office of the Privacy Commissioner of Canada.</p>

  <h2>Opting out of measurement</h2>
  <p>Turning on your browser's Do Not Track or Global Privacy Control signal stops this site's analytics from recording anything. Clearing site data removes the anonymous identifier.</p>

  <h2>Listing data</h2>
  <p>Property information on this site originates from the MLS® System and is deemed reliable but is not guaranteed accurate by ${esc(site.name)} or by The Canadian Real Estate Association. Verify all measurements, taxes, condo fees and boundaries independently before relying on them.</p>
</div></section>`;

  return {
    title: `Privacy Policy | ${site.shortName}`,
    description: 'What this website collects, how long it is kept, who it is shared with, and how to have it deleted.',
    path: '/privacy/',
    body,
    schema: [breadcrumbs(site, [{ name: 'Home', path: '/' }, { name: 'Privacy', path: '/privacy/' }])],
  };
}

export function terms(site) {
  const body = `
<section class="shell page-head">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span aria-hidden="true">/</span> <span aria-current="page">Terms</span></nav>
  <h1 class="display">Terms of use</h1>
  <p class="lede">Last updated 13 September 2026.</p>
</section>
<section class="shell sec-tight"><div class="article-body prose narrow">
  <h2>Use of this site</h2>
  <p>This site is provided for personal, non-commercial use by consumers interested in purchasing or selling real estate in Saskatchewan. Automated scraping, bulk downloading, or republishing of the listing content is not permitted.</p>

  <h2>Listing information</h2>
  <p>Listing data is sourced from the MLS® System and is believed accurate but is not warranted. Prices, availability, taxes, condo fees, measurements and school catchments change and should be independently verified. Nothing on this site constitutes an offer, and no agency relationship is created by browsing it or by submitting a form.</p>

  <h2>Estimates and tools</h2>
  <p>The mortgage calculator and any valuation range shown on this site are estimates for general guidance only. They are not an offer of credit, an appraisal, or professional financial advice. Confirm figures with a licensed mortgage professional, an appraiser, or your lawyer before acting on them.</p>

  <h2>Trademarks</h2>
  <p>MLS®, Multiple Listing Service®, REALTOR®, REALTORS® and the associated logos are trademarks owned or controlled by The Canadian Real Estate Association, used under licence by members.</p>

  <h2>Liability</h2>
  <p>${esc(site.name)} is not liable for indirect or consequential loss arising from use of this website or reliance on information published on it, to the extent permitted by Saskatchewan law.</p>

  <h2>Governing law</h2>
  <p>These terms are governed by the laws of the Province of Saskatchewan and the federal laws of Canada applicable in it.</p>
</div></section>`;

  return {
    title: `Terms of Use | ${site.shortName}`,
    description: 'Terms governing use of this website, its listing data, and its estimate tools.',
    path: '/terms/',
    body,
    schema: [breadcrumbs(site, [{ name: 'Home', path: '/' }, { name: 'Terms', path: '/terms/' }])],
  };
}

export function notFound(site, listings) {
  const body = `
<section class="shell page-head">
  <p class="eyebrow">404</p>
  <h1 class="display">That page isn't here.</h1>
  <p class="lede">A listing that has sold, or a link that has moved. Either way, here is somewhere useful to go.</p>
  <div class="row">
    <a class="btn btn-dark" href="/listings/"><span>Browse listings</span><span class="btn-ic">${icon('arrow')}</span></a>
    <a class="btn btn-ghost" href="/contact/"><span>Contact us</span></a>
  </div>
</section>
<section class="shell sec"><div class="grid-3">${listings.filter((l) => l.status === 'for-sale').slice(0, 3).map(listingCard).join('')}</div></section>`;

  return {
    title: `Page not found | ${site.shortName}`,
    description:
      'The page you were looking for is not here — it may be a listing that has sold or a link that has moved. Browse current Regina listings instead.',
    path: '/404.html',
    body,
    schema: [],
  };
}
