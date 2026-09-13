import { esc, money, num, icon, dateLong } from './layout.mjs';

export const STATUS_LABEL = {
  'for-sale': 'For sale',
  pending: 'Pending',
  sold: 'Sold',
};

export const TYPE_LABEL = {
  house: 'House',
  condo: 'Condo',
  townhouse: 'Townhouse',
  'multi-family': 'Multi-family',
  acreage: 'Acreage',
};

export function listingCard(l, { eager = false } = {}) {
  const img = l.images[0];
  const alt = `${l.title}, ${TYPE_LABEL[l.type]} for sale in ${l.neighbourhood}, ${l.city}`;
  return `
<article class="card listing-card" data-listing="${esc(l.slug)}"
  data-price="${l.price}" data-beds="${l.beds}" data-baths="${l.baths}"
  data-type="${esc(l.type)}" data-status="${esc(l.status)}"
  data-hood="${esc(l.neighbourhood)}" data-sqft="${l.sqft}" data-listed="${esc(l.listedOn)}">
  <div class="card-shell">
    <a class="card-media" href="/listings/${esc(l.slug)}/" tabindex="-1" aria-hidden="true">
      <img src="${esc(img)}" alt="" loading="${eager ? 'eager' : 'lazy'}" decoding="async" width="800" height="600">
      <span class="chip chip-${esc(l.status)}">${STATUS_LABEL[l.status]}</span>
    </a>
    <div class="card-body">
      <p class="card-meta">
        <span>${icon('bed')}${l.beds} bed</span>
        <span>${icon('bath')}${l.baths} bath</span>
        <span>${icon('area')}${num(l.sqft)} ft²</span>
      </p>
      <h3 class="card-title"><a href="/listings/${esc(l.slug)}/" data-track="listing_click" data-track-id="${esc(l.mls)}">${esc(l.title)}</a></h3>
      <p class="card-sub">${icon('pin')}${esc(l.neighbourhood)}, ${esc(l.city)}</p>
      <p class="card-price">${money(l.status === 'sold' ? l.soldPrice : l.price)}<span class="sr-only"> ${alt}</span></p>
    </div>
  </div>
</article>`;
}

export function sectionHead({ eyebrow, title, lede, action }) {
  return `
<div class="sec-head">
  <div>
    ${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}
    <h2 class="display">${title}</h2>
    ${lede ? `<p class="lede">${lede}</p>` : ''}
  </div>
  ${action ? `<div class="sec-head-action">${action}</div>` : ''}
</div>`;
}

export function faqSection(faqs, { title = 'Frequently asked questions', lede = '' } = {}) {
  const items = faqs
    .map(
      (f) => `
  <details class="faq-item" data-track="faq_open" data-track-id="${esc(f.q)}">
    <summary><span>${esc(f.q)}</span>${icon('chev', 'faq-chev')}</summary>
    <div class="faq-body"><p>${esc(f.a)}</p></div>
  </details>`
    )
    .join('');
  return `
<section class="shell sec" id="faq" aria-labelledby="faq-h">
  <div class="faq-grid">
    <div class="faq-intro">
      <p class="eyebrow">Questions</p>
      <h2 class="display" id="faq-h">${esc(title)}</h2>
      ${lede ? `<p class="lede">${esc(lede)}</p>` : ''}
      <div class="faq-aside">
        <img src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=800&q=70"
             alt="Interior of a renovated Regina living room with natural light" loading="lazy" decoding="async" width="800" height="600">
      </div>
    </div>
    <div class="faq-list">${items}</div>
  </div>
</section>`;
}

export function faqSchema(faqs) {
  return {
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

export function testimonials(items) {
  const slides = items
    .map(
      (t, i) => `
  <figure class="tst" role="group" aria-roledescription="slide" aria-label="${i + 1} of ${items.length}"${i ? ' hidden' : ''}>
    <div class="tst-photo"><img src="${esc(t.photo)}" alt="Portrait of ${esc(t.name)}" loading="lazy" decoding="async" width="600" height="700"></div>
    <div class="tst-body">
      ${icon('quote', 'tst-quote')}
      <blockquote><p>${esc(t.quote)}</p></blockquote>
      <figcaption><strong>${esc(t.name)}</strong><span>${esc(t.role)}</span></figcaption>
    </div>
  </figure>`
    )
    .join('');
  return `
<section class="shell sec" aria-labelledby="tst-h">
  <div class="sec-head">
    <div>
      <p class="eyebrow">Clients</p>
      <h2 class="display" id="tst-h">What it's like<br>working with us.</h2>
    </div>
    <div class="sec-head-action">
      <div class="tst-nav">
        <button type="button" class="rnd" data-tst="prev" aria-label="Previous testimonial">${icon('chev', 'rot90')}</button>
        <button type="button" class="rnd" data-tst="next" aria-label="Next testimonial">${icon('chev', 'rot-90')}</button>
      </div>
    </div>
  </div>
  <div class="tst-stage" data-tst-stage aria-live="polite">${slides}</div>
</section>`;
}

export function ctaBanner() {
  return `
<section class="shell sec">
  <div class="cta">
    <img class="cta-bg" src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=60"
         alt="" loading="lazy" decoding="async" aria-hidden="true" width="1600" height="700">
    <div class="cta-inner">
      <h2 class="display">Thinking about<br>making a move?</h2>
      <p>One call gets you a straight answer on price, timing and what it'll cost.</p>
      <a class="btn btn-cream" href="/contact/" data-track="cta_banner">
        <span>Get started</span><span class="btn-ic">${icon('arrow')}</span>
      </a>
    </div>
  </div>
</section>`;
}

export function postCard(p) {
  return `
<article class="card post-card">
  <div class="card-shell">
    <a class="card-media" href="/guides/${esc(p.slug)}/" tabindex="-1" aria-hidden="true">
      <img src="${esc(p.image)}" alt="" loading="lazy" decoding="async" width="800" height="520">
    </a>
    <div class="card-body">
      <p class="card-meta"><span>${esc(p.category)}</span><span>${p.readMinutes} min read</span></p>
      <h3 class="card-title"><a href="/guides/${esc(p.slug)}/" data-track="guide_click" data-track-id="${esc(p.slug)}">${esc(p.title)}</a></h3>
      <p class="card-sub">${esc(p.excerpt)}</p>
      <p class="card-date"><time datetime="${esc(p.date)}">${dateLong(p.date)}</time></p>
    </div>
  </div>
</article>`;
}

/** Lead form. Every variant shares one markup path so spam defences stay in one place. */
export function leadForm(site, { id, heading, sub, kind, fields = [], cta = 'Send' }) {
  const extra = fields
    .map((f) => {
      if (f.type === 'select') {
        return `<label class="fld"><span>${esc(f.label)}</span>
        <select name="${esc(f.name)}"${f.required ? ' required' : ''}>${f.options
          .map((o) => `<option value="${esc(o)}">${esc(o)}</option>`)
          .join('')}</select></label>`;
      }
      if (f.type === 'textarea') {
        return `<label class="fld fld-wide"><span>${esc(f.label)}</span>
        <textarea name="${esc(f.name)}" rows="4" maxlength="2000"${f.required ? ' required' : ''} placeholder="${esc(f.placeholder || '')}"></textarea></label>`;
      }
      return `<label class="fld${f.wide ? ' fld-wide' : ''}"><span>${esc(f.label)}</span>
      <input type="${esc(f.type || 'text')}" name="${esc(f.name)}"${f.required ? ' required' : ''} ${f.autocomplete ? `autocomplete="${esc(f.autocomplete)}"` : ''} maxlength="200" placeholder="${esc(f.placeholder || '')}"></label>`;
    })
    .join('');

  return `
<form class="lead-form" id="${esc(id)}" method="POST" action="${esc(site.forms.endpoint)}" data-lead="${esc(kind)}" novalidate>
  <input type="hidden" name="access_key" value="${esc(site.forms.accessKey)}">
  <input type="hidden" name="subject" value="${esc(heading)} — ${esc(site.name)} website">
  <input type="hidden" name="from_name" value="${esc(site.name)} website">
  <input type="hidden" name="lead_type" value="${esc(kind)}">
  <input type="hidden" name="page" value="" data-fill="page">
  <input type="hidden" name="referrer" value="" data-fill="referrer">
  <input type="hidden" name="campaign" value="" data-fill="campaign">
  <!-- Honeypot: real users never see or fill this. -->
  <div class="hp" aria-hidden="true"><label>Leave this empty<input type="text" name="botcheck" tabindex="-1" autocomplete="off"></label></div>
  <div class="form-head">
    <h3>${esc(heading)}</h3>
    ${sub ? `<p>${esc(sub)}</p>` : ''}
  </div>
  <div class="form-grid">
    <label class="fld"><span>Name</span><input type="text" name="name" required autocomplete="name" maxlength="120" placeholder="Your name"></label>
    <label class="fld"><span>Email</span><input type="email" name="email" required autocomplete="email" maxlength="200" placeholder="you@example.com"></label>
    <label class="fld"><span>Phone</span><input type="tel" name="phone" autocomplete="tel" maxlength="40" placeholder="(306) 555-0000"></label>
    ${extra}
  </div>
  <label class="consent">
    <input type="checkbox" name="consent" required>
    <span>I'm happy to be contacted about this and I've read the <a href="/privacy/">privacy policy</a>. You can withdraw that any time.</span>
  </label>
  ${site.forms.turnstileSiteKey ? `<div class="cf-turnstile" data-sitekey="${esc(site.forms.turnstileSiteKey)}"></div>` : ''}
  <button class="btn btn-dark btn-block" type="submit" data-track="form_submit" data-track-id="${esc(kind)}">
    <span>${esc(cta)}</span><span class="btn-ic">${icon('arrow')}</span>
  </button>
  <p class="form-status" role="status" aria-live="polite"></p>
</form>`;
}
