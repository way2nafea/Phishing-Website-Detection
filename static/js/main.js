/**
 * NEXUS — main.js
 * Lightweight motion system · Apple-grade · zero dependencies
 *
 * Modules:
 *  1. Hero fade       — one-time, CSS-driven, triggers on DOM ready
 *  2. Scroll reveal   — IntersectionObserver, runs once per element
 *  3. Subtle tilt     — pointer-tracking 3D tilt (4° max), GPU-only
 *  4. Sidebar toggle  — mobile sidebar open/close
 *  5. Form loader     — submit-state button feedback
 */

(function () {
  'use strict';

  /* ──────────────────────────────────────────────────────────
     CONSTANTS
  ────────────────────────────────────────────────────────── */
  const TILT_MAX    = 4;          // degrees, keeps it premium not toy
  const TILT_SCALE  = 1.015;      // very slight Z-lift on hover
  const EASE_RESET  = 'transform 0.55s cubic-bezier(0.22, 1, 0.36, 1)';
  const EASE_TRACK  = 'transform 0.12s linear';

  /* ──────────────────────────────────────────────────────────
     1. HERO FADE
     Adds .hero-ready to .page-header / .dashboard-header once.
     CSS handles the actual animation — no JS animation frames.
  ────────────────────────────────────────────────────────── */
  function initHero() {
    const hero = document.querySelector('.page-header, .dashboard-header');
    if (!hero || hero.classList.contains('hero-ready')) return;

    // Small rAF delay ensures the class triggers after paint
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        hero.classList.add('hero-ready');
      });
    });
  }

  /* ──────────────────────────────────────────────────────────
     2. SCROLL REVEAL
     Targets elements with class="reveal".
     Marks each as .revealed exactly once when ≥15% visible.
  ────────────────────────────────────────────────────────── */
  function initScrollReveal() {
    const targets = document.querySelectorAll('.reveal');
    if (!targets.length || !('IntersectionObserver' in window)) {
      // Graceful fallback: just show everything
      targets.forEach(el => el.classList.add('revealed'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('revealed');
          obs.unobserve(entry.target); // run once — no continuous re-trigger
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -32px 0px' }
    );

    targets.forEach(el => observer.observe(el));
  }

  /* ──────────────────────────────────────────────────────────
     3. SUBTLE 3D TILT
     Applied to [data-tilt] elements.
     Pure CSS transform — no layout reflow, no opacity changes.
     Resets smoothly on mouseleave.
  ────────────────────────────────────────────────────────── */
  function initTilt() {
    const targets = document.querySelectorAll('[data-tilt]');
    if (!targets.length) return;

    // Skip on touch-only devices (no hover = tilt makes no sense)
    if (window.matchMedia('(hover: none)').matches) return;

    targets.forEach(card => {
      card.style.willChange    = 'transform';
      card.style.transformStyle = 'preserve-3d';

      card.addEventListener('mouseenter', () => {
        card.style.transition = EASE_TRACK;
      });

      card.addEventListener('mousemove', e => {
        const rect   = card.getBoundingClientRect();
        const cx     = rect.left + rect.width  / 2;
        const cy     = rect.top  + rect.height / 2;
        const dx     = (e.clientX - cx) / (rect.width  / 2); // −1 … 1
        const dy     = (e.clientY - cy) / (rect.height / 2); // −1 … 1

        const rotX   = -dy * TILT_MAX;  // negative: tilt toward cursor
        const rotY   =  dx * TILT_MAX;

        card.style.transform =
          `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale3d(${TILT_SCALE},${TILT_SCALE},${TILT_SCALE})`;
      });

      card.addEventListener('mouseleave', () => {
        card.style.transition = EASE_RESET;
        card.style.transform  = 'perspective(900px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)';
      });
    });
  }

  /* ──────────────────────────────────────────────────────────
     4. SIDEBAR TOGGLE  (mobile)
     Works with the sidebar layout used in security_suite.html etc.
  ────────────────────────────────────────────────────────── */
  function initSidebar() {
    const sidebar  = document.getElementById('sidebar');
    const overlay  = document.getElementById('sidebarOverlay');
    const toggle   = document.getElementById('sidebarToggle');
    if (!sidebar || !toggle) return;

    function open()  { sidebar.classList.add('open');    overlay?.classList.add('active');    }
    function close() { sidebar.classList.remove('open'); overlay?.classList.remove('active'); }

    toggle.addEventListener('click', () =>
      sidebar.classList.contains('open') ? close() : open()
    );
    overlay?.addEventListener('click', close);

    // Close on Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') close();
    });
  }

  /* ──────────────────────────────────────────────────────────
     5. FORM LOADER
     Any <form> with [data-loader] shows a loading state on submit.
     Usage: <form data-loader="Scanning…">
  ────────────────────────────────────────────────────────── */
  function initFormLoaders() {
    document.querySelectorAll('form[data-loader]').forEach(form => {
      form.addEventListener('submit', function () {
        const label = this.dataset.loader || 'Processing…';
        const btn   = this.querySelector('[type="submit"]');
        if (!btn) return;

        btn.disabled = true;
        btn.style.pointerEvents = 'none';
        btn.innerHTML =
          `<span class="spin-ring" style="width:15px;height:15px;border-width:2.5px"></span> ${label}`;
      });
    });
  }

  /* ──────────────────────────────────────────────────────────
     6. ACTIVE NAV HIGHLIGHT
     Adds .active to the nav-link / sidebar-link whose href
     matches the current pathname — useful for any layout.
  ────────────────────────────────────────────────────────── */
  function initActiveNav() {
    const path  = window.location.pathname;
    const links = document.querySelectorAll('.nav-link, .sidebar-link');

    links.forEach(link => {
      if (link.getAttribute('href') === path) {
        link.classList.add('active');
      }
    });
  }

  /* ──────────────────────────────────────────────────────────
     7. STAGGER INJECT
     For groups of .reveal children, inject CSS-var delays
     so sibling cards fan in beautifully without JS timers.
  ────────────────────────────────────────────────────────── */
  function initStagger() {
    document.querySelectorAll('.stagger').forEach(container => {
      const children = container.querySelectorAll('.reveal, .card, .stat-card, .tool-card');
      children.forEach((child, i) => {
        child.classList.add('reveal');               // ensure class
        child.style.transitionDelay = `${i * 60}ms`; // 60ms between each
      });
    });
  }

  /* ──────────────────────────────────────────────────────────
     INIT — runs after DOM is parsed
  ────────────────────────────────────────────────────────── */
  function init() {
    initHero();
    initStagger();          // must come before initScrollReveal
    initScrollReveal();
    initTilt();
    initSidebar();
    initFormLoaders();
    initActiveNav();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init(); // already parsed (e.g. deferred script)
  }

})();