/**
 * PhishGuard AI — Analytics, Notifications & Shared Utilities
 * static/js/analytics.js
 *
 * Provides:
 *   1. Toast Notification System  → window.PhishGuard.notify(msg, sev)
 *   2. Fake Threat Data Generator → window.PhishGuard.generateFakeData(n)
 *   3. Chart.js Dashboard Charts  → auto-initializes on #dash-pie etc.
 */

(function () {
  'use strict';

  /* ─── THREAT DATA POOL ───────────────────────────────── */
  const CITIES = [
    { city:'Moscow',      country:'Russia',         lat: 55.75, lng:  37.62 },
    { city:'Beijing',     country:'China',           lat: 39.91, lng: 116.39 },
    { city:'Lagos',       country:'Nigeria',         lat:  6.45, lng:   3.38 },
    { city:'São Paulo',   country:'Brazil',          lat:-23.55, lng: -46.63 },
    { city:'Bucharest',   country:'Romania',         lat: 44.43, lng:  26.10 },
    { city:'Kyiv',        country:'Ukraine',         lat: 50.45, lng:  30.52 },
    { city:'Tehran',      country:'Iran',            lat: 35.69, lng:  51.39 },
    { city:'Karachi',     country:'Pakistan',        lat: 24.86, lng:  67.01 },
    { city:'Mumbai',      country:'India',           lat: 19.08, lng:  72.88 },
    { city:'Jakarta',     country:'Indonesia',       lat: -6.21, lng: 106.85 },
    { city:'Ho Chi Minh', country:'Vietnam',         lat: 10.82, lng: 106.63 },
    { city:'Ankara',      country:'Turkey',          lat: 39.92, lng:  32.85 },
    { city:'Cairo',       country:'Egypt',           lat: 30.06, lng:  31.25 },
    { city:'Johannesburg',country:'South Africa',    lat:-26.20, lng:  28.04 },
    { city:'Minsk',       country:'Belarus',         lat: 53.90, lng:  27.57 },
    { city:'Pyongyang',   country:'North Korea',     lat: 39.03, lng: 125.75 },
    { city:'Hanoi',       country:'Vietnam',         lat: 21.03, lng: 105.85 },
    { city:'Bangkok',     country:'Thailand',        lat: 13.75, lng: 100.52 },
    { city:'Dhaka',       country:'Bangladesh',      lat: 23.72, lng:  90.41 },
    { city:'Nairobi',     country:'Kenya',           lat: -1.29, lng:  36.82 },
    { city:'Bogotá',      country:'Colombia',        lat:  4.71, lng: -74.07 },
    { city:'Mexico City', country:'Mexico',          lat: 19.43, lng: -99.13 },
    { city:'Buenos Aires',country:'Argentina',       lat:-34.60, lng: -58.38 },
    { city:'Lima',        country:'Peru',            lat:-12.05, lng: -77.04 },
    { city:'Algiers',     country:'Algeria',         lat: 36.74, lng:   3.06 },
    { city:'Accra',       country:'Ghana',           lat:  5.56, lng:  -0.20 },
    { city:'Islamabad',   country:'Pakistan',        lat: 33.72, lng:  73.04 },
    { city:'Dhaka',       country:'Bangladesh',      lat: 23.81, lng:  90.41 },
    { city:'Kuala Lumpur',country:'Malaysia',        lat:  3.14, lng: 101.69 },
    { city:'Manila',      country:'Philippines',     lat: 14.60, lng: 120.98 },
    { city:'Taipei',      country:'Taiwan',          lat: 25.03, lng: 121.56 },
    { city:'Seoul',       country:'South Korea',     lat: 37.57, lng: 126.98 },
    { city:'Riyadh',      country:'Saudi Arabia',    lat: 24.69, lng:  46.72 },
    { city:'Dubai',       country:'UAE',             lat: 25.20, lng:  55.27 },
    { city:'Casablanca',  country:'Morocco',         lat: 33.59, lng:  -7.62 },
    { city:'Addis Ababa', country:'Ethiopia',        lat:  9.03, lng:  38.74 },
    { city:'Kinshasa',    country:'DR Congo',        lat: -4.32, lng:  15.32 },
    { city:'Tashkent',    country:'Uzbekistan',      lat: 41.30, lng:  69.24 },
    { city:'Baku',        country:'Azerbaijan',      lat: 40.41, lng:  49.87 },
    { city:'Tbilisi',     country:'Georgia',         lat: 41.69, lng:  44.83 },
    { city:'Caracas',     country:'Venezuela',       lat: 10.48, lng: -66.88 },
    { city:'Havana',      country:'Cuba',            lat: 23.13, lng: -82.38 },
    { city:'Khartoum',    country:'Sudan',           lat: 15.55, lng:  32.53 },
    { city:'Tripoli',     country:'Libya',           lat: 32.90, lng:  13.18 },
    { city:'Rangoon',     country:'Myanmar',         lat: 16.87, lng:  96.14 },
    { city:'Colombo',     country:'Sri Lanka',       lat:  6.93, lng:  79.84 },
  ];

  const THREAT_TYPES = [
    'Phishing Campaign','Ransomware Drop','Credential Harvesting','SQL Injection',
    'DDoS Source','Malware C2','Botnet Node','Spear Phishing','Zero-Day Exploit',
    'Brute Force Attack','Port Scan','Data Exfiltration','Man-in-the-Middle',
    'Cryptojacking','Formjacking','Supply Chain Attack','DNS Spoofing','ARP Poisoning',
  ];

  const SEVERITIES = ['HIGH','HIGH','MEDIUM','MEDIUM','MEDIUM','LOW','LOW','LOW','LOW'];

  function rand(min, max) { return Math.random() * (max - min) + min; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function generateFakeData(count) {
    count = count || 35;
    const used = new Set();
    const data = [];
    const now  = Date.now();

    for (let i = 0; i < count; i++) {
      let city;
      do { city = pick(CITIES); } while (used.has(city.city) && used.size < CITIES.length);
      used.add(city.city);

      const sev     = pick(SEVERITIES);
      const threat  = pick(THREAT_TYPES);
      const ageMs   = rand(0, 3600000 * 6); // within last 6 hours
      const time    = new Date(now - ageMs).toISOString();
      const risk    = sev === 'HIGH' ? ~~rand(70,100) : sev === 'MEDIUM' ? ~~rand(30,70) : ~~rand(5,30);

      data.push({
        city:     city.city,
        country:  city.country,
        lat:      city.lat + rand(-0.5, 0.5),
        lng:      city.lng + rand(-0.5, 0.5),
        severity: sev,
        threat:   threat,
        time:     time,
        risk_score: risk,
      });
    }

    return data;
  }

  /* ─── TOAST NOTIFICATION SYSTEM ──────────────────────── */
  let _toastContainer = null;

  function ensureToastContainer() {
    if (_toastContainer) return _toastContainer;
    _toastContainer = document.createElement('div');
    _toastContainer.id = 'pg-toast-container';
    _toastContainer.className = 'pg-toast-container';
    document.body.appendChild(_toastContainer);
    return _toastContainer;
  }

  function notify(message, severity, duration) {
    severity = (severity || 'info').toUpperCase();
    duration = duration || 4500;

    const container = ensureToastContainer();
    const toast     = document.createElement('div');
    toast.className = 'pg-toast pg-toast--' + severity.toLowerCase();

    const icons = { HIGH:'⚠️', MEDIUM:'🔔', LOW:'ℹ️', INFO:'ℹ️', SUCCESS:'✅', DANGER:'❌' };
    const icon  = icons[severity] || icons.INFO;

    toast.innerHTML = `
      <span class="pg-toast-icon">${icon}</span>
      <span class="pg-toast-msg">${message}</span>
      <button class="pg-toast-close" aria-label="Dismiss">✕</button>
    `;

    toast.querySelector('.pg-toast-close').addEventListener('click', () => dismissToast(toast));
    container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => toast.classList.add('pg-toast--visible'));

    // Auto dismiss
    const timer = setTimeout(() => dismissToast(toast), duration);
    toast._timer = timer;
    return toast;
  }

  function dismissToast(toast) {
    clearTimeout(toast._timer);
    toast.classList.remove('pg-toast--visible');
    toast.classList.add('pg-toast--hiding');
    setTimeout(() => toast.remove(), 350);
  }

  /* ─── CHART.JS DASHBOARD ANALYTICS ───────────────────── */
  const CHART_DEFAULTS = {
    plugins: {
      legend: {
        labels: {
          color: '#8A9BBE',
          font: { family: "'Outfit', sans-serif", size: 12 },
          padding: 16,
          usePointStyle: true,
          pointStyleWidth: 8,
        }
      },
      tooltip: {
        backgroundColor: 'rgba(11,15,25,0.96)',
        borderColor: 'rgba(45,114,212,0.3)',
        borderWidth: 1,
        titleColor: '#F0F4FF',
        bodyColor: '#8A9BBE',
        padding: 12,
        cornerRadius: 8,
        titleFont: { family: "'Syne', sans-serif", weight: '700' },
        bodyFont: { family: "'Outfit', sans-serif" },
      }
    },
    animation: { duration: 1000, easing: 'easeInOutQuart' }
  };

  function initDashboardCharts(data) {
    if (typeof Chart === 'undefined') return;

    const high   = data.filter(d => (d.severity||'').toUpperCase() === 'HIGH').length;
    const medium = data.filter(d => (d.severity||'').toUpperCase() === 'MEDIUM').length;
    const low    = data.filter(d => (d.severity||'').toUpperCase() === 'LOW').length;

    // 1) PIE CHART — Severity Distribution
    const pieEl = document.getElementById('chart-pie');
    if (pieEl) {
      if (pieEl._chartInst) pieEl._chartInst.destroy();
      pieEl._chartInst = new Chart(pieEl, {
        type: 'doughnut',
        data: {
          labels: ['HIGH', 'MEDIUM', 'LOW'],
          datasets: [{
            data: [high, medium, low],
            backgroundColor: [
              'rgba(255,69,96,0.85)',
              'rgba(255,176,32,0.85)',
              'rgba(0,229,160,0.85)',
            ],
            borderColor: ['rgba(255,69,96,0.2)','rgba(255,176,32,0.2)','rgba(0,229,160,0.2)'],
            borderWidth: 1,
            hoverOffset: 8,
          }]
        },
        options: {
          ...CHART_DEFAULTS,
          cutout: '68%',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            ...CHART_DEFAULTS.plugins,
            legend: { ...CHART_DEFAULTS.plugins.legend, position: 'bottom' }
          }
        }
      });
    }

    // 2) BAR CHART — Top Scanned Domains (top 10)
    const barEl = document.getElementById('chart-bar');
    if (barEl) {
      const domainCounts = {};
      data.forEach(d => {
        try {
          const urlObj = new URL((d.url || "").startsWith("http") ? d.url : "http://" + d.url);
          const domain = urlObj.hostname.replace("www.", "");
          domainCounts[domain] = (domainCounts[domain] || 0) + 1;
        } catch (_) {
            if (d.url) {
                domainCounts[d.url] = (domainCounts[d.url] || 0) + 1;
            }
        }
      });
      const sorted = Object.entries(domainCounts)
        .sort((a,b) => b[1]-a[1]).slice(0,10);

      const barColors = sorted.map(([,count]) => {
        const max = sorted[0][1];
        const t   = count / max;
        return t > 0.7 ? 'rgba(255,69,96,0.75)'
             : t > 0.4 ? 'rgba(255,176,32,0.75)'
             : 'rgba(45,114,212,0.75)';
      });

      if (barEl._chartInst) barEl._chartInst.destroy();
      barEl._chartInst = new Chart(barEl, {
        type: 'bar',
        data: {
          labels: sorted.map(([c]) => c),
          datasets: [{
            label: 'Threats',
            data: sorted.map(([,n]) => n),
            backgroundColor: barColors,
            borderColor: barColors.map(c => c.replace('0.75','1')),
            borderWidth: 1,
            borderRadius: 6,
            borderSkipped: false,
          }]
        },
        options: {
          ...CHART_DEFAULTS,
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              ticks: { color: '#8A9BBE', font: { family: "'JetBrains Mono', monospace", size: 10 }, maxRotation: 45 },
              grid: { color: 'rgba(45,114,212,0.07)' },
            },
            y: {
              beginAtZero: true,
              ticks: { color: '#8A9BBE', font: { family: "'JetBrains Mono', monospace", size: 11 }, stepSize: 1 },
              grid: { color: 'rgba(45,114,212,0.07)' },
            }
          },
          plugins: {
            ...CHART_DEFAULTS.plugins,
            legend: { display: false }
          }
        }
      });
    }

    // 3) LINE CHART — Threats Over Time (last 24 buckets = ~30min each)
    const lineEl = document.getElementById('chart-line');
    if (lineEl) {
      const now      = Date.now();
      const BUCKETS  = 24;
      const BUCKET_MS= 30 * 60 * 1000; // 30 min
      const buckets  = Array(BUCKETS).fill(0);
      const highBuckets = Array(BUCKETS).fill(0);

      data.forEach(d => {
        try {
          const ts  = new Date(d.time).getTime();
          const idx = Math.floor((now - ts) / BUCKET_MS);
          if (idx >= 0 && idx < BUCKETS) {
            buckets[BUCKETS - 1 - idx]++;
            if ((d.severity||'').toUpperCase() === 'HIGH') {
              highBuckets[BUCKETS - 1 - idx]++;
            }
          }
        } catch(_) {}
      });

      const labels = [];
      for (let i = BUCKETS; i >= 1; i--) {
        const t = new Date(now - i * BUCKET_MS);
        labels.push(t.getHours().toString().padStart(2,'0') + ':' + t.getMinutes().toString().padStart(2,'0'));
      }

      if (lineEl._chartInst) lineEl._chartInst.destroy();
      lineEl._chartInst = new Chart(lineEl, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'All Threats',
              data: buckets,
              borderColor: 'rgba(45,114,212,0.9)',
              backgroundColor: 'rgba(45,114,212,0.08)',
              pointBackgroundColor: 'rgba(45,114,212,1)',
              pointRadius: 3,
              pointHoverRadius: 6,
              fill: true,
              tension: 0.4,
              borderWidth: 2,
            },
            {
              label: 'HIGH Severity',
              data: highBuckets,
              borderColor: 'rgba(255,69,96,0.9)',
              backgroundColor: 'rgba(255,69,96,0.06)',
              pointBackgroundColor: 'rgba(255,69,96,1)',
              pointRadius: 3,
              pointHoverRadius: 6,
              fill: true,
              tension: 0.4,
              borderWidth: 2,
            }
          ]
        },
        options: {
          ...CHART_DEFAULTS,
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              ticks: {
                color: '#4A5A7A',
                font: { family: "'JetBrains Mono', monospace", size: 9 },
                maxTicksLimit: 8,
              },
              grid: { color: 'rgba(45,114,212,0.06)' },
            },
            y: {
              beginAtZero: true,
              ticks: { color: '#8A9BBE', font: { family: "'JetBrains Mono', monospace", size: 11 }, stepSize: 1 },
              grid: { color: 'rgba(45,114,212,0.07)' },
            }
          },
          plugins: {
            ...CHART_DEFAULTS.plugins,
            legend: { ...CHART_DEFAULTS.plugins.legend, position: 'top', align: 'end' }
          }
        }
      });
    }
  }

  /* ─── DASHBOARD CHART LOADER ──────────────────────────── */
  async function loadDashboardCharts() {
    const pieEl  = document.getElementById('chart-pie');
    const barEl  = document.getElementById('chart-bar');
    const lineEl = document.getElementById('chart-line');
    if (!pieEl && !barEl && !lineEl) return; // not on dashboard

    // Show skeleton
    document.querySelectorAll('.chart-skeleton').forEach(el => el.classList.add('loading'));

    try {
      let data = [];
      try {
        const res = await fetch('/api/user-scans-analytics', { credentials: 'same-origin' });
        if (res.ok) data = await res.json();
      } catch(_) {}

      document.querySelectorAll('.chart-skeleton').forEach(el => el.classList.remove('loading'));
      initDashboardCharts(data);

    } catch(err) {
      console.warn('[Analytics] Chart load error:', err);
      document.querySelectorAll('.chart-skeleton').forEach(el => el.classList.remove('loading'));
      initDashboardCharts([]);
    }
  }

  /* ─── BOOT ────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    loadDashboardCharts();
  });

  /* ─── PUBLIC API ──────────────────────────────────────── */
  window.PhishGuard = window.PhishGuard || {};
  window.PhishGuard.notify          = notify;
  window.PhishGuard.generateFakeData = generateFakeData;
  window.PhishGuard.loadDashboardCharts = loadDashboardCharts;

})();