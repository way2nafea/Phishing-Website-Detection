/**
 * NEXUS — Unified 3D Card Tilt System  v4.0
 * static/js/tilt.js
 *
 * Single source of truth for ALL tilt interactions.
 * Apple-level subtle, smooth, and controlled via CSS variables.
 *
 * Features:
 *   - Max rotation clamped to 4 degrees
 *   - Smooth interpolation via CSS transitions (0.6s cubic-bezier(0.22, 1, 0.36, 1))
 *   - No requestAnimationFrame jitter
 *   - Graceful reset on mouse leave
 *   - Subtle glare overlay
 *   - Works consistently across all pages
 */

(function () {
  'use strict';

  /* ─── CONFIG ──────────────────────────────────────────────── */
  const CFG = {
    maxTilt:       4,          // degrees — subtle, premium feel
    perspective:   1000,       // px
    scale:         1.015,      // very subtle zoom on hover
    glareOpacity:  0.10,       // max glare brightness
    glareSize:     60,         // % radius of glare spotlight
  };

  /* All selectors that receive the tilt effect */
  const SELECTORS = [
    '.stat-card',
    '.content-card',
    '.result-card',
    '.tool-card',
    '.auth-card',
    '.intel-card',
    '.tilt-card',
    '.feat-card',
    '.step-card',
    '[data-tilt]',
  ].join(', ');

  /* ─── MOBILE CHECK ───────────────────────────────────────── */
  function isMobile() {
    return window.matchMedia('(pointer: coarse)').matches
        || window.matchMedia('(hover: none)').matches
        || window.innerWidth < 768;
  }

  /* ─── REDUCED MOTION CHECK ───────────────────────────────── */
  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ─── CLAMP ──────────────────────────────────────────────── */
  function clamp(val, min, max) {
    return Math.min(max, Math.max(min, val));
  }

  /* ─── BUILD GLARE OVERLAY ────────────────────────────────── */
  function createGlare(card) {
    if (card.querySelector('.nexus-tilt-glare')) return null;

    const wrap = document.createElement('div');
    wrap.className = 'nexus-tilt-glare';
    Object.assign(wrap.style, {
      position:      'absolute',
      inset:         '0',
      pointerEvents: 'none',
      borderRadius:  'inherit',
      zIndex:        '99',
      overflow:      'hidden',
    });

    const inner = document.createElement('div');
    inner.className = 'nexus-tilt-glare-inner';
    Object.assign(inner.style, {
      position:     'absolute',
      width:        `${CFG.glareSize * 2}%`,
      height:       `${CFG.glareSize * 2}%`,
      borderRadius: '50%',
      background:   `radial-gradient(ellipse at center,
                       rgba(255,255,255,${CFG.glareOpacity}) 0%,
                       rgba(255,255,255,0) 70%)`,
      transform:    'translate(-50%, -50%)',
      left:         '50%',
      top:          '0%',
      opacity:      '0',
      transition:   'opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1), left 0.2s cubic-bezier(0.22, 1, 0.36, 1), top 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
    });

    wrap.appendChild(inner);

    const pos = getComputedStyle(card).position;
    if (!pos || pos === 'static') card.style.position = 'relative';
    card.appendChild(wrap);

    return inner;
  }

  /* ─── DESTROY EXISTING TILT INSTANCES ────────────────────── */
  function destroyExisting(card) {
    if (card.vanillaTilt) {
      try { card.vanillaTilt.destroy(); } catch(_) {}
      delete card.vanillaTilt;
    }
    card.querySelectorAll('.pg-tilt-glare').forEach(el => el.remove());
  }

  /* ═══════════════════════════════════════════════════════════
   *  APPLY SMOOTH TILT TO ONE ELEMENT
   * ═══════════════════════════════════════════════════════════ */
  function applyTilt(card) {
    if (card._nexusTiltV4) return;
    card._nexusTiltV4 = true;

    destroyExisting(card);

    card.style.transformStyle = 'preserve-3d';
    card.style.willChange     = 'transform';
    // Apple-level smooth motion
    card.style.transition     = 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)';
    // Base transform state using CSS variables
    card.style.setProperty('--tilt-rx', '0deg');
    card.style.setProperty('--tilt-ry', '0deg');
    card.style.setProperty('--tilt-scale', '1');
    card.style.transform = `perspective(${CFG.perspective}px) rotateX(var(--tilt-rx)) rotateY(var(--tilt-ry)) scale3d(var(--tilt-scale), var(--tilt-scale), 1)`;

    const glareEl = createGlare(card);

    function onMouseMove(e) {
      if (isMobile()) return;

      const rect = card.getBoundingClientRect();
      const dx   = (e.clientX - rect.left - rect.width  / 2) / (rect.width  / 2);
      const dy   = (e.clientY - rect.top  - rect.height / 2) / (rect.height / 2);

      // Strict clamping to 4 degrees as requested
      const targetRY = clamp(dx * CFG.maxTilt, -CFG.maxTilt, CFG.maxTilt);
      const targetRX = clamp(dy * -CFG.maxTilt, -CFG.maxTilt, CFG.maxTilt);

      card.style.setProperty('--tilt-rx', `${targetRX.toFixed(2)}deg`);
      card.style.setProperty('--tilt-ry', `${targetRY.toFixed(2)}deg`);
      card.style.setProperty('--tilt-scale', `${CFG.scale}`);

      if (glareEl) {
        const gx = ((e.clientX - rect.left) / rect.width)  * 100;
        const gy = ((e.clientY - rect.top)  / rect.height) * 100;
        glareEl.style.left    = gx + '%';
        glareEl.style.top     = gy + '%';
        glareEl.style.opacity = '1';
      }
    }

    function onMouseEnter() {
      if (isMobile()) return;
      // Use a slightly faster but still smooth transition on entry to prevent "snapping"
      card.style.transition = 'transform 0.2s ease-out';
    }

    function onMouseLeave() {
      if (isMobile()) return;
      // Reset with the premium smooth transition
      card.style.transition = 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)';
      card.style.setProperty('--tilt-rx', '0deg');
      card.style.setProperty('--tilt-ry', '0deg');
      card.style.setProperty('--tilt-scale', '1');

      if (glareEl) {
        glareEl.style.opacity = '0';
      }
    }

    card.addEventListener('mousemove',  onMouseMove,  { passive: true });
    card.addEventListener('mouseenter', onMouseEnter, { passive: true });
    card.addEventListener('mouseleave', onMouseLeave, { passive: true });
  }

  /* ═══════════════════════════════════════════════════════════
   *  INIT
   * ═══════════════════════════════════════════════════════════ */
  function initAll() {
    if (isMobile() || prefersReducedMotion()) return;
    document.querySelectorAll(SELECTORS).forEach(applyTilt);
  }

  function watchDom() {
    if (isMobile() || prefersReducedMotion()) return;
    const observer = new MutationObserver(mutations => {
      mutations.forEach(m => {
        m.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;
          if (node.matches && node.matches(SELECTORS)) applyTilt(node);
          if (node.querySelectorAll) {
            node.querySelectorAll(SELECTORS).forEach(applyTilt);
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function boot() {
    if (isMobile() || prefersReducedMotion()) return;
    initAll();
    watchDom();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.NexusTilt = {
    init:     boot,
    apply:    applyTilt,
    isMobile: isMobile,
  };

})();