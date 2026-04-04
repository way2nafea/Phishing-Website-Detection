/**
 * PhishGuard AI — 3D Card Tilt Effect
 * static/js/tilt.js
 *
 * Strategy:
 *   1. If VanillaTilt (CDN) is loaded  → use it (reads data-tilt-* attributes natively)
 *   2. Otherwise                       → fall back to custom vanilla-JS implementation
 *
 * VanillaTilt CDN must be included BEFORE this file:
 *   <script src="https://cdnjs.cloudflare.com/ajax/libs/vanilla-tilt/1.7.0/vanilla-tilt.min.js"></script>
 *   <script src="{{ url_for('static', filename='js/tilt.js') }}"></script>
 */

(function () {
  'use strict';

  /* ─── SHARED CONFIG ──────────────────────────────────────── */
  const TILT_OPTIONS = {
    max:           8,
    speed:         400,
    glare:         true,
    'max-glare':   0.15,
    scale:         1.03,
    perspective:   900,
    easing:        'cubic-bezier(0.03,0.98,0.52,0.99)',
    gyroscope:     false,
  };

  /* All selectors that should receive the tilt effect */
  const SELECTORS = [
    '.stat-card',
    '.content-card',
    '.result-card',
    '.tool-card',
    '.auth-card',
    '.intel-card',
    '.tilt-card',
    '[data-tilt]',
  ].join(', ');

  /* ─── MOBILE CHECK ───────────────────────────────────────── */
  function isMobile() {
    return window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;
  }

  /* ═══════════════════════════════════════════════════════════
   *  PATH A — VanillaTilt CDN is available
   * ═══════════════════════════════════════════════════════════ */
  function initWithVanillaTilt() {
    if (isMobile()) return;

    const elements = document.querySelectorAll(SELECTORS);
    if (!elements.length) return;

    VanillaTilt.init(elements, TILT_OPTIONS);

    /* Watch for dynamically added cards */
    const observer = new MutationObserver(mutations => {
      mutations.forEach(m => {
        m.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;
          const targets = [];
          if (node.matches && node.matches(SELECTORS)) targets.push(node);
          if (node.querySelectorAll) {
            node.querySelectorAll(SELECTORS).forEach(el => targets.push(el));
          }
          if (targets.length) VanillaTilt.init(targets, TILT_OPTIONS);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  /* ═══════════════════════════════════════════════════════════
   *  PATH B — Custom vanilla-JS fallback (no CDN dependency)
   * ═══════════════════════════════════════════════════════════ */

  /* ─── CUSTOM CONFIG ─ */
  const CFG = {
    maxTilt:       8,
    glareOpacity:  0.15,
    perspective:   900,
    scale:         1.03,
    speed:         400,
    easing:        'cubic-bezier(0.03,0.98,0.52,0.99)',
    glareSize:     70,
    resetDuration: 600,
  };

  /* ─── BUILD GLARE OVERLAY ─ */
  function createGlare(card) {
    const wrap = document.createElement('div');
    wrap.className = 'pg-tilt-glare';
    Object.assign(wrap.style, {
      position:      'absolute',
      inset:         '0',
      pointerEvents: 'none',
      borderRadius:  'inherit',
      zIndex:        '99',
      overflow:      'hidden',
    });

    const inner = document.createElement('div');
    inner.className = 'pg-tilt-glare-inner';
    Object.assign(inner.style, {
      position:     'absolute',
      width:        `${CFG.glareSize * 2}%`,
      height:       `${CFG.glareSize * 2}%`,
      borderRadius: '50%',
      background:   `radial-gradient(ellipse at center,
                       rgba(255,255,255,${CFG.glareOpacity}) 0%,
                       rgba(255,255,255,0) 70%)`,
      transform:    'translate(-50%,-50%)',
      left:         '50%',
      top:          '0%',
      opacity:      '0',
      transition:   `opacity ${CFG.speed}ms ${CFG.easing}`,
    });

    wrap.appendChild(inner);
    const pos = getComputedStyle(card).position;
    if (!pos || pos === 'static') card.style.position = 'relative';
    card.appendChild(wrap);
    return inner;
  }

  /* ─── APPLY TILT TO ONE ELEMENT ─ */
  function applyTilt(card) {
    if (card._pgTiltInit) return;
    card._pgTiltInit = true;

    card.style.transformStyle = 'preserve-3d';
    card.style.willChange     = 'transform';
    card.style.transition     = `transform ${CFG.speed}ms ${CFG.easing}`;

    const glareEl = createGlare(card);
    let raf = null;
    let targetRX = 0, targetRY = 0;
    let curRX    = 0, curRY    = 0;

    function lerp(a, b, t) { return a + (b - a) * t; }

    function animate() {
      curRX = lerp(curRX, targetRX, 0.12);
      curRY = lerp(curRY, targetRY, 0.12);

      card.style.transform = `
        perspective(${CFG.perspective}px)
        rotateX(${curRX}deg)
        rotateY(${curRY}deg)
        scale3d(${CFG.scale},${CFG.scale},${CFG.scale})
      `;

      if (Math.abs(curRX - targetRX) > 0.01 || Math.abs(curRY - targetRY) > 0.01) {
        raf = requestAnimationFrame(animate);
      } else {
        raf = null;
      }
    }

    function onMove(e) {
      if (isMobile()) return;
      const rect  = card.getBoundingClientRect();
      const dx    = (e.clientX - rect.left - rect.width  / 2) / (rect.width  / 2);
      const dy    = (e.clientY - rect.top  - rect.height / 2) / (rect.height / 2);

      targetRY = dx *  CFG.maxTilt;
      targetRX = dy * -CFG.maxTilt;

      glareEl.style.left    = `${((e.clientX - rect.left) / rect.width)  * 100}%`;
      glareEl.style.top     = `${((e.clientY - rect.top)  / rect.height) * 100}%`;
      glareEl.style.opacity = '1';

      if (!raf) raf = requestAnimationFrame(animate);
    }

    function onEnter() {
      if (isMobile()) return;
      card.style.transition  = `transform ${CFG.speed}ms ${CFG.easing}`;
      glareEl.style.opacity  = '1';
      glareEl.style.transition = `opacity ${CFG.speed}ms ease, left 0.1s ease, top 0.1s ease`;
    }

    function onLeave() {
      if (isMobile()) return;
      targetRX = 0; targetRY = 0;
      glareEl.style.opacity = '0';
      if (!raf) raf = requestAnimationFrame(animate);

      setTimeout(() => {
        curRX = 0; curRY = 0;
        card.style.transform = `
          perspective(${CFG.perspective}px)
          rotateX(0deg) rotateY(0deg) scale3d(1,1,1)
        `;
      }, CFG.resetDuration);
    }

    card.addEventListener('mousemove',  onMove,  { passive: true });
    card.addEventListener('mouseenter', onEnter, { passive: true });
    card.addEventListener('mouseleave', onLeave, { passive: true });
  }

  function initAll() {
    if (isMobile()) return;
    document.querySelectorAll(SELECTORS).forEach(applyTilt);
  }

  function watchDom() {
    if (isMobile()) return;
    const observer = new MutationObserver(mutations => {
      mutations.forEach(m => {
        m.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;
          if (node.matches && node.matches(SELECTORS)) applyTilt(node);
          if (node.querySelectorAll) node.querySelectorAll(SELECTORS).forEach(applyTilt);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  /* ═══════════════════════════════════════════════════════════
   *  BOOT — pick the right path and initialise
   * ═══════════════════════════════════════════════════════════ */
  function boot() {
    if (isMobile()) return;

    if (typeof window.VanillaTilt !== 'undefined') {
      /* ── VanillaTilt CDN loaded ── */
      initWithVanillaTilt();
    } else {
      /* ── Custom fallback ── */
      initAll();
      watchDom();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* ─── PUBLIC API ─────────────────────────────────────────── */
  window.PhishGuardTilt = {
    init:     boot,
    isMobile: isMobile,
  };

})();