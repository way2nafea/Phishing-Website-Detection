/**
 * NEXUS — main.js  v2.0
 * Premium animation engine.
 * Features: Loader · Cursor Glow · Parallax · Magnetic Btns ·
 *           Ripples · Hero Entrance · Scroll Reveal · Tilt · Sidebar
 */

(function () {
  'use strict';

  /* ── CONSTANTS ──────────────────────────────────────────────── */
  const IS_TOUCH   = window.matchMedia('(hover: none)').matches;
  const IS_MOBILE  = window.innerWidth < 768;
  const REDUCED    = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ══════════════════════════════════════════════════════════════
     1. FULL-SCREEN PAGE LOADER
  ══════════════════════════════════════════════════════════════ */
  function initLoader() {
    const loader = document.getElementById('nexus-loader');
    if (!loader) return;

    // Animate progress bar
    const bar = loader.querySelector('.loader-bar-fill');
    if (bar) {
      let w = 0;
      const iv = setInterval(() => {
        w += Math.random() * 18 + 4;
        if (w >= 92) { clearInterval(iv); w = 92; }
        bar.style.width = w + '%';
      }, 90);
    }

    function hideLoader() {
      if (bar) bar.style.width = '100%';
      setTimeout(() => {
        loader.classList.add('loader-out');
        setTimeout(() => {
          loader.style.display = 'none';
          document.body.classList.remove('loading');
          // Trigger hero entrance after loader fades
          initHero();
        }, 680);
      }, 280);
    }

    if (document.readyState === 'complete') {
      hideLoader();
    } else {
      window.addEventListener('load', hideLoader);
      // Fallback: hide after 3.5s max
      setTimeout(hideLoader, 3500);
    }
  }

  /* ══════════════════════════════════════════════════════════════
     2. CUSTOM CURSOR GLOW  (desktop only)
  ══════════════════════════════════════════════════════════════ */
  function initCursor() {
    if (IS_TOUCH || IS_MOBILE) return;
    const dot  = document.getElementById('cursor-dot');
    const ring = document.getElementById('cursor-ring');
    if (!dot || !ring) return;

    let mx = 0, my = 0, rx = 0, ry = 0;

    document.addEventListener('mousemove', e => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate(${mx - 4}px, ${my - 4}px)`;
    }, { passive: true });

    // Lagging ring via rAF
    function animateRing() {
      rx += (mx - rx) * 0.12;
      ry += (my - ry) * 0.12;
      ring.style.transform = `translate(${rx - 18}px, ${ry - 18}px)`;
      requestAnimationFrame(animateRing);
    }
    animateRing();

    // Grow ring on hoverable elements
    const hoverables = document.querySelectorAll(
      'a, button, .feat-card, .step-card, .btn-hero-primary, .btn-hero-outline, .btn-nav, input'
    );
    hoverables.forEach(el => {
      el.addEventListener('mouseenter', () => {
        ring.classList.add('cursor-ring--hover');
        dot.classList.add('cursor-dot--hover');
      });
      el.addEventListener('mouseleave', () => {
        ring.classList.remove('cursor-ring--hover');
        dot.classList.remove('cursor-dot--hover');
      });
    });

    // Click burst
    document.addEventListener('mousedown', () => ring.classList.add('cursor-ring--click'));
    document.addEventListener('mouseup',   () => ring.classList.remove('cursor-ring--click'));
  }

  /* ══════════════════════════════════════════════════════════════
     3. PARALLAX BLOBS ON SCROLL
  ══════════════════════════════════════════════════════════════ */
  function initParallax() {
    if (REDUCED || IS_MOBILE) return;
    const blobs = document.querySelectorAll('.ambient-blob');
    if (!blobs.length) return;

    const factors = [0.08, -0.05, 0.06];
    window.addEventListener('scroll', () => {
      const sy = window.scrollY;
      blobs.forEach((b, i) => {
        const f = factors[i] ?? 0.05;
        b.style.transform = `translateY(${sy * f}px)`;
      });
    }, { passive: true });
  }

  /* ══════════════════════════════════════════════════════════════
     4. MOUSE PARALLAX ON HERO (subtle 3D depth)
  ══════════════════════════════════════════════════════════════ */
  function initHeroMouseParallax() {
    if (IS_TOUCH || REDUCED) return;
    const hero = document.querySelector('.hero');
    if (!hero) return;

    hero.addEventListener('mousemove', e => {
      const rect = hero.getBoundingClientRect();
      const cx = (e.clientX - rect.left) / rect.width  - 0.5; // -0.5 → 0.5
      const cy = (e.clientY - rect.top)  / rect.height - 0.5;

      const copy = hero.querySelector('.hero-copy');
      const vis  = hero.querySelector('.hero-visual');
      if (copy) copy.style.transform = `translate(${cx * -8}px, ${cy * -5}px)`;
      if (vis)  vis.style.transform  = `translate(${cx *  12}px, ${cy *  8}px)`;
    }, { passive: true });

    hero.addEventListener('mouseleave', () => {
      const copy = hero.querySelector('.hero-copy');
      const vis  = hero.querySelector('.hero-visual');
      if (copy) copy.style.transform = '';
      if (vis)  vis.style.transform  = '';
    });
  }

  /* ══════════════════════════════════════════════════════════════
     5. MAGNETIC BUTTONS
  ══════════════════════════════════════════════════════════════ */
  function initMagneticButtons() {
    if (IS_TOUCH) return;
    const magnets = document.querySelectorAll('.magnetic-btn');
    magnets.forEach(btn => {
      btn.addEventListener('mousemove', e => {
        const rect = btn.getBoundingClientRect();
        const x = (e.clientX - rect.left - rect.width  / 2) * 0.3;
        const y = (e.clientY - rect.top  - rect.height / 2) * 0.3;
        if (typeof gsap !== 'undefined') {
          gsap.to(btn, { '--tx': `${x}px`, '--ty': `${y}px`, duration: 0.3, ease: 'power3.out' });
        } else {
          btn.style.setProperty('--tx', `${x}px`);
          btn.style.setProperty('--ty', `${y}px`);
        }
      });
      btn.addEventListener('mouseleave', () => {
        if (typeof gsap !== 'undefined') {
          gsap.to(btn, { '--tx': '0px', '--ty': '0px', duration: 0.7, ease: 'elastic.out(1, 0.3)' });
        } else {
          btn.style.setProperty('--tx', '0px');
          btn.style.setProperty('--ty', '0px');
        }
      });
    });
  }

  /* ══════════════════════════════════════════════════════════════
     6. RIPPLE CLICK EFFECT
  ══════════════════════════════════════════════════════════════ */
  function initRipples() {
    document.querySelectorAll('.ripple-btn').forEach(btn => {
      btn.addEventListener('mousedown', function (e) {
        const rect = btn.getBoundingClientRect();
        const x = (e.clientX ?? e.touches?.[0]?.clientX ?? 0) - rect.left;
        const y = (e.clientY ?? e.touches?.[0]?.clientY ?? 0) - rect.top;
        const ripple = document.createElement('span');
        ripple.classList.add('ripple');
        const size = Math.max(btn.clientWidth, btn.clientHeight);
        ripple.style.cssText = `width:${size}px;height:${size}px;left:${x - size / 2}px;top:${y - size / 2}px`;
        btn.appendChild(ripple);
        setTimeout(() => ripple.remove(), 650);
      });
    });
  }

  /* ══════════════════════════════════════════════════════════════
     7. HERO GSAP ENTRANCE (called after loader hides)
  ══════════════════════════════════════════════════════════════ */
  function initHero() {
    // Only run on landing page
    if (!document.querySelector('.hero-badge')) return;

    if (typeof gsap === 'undefined') {
      // CSS fallback: make elements visible
      document.querySelectorAll('.gsap-reveal, .reveal').forEach(el => {
        el.style.visibility = 'visible';
        el.classList.add('revealed');
      });
      return;
    }

    // Kill CSS animations that would fight GSAP
    document.querySelectorAll(
      '.hero-badge,.hero-eyebrow,.hero-title,.hero-subtitle,.hero-desc,.hero-btns,.hero-stats,.hero-visual'
    ).forEach(el => { el.style.animation = 'none'; el.style.visibility = 'visible'; });

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    tl.fromTo('.hero-badge',
        { y: 20, autoAlpha: 0 },
        { y: 0,  autoAlpha: 1, duration: 0.75 }
      )
      .fromTo(['.hero-eyebrow', '.hero-title', '.hero-subtitle', '.hero-desc'],
        { y: 34, autoAlpha: 0 },
        { y: 0,  autoAlpha: 1, duration: 0.75, stagger: 0.1 }, '-=0.55'
      )
      .fromTo('.hero-btns',
        { y: 20, autoAlpha: 0 },
        { y: 0,  autoAlpha: 1, duration: 0.6 }, '-=0.45'
      )
      .fromTo('.hero-stat',
        { y: 18, autoAlpha: 0 },
        { y: 0,  autoAlpha: 1, duration: 0.5, stagger: 0.08 }, '-=0.35'
      );

    const vis = document.querySelector('.hero-visual');
    if (vis) {
      vis.style.visibility = 'visible';
      gsap.fromTo(vis,
        { autoAlpha: 0, scale: 0.9, y: 30 },
        { autoAlpha: 1, scale: 1,   y: 0, duration: 1.1, ease: 'power3.out' },
        '-=1.2'
      );
    }

    // After hero plays, init scroll reveal
    tl.add(() => initScrollReveal());
  }

  /* ══════════════════════════════════════════════════════════════
     8. SCROLL REVEAL  (GSAP ScrollTrigger or CSS fallback)
  ══════════════════════════════════════════════════════════════ */
  function initScrollReveal() {
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
      gsap.registerPlugin(ScrollTrigger);

      gsap.utils.toArray('.section-eyebrow, .section-title, .section-sub').forEach(el => {
        gsap.fromTo(el,
          { y: 28, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.75, ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 87%' }
          }
        );
      });

      gsap.utils.toArray('.stagger, .steps-grid').forEach(container => {
        const children = container.querySelectorAll('.reveal, .feat-card, .step-card, .step-connector');
        children.forEach(c => c.classList.remove('reveal'));
        gsap.fromTo(children,
          { y: 44, autoAlpha: 0, scale: 0.97 },
          { y: 0,  autoAlpha: 1, scale: 1,
            duration: 0.8, stagger: 0.1, ease: 'back.out(1.2)',
            scrollTrigger: { trigger: container, start: 'top 82%' }
          }
        );
      });

      const cta = document.querySelector('.cta-card');
      if (cta) {
        cta.classList.remove('reveal');
        gsap.fromTo(cta,
          { y: 50, autoAlpha: 0, scale: 0.95 },
          { y: 0,  autoAlpha: 1, scale: 1, duration: 0.8, ease: 'power3.out',
            scrollTrigger: { trigger: '.cta-wrap', start: 'top 78%' }
          }
        );
      }

    } else {
      // CSS-only fallback
      const targets = document.querySelectorAll('.reveal');
      if (!('IntersectionObserver' in window)) {
        targets.forEach(el => el.classList.add('revealed'));
        return;
      }
      const obs = new IntersectionObserver(
        (entries, ob) => {
          entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('revealed');
            ob.unobserve(entry.target);
          });
        },
        { threshold: 0.12, rootMargin: '0px 0px -30px 0px' }
      );
      targets.forEach(el => { el.style.visibility = 'visible'; obs.observe(el); });
    }
  }

  /* ══════════════════════════════════════════════════════════════
     9. 3D CARD TILT + GLARE  (replaces removed tilt section)
  ══════════════════════════════════════════════════════════════ */
  function initCardTilt() {
    if (IS_TOUCH || REDUCED) return;
    const cards = document.querySelectorAll('[data-tilt], .feat-card, .step-card');
    const MAX   = 6; // degrees

    cards.forEach(card => {
      card.style.transformStyle = 'preserve-3d';
      card.style.willChange     = 'transform';

      card.addEventListener('mousemove', e => {
        const rect = card.getBoundingClientRect();
        const cx   = (e.clientX - rect.left) / rect.width;
        const cy   = (e.clientY - rect.top)  / rect.height;
        const rx   = (cy - 0.5) * -MAX * 2;
        const ry   = (cx - 0.5) *  MAX * 2;

        card.style.transform = `perspective(600px) rotateX(${rx}deg) rotateY(${ry}deg) scale(1.025)`;

        // Glare position
        card.style.setProperty('--glare-x', `${cx * 100}%`);
        card.style.setProperty('--glare-y', `${cy * 100}%`);
        card.style.setProperty('--glare-opacity', '1');
      }, { passive: true });

      card.addEventListener('mouseleave', () => {
        if (typeof gsap !== 'undefined') {
          gsap.to(card, { rotateX: 0, rotateY: 0, scale: 1, duration: 0.6, ease: 'power3.out',
            clearProps: 'rotateX,rotateY,scale' });
        } else {
          card.style.transform = '';
        }
        card.style.setProperty('--glare-opacity', '0');
      });
    });
  }

  /* ══════════════════════════════════════════════════════════════
     10. STAT COUNTER ANIMATION
  ══════════════════════════════════════════════════════════════ */
  function initCounters() {
    const stats = document.querySelectorAll('.hero-stat-val[data-count]');
    if (!stats.length) return;
    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el      = entry.target;
        const target  = parseFloat(el.dataset.count);
        const suffix  = el.dataset.suffix || '';
        const decimal = target % 1 !== 0;
        const dur     = REDUCED ? 0 : 1800;
        let start     = null;
        function tick(ts) {
          if (!start) start = ts;
          const p = Math.min((ts - start) / dur, 1);
          const e = 1 - Math.pow(1 - p, 3);
          el.textContent = (decimal ? (e * target).toFixed(1) : Math.floor(e * target)) + suffix;
          if (p < 1) requestAnimationFrame(tick);
          else el.textContent = (decimal ? target.toFixed(1) : target) + suffix;
        }
        dur === 0 ? (el.textContent = (decimal ? target.toFixed(1) : target) + suffix) : requestAnimationFrame(tick);
        obs.unobserve(el);
      });
    }, { threshold: 0.5 });
    stats.forEach(el => obs.observe(el));
  }

  /* ══════════════════════════════════════════════════════════════
     11. NAVBAR SCROLL EFFECT
  ══════════════════════════════════════════════════════════════ */
  function initNavbar() {
    const nav = document.getElementById('main-nav');
    if (!nav) return;
    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 40);
    }, { passive: true });
  }

  /* ══════════════════════════════════════════════════════════════
     12. SIDEBAR TOGGLE (app pages)
  ══════════════════════════════════════════════════════════════ */
  function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const toggle  = document.getElementById('sidebarToggle');
    if (!sidebar || !toggle) return;
    const open  = () => { sidebar.classList.add('open');    overlay?.classList.add('active');    };
    const close = () => { sidebar.classList.remove('open'); overlay?.classList.remove('active'); };
    toggle.addEventListener('click',  () => sidebar.classList.contains('open') ? close() : open());
    overlay?.addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  }

  /* ══════════════════════════════════════════════════════════════
     13. FORM LOADERS
  ══════════════════════════════════════════════════════════════ */
  function initFormLoaders() {
    document.querySelectorAll('form[data-loader]').forEach(form => {
      form.addEventListener('submit', function () {
        const label = this.dataset.loader || 'Processing…';
        const btn   = this.querySelector('[type="submit"]');
        if (!btn) return;
        btn.disabled = true;
        btn.style.pointerEvents = 'none';
        btn.innerHTML = `<span class="spin-ring" style="width:15px;height:15px;border-width:2.5px"></span> ${label}`;
      });
    });
  }

  /* ══════════════════════════════════════════════════════════════
     14. ACTIVE NAV LINK
  ══════════════════════════════════════════════════════════════ */
  function initActiveNav() {
    const path  = window.location.pathname;
    const links = document.querySelectorAll('.nav-link, .sidebar-link');
    links.forEach(link => {
      if (link.getAttribute('href') === path) link.classList.add('active');
    });
  }

  /* ══════════════════════════════════════════════════════════════
     15. GLARE EFFECT ON CARDS (mouse follows)
  ══════════════════════════════════════════════════════════════ */
  function initGlare() {
    if (IS_TOUCH) return;
    const cards = document.querySelectorAll('.feat-card,.step-card,.cta-card');
    cards.forEach(card => {
      card.addEventListener('mousemove', e => {
        const rect = card.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width  * 100).toFixed(1) + '%';
        const y = ((e.clientY - rect.top)  / rect.height * 100).toFixed(1) + '%';
        card.style.setProperty('--glare-x', x);
        card.style.setProperty('--glare-y', y);
        card.style.setProperty('--glare-opacity', '1');
      }, { passive: true });
      card.addEventListener('mouseleave', () => {
        card.style.setProperty('--glare-opacity', '0');
      });
    });
  }

  /* ══════════════════════════════════════════════════════════════
     INIT — ordered carefully
  ══════════════════════════════════════════════════════════════ */
  function init() {
    initLoader();          // 1st — handles its own timing
    initParallax();        // Scroll background
    initHeroMouseParallax();
    initNavbar();
    initMagneticButtons();
    initRipples();
    initCardTilt();
    initGlare();
    initCounters();
    initSidebar();
    initFormLoaders();
    initActiveNav();
    // Hero entrance is triggered AFTER loader fades (inside initLoader)
    // But if there's no loader, call it now
    if (!document.getElementById('nexus-loader')) {
      initHero();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();