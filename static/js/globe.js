/**
 * PhishGuard AI — 3D Threat Globe
 * static/js/globe.js
 *
 * Globe.gl powered 3D rotating Earth with:
 *   - Real-time threat points (pulsing, colored by severity)
 *   - Animated attack arcs between threat locations
 *   - Moving particles along arcs
 *   - Live API sync every 12 seconds
 *   - Hover tooltips
 *   - Counter overlay
 */

(function () {
  'use strict';

  /* ─── CONFIG ─────────────────────────────────────── */
  const API_URL    = '/api/threat-map';
  const REFRESH_MS = 12000;

  const SEV_COLORS = {
    HIGH:   '#ff4560',
    MEDIUM: '#ffb020',
    LOW:    '#00e5a0',
  };

  const ARC_COLORS = [
    'rgba(255,69,96,',
    'rgba(255,176,32,',
    'rgba(45,114,212,',
    'rgba(0,255,198,',
  ];

  /* ─── STATE ──────────────────────────────────────── */
  let globe        = null;
  let threatData   = [];
  let refreshTimer = null;
  let arcTimer     = null;

  /* ─── HELPERS ────────────────────────────────────── */
  function rand(min, max) { return Math.random() * (max - min) + min; }
  function pick(arr)      { return arr[Math.floor(Math.random() * arr.length)]; }

  function sevColor(sev) {
    return SEV_COLORS[(sev || '').toUpperCase()] || SEV_COLORS.LOW;
  }

  function formatTime(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleString('en-GB', {
        day: '2-digit', month: 'short',
        hour: '2-digit', minute: '2-digit', hour12: false
      });
    } catch (_) { return iso || '—'; }
  }

  function nowString() {
    return new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  /* ─── GENERATE ARCS ─────────────────────────────── */
  function generateArcs(threats) {
    if (threats.length < 2) return [];

    const arcs = [];
    const n    = Math.min(threats.length, 20);

    for (let i = 0; i < n; i++) {
      const src = threats[i];
      const dst = threats[(i + Math.floor(rand(1, threats.length - 1))) % threats.length];

      if (!src || !dst) continue;

      const colorBase = pick(ARC_COLORS);
      const alpha     = rand(0.4, 0.85).toFixed(2);

      arcs.push({
        startLat:  src.lat,
        startLng:  src.lng,
        endLat:    dst.lat,
        endLng:    dst.lng,
        color:     [`${colorBase}${alpha})`, `${colorBase}0)`],
        stroke:    rand(0.4, 1.2),
        dash:      rand(1, 4),
        gap:       rand(1, 5),
        altitude:  rand(0.15, 0.5),
        srcSev:    src.severity,
        label:     `${src.city} → ${dst.city}`,
        threat:    src.threat,
      });
    }

    return arcs;
  }

  /* ─── RENDER DATA ────────────────────────────────── */
  function renderGlobeData(threats) {
    if (!globe) return;

    const arcs = generateArcs(threats);

    /* Points */
    globe
      .pointsData(threats)
      .pointLat(d => d.lat)
      .pointLng(d => d.lng)
      .pointColor(d => sevColor(d.severity))
      .pointAltitude(d => {
        const s = (d.severity || '').toUpperCase();
        return s === 'HIGH' ? 0.04 : s === 'MEDIUM' ? 0.025 : 0.01;
      })
      .pointRadius(d => {
        const s = (d.severity || '').toUpperCase();
        return s === 'HIGH' ? 0.55 : s === 'MEDIUM' ? 0.42 : 0.28;
      })
      .pointsMerge(false)
      .pointLabel(d => buildTooltipHTML(d));

    /* Rings (pulse) */
    globe
      .ringsData(threats)
      .ringLat(d => d.lat)
      .ringLng(d => d.lng)
      .ringColor(d => t => {
        const col = sevColor(d.severity);
        return hexToRgba(col, Math.max(0, 1 - t));
      })
      .ringMaxRadius(d => {
        const s = (d.severity || '').toUpperCase();
        return s === 'HIGH' ? 5 : s === 'MEDIUM' ? 3.5 : 2;
      })
      .ringPropagationSpeed(d => {
        const s = (d.severity || '').toUpperCase();
        return s === 'HIGH' ? 3.5 : s === 'MEDIUM' ? 2.5 : 1.5;
      })
      .ringRepeatPeriod(d => {
        const s = (d.severity || '').toUpperCase();
        return s === 'HIGH' ? 700 : s === 'MEDIUM' ? 1000 : 1400;
      });

    /* Arcs */
    globe
      .arcsData(arcs)
      .arcStartLat(d => d.startLat)
      .arcStartLng(d => d.startLng)
      .arcEndLat(d => d.endLat)
      .arcEndLng(d => d.endLng)
      .arcColor(d => d.color)
      .arcStroke(d => d.stroke)
      .arcDashLength(d => d.dash)
      .arcDashGap(d => d.gap)
      .arcDashAnimateTime(d => rand(1500, 3500))
      .arcAltitudeAutoScale(0.4)
      .arcLabel(d => `<span style="font-size:0.78rem;color:#fff">${d.label}</span>`);

    /* Particles on arcs */
    globe
      .customLayerData(arcs)
      .customThreeObject(() => {
        const THREE = window.THREE;
        if (!THREE) return null;
        const geo  = new THREE.SphereGeometry(0.5, 6, 6);
        const mat  = new THREE.MeshBasicMaterial({ color: 0x00ffc6, transparent: true, opacity: 0.85 });
        return new THREE.Mesh(geo, mat);
      })
      .customThreeObjectUpdate(() => {});

    /* Update counters */
    updateCounters(threats, arcs);
  }

  /* ─── BUILD TOOLTIP ─────────────────────────────── */
  function buildTooltipHTML(d) {
    const sev   = (d.severity || 'LOW').toUpperCase();
    const color = sevColor(sev);
    return `
      <div style="
        background:rgba(11,15,25,0.97);
        border:1px solid rgba(45,114,212,0.35);
        border-radius:8px;
        padding:12px 16px;
        min-width:200px;
        font-family:'Outfit',sans-serif;
        box-shadow:0 8px 32px rgba(0,0,0,0.6);
      ">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span style="font-size:1.1rem">📍</span>
          <div>
            <div style="font-weight:700;color:#f0f4ff;font-size:0.875rem">${d.city}</div>
            <div style="font-size:0.75rem;color:#4a5a7a">${d.country}</div>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.78rem;padding:4px 0;border-top:1px solid rgba(255,255,255,0.06)">
          <span style="color:#4a5a7a;font-family:'JetBrains Mono',monospace;font-size:0.72rem">THREAT</span>
          <span style="color:#8a9bbe;font-weight:500">${d.threat}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.78rem;padding:4px 0;border-top:1px solid rgba(255,255,255,0.06)">
          <span style="color:#4a5a7a;font-family:'JetBrains Mono',monospace;font-size:0.72rem">SEVERITY</span>
          <span style="color:${color};font-weight:700;font-family:'JetBrains Mono',monospace;font-size:0.75rem">${sev}</span>
        </div>
        <div style="font-size:0.72rem;color:#4a5a7a;margin-top:6px;font-family:'JetBrains Mono',monospace">${formatTime(d.time)}</div>
      </div>`;
  }

  /* ─── UPDATE COUNTERS ────────────────────────────── */
  function updateCounters(threats, arcs) {
    const high   = threats.filter(t => (t.severity || '').toUpperCase() === 'HIGH').length;
    const medium = threats.filter(t => (t.severity || '').toUpperCase() === 'MEDIUM').length;
    const low    = threats.filter(t => (t.severity || '').toUpperCase() === 'LOW').length;

    safeSet('count-total',  threats.length);
    safeSet('count-high',   high);
    safeSet('count-medium', medium);
    safeSet('count-low',    low);
    safeSet('stat-arcs',    arcs ? arcs.length : 0);
    safeSet('stat-points',  threats.length);
    safeSet('last-updated', 'Last updated: ' + nowString());
    safeSet('intel-ts',     nowString());
  }

  function safeSet(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  /* ─── UPDATE INTEL PANEL ─────────────────────────── */
  function updateIntelPanel(threats) {
    const feed = document.getElementById('intel-feed');
    if (!feed) return;

    feed.innerHTML = '';

    if (!threats || threats.length === 0) {
      feed.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:0.8rem">No active threats</div>';
      return;
    }

    const sorted = [...threats].sort((a, b) => {
      const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return (order[(a.severity || '').toUpperCase()] ?? 3) - (order[(b.severity || '').toUpperCase()] ?? 3);
    });

    sorted.forEach((t, i) => {
      const item = document.createElement('div');
      item.className = 'intel-item';
      item.style.animationDelay = `${i * 35}ms`;

      const sev = (t.severity || 'LOW').toUpperCase();
      item.innerHTML = `
        <div class="intel-item-top">
          <span class="intel-loc">${t.city}, ${t.country}</span>
          <span class="intel-sev ${sev}">${sev}</span>
        </div>
        <div class="intel-threat">${t.threat}</div>
        <div class="intel-time">${formatTime(t.time)}</div>`;

      item.addEventListener('click', () => {
        if (globe) {
          globe.pointOfView({ lat: t.lat, lng: t.lng, altitude: 1.8 }, 1200);
        }
      });

      feed.appendChild(item);
    });
  }

  /* ─── HEX TO RGBA ────────────────────────────────── */
  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  /* ─── FETCH & REFRESH ────────────────────────────── */
  async function fetchThreats(showLoader) {
    if (showLoader) setLoader(true);

    try {
      const res  = await fetch(API_URL, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (Array.isArray(data)) {
        threatData = data;
        renderGlobeData(data);
        updateIntelPanel(data);
      }
    } catch (err) {
      console.warn('[Globe] Fetch error:', err);
    } finally {
      setLoader(false);
    }
  }

  function startAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(() => fetchThreats(false), REFRESH_MS);
  }

  /* ─── LOADER ─────────────────────────────────────── */
  function setLoader(visible) {
    const el = document.getElementById('globe-loading');
    if (!el) return;
    if (visible) {
      el.classList.remove('hidden');
    } else {
      setTimeout(() => el.classList.add('hidden'), 600);
    }
  }

  /* ─── LOADING STEPS ANIMATION ────────────────────── */
  function animateLoadingSteps() {
    const el    = document.getElementById('loading-status');
    if (!el) return;
    const steps = [
      'Initializing Three.js renderer…',
      'Loading Earth texture…',
      'Fetching threat intelligence…',
      'Plotting threat coordinates…',
      'Generating attack arcs…',
      'Starting live sync…',
    ];
    let i = 0;
    const iv = setInterval(() => {
      if (!el) { clearInterval(iv); return; }
      el.textContent = steps[i % steps.length];
      i++;
    }, 500);
    setTimeout(() => clearInterval(iv), 3500);
  }

  /* ─── INIT GLOBE ─────────────────────────────────── */
  function initGlobe() {
    const container = document.getElementById('globe-canvas-wrap');
    if (!container) return;
    if (typeof Globe === 'undefined') {
      console.error('[Globe] Globe.gl not loaded');
      return;
    }

    globe = Globe({
      waitForGlobeReady: true,
      animateIn: true,
    })(container);

    globe
      /* Globe appearance */
      .globeImageUrl('//unpkg.com/three-globe/example/img/earth-dark.jpg')
      .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
      .backgroundImageUrl('//unpkg.com/three-globe/example/img/night-sky.png')
      .showAtmosphere(true)
      .atmosphereColor('rgba(45,114,212,0.25)')
      .atmosphereAltitude(0.18)

      /* Initial view */
      .pointOfView({ lat: 20, lng: 0, altitude: 2.2 }, 0)

      /* Controls */
      .enablePointerInteraction(true);

    /* Auto-rotate */
    globe.controls().autoRotate      = true;
    globe.controls().autoRotateSpeed = 0.4;
    globe.controls().enableZoom      = true;
    globe.controls().minDistance     = 150;
    globe.controls().maxDistance     = 700;

    /* Pause rotation on hover */
    container.addEventListener('mouseenter', () => {
      globe.controls().autoRotate = false;
    });
    container.addEventListener('mouseleave', () => {
      globe.controls().autoRotate = true;
    });

    /* Resize handling */
    function handleResize() {
      if (!globe) return;
      globe.width(container.offsetWidth);
      globe.height(container.offsetHeight);
    }

    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(handleResize).observe(container);
    }
    window.addEventListener('resize', handleResize);
    handleResize();

    /* Expose invalidate for external use */
    window.globeInvalidate = handleResize;
  }

  /* ─── PUBLIC API ─────────────────────────────────── */
  window.globeRefresh = function () {
    const btn  = document.getElementById('refresh-btn');
    const icon = document.getElementById('refresh-icon');
    if (btn)  btn.classList.add('spinning');
    if (icon) icon.classList.add('spinning');

    fetchThreats(false).finally(() => {
      setTimeout(() => {
        if (btn)  btn.classList.remove('spinning');
        if (icon) icon.classList.remove('spinning');
      }, 700);
    });

    startAutoRefresh();
  };

  /* ─── BOOT ───────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    animateLoadingSteps();

    /* Small delay to let CSS paint before Three.js grabs dimensions */
    setTimeout(() => {
      initGlobe();
      fetchThreats(true);
      startAutoRefresh();
    }, 200);
  });

})();