/**
 * NEXUS — main.js
 * Premium animation engine powered by GSAP.
 */

(function () {
  'use strict';

  /* ──────────────────────────────────────────────────────────
     CONSTANTS
  ────────────────────────────────────────────────────────── */
  const TILT_MAX    = 4;          
  const TILT_SCALE  = 1.015;      

  /* ──────────────────────────────────────────────────────────
     1. PARALLAX BACKGROUND (REMOVED)
  ────────────────────────────────────────────────────────── */


  /* ──────────────────────────────────────────────────────────
     2. MAGNETIC BUTTONS (High Priority)
     Buttons follow the cursor with smooth easing
  ────────────────────────────────────────────────────────── */
  function initMagneticButtons() {
    if (window.matchMedia('(hover: none)').matches) return;

    const magnets = document.querySelectorAll('.magnetic-btn');

    magnets.forEach(btn => {
      btn.addEventListener('mousemove', e => {
        const rect = btn.getBoundingClientRect();
        const h = rect.width / 2;
        const v = rect.height / 2;
        // Calculate distance from center
        const x = e.clientX - rect.left - h;
        const y = e.clientY - rect.top - v;

        // Apply a fraction of the distance (magnetic pull)
        const pullX = x * 0.3;
        const pullY = y * 0.3;

        // Use GSAP for buttery smooth follower
        if (typeof gsap !== 'undefined') {
          gsap.to(btn, {
            '--tx': `${pullX}px`,
            '--ty': `${pullY}px`,
            duration: 0.3,
            ease: 'power3.out'
          });
        } else {
          // Fallback to CSS variables
          btn.style.setProperty('--tx', `${pullX}px`);
          btn.style.setProperty('--ty', `${pullY}px`);
        }
      });

      btn.addEventListener('mouseleave', () => {
        if (typeof gsap !== 'undefined') {
          gsap.to(btn, {
            '--tx': `0px`,
            '--ty': `0px`,
            duration: 0.7,
            ease: 'elastic.out(1, 0.3)'
          });
        } else {
          btn.style.setProperty('--tx', `0px`);
          btn.style.setProperty('--ty', `0px`);
        }
      });
    });
  }

  /* ──────────────────────────────────────────────────────────
     3. RIPPLE CLICK EFFECT (High Priority)
     Ripple expands from exact click coordinates
  ────────────────────────────────────────────────────────── */
  function initRipples() {
    const rippleBtns = document.querySelectorAll('.ripple-btn');
    
    rippleBtns.forEach(btn => {
      btn.addEventListener('mousedown', function(e) {
        let x, y;
        
        // Handle touch vs mouse
        if (e.clientX !== undefined) {
          x = e.clientX - btn.getBoundingClientRect().left;
          y = e.clientY - btn.getBoundingClientRect().top;
        } else if (e.touches && e.touches[0]) {
          x = e.touches[0].clientX - btn.getBoundingClientRect().left;
          y = e.touches[0].clientY - btn.getBoundingClientRect().top;
        } else {
          return; // Ignore
        }

        const ripple = document.createElement('span');
        ripple.classList.add('ripple');
        
        // Ensure ripple covers the whole button
        const size = Math.max(btn.clientWidth, btn.clientHeight);
        ripple.style.width = ripple.style.height = `${size}px`;
        ripple.style.left = `${x - size / 2}px`;
        ripple.style.top = `${y - size / 2}px`;
        
        btn.appendChild(ripple);
        
        // Clean up after 600ms (duration of animation)
        setTimeout(() => {
          ripple.remove();
        }, 600);
      });
    });
  }

  /* ──────────────────────────────────────────────────────────
     4. HERO GSAP ENTRANCE
  ────────────────────────────────────────────────────────── */
  function initHero() {
    if (typeof gsap === 'undefined') return;

    // Remove CSS animation to let JS take over
    const heroElements = document.querySelectorAll('.hero-badge, .hero-eyebrow, .hero-title, .hero-subtitle, .hero-desc, .hero-btns, .hero-stats');
    heroElements.forEach(el => el.style.animation = 'none');
    
    const globe = document.querySelector('.hero-visual');
    if (globe) globe.style.animation = 'none';

    const tl = gsap.timeline();

    tl.fromTo('.hero-badge', 
      { y: 20, opacity: 0 }, 
      { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' }
    )
    .fromTo(['.hero-eyebrow', '.hero-title', '.hero-subtitle', '.hero-desc'],
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8, stagger: 0.1, ease: 'power3.out' },
      "-=0.6"
    )
    .fromTo('.hero-btns',
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out' },
      "-=0.4"
    )
    .fromTo('.hero-stat',
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, stagger: 0.1, ease: 'power3.out' },
      "-=0.4"
    );

    if (globe) {
      gsap.fromTo(globe, 
        { scale: 0.9, opacity: 0, rotation: -5 }, 
        { scale: 1, opacity: 1, rotation: 0, duration: 1.2, ease: 'power3.out' },
        0.2 // start near beginning
      );
    }
  }

  /* ──────────────────────────────────────────────────────────
     5. GSAP SCROLL REVEAL & STAGGER
     Uses ScrollTrigger if available, otherwise fallback
  ────────────────────────────────────────────────────────── */
  function initScrollReveal() {
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
      gsap.registerPlugin(ScrollTrigger);

      // Section titles
      gsap.utils.toArray('.section-eyebrow, .section-title, .section-sub').forEach(el => {
        gsap.fromTo(el, 
          { y: 30, autoAlpha: 0 },
          { 
            y: 0, autoAlpha: 1, duration: 0.8, ease: 'power3.out',
            scrollTrigger: {
              trigger: el,
              start: "top 85%",
            }
          }
        );
      });

      // Grids / Staggers
      gsap.utils.toArray('.stagger, .steps-grid').forEach(container => {
        const children = container.querySelectorAll('.reveal, .feat-card, .step-card, .step-connector');
        
        // Remove class reveal so fallback CSS doesn't fight GSAP
        children.forEach(c => c.classList.remove('reveal'));
        
        gsap.fromTo(children, 
          { y: 40, autoAlpha: 0, scale: 0.98 },
          {
            y: 0, autoAlpha: 1, scale: 1,
            duration: 0.8, stagger: 0.1, ease: 'back.out(1.2)',
            scrollTrigger: {
              trigger: container,
              start: "top 80%",
            }
          }
        );
      });
      
      // CTA Reveal
      const cta = document.querySelector('.cta-card');
      if (cta) {
        cta.classList.remove('reveal');
        gsap.fromTo(cta,
          { y: 50, autoAlpha: 0, scale: 0.95 },
          {
            y: 0, autoAlpha: 1, scale: 1, duration: 0.8, ease: 'power3.out',
            scrollTrigger: {
              trigger: '.cta-wrap',
              start: "top 75%",
            }
          }
        );
      }

    } else {
      // Graceful fallback to CSS IntersectionObserver
      const targets = document.querySelectorAll('.reveal');
      if (!targets.length || !('IntersectionObserver' in window)) {
        targets.forEach(el => el.classList.add('revealed'));
        return;
      }
      const observer = new IntersectionObserver(
        (entries, obs) => {
          entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('revealed');
            obs.unobserve(entry.target); 
          });
        },
        { threshold: 0.12, rootMargin: '0px 0px -32px 0px' }
      );
      targets.forEach(el => observer.observe(el));
    }
  }

  /* ──────────────────────────────────────────────────────────
     5.5. RADAR (REMOVED)
  ────────────────────────────────────────────────────────── */

  /* ──────────────────────────────────────────────────────────
     6. SUBTLE 3D TILT + GLARE (REMOVED)
  ────────────────────────────────────────────────────────── */

  /* ──────────────────────────────────────────────────────────
     7. SIDEBAR TOGGLE & EXTRAS 
  ────────────────────────────────────────────────────────── */
  function initSidebar() {
    const sidebar  = document.getElementById('sidebar');
    const overlay  = document.getElementById('sidebarOverlay');
    const toggle   = document.getElementById('sidebarToggle');
    if (!sidebar || !toggle) return;

    function open()  { sidebar.classList.add('open');    overlay?.classList.add('active');    }
    function close() { sidebar.classList.remove('open'); overlay?.classList.remove('active'); }

    toggle.addEventListener('click', () => sidebar.classList.contains('open') ? close() : open());
    overlay?.addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  }

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

  function initActiveNav() {
    const path  = window.location.pathname;
    const links = document.querySelectorAll('.nav-link, .sidebar-link');
    links.forEach(link => {
      if (link.getAttribute('href') === path) link.classList.add('active');
    });
  }

  /* ──────────────────────────────────────────────────────────
     INIT
  ────────────────────────────────────────────────────────── */
  function init() {
    initMagneticButtons();
    initRipples();
    initScrollReveal(); 
    initHero();
    
    // Non-animation logic
    initSidebar();
    initFormLoaders();
    initActiveNav();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init(); 
  }

})();