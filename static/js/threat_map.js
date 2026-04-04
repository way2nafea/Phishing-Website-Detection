/**
 * PhishGuard AI — Live Threat Map (Enhanced)
 * static/js/threat_map.js
 *
 * Features:
 *   - Leaflet dark map with pulsing markers
 *   - Leaflet.heat heatmap layer
 *   - Auto-refresh toggle (10s / off)
 *   - Toast notifications for new HIGH threats
 *   - Live intel feed with auto-scroll + new-entry blink
 *   - Fake data fallback when API returns < 5 items
 *   - Enhanced popups with risk score
 *   - map.invalidateSize() on DOMContentLoaded + ResizeObserver
 */

(function () {
  'use strict';

  /* ─── CONFIG ─────────────────────────────────────────── */
  const API_URL       = '/api/threat-map';
  const REFRESH_MS    = 10000;
  const ANIMATE_IN_MS = 60;

  /* ─── FAKE DATA POOL ─────────────────────────────────── */
  const FAKE_CITIES = [
    { city:'Moscow',       country:'Russia',      lat: 55.75, lng:  37.62 },
    { city:'Beijing',      country:'China',        lat: 39.91, lng: 116.39 },
    { city:'Lagos',        country:'Nigeria',      lat:  6.45, lng:   3.38 },
    { city:'São Paulo',    country:'Brazil',       lat:-23.55, lng: -46.63 },
    { city:'Bucharest',    country:'Romania',      lat: 44.43, lng:  26.10 },
    { city:'Kyiv',         country:'Ukraine',      lat: 50.45, lng:  30.52 },
    { city:'Tehran',       country:'Iran',         lat: 35.69, lng:  51.39 },
    { city:'Karachi',      country:'Pakistan',     lat: 24.86, lng:  67.01 },
    { city:'Mumbai',       country:'India',        lat: 19.08, lng:  72.88 },
    { city:'Jakarta',      country:'Indonesia',    lat: -6.21, lng: 106.85 },
    { city:'Ho Chi Minh',  country:'Vietnam',      lat: 10.82, lng: 106.63 },
    { city:'Ankara',       country:'Turkey',       lat: 39.92, lng:  32.85 },
    { city:'Cairo',        country:'Egypt',        lat: 30.06, lng:  31.25 },
    { city:'Johannesburg', country:'South Africa', lat:-26.20, lng:  28.04 },
    { city:'Minsk',        country:'Belarus',      lat: 53.90, lng:  27.57 },
    { city:'Bangkok',      country:'Thailand',     lat: 13.75, lng: 100.52 },
    { city:'Dhaka',        country:'Bangladesh',   lat: 23.72, lng:  90.41 },
    { city:'Nairobi',      country:'Kenya',        lat: -1.29, lng:  36.82 },
    { city:'Bogotá',       country:'Colombia',     lat:  4.71, lng: -74.07 },
    { city:'Mexico City',  country:'Mexico',       lat: 19.43, lng: -99.13 },
    { city:'Buenos Aires', country:'Argentina',    lat:-34.60, lng: -58.38 },
    { city:'Riyadh',       country:'Saudi Arabia', lat: 24.69, lng:  46.72 },
    { city:'Kuala Lumpur', country:'Malaysia',     lat:  3.14, lng: 101.69 },
    { city:'Manila',       country:'Philippines',  lat: 14.60, lng: 120.98 },
    { city:'Seoul',        country:'South Korea',  lat: 37.57, lng: 126.98 },
    { city:'Tashkent',     country:'Uzbekistan',   lat: 41.30, lng:  69.24 },
    { city:'Caracas',      country:'Venezuela',    lat: 10.48, lng: -66.88 },
    { city:'Khartoum',     country:'Sudan',        lat: 15.55, lng:  32.53 },
    { city:'Casablanca',   country:'Morocco',      lat: 33.59, lng:  -7.62 },
    { city:'Accra',        country:'Ghana',        lat:  5.56, lng:  -0.20 },
  ];

  const THREAT_TYPES = [
    'Phishing Campaign','Ransomware Drop','Credential Harvesting',
    'SQL Injection','DDoS Source','Malware C2','Botnet Node',
    'Spear Phishing','Zero-Day Exploit','Brute Force Attack',
    'Data Exfiltration','DNS Spoofing','Cryptojacking',
  ];

  const SEVERITIES = ['HIGH','HIGH','MEDIUM','MEDIUM','MEDIUM','LOW','LOW','LOW','LOW'];

  function rnd(a, b) { return Math.random() * (b - a) + a; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function generateFakeData(n) {
    n = n || 30;
    const used = new Set();
    const now  = Date.now();
    const out  = [];
    for (let i = 0; i < n; i++) {
      let c; do { c = pick(FAKE_CITIES); } while (used.has(c.city) && used.size < FAKE_CITIES.length);
      used.add(c.city);
      const sev   = pick(SEVERITIES);
      const risk  = sev==='HIGH' ? ~~rnd(72,99) : sev==='MEDIUM' ? ~~rnd(32,69) : ~~rnd(5,29);
      out.push({
        city: c.city, country: c.country,
        lat: c.lat + rnd(-0.4,0.4), lng: c.lng + rnd(-0.4,0.4),
        severity: sev, threat: pick(THREAT_TYPES),
        time: new Date(now - rnd(0, 21600000)).toISOString(),
        risk_score: risk,
      });
    }
    return out;
  }

  /* ─── TOAST SYSTEM ───────────────────────────────────── */
  let _toastBox = null;
  function getToastBox() {
    if (_toastBox) return _toastBox;
    _toastBox = document.createElement('div');
    _toastBox.className = 'pg-toast-container';
    document.body.appendChild(_toastBox);
    return _toastBox;
  }

  function toast(msg, sev, dur) {
    sev = (sev || 'info').toUpperCase(); dur = dur || 4500;
    const box   = getToastBox();
    const el    = document.createElement('div');
    el.className = 'pg-toast pg-toast--' + sev.toLowerCase();
    const icons  = {HIGH:'⚠️',MEDIUM:'🔔',LOW:'ℹ️',INFO:'ℹ️',SUCCESS:'✅'};
    el.innerHTML = `<span class="pg-toast-icon">${icons[sev]||'ℹ️'}</span>
      <span class="pg-toast-msg">${msg}</span>
      <button class="pg-toast-close">✕</button>`;
    el.querySelector('.pg-toast-close').onclick = () => dismissToast(el);
    box.appendChild(el);
    requestAnimationFrame(() => el.classList.add('pg-toast--visible'));
    el._t = setTimeout(() => dismissToast(el), dur);
    return el;
  }

  function dismissToast(el) {
    clearTimeout(el._t);
    el.classList.remove('pg-toast--visible');
    el.classList.add('pg-toast--hiding');
    setTimeout(() => el.remove(), 350);
  }

  /* ─── MAP INIT ───────────────────────────────────────── */
  const map = L.map('map', {
    center: [20, 0], zoom: 2, minZoom: 2, maxZoom: 10,
    zoomControl: true, attributionControl: false,
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd', maxZoom: 19,
  }).addTo(map);

  L.control.attribution({ prefix: false, position: 'bottomright' })
    .addAttribution('<span style="color:rgba(255,255,255,0.2);font-size:10px">© CartoDB · PhishGuard AI</span>')
    .addTo(map);

  /* ─── STATE ──────────────────────────────────────────── */
  let markerLayer    = L.layerGroup().addTo(map);
  let heatLayer      = null;
  let heatVisible    = false;
  let refreshTimer   = null;
  let autoRefreshOn  = true;
  let threatData     = [];
  let previousHighSet= new Set();

  /* ─── HELPERS ─────────────────────────────────────────── */
  function sevClass(sev) {
    if (!sev) return 'low';
    const s = sev.toUpperCase();
    return s === 'HIGH' ? 'high' : s === 'MEDIUM' ? 'medium' : 'low';
  }

  function sevColor(sev) {
    const c = sevClass(sev);
    return c === 'high' ? '#FF4560' : c === 'medium' ? '#FFB020' : '#00E5A0';
  }

  function fmtTime(iso) {
    try {
      return new Date(iso).toLocaleString('en-GB', {
        day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit', hour12:false
      });
    } catch(_) { return iso || '—'; }
  }

  function nowStr() {
    return new Date().toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  }

  function calcRisk(t) {
    if (t.risk_score != null) return t.risk_score;
    return t.severity === 'HIGH' ? 85 : t.severity === 'MEDIUM' ? 50 : 15;
  }

  /* ─── CUSTOM PULSING ICON ─────────────────────────────── */
  function makePulseIcon(sev) {
    const cls = sevClass(sev);
    const html = `<div class="pulse-marker ${cls}"><div class="ring"></div><div class="dot"></div></div>`;
    return L.divIcon({ html, className:'', iconSize:[22,22], iconAnchor:[11,11], popupAnchor:[0,-14] });
  }

  /* ─── ENHANCED POPUP ──────────────────────────────────── */
  function buildPopup(t) {
    const cls   = sevClass(t.severity);
    const color = sevColor(t.severity);
    const risk  = calcRisk(t);
    const barW  = Math.min(100, Math.max(0, risk));
    const barColor = risk >= 70 ? 'var(--danger)' : risk >= 30 ? 'var(--warning)' : 'var(--success)';

    return `
      <div class="threat-popup">
        <div class="popup-header">
          <span class="popup-flag">📍</span>
          <div>
            <div class="popup-location">${t.city}</div>
            <div class="popup-city">${t.country}</div>
          </div>
          <span class="intel-sev ${t.severity}" style="margin-left:auto">${t.severity}</span>
        </div>
        <div class="popup-row">
          <span class="popup-key">THREAT TYPE</span>
          <span class="popup-val">${t.threat}</span>
        </div>
        <div class="popup-row">
          <span class="popup-key">SEVERITY</span>
          <span class="popup-val" style="color:${color};font-weight:700">${t.severity}</span>
        </div>
        <div class="popup-row">
          <span class="popup-key">RISK SCORE</span>
          <span class="popup-val" style="font-family:var(--font-mono);font-weight:700;color:${barColor}">${risk}%</span>
        </div>
        <div style="margin:8px 0 4px">
          <div style="height:5px;background:rgba(255,255,255,0.07);border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${barW}%;background:${barColor};border-radius:3px;transition:width 0.8s ease"></div>
          </div>
        </div>
        <div class="popup-time"><i class="fa-regular fa-clock" style="margin-right:4px"></i>${fmtTime(t.time)}</div>
      </div>`;
  }

  /* ─── RENDER MARKERS ──────────────────────────────────── */
  function renderMarkers(threats) {
    markerLayer.clearLayers();
    threats.forEach((t, i) => {
      if (!t.lat || !t.lng) return;
      const icon   = makePulseIcon(t.severity);
      const marker = L.marker([t.lat, t.lng], { icon, opacity: 0 });
      marker.bindPopup(buildPopup(t), { maxWidth:300, className:'threat-popup-wrapper' });
      markerLayer.addLayer(marker);
      setTimeout(() => { try { marker.setOpacity(1); } catch(_) {} }, i * ANIMATE_IN_MS);
    });
  }

  /* ─── HEATMAP ─────────────────────────────────────────── */
  function buildHeatData(threats) {
    return threats.map(t => {
      const sev = (t.severity||'').toUpperCase();
      const intensity = sev === 'HIGH' ? 1.0 : sev === 'MEDIUM' ? 0.6 : 0.3;
      return [t.lat, t.lng, intensity];
    });
  }

  function showHeatmap(threats) {
    if (typeof L.heatLayer === 'undefined') return;
    if (heatLayer) { map.removeLayer(heatLayer); heatLayer = null; }
    heatLayer = L.heatLayer(buildHeatData(threats), {
      radius: 28, blur: 22, maxZoom: 8, max: 1.0,
      gradient: { 0.2:'rgba(0,229,160,0.6)', 0.5:'rgba(255,176,32,0.8)', 1.0:'rgba(255,69,96,1)' },
    }).addTo(map);
  }

  function toggleHeatmap() {
    heatVisible = !heatVisible;
    const btn = document.getElementById('heatmap-toggle');
    if (heatVisible) {
      showHeatmap(threatData);
      if (btn) { btn.classList.add('active'); btn.innerHTML = '<i class="fa-solid fa-fire"></i> Heatmap ON'; }
    } else {
      if (heatLayer) { map.removeLayer(heatLayer); heatLayer = null; }
      if (btn) { btn.classList.remove('active'); btn.innerHTML = '<i class="fa-solid fa-fire"></i> Heatmap'; }
    }
  }
  window.toggleHeatmap = toggleHeatmap;

  /* ─── AUTO-REFRESH TOGGLE ─────────────────────────────── */
  function toggleAutoRefresh() {
    autoRefreshOn = !autoRefreshOn;
    const btn  = document.getElementById('auto-refresh-toggle');
    const pill = document.getElementById('auto-refresh-status');

    if (autoRefreshOn) {
      startAutoRefresh();
      if (btn)  btn.classList.add('active');
      if (pill) { pill.innerHTML = '<div class="status-dot"></div> Live Feed Active'; }
      toast('Auto-refresh enabled — updating every 10s', 'info', 3000);
    } else {
      stopAutoRefresh();
      if (btn)  btn.classList.remove('active');
      if (pill) { pill.innerHTML = '<div class="status-dot" style="background:var(--warning)"></div> Feed Paused'; }
      toast('Auto-refresh paused', 'medium', 2500);
    }
  }
  window.toggleAutoRefresh = toggleAutoRefresh;

  /* ─── COUNTERS ────────────────────────────────────────── */
  function updateRibbon(threats) {
    const high   = threats.filter(t => (t.severity||'').toUpperCase() === 'HIGH').length;
    const medium = threats.filter(t => (t.severity||'').toUpperCase() === 'MEDIUM').length;
    const low    = threats.filter(t => !['HIGH','MEDIUM'].includes((t.severity||'').toUpperCase())).length;

    safeSet('count-high',   high);
    safeSet('count-medium', medium);
    safeSet('count-low',    low);
    safeSet('threat-counter', threats.length);
    safeSet('threat-counter-sub', `${high} high · ${medium} med · ${low} low`);
    safeSet('last-updated-ribbon', 'Last updated: ' + nowStr());
    safeSet('intel-timestamp', nowStr());
  }

  function safeSet(id, val) { const e = document.getElementById(id); if (e) e.textContent = val; }

  /* ─── INTEL FEED ──────────────────────────────────────── */
  function updateIntelPanel(threats, isRefresh) {
    const feed = document.getElementById('intel-feed');
    if (!feed) return;

    const sorted = [...threats].sort((a,b) => {
      const o = {HIGH:0,MEDIUM:1,LOW:2};
      return (o[(a.severity||'').toUpperCase()]??3) - (o[(b.severity||'').toUpperCase()]??3);
    });

    // Detect new HIGH threats
    const newHigh = [];
    sorted.forEach(t => {
      if ((t.severity||'').toUpperCase() === 'HIGH') {
        const key = `${t.city}-${t.country}-${t.threat}`;
        if (isRefresh && !previousHighSet.has(key)) newHigh.push(t);
        previousHighSet.add(key);
      }
    });

    // Fire notifications for new HIGH threats
    newHigh.slice(0,3).forEach(t => {
      toast(`⚠️ NEW HIGH threat: ${t.city}, ${t.country} — ${t.threat}`, 'HIGH', 6000);
    });

    // Build feed
    feed.innerHTML = '';

    if (!sorted.length) {
      feed.innerHTML = '<div style="padding:20px 14px;text-align:center;color:var(--text-muted);font-size:0.8rem">No active threats detected</div>';
      return;
    }

    sorted.forEach((t, idx) => {
      const item      = document.createElement('div');
      const isNew     = isRefresh && newHigh.find(n => n.city === t.city && n.threat === t.threat);
      item.className  = 'intel-item' + (isNew ? ' intel-item--new' : '');
      item.style.animationDelay = `${idx * 35}ms`;

      const flagMap = { Russia:'🇷🇺', China:'🇨🇳', Nigeria:'🇳🇬', Ukraine:'🇺🇦', India:'🇮🇳',
        Brazil:'🇧🇷', Iran:'🇮🇷', Pakistan:'🇵🇰', Indonesia:'🇮🇩', Vietnam:'🇻🇳',
        Turkey:'🇹🇷', Egypt:'🇪🇬', Mexico:'🇲🇽', Romania:'🇷🇴', Belarus:'🇧🇾',
        'South Korea':'🇰🇷', Philippines:'🇵🇭', Thailand:'🇹🇭', Malaysia:'🇲🇾',
        Bangladesh:'🇧🇩', Kenya:'🇰🇪', Colombia:'🇨🇴', Argentina:'🇦🇷',
        'Saudi Arabia':'🇸🇦', 'South Africa':'🇿🇦', Morocco:'🇲🇦', Ghana:'🇬🇭',
        Uzbekistan:'🇺🇿', Sudan:'🇸🇩', Venezuela:'🇻🇪', USA:'🇺🇸', Germany:'🇩🇪',
      };
      const flag = flagMap[t.country] || '🌐';

      item.innerHTML = `
        <div class="intel-item-top">
          <span class="intel-location">${flag} ${t.city}, ${t.country}</span>
          <span class="intel-sev ${t.severity}">${t.severity}</span>
        </div>
        <div class="intel-type">${t.threat}</div>
        <div class="intel-time">${fmtTime(t.time)}</div>`;

      item.style.cursor = 'pointer';
      item.addEventListener('click', () => map.flyTo([t.lat, t.lng], 5, { duration:1.2, easeLinearity:0.4 }));
      feed.appendChild(item);
    });

    // Auto-scroll to top to show latest
    if (isRefresh) {
      const scroll = feed.closest('.intel-scroll') || feed.parentElement;
      if (scroll) scroll.scrollTop = 0;
    }
  }

  /* ─── FETCH & REFRESH ─────────────────────────────────── */
  async function fetchThreats(showLoading, isRefresh) {
    if (showLoading) showLoader(true);
    try {
      let data = [];
      try {
        const res = await fetch(API_URL, { credentials:'same-origin' });
        if (res.ok) data = await res.json();
      } catch(_) {}

      if (!Array.isArray(data) || data.length < 5) {
        data = generateFakeData(30);
      }

      threatData = data;
      renderMarkers(data);
      updateRibbon(data);
      updateIntelPanel(data, !!isRefresh);
      if (heatVisible) showHeatmap(data);

      requestAnimationFrame(() => map.invalidateSize({ animate: false }));

    } catch(err) {
      console.warn('[ThreatMap] Error:', err);
      setConnStatus(false);
    } finally {
      showLoader(false);
      setConnStatus(true);
    }
  }

  function startAutoRefresh() {
    stopAutoRefresh();
    refreshTimer = setInterval(() => fetchThreats(false, true), REFRESH_MS);
  }

  function stopAutoRefresh() {
    if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
  }

  /* ─── UI HELPERS ──────────────────────────────────────── */
  function showLoader(v) {
    const el = document.getElementById('map-loading');
    if (!el) return;
    v ? el.classList.remove('hidden') : setTimeout(() => el.classList.add('hidden'), 300);
  }

  function setConnStatus(online) {
    const el = document.getElementById('connection-status');
    if (!el) return;
    el.innerHTML = online
      ? '<div class="status-dot"></div> Live Feed Active'
      : '<div class="status-dot" style="background:var(--danger)"></div> Reconnecting…';
  }

  window.manualRefresh = function () {
    const btn  = document.getElementById('refresh-btn');
    const icon = document.getElementById('refresh-icon');
    if (btn)  btn.classList.add('spinning');
    if (icon) icon.classList.add('spinning');
    fetchThreats(false, true).finally(() => {
      setTimeout(() => {
        if (btn)  btn.classList.remove('spinning');
        if (icon) icon.classList.remove('spinning');
      }, 600);
    });
    if (autoRefreshOn) startAutoRefresh();
  };

  /* ─── RESIZE HANDLING ─────────────────────────────────── */
  function attachResizeObserver() {
    const mapEl = document.getElementById('map');
    if (!mapEl) return;
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => map.invalidateSize({ animate: false })).observe(mapEl);
    } else {
      window.addEventListener('resize', () => map.invalidateSize({ animate: false }));
    }
  }

  /* ─── BOOT ────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => map.invalidateSize({ animate: false }), 0);
    fetchThreats(true, false);
    startAutoRefresh();
    attachResizeObserver();

    // Init auto-refresh button state
    const btn = document.getElementById('auto-refresh-toggle');
    if (btn) btn.classList.add('active');
  });

})();