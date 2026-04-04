/**
 * PhishGuard AI — Live Threat Map
 * static/js/threat_map.js
 *
 * Leaflet.js dark-theme map with pulsing markers, auto-refresh,
 * animated intel panel, and live threat counter.
 *
 * FIX APPLIED:
 *   • map.invalidateSize() called after DOMContentLoaded so Leaflet
 *     re-reads the container dimensions now that the CSS height chain
 *     is correct (html→body→.app-layout→.main-content→.threat-page-body
 *     →.map-shell→#map all have real pixel heights).
 *   • ResizeObserver watches #map itself — fires invalidateSize() any
 *     time the container is resized (window resize, sidebar toggle, etc.)
 *   • window 'resize' fallback for browsers without ResizeObserver.
 */

(function () {
  'use strict';

  /* ─── CONFIG ─────────────────────────────────────── */
  const API_URL       = '/api/threat-map';
  const REFRESH_MS    = 12000;   // 12-second auto-refresh
  const ANIMATE_IN_MS = 80;      // stagger delay per marker

  /* ─── MAP INIT ───────────────────────────────────── */
  const map = L.map('map', {
    center: [20, 0],
    zoom: 2,
    minZoom: 2,
    maxZoom: 10,
    zoomControl: true,
    attributionControl: false,
  });

  // CartoDB Dark Matter tile layer
  L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    {
      subdomains: 'abcd',
      maxZoom: 19,
    }
  ).addTo(map);

  // Custom attribution (bottom-right, minimal)
  L.control.attribution({ prefix: false, position: 'bottomright' })
    .addAttribution('<span style="color:rgba(255,255,255,0.25);font-size:10px">© CartoDB | PhishGuard AI</span>')
    .addTo(map);

  /* ─── STATE ──────────────────────────────────────── */
  let markerLayer  = L.layerGroup().addTo(map);
  let refreshTimer = null;
  let threatData   = [];

  /* ─── HELPERS ────────────────────────────────────── */
  function severityClass(sev) {
    if (!sev) return 'low';
    const s = sev.toUpperCase();
    if (s === 'HIGH')   return 'high';
    if (s === 'MEDIUM') return 'medium';
    return 'low';
  }

  function formatTime(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleString('en-GB', {
        day: '2-digit', month: 'short',
        hour: '2-digit', minute: '2-digit',
        hour12: false
      });
    } catch (_) { return iso || '—'; }
  }

  function nowString() {
    return new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  /* ─── CUSTOM PULSING ICON ────────────────────────── */
  function makePulseIcon(severity) {
    const cls  = severityClass(severity);
    const html = `
      <div class="pulse-marker ${cls}">
        <div class="ring"></div>
        <div class="dot"></div>
      </div>`;
    return L.divIcon({
      html,
      className: '',
      iconSize:    [22, 22],
      iconAnchor:  [11, 11],
      popupAnchor: [0, -14],
    });
  }

  /* ─── POPUP HTML ─────────────────────────────────── */
  function buildPopup(t) {
    const cls   = severityClass(t.severity);
    const color = cls === 'high'
      ? 'var(--danger)'
      : cls === 'medium'
        ? 'var(--warning)'
        : 'var(--success)';
    return `
      <div class="threat-popup">
        <div class="popup-header">
          <span class="popup-flag">📍</span>
          <div>
            <div class="popup-location">${t.country}</div>
            <div class="popup-city">${t.city}</div>
          </div>
        </div>
        <div class="popup-row">
          <span class="popup-key">THREAT TYPE</span>
          <span class="popup-val">${t.threat}</span>
        </div>
        <div class="popup-row">
          <span class="popup-key">SEVERITY</span>
          <span class="popup-val" style="color:${color};font-weight:700">${t.severity}</span>
        </div>
        <div class="popup-time">
          <i class="fa-regular fa-clock" style="margin-right:4px"></i>${formatTime(t.time)}
        </div>
      </div>`;
  }

  /* ─── RENDER MARKERS ─────────────────────────────── */
  function renderMarkers(threats) {
    markerLayer.clearLayers();

    threats.forEach((t, i) => {
      if (!t.lat || !t.lng) return;

      const icon   = makePulseIcon(t.severity);
      const marker = L.marker([t.lat, t.lng], { icon, opacity: 0 });

      marker.bindPopup(buildPopup(t), {
        maxWidth: 280,
        className: 'threat-popup-wrapper',
      });

      markerLayer.addLayer(marker);

      // Staggered fade-in
      setTimeout(() => {
        try { marker.setOpacity(1); } catch (_) {}
      }, i * ANIMATE_IN_MS);
    });
  }

  /* ─── UPDATE RIBBON COUNTERS ─────────────────────── */
  function updateRibbon(threats) {
    const high   = threats.filter(t => (t.severity || '').toUpperCase() === 'HIGH').length;
    const medium = threats.filter(t => (t.severity || '').toUpperCase() === 'MEDIUM').length;
    const low    = threats.filter(t => !['HIGH', 'MEDIUM'].includes((t.severity || '').toUpperCase())).length;

    document.getElementById('count-high').textContent   = high;
    document.getElementById('count-medium').textContent = medium;
    document.getElementById('count-low').textContent    = low;

    const counter = document.getElementById('threat-counter');
    const sub     = document.getElementById('threat-counter-sub');
    counter.textContent = threats.length;
    sub.textContent     = `${high} high · ${medium} med · ${low} low`;

    document.getElementById('last-updated-ribbon').textContent = 'Last updated: ' + nowString();
    document.getElementById('intel-timestamp').textContent     = nowString();
  }

  /* ─── INTEL FEED PANEL ───────────────────────────── */
  function updateIntelPanel(threats) {
    const feed = document.getElementById('intel-feed');
    if (!feed) return;

    feed.innerHTML = '';

    if (!threats || threats.length === 0) {
      feed.innerHTML = '<div style="padding:20px 14px;text-align:center;color:var(--text-muted);font-size:0.8rem">No active threats detected</div>';
      return;
    }

    // Sort by severity: HIGH first
    const sorted = [...threats].sort((a, b) => {
      const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return (order[(a.severity || '').toUpperCase()] ?? 3)
           - (order[(b.severity || '').toUpperCase()] ?? 3);
    });

    sorted.forEach((t, idx) => {
      const item = document.createElement('div');
      item.className = 'intel-item';
      item.style.animationDelay = `${idx * 40}ms`;
      item.innerHTML = `
        <div class="intel-item-top">
          <span class="intel-location">${t.city}, ${t.country}</span>
          <span class="intel-sev ${t.severity}">${t.severity}</span>
        </div>
        <div class="intel-type">${t.threat}</div>
        <div class="intel-time">${formatTime(t.time)}</div>`;

      // Click to fly to marker
      item.style.cursor = 'pointer';
      item.addEventListener('click', () => {
        map.flyTo([t.lat, t.lng], 5, { duration: 1.2, easeLinearity: 0.4 });
      });

      feed.appendChild(item);
    });
  }

  /* ─── FETCH & REFRESH ────────────────────────────── */
  async function fetchThreats(showLoading) {
    if (showLoading) showLoader(true);

    try {
      const res  = await fetch(API_URL, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (Array.isArray(data)) {
        threatData = data;
        renderMarkers(data);
        updateRibbon(data);
        updateIntelPanel(data);
      }

      // FIX: Force Leaflet to re-measure the container after data renders.
      // This is the safety net — even if the CSS height chain is correct,
      // calling invalidateSize() ensures tiles fill the full container,
      // especially on the first load before the browser has fully painted.
      requestAnimationFrame(() => {
        map.invalidateSize({ animate: false });
      });

    } catch (err) {
      console.warn('[ThreatMap] Fetch error:', err);
      setConnectionStatus(false);
    } finally {
      showLoader(false);
      setConnectionStatus(true);
    }
  }

  function startAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(() => fetchThreats(false), REFRESH_MS);
  }

  /* ─── UI HELPERS ─────────────────────────────────── */
  function showLoader(visible) {
    const el = document.getElementById('map-loading');
    if (!el) return;
    if (visible) {
      el.classList.remove('hidden');
    } else {
      setTimeout(() => el.classList.add('hidden'), 300);
    }
  }

  function setConnectionStatus(online) {
    const el = document.getElementById('connection-status');
    if (!el) return;
    el.innerHTML = online
      ? '<div class="status-dot"></div> Live Feed Active'
      : '<div class="status-dot" style="background:var(--danger)"></div> Reconnecting…';
  }

  /* ─── MANUAL REFRESH (called from HTML) ──────────── */
  window.manualRefresh = function () {
    const btn  = document.getElementById('refresh-btn');
    const icon = document.getElementById('refresh-icon');
    if (btn)  btn.classList.add('spinning');
    if (icon) icon.classList.add('spinning');

    fetchThreats(false).finally(() => {
      setTimeout(() => {
        if (btn)  btn.classList.remove('spinning');
        if (icon) icon.classList.remove('spinning');
      }, 600);
    });

    // Reset auto-refresh timer so the interval restarts from now
    startAutoRefresh();
  };

  /* ─── RESIZE HANDLING ────────────────────────────── */
  // ResizeObserver: fires whenever #map's pixel dimensions change.
  // This covers: window resize, sidebar open/close (changes margin-left),
  // any dynamic layout shift that Leaflet doesn't automatically detect.
  function attachResizeObserver() {
    const mapEl = document.getElementById('map');
    if (!mapEl) return;

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        map.invalidateSize({ animate: false });
      });
      ro.observe(mapEl);
    } else {
      // Fallback for older browsers
      window.addEventListener('resize', () => {
        map.invalidateSize({ animate: false });
      });
    }
  }

  /* ─── BOOT ───────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    // FIX: Call invalidateSize() immediately after DOM is ready.
    // At this point the CSS height chain is resolved, so Leaflet
    // reads the correct pixel dimensions and renders tiles properly.
    // Using setTimeout(0) defers to the next paint cycle, which
    // guarantees the browser has applied all CSS before we measure.
    setTimeout(() => {
      map.invalidateSize({ animate: false });
    }, 0);

    fetchThreats(true);   // initial load with spinner
    startAutoRefresh();
    attachResizeObserver();
  });

})();