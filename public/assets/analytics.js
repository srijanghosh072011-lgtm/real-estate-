/* Everline — first-party behaviour analytics.
 *
 * Records how people actually use the site: what they scroll past, which
 * listings they open, which filters they set, where they abandon a form.
 * No cookies, no cross-site identifiers, no personal data. Honours Do Not
 * Track and Global Privacy Control.
 *
 * Events are batched and flushed with sendBeacon. Set the endpoint in
 * data/site.json (analytics.endpoint) to receive them; with no endpoint the
 * events still reach GA4 / Plausible if either is configured, and otherwise
 * go nowhere. Call window.track(name, props) from anywhere.
 */
(() => {
  'use strict';

  const OPTED_OUT =
    navigator.doNotTrack === '1' ||
    window.doNotTrack === '1' ||
    navigator.globalPrivacyControl === true;

  if (OPTED_OUT) {
    window.track = () => {};
    return;
  }

  const ENDPOINT = (window.__ANALYTICS__ || {}).endpoint || '';
  const KEY = 'ev_vid';
  const SESSION_KEY = 'ev_sid';

  const uid = () =>
    (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()).slice(0, 36);

  // localStorage throws in some privacy modes — never let that break the page.
  const store = (area, key, make) => {
    try {
      const existing = area.getItem(key);
      if (existing) return existing;
      const fresh = make();
      area.setItem(key, fresh);
      return fresh;
    } catch {
      return 'anon';
    }
  };

  const visitorId = store(localStorage, KEY, uid);
  const sessionId = store(sessionStorage, SESSION_KEY, uid);

  const base = () => ({
    v: visitorId,
    s: sessionId,
    path: location.pathname,
    ref: document.referrer.slice(0, 300),
    w: window.innerWidth,
    h: window.innerHeight,
    t: Date.now(),
  });

  /* ------------------------------------------------------------- queue --- */
  let queue = [];
  let flushTimer = null;

  function flush() {
    clearTimeout(flushTimer);
    flushTimer = null;
    if (!queue.length || !ENDPOINT) {
      queue = [];
      return;
    }
    const payload = JSON.stringify({ events: queue });
    queue = [];
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: 'application/json' }));
      } else {
        fetch(ENDPOINT, { method: 'POST', body: payload, keepalive: true, headers: { 'Content-Type': 'application/json' } });
      }
    } catch {
      /* measurement must never surface an error to a visitor */
    }
  }

  function track(name, props = {}) {
    queue.push({ name, ...base(), ...props });
    if (!flushTimer) flushTimer = setTimeout(flush, 4000);
    if (queue.length >= 20) flush();

    // Mirror into whichever vendor tag is configured, if any.
    if (typeof window.gtag === 'function') window.gtag('event', name, props);
    if (typeof window.plausible === 'function') window.plausible(name, { props });
  }

  window.track = track;

  /* --------------------------------------------------------- pageview --- */
  const started = performance.now();
  track('pageview', { title: document.title.slice(0, 120) });

  /* ----------------------------------------------------- scroll depth --- */
  // rAF-throttled scroll listener: one read per frame, no layout thrash.
  const marks = [25, 50, 75, 100];
  const hit = new Set();
  let ticking = false;

  const measure = () => {
    ticking = false;
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const pct = max > 0 ? Math.round(((window.scrollY || 0) / max) * 100) : 100;
    for (const m of marks) {
      if (pct >= m && !hit.has(m)) {
        hit.add(m);
        track('scroll_depth', { depth: m });
      }
    }
  };

  addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(measure);
    },
    { passive: true }
  );

  /* ------------------------------------------------ declarative clicks --- */
  addEventListener(
    'click',
    (e) => {
      const el = e.target.closest('[data-track]');
      if (el) track(el.dataset.track, { id: el.dataset.trackId || el.textContent.trim().slice(0, 60) });

      const link = e.target.closest('a[href]');
      if (link && link.host && link.host !== location.host) {
        track('outbound_click', { href: link.href.slice(0, 200) });
      }
    },
    { capture: true, passive: true }
  );

  /* ---------------------------------------------- section visibility --- */
  // Which sections people actually reach is the most useful thing on a long page.
  if ('IntersectionObserver' in window) {
    const seen = new WeakSet();
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (!en.isIntersecting || seen.has(en.target)) continue;
          seen.add(en.target);
          const label =
            en.target.getAttribute('aria-labelledby') ||
            en.target.getAttribute('aria-label') ||
            en.target.id ||
            'section';
          track('section_view', { section: label.slice(0, 60) });
        }
      },
      { threshold: 0.4 }
    );
    document.querySelectorAll('section[aria-labelledby], section[aria-label], section[id]').forEach((s) => io.observe(s));
  }

  /* ------------------------------------------------------ form funnel --- */
  // Which forms get started versus finished tells you where copy is failing.
  document.querySelectorAll('.lead-form').forEach((form) => {
    let started = false;
    form.addEventListener(
      'input',
      () => {
        if (started) return;
        started = true;
        track('form_start', { kind: form.dataset.lead });
      },
      { once: false }
    );
  });

  /* ------------------------------------------------------ engagement --- */
  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    track('page_exit', { seconds: Math.round((performance.now() - started) / 1000), maxDepth: Math.max(0, ...hit) });
    flush();
  };
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') end();
  });
  addEventListener('pagehide', end);
})();
