/**
 * NEXUS — Unified 3D Card Tilt System  v3.0
 * static/js/tilt.js
 *
 * Single source of truth for ALL tilt interactions.
 * Apple-level subtle, smooth, and controlled.
 *
 * Features:
 *   - Max rotation clamped to 4 degrees
 *   - Smooth interpolation via requestAnimationFrame
 *   - Damped follow (no direct snapping)
 *   - Graceful reset on mouse leave
 *   - Subtle glare overlay
 *   - Works consistently across all pages
 *
 * NOTE: VanillaTilt CDN is NO LONGER needed.
 */

(function () {
  'use strict';

  /* ─── CONFIG ──────────────────────────────────────────────── */
  const CFG = {
    maxTilt:       4,          // degrees — subtle, premium feel
    perspective:   1000,       // px
    scale:         1.015,      // very subtle zoom on hover
    damping:       0.08,       // lerp factor — lower = smoother/slower follow
    glareOpacity:  0.10,       // max glare brightness
    glareSize:     60,         // % radius of glare spotlight
    resetSpeed:    0.06,       // lerp factor for reset animation
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

  /* ─── LERP UTILITY ───────────────────────────────────────── */
  function lerp(current, target, factor) {
    return current + (target - current) * factor;
  }

  /* ─── CLAMP ──────────────────────────────────────────────── */
  function clamp(val, min, max) {
    return Math.min(max, Math.max(min, val));
  }

  /* ─── BUILD GLARE OVERLAY ────────────────────────────────── */
  function createGlare(card) {
    // Prevent duplicates
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
      transition:   'opacity 0.4s ease',
    });

    wrap.appendChild(inner);

    const pos = getComputedStyle(card).position;
    if (!pos || pos === 'static') card.style.position = 'relative';
    card.appendChild(wrap);

    return inner;
  }

  /* ─── DESTROY EXISTING TILT INSTANCES ────────────────────── */
  function destroyExisting(card) {
    // Remove VanillaTilt if it was initialized
    if (card.vanillaTilt) {
      try { card.vanillaTilt.destroy(); } catch(_) {}
      delete card.vanillaTilt;
    }
    // Remove our old glare overlays
    card.querySelectorAll('.pg-tilt-glare').forEach(el => el.remove());
  }

  /* ═══════════════════════════════════════════════════════════
   *  APPLY SMOOTH TILT TO ONE ELEMENT
   * ═══════════════════════════════════════════════════════════ */
  function applyTilt(card) {
    // Prevent double-init
    if (card._nexusTiltV3) return;
    card._nexusTiltV3 = true;

    // Clean up any previous tilt systems
    destroyExisting(card);

    // Setup card styles
    card.style.transformStyle = 'preserve-3d';
    card.style.willChange     = 'transform';

    const glareEl = createGlare(card);

    // State
    let targetRX  = 0,  targetRY = 0;     // target rotation
    let currentRX = 0,  currentRY = 0;    // current (interpolated) rotation
    let isHovering = false;
    let rafId = null;

    /* ─── ANIMATION LOOP ─────────────────────────────────── */
    function tick() {
      const factor = isHovering ? CFG.damping : CFG.resetSpeed;

      currentRX = lerp(currentRX, targetRX, factor);
      currentRY = lerp(currentRY, targetRY, factor);

      // Clamp for safety
      currentRX = clamp(currentRX, -CFG.maxTilt, CFG.maxTilt);
      currentRY = clamp(currentRY, -CFG.maxTilt, CFG.maxTilt);

      const scale = isHovering ? CFG.scale : 1;

      card.style.transform =
        `perspective(${CFG.perspective}px) ` +
        `rotateX(${currentRX.toFixed(3)}deg) ` +
        `rotateY(${currentRY.toFixed(3)}deg) ` +
        `scale3d(${scale}, ${scale}, 1)`;

      // Keep animating if we haven't settled
      const dx = Math.abs(currentRX - targetRX);
      const dy = Math.abs(currentRY - targetRY);

      if (dx > 0.01 || dy > 0.01) {
        rafId = requestAnimationFrame(tick);
      } else {
        // Snap to final value
        currentRX = targetRX;
        currentRY = targetRY;

        if (!isHovering && targetRX === 0 && targetRY === 0) {
          card.style.transform = '';
        }
        rafId = null;
      }
    }

    function startAnimation() {
      if (!rafId) rafId = requestAnimationFrame(tick);
    }

    /* ─── EVENT HANDLERS ─────────────────────────────────── */
    function onMouseMove(e) {
      if (isMobile()) return;

      const rect = card.getBoundingClientRect();
      const dx   = (e.clientX - rect.left - rect.width  / 2) / (rect.width  / 2);
      const dy   = (e.clientY - rect.top  - rect.height / 2) / (rect.height / 2);

      // Set target (clamped)
      targetRY =  clamp(dx * CFG.maxTilt, -CFG.maxTilt, CFG.maxTilt);
      targetRX =  clamp(dy * -CFG.maxTilt, -CFG.maxTilt, CFG.maxTilt);

      // Update glare position
      if (glareEl) {
        const gx = ((e.clientX - rect.left) / rect.width)  * 100;
        const gy = ((e.clientY - rect.top)  / rect.height) * 100;
        glareEl.style.left    = gx + '%';
        glareEl.style.top     = gy + '%';
        glareEl.style.opacity = '1';
      }

      startAnimation();
    }

    function onMouseEnter() {
      if (isMobile()) return;
      isHovering = true;
    }

    function onMouseLeave() {
      if (isMobile()) return;
      isHovering = false;
      targetRX = 0;
      targetRY = 0;

      if (glareEl) {
        glareEl.style.opacity = '0';
      }

      startAnimation();
    }

    /* ─── BIND EVENTS ────────────────────────────────────── */
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

  /* Watch for dynamically added cards */
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

  /* ═══════════════════════════════════════════════════════════
   *  BOOT
   * ═══════════════════════════════════════════════════════════ */
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

  /* ─── PUBLIC API ─────────────────────────────────────────── */
  window.NexusTilt = {
    init:     boot,
    apply:    applyTilt,
    isMobile: isMobile,
  };

})();