/* Everline — UI behaviour. Vanilla, no dependencies, no build step. */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const cad = (n) =>
    n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 });

  /* ------------------------------------------------------------- nav --- */
  const burger = $('.burger');
  const sheet = $('#mobile-menu');
  if (burger && sheet) {
    const setOpen = (open) => {
      sheet.hidden = !open;
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      document.body.classList.toggle('sheet-open', open);
      if (open) sheet.querySelector('a')?.focus();
    };
    burger.addEventListener('click', () => setOpen(sheet.hidden));
    sheet.addEventListener('click', (e) => {
      if (e.target.tagName === 'A' || e.target === sheet) setOpen(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !sheet.hidden) {
        setOpen(false);
        burger.focus();
      }
    });
  }

  /* --------------------------------------------------- scroll reveals --- */
  // Tag section-level blocks once, then observe. Cheaper than authoring the
  // attribute on every element in the templates.
  const REVEAL = '.sec > *, .sec-tight > *, .page-head > *, .hero-copy, .search, .stats > *';
  const targets = $$(REVEAL).filter((el) => !el.closest('[data-reveal]'));
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    targets.forEach((el, i) => {
      el.setAttribute('data-reveal', '');
      el.style.transitionDelay = `${Math.min(i % 6, 5) * 60}ms`;
    });
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }
    );
    targets.forEach((el) => io.observe(el));
  }

  /* ------------------------------------------------------- testimonials --- */
  const stage = $('[data-tst-stage]');
  if (stage) {
    const slides = $$('.tst', stage);
    let idx = 0;
    const show = (n) => {
      idx = (n + slides.length) % slides.length;
      slides.forEach((s, i) => (s.hidden = i !== idx));
    };
    $$('[data-tst]').forEach((b) =>
      b.addEventListener('click', () => show(idx + (b.dataset.tst === 'next' ? 1 : -1)))
    );
  }

  /* ------------------------------------------------------------ gallery --- */
  const galImg = $('#gal-img');
  if (galImg) {
    const thumbs = $$('.gal-thumb');
    thumbs.forEach((t) =>
      t.addEventListener('click', () => {
        galImg.src = t.querySelector('img').src;
        thumbs.forEach((o) => o.classList.toggle('is-active', o === t));
        window.track?.('gallery_view', { index: t.dataset.gal });
      })
    );
  }

  /* --------------------------------------------------------- calculator --- */
  // Canadian mortgages compound semi-annually, not monthly.
  function payment(principal, annualRate, years) {
    const n = years * 12;
    if (principal <= 0 || n <= 0) return 0;
    if (annualRate <= 0) return principal / n;
    const i = Math.pow(1 + annualRate / 100 / 2, 1 / 6) - 1;
    return (principal * i) / (1 - Math.pow(1 + i, -n));
  }

  $$('.calc, .calc-mini').forEach((box) => {
    const get = (k, fallback) => {
      const el = box.querySelector(`[data-calc="${k}"]`);
      const v = el ? parseFloat(el.value) : NaN;
      return Number.isFinite(v) ? v : fallback;
    };
    const out = box.querySelector('[data-calc-out]');
    const amountEl = box.querySelector('[data-calc-amount]');
    const interestEl = box.querySelector('[data-calc-interest]');

    const update = () => {
      const price = Math.max(0, get('price', 0));
      const down = Math.min(100, Math.max(0, get('down', 20)));
      const rate = get('rate', 4.49);
      const years = Math.max(1, get('years', 25));
      const principal = price * (1 - down / 100);
      const m = payment(principal, rate, years);
      if (out) out.textContent = m > 0 ? cad(m) + ' / mo' : '—';
      if (amountEl) amountEl.textContent = cad(principal);
      if (interestEl) interestEl.textContent = cad(Math.max(0, m * years * 12 - principal));
    };

    $$('[data-calc]', box).forEach((el) => el.addEventListener('input', update));
    update();
  });

  /* ------------------------------------------------------------ filters --- */
  const grid = $('#listing-grid');
  const filters = $('#filters');
  if (grid && filters) {
    const cards = $$('.listing-card', grid);
    const countEl = $('#count');
    const empty = $('#empty');

    const read = () => Object.fromEntries(new FormData(filters).entries());

    const apply = (pushUrl = true) => {
      const f = read();
      const [lo, hi] = (f.price || '').split('-').map(Number);
      let shown = 0;

      for (const c of cards) {
        const d = c.dataset;
        const ok =
          (!f.status || d.status === f.status) &&
          (!f.type || d.type === f.type) &&
          (!f.hood || d.hood === f.hood) &&
          (!f.beds || +d.beds >= +f.beds) &&
          (!f.baths || +d.baths >= +f.baths) &&
          (!f.price || (+d.price >= lo && +d.price <= hi));
        c.hidden = !ok;
        if (ok) shown++;
      }

      const key = { 'price-asc': 1, 'price-desc': -1 }[f.sort];
      const sorted = [...cards].sort((a, b) => {
        if (key) return key * (+a.dataset.price - +b.dataset.price);
        if (f.sort === 'sqft') return +b.dataset.sqft - +a.dataset.sqft;
        return b.dataset.listed.localeCompare(a.dataset.listed);
      });
      sorted.forEach((c) => grid.appendChild(c));

      if (countEl) countEl.textContent = shown;
      if (empty) empty.hidden = shown > 0;

      if (pushUrl) {
        const q = new URLSearchParams(Object.entries(f).filter(([, v]) => v));
        history.replaceState(null, '', q.toString() ? `?${q}` : location.pathname);
        window.track?.('filter_apply', { ...f, results: shown });
      }
    };

    // Seed from the query string so links like /listings/?hood=Cathedral work.
    const params = new URLSearchParams(location.search);
    for (const [k, v] of params) {
      const field = filters.elements[k];
      if (field && [...field.options].some((o) => o.value === v)) field.value = v;
    }

    filters.addEventListener('change', () => apply());
    filters.addEventListener('reset', () => setTimeout(() => apply(), 0));
    $('[data-clear]')?.addEventListener('click', () => filters.reset());
    apply(params.toString().length > 0);
  }

  /* -------------------------------------------------------------- forms --- */
  const campaign = (() => {
    const p = new URLSearchParams(location.search);
    return ['utm_source', 'utm_medium', 'utm_campaign', 'gclid', 'fbclid']
      .map((k) => (p.get(k) ? `${k}=${p.get(k)}` : null))
      .filter(Boolean)
      .join('&');
  })();

  $$('.lead-form').forEach((form) => {
    form.querySelector('[data-fill="page"]').value = location.pathname;
    form.querySelector('[data-fill="referrer"]').value = document.referrer.slice(0, 300);
    form.querySelector('[data-fill="campaign"]').value = campaign;

    const status = $('.form-status', form);
    const button = form.querySelector('button[type="submit"]');
    let sending = false;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (sending) return;

      // Honeypot: a filled hidden field is a bot. Fail silently so it retries nothing.
      if (form.elements.botcheck.value) return;

      // Validate here because the form carries novalidate (we want our own messaging).
      const invalid = $$('[required]', form).find((el) =>
        el.type === 'checkbox' ? !el.checked : !el.value.trim() || !el.checkValidity()
      );
      if (invalid) {
        invalid.setAttribute('aria-invalid', 'true');
        invalid.focus();
        status.textContent = 'Please check the highlighted field.';
        status.className = 'form-status err';
        return;
      }
      $$('[aria-invalid]', form).forEach((el) => el.removeAttribute('aria-invalid'));

      sending = true;
      button.disabled = true;
      status.textContent = 'Sending…';
      status.className = 'form-status';

      try {
        const res = await fetch(form.action, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(Object.fromEntries(new FormData(form).entries())),
        });
        if (!res.ok) throw new Error(res.status);
        status.textContent = 'Thank you — we have it. You will hear back within one business day.';
        status.className = 'form-status ok';
        window.track?.('lead_submitted', { kind: form.dataset.lead });
        form.reset();
      } catch (err) {
        // Fall back to whatever contact details the footer already renders.
        const mail = $('.footer a[href^="mailto:"]');
        const tel = $('.footer a[href^="tel:"]');
        status.textContent =
          `That did not send. Please email ${mail ? mail.textContent : ''}` +
          (tel ? ` or call ${tel.textContent}` : '') + '.';
        status.className = 'form-status err';
        window.track?.('lead_failed', { kind: form.dataset.lead });
      } finally {
        sending = false;
        button.disabled = false;
      }
    });
  });
})();
