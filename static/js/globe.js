/**
 * PhishGuard AI — 3D Threat Globe + Advanced Search System
 * static/js/globe.js
 *
 * Features:
 *  - Severity-colored arcs (HIGH/MED/LOW)
 *  - Directional arc animation
 *  - Toast notifications for HIGH threats
 *  - Auto-refresh toggle
 *  - Fake data fallback
 *  - Enhanced hover tooltips with risk scores
 *  - ADVANCED SEARCH: text + voice (Web Speech API)
 *  - Autocomplete dropdown (cities, countries, continents)
 *  - Globe rotation / zoom to searched location
 *  - Glowing search pin marker
 *  - Recent searches (localStorage)
 *  - Geolocation "use my location"
 *  - Intelligent voice command parsing
 */

(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════
   *  CONFIG
   * ══════════════════════════════════════════════════════════ */
  const API_URL        = '/api/threat-map';
  const SEARCH_API_URL = '/search_location';
  const REFRESH_MS     = 12000;
  const MAX_RECENT     = 8;
  const RECENT_KEY     = 'pg_globe_recent_searches';

  const SEV_COLORS = {
    HIGH:   '#FF4560',
    MEDIUM: '#FFB020',
    LOW:    '#00E5A0',
  };

  /* ══════════════════════════════════════════════════════════
   *  FAKE DATA (fallback)
   * ══════════════════════════════════════════════════════════ */
  const FAKE_CITIES = [
    { city:'Moscow',       country:'Russia',        lat: 55.75, lng:  37.62 },
    { city:'Beijing',      country:'China',          lat: 39.91, lng: 116.39 },
    { city:'Lagos',        country:'Nigeria',        lat:  6.45, lng:   3.38 },
    { city:'São Paulo',    country:'Brazil',         lat:-23.55, lng: -46.63 },
    { city:'Bucharest',    country:'Romania',        lat: 44.43, lng:  26.10 },
    { city:'Kyiv',         country:'Ukraine',        lat: 50.45, lng:  30.52 },
    { city:'Tehran',       country:'Iran',           lat: 35.69, lng:  51.39 },
    { city:'Karachi',      country:'Pakistan',       lat: 24.86, lng:  67.01 },
    { city:'Mumbai',       country:'India',          lat: 19.08, lng:  72.88 },
    { city:'Jakarta',      country:'Indonesia',      lat: -6.21, lng: 106.85 },
    { city:'Ho Chi Minh',  country:'Vietnam',        lat: 10.82, lng: 106.63 },
    { city:'Cairo',        country:'Egypt',          lat: 30.06, lng:  31.25 },
    { city:'Johannesburg', country:'S. Africa',      lat:-26.20, lng:  28.04 },
    { city:'Bangkok',      country:'Thailand',       lat: 13.75, lng: 100.52 },
    { city:'Nairobi',      country:'Kenya',          lat: -1.29, lng:  36.82 },
    { city:'Bogotá',       country:'Colombia',       lat:  4.71, lng: -74.07 },
    { city:'Mexico City',  country:'Mexico',         lat: 19.43, lng: -99.13 },
    { city:'Seoul',        country:'South Korea',    lat: 37.57, lng: 126.98 },
    { city:'Riyadh',       country:'Saudi Arabia',   lat: 24.69, lng:  46.72 },
    { city:'Kuala Lumpur', country:'Malaysia',       lat:  3.14, lng: 101.69 },
    { city:'Manila',       country:'Philippines',    lat: 14.60, lng: 120.98 },
    { city:'Tashkent',     country:'Uzbekistan',     lat: 41.30, lng:  69.24 },
    { city:'Minsk',        country:'Belarus',        lat: 53.90, lng:  27.57 },
    { city:'Ankara',       country:'Turkey',         lat: 39.92, lng:  32.85 },
    { city:'Casablanca',   country:'Morocco',        lat: 33.59, lng:  -7.62 },
    { city:'Accra',        country:'Ghana',          lat:  5.56, lng:  -0.20 },
    { city:'Caracas',      country:'Venezuela',      lat: 10.48, lng: -66.88 },
    { city:'Khartoum',     country:'Sudan',          lat: 15.55, lng:  32.53 },
    { city:'Buenos Aires', country:'Argentina',      lat:-34.60, lng: -58.38 },
    { city:'Dhaka',        country:'Bangladesh',     lat: 23.72, lng:  90.41 },
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
    n = n || 32;
    const used = new Set();
    const now  = Date.now();
    const out  = [];
    for (let i = 0; i < n; i++) {
      let c; do { c = pick(FAKE_CITIES); } while (used.has(c.city) && used.size < FAKE_CITIES.length);
      used.add(c.city);
      const sev  = pick(SEVERITIES);
      const risk = sev==='HIGH' ? ~~rnd(72,99) : sev==='MEDIUM' ? ~~rnd(32,69) : ~~rnd(5,29);
      out.push({
        city: c.city, country: c.country,
        lat: c.lat + rnd(-0.3,0.3), lng: c.lng + rnd(-0.3,0.3),
        severity: sev, threat: pick(THREAT_TYPES),
        time: new Date(now - rnd(0, 21600000)).toISOString(),
        risk_score: risk,
      });
    }
    return out;
  }

  /* ══════════════════════════════════════════════════════════
   *  TOAST SYSTEM
   * ══════════════════════════════════════════════════════════ */
  let _toastBox = null;
  function getToastBox() {
    if (_toastBox) return _toastBox;
    _toastBox = document.createElement('div');
    _toastBox.className = 'pg-toast-container';
    document.body.appendChild(_toastBox);
    return _toastBox;
  }
  function toast(msg, sev, dur) {
    sev = (sev||'info').toUpperCase(); dur = dur||4500;
    const box = getToastBox();
    const el  = document.createElement('div');
    el.className = 'pg-toast pg-toast--' + sev.toLowerCase();
    const icons  = {HIGH:'⚠️',MEDIUM:'🔔',LOW:'ℹ️',INFO:'ℹ️',SUCCESS:'✅'};
    el.innerHTML = `<span class="pg-toast-icon">${icons[sev]||'ℹ️'}</span>
      <span class="pg-toast-msg">${msg}</span>
      <button class="pg-toast-close">✕</button>`;
    el.querySelector('.pg-toast-close').onclick = () => dismissToast(el);
    box.appendChild(el);
    requestAnimationFrame(() => el.classList.add('pg-toast--visible'));
    el._t = setTimeout(() => dismissToast(el), dur);
  }
  function dismissToast(el) {
    clearTimeout(el._t);
    el.classList.remove('pg-toast--visible');
    el.classList.add('pg-toast--hiding');
    setTimeout(() => el.remove(), 350);
  }

  /* ══════════════════════════════════════════════════════════
   *  GLOBE STATE
   * ══════════════════════════════════════════════════════════ */
  let globe         = null;
  let threatData    = [];
  let refreshTimer  = null;
  let autoRefreshOn = true;
  let prevHighSet   = new Set();

  // Search pin data on globe
  let searchPinData = [];

  /* ══════════════════════════════════════════════════════════
   *  HELPERS
   * ══════════════════════════════════════════════════════════ */
  function sevColor(sev) { return SEV_COLORS[(sev||'').toUpperCase()] || SEV_COLORS.LOW; }

  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function fmtTime(iso) {
    try {
      return new Date(iso).toLocaleString('en-GB', {
        day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit', hour12:false
      });
    } catch(_) { return iso||'—'; }
  }

  function nowStr() {
    return new Date().toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  }

  /* ══════════════════════════════════════════════════════════
   *  ARC GENERATION
   * ══════════════════════════════════════════════════════════ */
  function generateArcs(threats) {
    if (threats.length < 2) return [];
    const arcs   = [];
    const n      = Math.min(threats.length, 22);
    const sorted = [...threats].sort((a,b) => {
      const o = { HIGH:0, MEDIUM:1, LOW:2 };
      return (o[(b.severity||'').toUpperCase()]??3) - (o[(a.severity||'').toUpperCase()]??3);
    });

    for (let i = 0; i < n; i++) {
      const src = sorted[i];
      const dst = sorted[(i + Math.floor(rnd(1, sorted.length))) % sorted.length];
      if (!src || !dst || src === dst) continue;

      const sev       = src.severity || 'LOW';
      const baseColor = sevColor(sev);
      const alpha     = sev === 'HIGH' ? rnd(0.7, 0.95) : rnd(0.4, 0.75);
      const stroke    = sev === 'HIGH' ? rnd(1.0, 2.0)  : rnd(0.4, 1.2);
      const speed     = sev === 'HIGH' ? rnd(1200, 2200) : rnd(1800, 3800);
      const alt       = sev === 'HIGH' ? rnd(0.2, 0.55)  : rnd(0.1, 0.4);

      arcs.push({
        startLat: src.lat, startLng: src.lng,
        endLat:   dst.lat, endLng:   dst.lng,
        color:    [hexToRgba(baseColor, alpha), hexToRgba(baseColor, 0.05)],
        stroke, dash: sev==='HIGH'?rnd(2,5):rnd(1,3),
        gap:      sev==='HIGH'?rnd(0.5,2):rnd(1,4),
        animTime: speed, altitude: alt, severity: sev,
        label: `<span style="font-size:0.78rem;color:${baseColor};font-weight:600">${src.city} → ${dst.city}</span>`,
      });
    }
    return arcs;
  }

  /* ══════════════════════════════════════════════════════════
   *  TOOLTIP HTML
   * ══════════════════════════════════════════════════════════ */
  function buildTooltip(d) {
    const sev    = (d.severity||'LOW').toUpperCase();
    const color  = sevColor(sev);
    const risk   = d.risk_score != null ? d.risk_score : sev==='HIGH' ? 85 : sev==='MEDIUM' ? 50 : 15;
    const barW   = Math.min(100, Math.max(0, risk));
    const barClr = risk>=70 ? '#FF4560' : risk>=30 ? '#FFB020' : '#00E5A0';

    return `
      <div style="
        background:rgba(11,15,25,0.97);border:1px solid rgba(45,114,212,0.35);
        border-radius:8px;padding:14px 18px;min-width:220px;
        font-family:'Outfit',sans-serif;box-shadow:0 8px 32px rgba(0,0,0,0.6);
      ">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <span style="font-size:1.1rem">📍</span>
          <div style="flex:1">
            <div style="font-weight:700;color:#f0f4ff;font-size:0.875rem">${d.city}</div>
            <div style="font-size:0.75rem;color:#4a5a7a">${d.country}</div>
          </div>
          <span style="font-size:0.68rem;font-weight:700;font-family:'JetBrains Mono',monospace;
            padding:2px 8px;border-radius:4px;color:${color};
            background:${hexToRgba(color,0.15)};border:1px solid ${hexToRgba(color,0.3)}">${sev}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.78rem;padding:5px 0;border-top:1px solid rgba(255,255,255,0.06)">
          <span style="color:#4a5a7a;font-family:'JetBrains Mono',monospace;font-size:0.72rem">THREAT</span>
          <span style="color:#8a9bbe;font-weight:500">${d.threat}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.78rem;padding:5px 0;border-top:1px solid rgba(255,255,255,0.06)">
          <span style="color:#4a5a7a;font-family:'JetBrains Mono',monospace;font-size:0.72rem">RISK</span>
          <span style="color:${barClr};font-weight:700;font-family:'JetBrains Mono',monospace">${risk}%</span>
        </div>
        <div style="height:4px;background:rgba(255,255,255,0.07);border-radius:2px;overflow:hidden;margin:6px 0 4px">
          <div style="height:100%;width:${barW}%;background:${barClr};border-radius:2px"></div>
        </div>
        <div style="font-size:0.72rem;color:#4a5a7a;margin-top:6px;font-family:'JetBrains Mono',monospace">${fmtTime(d.time)}</div>
      </div>`;
  }

  /* ══════════════════════════════════════════════════════════
   *  RENDER GLOBE DATA
   * ══════════════════════════════════════════════════════════ */
  function renderGlobeData(threats) {
    if (!globe) return;
    const arcs = generateArcs(threats);

    // Combine real threat points + search pin
    const allPoints = [...threats, ...searchPinData];

    globe
      .pointsData(allPoints)
      .pointLat(d => d.lat)
      .pointLng(d => d.lng)
      .pointColor(d => d._isSearchPin ? '#00E5A0' : sevColor(d.severity))
      .pointAltitude(d => {
        if (d._isSearchPin) return 0.08;
        const s = (d.severity||'').toUpperCase();
        return s==='HIGH' ? 0.05 : s==='MEDIUM' ? 0.03 : 0.01;
      })
      .pointRadius(d => {
        if (d._isSearchPin) return 0.9;
        const s = (d.severity||'').toUpperCase();
        return s==='HIGH' ? 0.6 : s==='MEDIUM' ? 0.45 : 0.28;
      })
      .pointsMerge(false)
      .pointLabel(d => d._isSearchPin ? buildSearchPinTooltip(d) : buildTooltip(d));

    globe
      .ringsData(allPoints)
      .ringLat(d => d.lat)
      .ringLng(d => d.lng)
      .ringColor(d => t => {
        const c = d._isSearchPin ? '#00E5A0' : sevColor(d.severity);
        return hexToRgba(c, Math.max(0, 1 - t));
      })
      .ringMaxRadius(d => {
        if (d._isSearchPin) return 8;
        const s=(d.severity||'').toUpperCase();
        return s==='HIGH'?6:s==='MEDIUM'?4:2.5;
      })
      .ringPropagationSpeed(d => {
        if (d._isSearchPin) return 3;
        const s=(d.severity||'').toUpperCase();
        return s==='HIGH'?4:s==='MEDIUM'?2.8:1.6;
      })
      .ringRepeatPeriod(d => {
        if (d._isSearchPin) return 800;
        const s=(d.severity||'').toUpperCase();
        return s==='HIGH'?650:s==='MEDIUM'?950:1300;
      });

    globe
      .arcsData(arcs)
      .arcStartLat(d => d.startLat).arcStartLng(d => d.startLng)
      .arcEndLat(d => d.endLat).arcEndLng(d => d.endLng)
      .arcColor(d => d.color).arcStroke(d => d.stroke)
      .arcDashLength(d => d.dash).arcDashGap(d => d.gap)
      .arcDashAnimateTime(d => d.animTime).arcAltitudeAutoScale(0.4)
      .arcLabel(d => d.label);

    updateCounters(threats, arcs);
  }

  function buildSearchPinTooltip(d) {
    return `
      <div style="background:rgba(8,14,28,0.97);border:1px solid rgba(0,229,160,0.4);
        border-radius:8px;padding:12px 16px;min-width:180px;font-family:'Outfit',sans-serif;
        box-shadow:0 8px 32px rgba(0,0,0,0.6),0 0 20px rgba(0,229,160,0.1)">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <span style="font-size:1.1rem">🔍</span>
          <div>
            <div style="font-weight:700;color:#00E5A0;font-size:0.875rem">${d.name}</div>
            <div style="font-size:0.75rem;color:#4a5a7a">${d.country||d.continent||'Location'}</div>
          </div>
        </div>
        <div style="font-size:0.72rem;color:#4a5a7a;font-family:'JetBrains Mono',monospace">
          ${d.lat.toFixed(4)}°, ${d.lng.toFixed(4)}°
        </div>
      </div>`;
  }

  /* ══════════════════════════════════════════════════════════
   *  COUNTERS
   * ══════════════════════════════════════════════════════════ */
  function updateCounters(threats, arcs) {
    const high   = threats.filter(t => (t.severity||'').toUpperCase()==='HIGH').length;
    const medium = threats.filter(t => (t.severity||'').toUpperCase()==='MEDIUM').length;
    const low    = threats.filter(t => (t.severity||'').toUpperCase()==='LOW').length;

    safeSet('count-total',  threats.length);
    safeSet('count-high',   high);
    safeSet('count-medium', medium);
    safeSet('count-low',    low);
    safeSet('stat-arcs',    arcs ? arcs.length : 0);
    safeSet('stat-points',  threats.length);
    safeSet('last-updated', 'Last updated: ' + nowStr());
    safeSet('intel-ts',     nowStr());
  }

  function safeSet(id, val) { const e = document.getElementById(id); if (e) e.textContent = val; }

  /* ══════════════════════════════════════════════════════════
   *  INTEL PANEL
   * ══════════════════════════════════════════════════════════ */
  function updateIntelPanel(threats, isRefresh) {
    const feed = document.getElementById('intel-feed');
    if (!feed) return;

    if (isRefresh) {
      threats.forEach(t => {
        if ((t.severity||'').toUpperCase() === 'HIGH') {
          const key = `${t.city}-${t.threat}`;
          if (!prevHighSet.has(key)) {
            toast(`⚠️ NEW HIGH threat: ${t.city}, ${t.country} — ${t.threat}`, 'HIGH', 6000);
          }
          prevHighSet.add(key);
        }
      });
    } else {
      threats.filter(t=>(t.severity||'').toUpperCase()==='HIGH')
             .forEach(t => prevHighSet.add(`${t.city}-${t.threat}`));
    }

    feed.innerHTML = '';
    if (!threats || !threats.length) {
      feed.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:0.8rem">No active threats</div>';
      return;
    }

    const sorted = [...threats].sort((a,b) => {
      const o = {HIGH:0,MEDIUM:1,LOW:2};
      return (o[(a.severity||'').toUpperCase()]??3) - (o[(b.severity||'').toUpperCase()]??3);
    });

    const flagMap = {Russia:'🇷🇺',China:'🇨🇳',Nigeria:'🇳🇬',Ukraine:'🇺🇦',India:'🇮🇳',
      Brazil:'🇧🇷',Iran:'🇮🇷',Pakistan:'🇵🇰',Indonesia:'🇮🇩',Vietnam:'🇻🇳',
      Turkey:'🇹🇷',Egypt:'🇪🇬',Mexico:'🇲🇽',Romania:'🇷🇴',Belarus:'🇧🇾',
      'South Korea':'🇰🇷',Philippines:'🇵🇭',Thailand:'🇹🇭',Malaysia:'🇲🇾',
      Bangladesh:'🇧🇩',Kenya:'🇰🇪',Colombia:'🇨🇴',Argentina:'🇦🇷',
      'Saudi Arabia':'🇸🇦','S. Africa':'🇿🇦',Morocco:'🇲🇦',Ghana:'🇬🇭',
      Uzbekistan:'🇺🇿',Sudan:'🇸🇩',Venezuela:'🇻🇪',
    };

    sorted.forEach((t, i) => {
      const item = document.createElement('div');
      item.className = 'intel-item';
      item.style.animationDelay = `${i * 35}ms`;
      const flag = flagMap[t.country] || '🌐';
      item.innerHTML = `
        <div class="intel-item-top">
          <span class="intel-loc">${flag} ${t.city}, ${t.country}</span>
          <span class="intel-sev ${t.severity}">${t.severity}</span>
        </div>
        <div class="intel-threat">${t.threat}</div>
        <div class="intel-time">${fmtTime(t.time)}</div>`;
      item.addEventListener('click', () => {
        if (globe) globe.pointOfView({ lat: t.lat, lng: t.lng, altitude: 1.8 }, 1200);
      });
      feed.appendChild(item);
    });
  }

  /* ══════════════════════════════════════════════════════════
   *  AUTO-REFRESH
   * ══════════════════════════════════════════════════════════ */
  function toggleAutoRefresh() {
    autoRefreshOn = !autoRefreshOn;
    const btn = document.getElementById('globe-auto-refresh');
    if (autoRefreshOn) {
      startAutoRefresh();
      if (btn) { btn.querySelector('span').textContent = 'Live: ON'; }
      toast('Auto-refresh enabled', 'info', 2500);
    } else {
      stopAutoRefresh();
      if (btn) { btn.querySelector('span').textContent = 'Live: OFF'; }
      toast('Auto-refresh paused', 'medium', 2500);
    }
  }
  window.globeToggleAutoRefresh = toggleAutoRefresh;

  async function fetchThreats(showLoader) {
    if (showLoader) setLoader(true);
    try {
      let data = [];
      try {
        const res = await fetch(API_URL, { credentials: 'same-origin' });
        if (res.ok) data = await res.json();
      } catch(_) {}

      if (!Array.isArray(data) || data.length < 5) data = generateFakeData(32);

      const isRefresh = threatData.length > 0;
      threatData = data;
      renderGlobeData(data);
      updateIntelPanel(data, isRefresh);
    } catch(err) {
      console.warn('[Globe] Fetch error:', err);
    } finally {
      setLoader(false);
    }
  }

  function startAutoRefresh() {
    stopAutoRefresh();
    refreshTimer = setInterval(() => fetchThreats(false), REFRESH_MS);
  }
  function stopAutoRefresh() {
    if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
  }

  function setLoader(visible) {
    const el = document.getElementById('globe-loading');
    if (!el) return;
    if (visible) { el.classList.remove('hidden'); }
    else { setTimeout(() => el.classList.add('hidden'), 600); }
  }

  function animateLoadingSteps() {
    const el = document.getElementById('loading-status');
    if (!el) return;
    const steps = [
      'Initializing Three.js renderer…',
      'Loading Earth texture…',
      'Fetching threat intelligence…',
      'Plotting threat coordinates…',
      'Generating severity-colored arcs…',
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

  /* ══════════════════════════════════════════════════════════
   *  INIT GLOBE
   * ══════════════════════════════════════════════════════════ */
  function initGlobe() {
    const container = document.getElementById('globe-canvas-wrap');
    if (!container || typeof Globe === 'undefined') {
      console.error('[Globe] Globe.gl not loaded');
      return;
    }

    globe = Globe({ waitForGlobeReady: true, animateIn: true })(container);

    globe
      .globeImageUrl('//unpkg.com/three-globe/example/img/earth-dark.jpg')
      .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
      .backgroundImageUrl('//unpkg.com/three-globe/example/img/night-sky.png')
      .showAtmosphere(true)
      .atmosphereColor('rgba(45,114,212,0.28)')
      .atmosphereAltitude(0.2)
      .pointOfView({ lat: 20, lng: 0, altitude: 2.2 }, 0)
      .enablePointerInteraction(true);

    globe.controls().autoRotate      = true;
    globe.controls().autoRotateSpeed = 0.4;
    globe.controls().enableZoom      = true;
    globe.controls().minDistance     = 150;
    globe.controls().maxDistance     = 700;

    container.addEventListener('mouseenter', () => { globe.controls().autoRotate = false; });
    container.addEventListener('mouseleave', () => { globe.controls().autoRotate = true; });

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
    window.globeInvalidate = handleResize;
  }

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
    if (autoRefreshOn) startAutoRefresh();
  };

  /* ══════════════════════════════════════════════════════════
   *  ██████████████████████████████████████████████████████
   *  ████           ADVANCED SEARCH SYSTEM              ████
   *  ██████████████████████████████████████████████████████
   * ══════════════════════════════════════════════════════════ */

  /* ── State ──────────────────────────────────────────────── */
  let searchDebounce    = null;
  let dropdownIndex     = -1;
  let dropdownItems     = [];
  let isListening       = false;
  let recognition       = null;
  let locationDataCache = null;

  /* ── Recent searches ────────────────────────────────────── */
  function getRecent() {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); }
    catch(_) { return []; }
  }
  function addRecent(item) {
    let list = getRecent().filter(r => r.name.toLowerCase() !== item.name.toLowerCase());
    list.unshift(item);
    if (list.length > MAX_RECENT) list = list.slice(0, MAX_RECENT);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch(_) {}
  }
  function clearRecent() {
    try { localStorage.removeItem(RECENT_KEY); } catch(_) {}
  }

  /* ── Load location dataset ──────────────────────────────── */
  async function loadLocationData() {
    if (locationDataCache) return locationDataCache;
    try {
      const res = await fetch('/static/data/locations.json');
      if (!res.ok) throw new Error('Not found');
      locationDataCache = await res.json();
    } catch(_) {
      // Minimal inline fallback
      locationDataCache = {
        cities: [
          {name:'New York',country:'United States',continent:'North America',lat:40.7128,lng:-74.0060},
          {name:'London',country:'United Kingdom',continent:'Europe',lat:51.5074,lng:-0.1278},
          {name:'Tokyo',country:'Japan',continent:'Asia',lat:35.6762,lng:139.6503},
          {name:'Mumbai',country:'India',continent:'Asia',lat:19.0760,lng:72.8777},
          {name:'Paris',country:'France',continent:'Europe',lat:48.8566,lng:2.3522},
          {name:'Sydney',country:'Australia',continent:'Oceania',lat:-33.8688,lng:151.2093},
          {name:'Dubai',country:'UAE',continent:'Asia',lat:25.2048,lng:55.2708},
          {name:'São Paulo',country:'Brazil',continent:'South America',lat:-23.5505,lng:-46.6333},
        ],
        countries: [
          {name:'United States',continent:'North America',lat:37.0902,lng:-95.7129},
          {name:'India',continent:'Asia',lat:20.5937,lng:78.9629},
          {name:'China',continent:'Asia',lat:35.8617,lng:104.1954},
          {name:'Russia',continent:'Europe',lat:61.5240,lng:105.3188},
          {name:'Brazil',continent:'South America',lat:-14.2350,lng:-51.9253},
          {name:'Japan',continent:'Asia',lat:36.2048,lng:138.2529},
        ],
        continents: [
          {name:'Asia',lat:29.8406,lng:89.2969},
          {name:'Europe',lat:54.5260,lng:15.2551},
          {name:'Africa',lat:-8.7832,lng:34.5085},
          {name:'North America',lat:54.5260,lng:-105.2551},
          {name:'South America',lat:-8.7832,lng:-55.4915},
          {name:'Oceania',lat:-22.7359,lng:140.0188},
        ],
      };
    }
    return locationDataCache;
  }

  /* ── Search local dataset ───────────────────────────────── */
  async function searchLocal(query) {
    const q    = query.toLowerCase().trim();
    const data = await loadLocationData();
    const results = [];

    if (!q) return results;

    // Cities
    data.cities.forEach(c => {
      if (c.name.toLowerCase().includes(q) || c.country.toLowerCase().includes(q)) {
        results.push({ ...c, type: 'city' });
      }
    });

    // Countries
    data.countries.forEach(c => {
      if (c.name.toLowerCase().includes(q)) {
        results.push({ ...c, type: 'country' });
      }
    });

    // Continents
    data.continents.forEach(c => {
      if (c.name.toLowerCase().includes(q)) {
        results.push({ ...c, type: 'continent' });
      }
    });

    // Sort: exact matches first, then by type order
    results.sort((a, b) => {
      const aEx = a.name.toLowerCase().startsWith(q) ? 0 : 1;
      const bEx = b.name.toLowerCase().startsWith(q) ? 0 : 1;
      if (aEx !== bEx) return aEx - bEx;
      const typeOrder = { city: 0, country: 1, continent: 2 };
      return (typeOrder[a.type]||3) - (typeOrder[b.type]||3);
    });

    return results.slice(0, 10);
  }

  /* ── Highlight matched text ─────────────────────────────── */
  function highlight(text, query) {
    if (!query) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return text.slice(0, idx) +
      '<mark>' + text.slice(idx, idx + query.length) + '</mark>' +
      text.slice(idx + query.length);
  }

  /* ── DOM refs ───────────────────────────────────────────── */
  function el(id) { return document.getElementById(id); }

  /* ── Show dropdown ──────────────────────────────────────── */
  function showDropdown(results, query) {
    const dd = el('globe-search-dropdown');
    if (!dd) return;

    dropdownItems = results;
    dropdownIndex = -1;
    dd.innerHTML  = '';

    if (!results.length && !query) {
      // Show recent searches
      const recent = getRecent();
      if (!recent.length) { dd.classList.remove('open'); return; }

      const hRow = document.createElement('div');
      hRow.className = 'dropdown-header-row';
      hRow.innerHTML = `
        <span class="dropdown-header-label">Recent Searches</span>
        <button class="recent-clear-all" id="recent-clear-btn">Clear all</button>`;
      dd.appendChild(hRow);

      recent.forEach(r => {
        const item = buildDropdownItem({
          name: r.name, subText: r.country || r.continent || '',
          type: 'recent', lat: r.lat, lng: r.lng,
          country: r.country, continent: r.continent,
        }, '');
        dd.appendChild(item);
      });

      dd.classList.add('open');
      const clearBtn = el('recent-clear-btn');
      if (clearBtn) {
        clearBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          clearRecent();
          dd.classList.remove('open');
        });
      }
      return;
    }

    if (!results.length) {
      dd.innerHTML = `<div class="dropdown-no-results">No results for "<strong>${query}</strong>"</div>`;
      dd.classList.add('open');
      return;
    }

    // Group by type
    const cities     = results.filter(r => r.type === 'city');
    const countries  = results.filter(r => r.type === 'country');
    const continents = results.filter(r => r.type === 'continent');

    if (cities.length) {
      dd.appendChild(makeHeader('Cities'));
      cities.forEach(r => dd.appendChild(buildDropdownItem(r, query)));
    }
    if (countries.length) {
      if (cities.length) dd.appendChild(makeDivider());
      dd.appendChild(makeHeader('Countries'));
      countries.forEach(r => dd.appendChild(buildDropdownItem(r, query)));
    }
    if (continents.length) {
      if (cities.length || countries.length) dd.appendChild(makeDivider());
      dd.appendChild(makeHeader('Continents'));
      continents.forEach(r => dd.appendChild(buildDropdownItem(r, query)));
    }

    dd.classList.add('open');
    dropdownItems = dd.querySelectorAll('.dropdown-item');
  }

  function makeHeader(label) {
    const h = document.createElement('div');
    h.className = 'dropdown-header';
    h.textContent = label;
    return h;
  }

  function makeDivider() {
    const d = document.createElement('div');
    d.className = 'dropdown-divider';
    return d;
  }

  function buildDropdownItem(r, query) {
    const icons = { city:'fa-building', country:'fa-flag', continent:'fa-earth-americas', recent:'fa-clock-rotate-left' };
    const badgeClass = { city:'badge-city', country:'badge-country', continent:'badge-continent', recent:'badge-recent' };
    const iconClass  = { city:'city', country:'country', continent:'continent', recent:'recent' };
    const labels     = { city:'CITY', country:'COUNTRY', continent:'CONTINENT', recent:'RECENT' };
    const subText    = r.subText || (r.type==='city' ? r.country : r.type==='country' ? r.continent : '');

    const div = document.createElement('div');
    div.className = 'dropdown-item';
    div.setAttribute('data-lat', r.lat);
    div.setAttribute('data-lng', r.lng);
    div.setAttribute('data-name', r.name);
    div.setAttribute('data-country', r.country || '');
    div.setAttribute('data-continent', r.continent || '');
    div.setAttribute('data-type', r.type);
    div.innerHTML = `
      <div class="dropdown-item-icon ${iconClass[r.type]||'city'}">
        <i class="fa-solid ${icons[r.type]||'fa-location-dot'}"></i>
      </div>
      <div class="dropdown-item-text">
        <div class="dropdown-item-name">${highlight(r.name, query)}</div>
        ${subText ? `<div class="dropdown-item-sub">${subText}</div>` : ''}
      </div>
      <span class="dropdown-item-badge ${badgeClass[r.type]||'badge-city'}">${labels[r.type]||'LOC'}</span>`;

    div.addEventListener('mousedown', (e) => {
      e.preventDefault();
      selectLocation({ lat: +r.lat, lng: +r.lng, name: r.name, country: r.country, continent: r.continent, type: r.type });
    });
    return div;
  }

  function hideDropdown() {
    const dd = el('globe-search-dropdown');
    if (dd) dd.classList.remove('open');
    dropdownIndex = -1;
  }

  /* ── Keyboard navigation ────────────────────────────────── */
  function navigateDropdown(dir) {
    const items = el('globe-search-dropdown') ?
      el('globe-search-dropdown').querySelectorAll('.dropdown-item') : [];
    if (!items.length) return;

    items[dropdownIndex]?.classList.remove('highlighted');
    dropdownIndex = Math.max(-1, Math.min(items.length - 1, dropdownIndex + dir));
    if (dropdownIndex >= 0) items[dropdownIndex].classList.add('highlighted');
  }

  function selectHighlighted() {
    const items = el('globe-search-dropdown') ?
      el('globe-search-dropdown').querySelectorAll('.dropdown-item') : [];
    if (dropdownIndex >= 0 && items[dropdownIndex]) {
      items[dropdownIndex].dispatchEvent(new Event('mousedown'));
    } else {
      // Use first result
      if (items[0]) items[0].dispatchEvent(new Event('mousedown'));
      else triggerSearch(el('globe-search-input')?.value || '');
    }
  }

  /* ── Search via backend API ─────────────────────────────── */
  async function triggerSearch(query) {
    if (!query.trim()) return;
    const spinner = el('globe-search-spinner');
    if (spinner) spinner.classList.add('active');

    try {
      const res = await fetch(`${SEARCH_API_URL}?q=${encodeURIComponent(query.trim())}`, { credentials:'same-origin' });
      if (!res.ok) throw new Error('No result');
      const data = await res.json();
      if (data.lat != null && data.lng != null) {
        selectLocation({ lat: data.lat, lng: data.lng, name: data.name, country: data.country, type: 'city' });
      } else {
        toast('Location not found: ' + query, 'medium', 3000);
      }
    } catch(_) {
      // Try local fallback
      const results = await searchLocal(query);
      if (results.length) {
        selectLocation({ lat: results[0].lat, lng: results[0].lng, name: results[0].name, country: results[0].country, continent: results[0].continent, type: results[0].type });
      } else {
        toast('Location not found: ' + query, 'medium', 3000);
      }
    } finally {
      if (spinner) spinner.classList.remove('active');
    }
  }

  /* ── Navigate globe to location ─────────────────────────── */
  function selectLocation({ lat, lng, name, country, continent, type }) {
    hideDropdown();

    // Update input
    const input = el('globe-search-input');
    if (input) { input.value = name; input.blur(); }
    showClear();

    // Save to recent
    addRecent({ name, country, continent, lat, lng, type });

    // Place search pin on globe
    searchPinData = [{ lat, lng, name, country, continent, _isSearchPin: true }];
    renderGlobeData(threatData);

    // Determine altitude by type
    const altitude = type === 'continent' ? 2.5 : type === 'country' ? 2.0 : 1.5;

    // Stop auto-rotate briefly and fly to location
    if (globe) {
      globe.controls().autoRotate = false;
      globe.pointOfView({ lat, lng, altitude }, 1800);
      setTimeout(() => {
        if (globe) globe.controls().autoRotate = true;
      }, 5000);
    }

    // Show pin label
    showPinLabel(name, country || continent || '', lat, lng);

    toast(`📍 Navigating to ${name}`, 'success', 3000);
  }

  function showPinLabel(name, sub, lat, lng) {
    const pin = el('search-pin-label');
    if (!pin) return;
    safeSet('pin-name',    name);
    safeSet('pin-country', sub);
    safeSet('pin-coords',  `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`);
    pin.classList.add('show');
  }

  function hidePinLabel() {
    const pin = el('search-pin-label');
    if (pin) pin.classList.remove('show');
    searchPinData = [];
    if (threatData.length) renderGlobeData(threatData);
  }

  function showClear() {
    const btn = el('globe-search-clear');
    if (btn) btn.classList.add('visible');
  }
  function hideClear() {
    const btn = el('globe-search-clear');
    if (btn) btn.classList.remove('visible');
  }

  /* ══════════════════════════════════════════════════════════
   *  VOICE SEARCH
   * ══════════════════════════════════════════════════════════ */

  // Voice command patterns
  const VOICE_PATTERNS = [
    /^(?:go\s+to|navigate\s+to|fly\s+to|show|zoom\s+to|focus\s+on|take\s+me\s+to|point\s+to)\s+(.+)/i,
    /^(?:search|find|look\s+up)\s+(.+)/i,
    /^(?:where\s+is)\s+(.+)/i,
    /^(?:reset|home|initial)\s*(?:view|globe|position)?$/i,
  ];

  function parseVoiceCommand(transcript) {
    const text = transcript.trim();

    // Reset command
    if (/^(reset|home|initial)(\s+(view|globe|position))?$/i.test(text)) {
      return { action: 'reset' };
    }

    // Location commands
    for (const pattern of VOICE_PATTERNS) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return { action: 'navigate', location: match[1].trim() };
      }
    }

    // Bare query (just the place name)
    return { action: 'navigate', location: text };
  }

  function initVoiceSearch() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      const btn = el('globe-mic-btn');
      if (btn) {
        btn.title = 'Voice search not supported in this browser';
        btn.style.opacity = '0.3';
        btn.style.cursor  = 'not-allowed';
      }
      return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous    = false;
    recognition.interimResults = true;
    recognition.lang          = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      isListening = true;
      const btn  = el('globe-mic-btn');
      const icon = el('mic-icon');
      const fb   = el('voice-feedback');
      const fbt  = el('voice-feedback-text');
      if (btn)  btn.classList.add('listening');
      if (icon) { icon.classList.remove('fa-microphone'); icon.classList.add('fa-microphone-lines'); }
      if (fb)   fb.classList.add('show');
      if (fbt)  fbt.textContent = '🎙️ Listening…';
    };

    recognition.onresult = (event) => {
      let interim = '';
      let final   = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t;
        else interim += t;
      }

      const fbt = el('voice-feedback-text');
      if (fbt) fbt.textContent = '🎙️ ' + (final || interim || 'Listening…');

      if (final) {
        // Fill input with transcribed text
        const input = el('globe-search-input');
        if (input) { input.value = final; showClear(); }

        const cmd = parseVoiceCommand(final);
        if (cmd.action === 'reset') {
          if (globe) globe.pointOfView({ lat: 20, lng: 0, altitude: 2.2 }, 1400);
          toast('Globe reset to home position', 'info', 2500);
          hidePinLabel();
          if (input) { input.value = ''; hideClear(); }
        } else if (cmd.location) {
          if (fbt) fbt.textContent = `Searching: "${cmd.location}"…`;
          triggerSearch(cmd.location);
        }
      }
    };

    recognition.onerror = (event) => {
      const fbt = el('voice-feedback-text');
      const msgs = {
        'no-speech':          'No speech detected. Try again.',
        'audio-capture':      'Microphone not available.',
        'not-allowed':        'Microphone access denied.',
        'network':            'Network error. Try again.',
        'aborted':            'Voice search cancelled.',
      };
      if (fbt) fbt.textContent = msgs[event.error] || 'Voice error: ' + event.error;
      toast(msgs[event.error] || 'Voice search error', 'medium', 3500);
    };

    recognition.onend = () => {
      isListening = false;
      const btn  = el('globe-mic-btn');
      const icon = el('mic-icon');
      if (btn)  btn.classList.remove('listening');
      if (icon) { icon.classList.remove('fa-microphone-lines'); icon.classList.add('fa-microphone'); }
      setTimeout(() => {
        const fb = el('voice-feedback');
        if (fb) fb.classList.remove('show');
      }, 2500);
    };
  }

  function toggleMic() {
    if (!recognition) {
      toast('Voice search not supported in this browser', 'medium', 3000);
      return;
    }
    if (isListening) {
      recognition.stop();
    } else {
      try { recognition.start(); }
      catch(e) { console.warn('[Voice]', e); }
    }
  }

  /* ══════════════════════════════════════════════════════════
   *  GEOLOCATION
   * ══════════════════════════════════════════════════════════ */
  function useMyLocation() {
    if (!navigator.geolocation) {
      toast('Geolocation not supported', 'medium', 3000);
      return;
    }
    const btn = el('globe-geo-btn');
    if (btn) { btn.style.opacity = '0.5'; btn.style.pointerEvents = 'none'; }
    toast('Getting your location…', 'info', 2000);

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (btn) { btn.style.opacity = ''; btn.style.pointerEvents = ''; }
        const { latitude: lat, longitude: lng } = coords;
        selectLocation({ lat, lng, name: 'Your Location', country: '', type: 'city' });
      },
      () => {
        if (btn) { btn.style.opacity = ''; btn.style.pointerEvents = ''; }
        toast('Could not get location. Check browser permissions.', 'medium', 3500);
      },
      { timeout: 8000, enableHighAccuracy: false }
    );
  }

  /* ══════════════════════════════════════════════════════════
   *  SEARCH INPUT WIRING
   * ══════════════════════════════════════════════════════════ */
  function initSearch() {
    const input   = el('globe-search-input');
    const box     = el('globe-search-box');
    const clearBtn= el('globe-search-clear');
    const micBtn  = el('globe-mic-btn');
    const geoBtn  = el('globe-geo-btn');
    const pinClose= el('pin-close');
    const wrapper = el('globe-search-wrapper');

    if (!input) return;

    // Focus expand
    input.addEventListener('focus', () => {
      box?.classList.add('focused');
      wrapper?.classList.add('expanded');
      const q = input.value.trim();
      if (!q) {
        // Show recent searches on empty focus
        showDropdown([], '');
      } else {
        handleInput(q);
      }
    });

    input.addEventListener('blur', () => {
      box?.classList.remove('focused');
      wrapper?.classList.remove('expanded');
      setTimeout(hideDropdown, 180);
    });

    input.addEventListener('input', () => {
      const q = input.value;
      if (q) showClear(); else hideClear();
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => handleInput(q.trim()), 200);
    });

    input.addEventListener('keydown', (e) => {
      const dd = el('globe-search-dropdown');
      const isOpen = dd?.classList.contains('open');

      if (e.key === 'ArrowDown') { e.preventDefault(); if (isOpen) navigateDropdown(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (isOpen) navigateDropdown(-1); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (isOpen) selectHighlighted();
        else triggerSearch(input.value);
      }
      else if (e.key === 'Escape') { hideDropdown(); input.blur(); }
    });

    // Clear button
    clearBtn?.addEventListener('click', () => {
      input.value = '';
      hideClear();
      hideDropdown();
      hidePinLabel();
      input.focus();
    });

    // Mic button
    micBtn?.addEventListener('click', toggleMic);

    // Geo button
    geoBtn?.addEventListener('click', useMyLocation);

    // Pin close
    pinClose?.addEventListener('click', hidePinLabel);

    // Click outside
    document.addEventListener('click', (e) => {
      const wrapper = el('globe-search-wrapper');
      if (wrapper && !wrapper.contains(e.target)) hideDropdown();
    });
  }

  async function handleInput(query) {
    if (!query) {
      showDropdown([], '');
      return;
    }
    const results = await searchLocal(query);
    showDropdown(results, query);
  }

  /* ══════════════════════════════════════════════════════════
   *  BOOT
   * ══════════════════════════════════════════════════════════ */
  document.addEventListener('DOMContentLoaded', () => {
    animateLoadingSteps();

    // Pre-load location data silently
    loadLocationData();

    setTimeout(() => {
      initGlobe();
      fetchThreats(true);
      startAutoRefresh();
    }, 200);

    // Init search + voice
    initSearch();
    initVoiceSearch();

    // Init auto-refresh button state
    const btn = el('globe-auto-refresh');
    if (btn) btn.classList.add('active');
  });

})();