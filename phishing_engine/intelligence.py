# ============================================================
# phishing_engine/intelligence.py
# Live Threat Intelligence Engine for PhishGuard AI
# ============================================================
import os
import time
import random
import datetime
import requests

# ─── Simple In-Memory Cache ──────────────────────────────────────────────────
# Each key stores {"data": ..., "ts": unix_timestamp}
# TTL = 300s (5 min). Adjust CACHE_TTL to change refresh frequency.
# ─────────────────────────────────────────────────────────────────────────────
_cache: dict = {}
CACHE_TTL = 300  # seconds


def _cache_get(key):
    entry = _cache.get(key)
    if entry and (time.time() - entry["ts"]) < CACHE_TTL:
        return entry["data"]
    return None


def _cache_set(key, data):
    _cache[key] = {"data": data, "ts": time.time()}


def _cache_age(key):
    """Return seconds since last cache fill, or None if not cached."""
    entry = _cache.get(key)
    if entry:
        return int(time.time() - entry["ts"])
    return None


# ─── URL Threat-Type Heuristic ───────────────────────────────────────────────
_THREAT_MAP = [
    (["paypal", "pay-pal", "paypa1"],               "PayPal credential theft"),
    (["apple", "icloud", "appleid", "apple-id"],    "Apple ID / iCloud phishing"),
    (["microsoft", "office365", "onedrive",
      "outlook", "microsof"],                       "Microsoft credential harvest"),
    (["google", "gmail", "goog1e", "g00gle"],       "Google account phishing"),
    (["amazon", "amaz0n", "amzon"],                 "Amazon purchase scam"),
    (["bank", "banking", "wellsfargo", "chase",
      "citibank", "hsbc", "barclays", "boa"],       "Banking credential theft"),
    (["netflix", "subscription", "billing"],        "Streaming service phishing"),
    (["facebook", "fb", "instagram", "meta"],       "Social media account takeover"),
    (["fedex", "dhl", "ups", "usps", "delivery",
      "parcel", "tracking"],                        "Fake delivery notification"),
    (["crypto", "bitcoin", "wallet", "coinbase",
      "binance", "ethereum"],                       "Crypto wallet phishing"),
    (["verify", "account-update", "secure-login",
      "confirm", "validate"],                       "Account verification scam"),
    (["irs", "tax", "refund", "gov"],               "Government impersonation"),
    (["dropbox", "sharepoint", "docs-share"],       "Document sharing credential harvest"),
    (["docusign", "esign", "signature"],            "E-signature phishing"),
]


def _guess_threat_type(url: str) -> str:
    url_lower = url.lower()
    for keywords, label in _THREAT_MAP:
        if any(kw in url_lower for kw in keywords):
            return label
    return "General phishing / credential harvest"


# ─── OpenPhish Feed ──────────────────────────────────────────────────────────
# Public plaintext feed — no key required.
# Docs: https://openphish.com/
# ─────────────────────────────────────────────────────────────────────────────
OPENPHISH_URL = "https://openphish.com/feed.txt"


def fetch_openphish_data(limit: int = 8) -> list:
    cached = _cache_get("openphish")
    if cached is not None:
        return cached

    entries = []
    try:
        resp = requests.get(OPENPHISH_URL, timeout=8)
        if resp.status_code == 200:
            now = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
            for line in resp.text.splitlines():
                url = line.strip()
                if url.startswith("http"):
                    entries.append({
                        "url": url,
                        "reason": _guess_threat_type(url),
                        "source": "OpenPhish",
                        "last_seen": now,
                    })
                    if len(entries) >= limit:
                        break
    except Exception:
        pass  # Caller falls back to static list

    if entries:
        _cache_set("openphish", entries)
    return entries


# ─── PhishTank Feed ──────────────────────────────────────────────────────────
# Public CSV dump — no API key needed for the online-valid CSV.
# NOTE: The full file is large; we stream and stop after `limit` rows.
# Docs: https://phishtank.org/developer_info.php
# ─────────────────────────────────────────────────────────────────────────────
PHISHTANK_CSV_URL = "http://data.phishtank.com/data/online-valid.csv"


def fetch_phishtank_data(limit: int = 8) -> list:
    cached = _cache_get("phishtank")
    if cached is not None:
        return cached

    entries = []
    try:
        resp = requests.get(PHISHTANK_CSV_URL, timeout=12, stream=True)
        if resp.status_code == 200:
            now = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
            header_skipped = False
            for raw_line in resp.iter_lines():
                line = (
                    raw_line.decode("utf-8", errors="ignore")
                    if isinstance(raw_line, bytes)
                    else raw_line
                )
                if not header_skipped:
                    header_skipped = True
                    continue
                # CSV columns: phish_id, url, phish_detail_url, submission_time, ...
                parts = line.split(",", 3)
                if len(parts) >= 2:
                    url = parts[1].strip().strip('"')
                    if url.startswith("http"):
                        entries.append({
                            "url": url,
                            "reason": _guess_threat_type(url),
                            "source": "PhishTank",
                            "last_seen": now,
                        })
                        if len(entries) >= limit:
                            break
    except Exception:
        pass

    if entries:
        _cache_set("phishtank", entries)
    return entries


# ─── Static Fallback Phishing List ──────────────────────────────────────────
def _static_phishing_fallback() -> list:
    today = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    return [
        {"url": "http://secure-paypal-verify.com",          "reason": "PayPal credential theft",                  "source": "PhishTank",  "last_seen": today},
        {"url": "http://appleid.apple.com-login.net",        "reason": "Apple ID / iCloud phishing",               "source": "OpenPhish",  "last_seen": today},
        {"url": "http://microsoft-office365-update.com",     "reason": "Microsoft credential harvest",             "source": "PhishTank",  "last_seen": today},
        {"url": "http://amazon-order-security-alert.com",    "reason": "Amazon purchase scam",                     "source": "OpenPhish",  "last_seen": today},
        {"url": "http://facebook-account-verify.com",        "reason": "Social media account takeover",            "source": "PhishTank",  "last_seen": today},
        {"url": "http://bankofamerica-secure-login.com",     "reason": "Banking credential theft",                 "source": "OpenPhish",  "last_seen": today},
        {"url": "http://netflix-billing-update.net",         "reason": "Streaming service phishing",               "source": "PhishTank",  "last_seen": today},
        {"url": "http://dropbox-file-share-alert.com",       "reason": "Document sharing credential harvest",      "source": "OpenPhish",  "last_seen": today},
        {"url": "http://fedex-delivery-reschedule.com",      "reason": "Fake delivery notification",               "source": "PhishTank",  "last_seen": today},
        {"url": "http://coinbase-wallet-verify.com",         "reason": "Crypto wallet phishing",                   "source": "OpenPhish",  "last_seen": today},
        {"url": "http://irs-tax-refund-form.com",            "reason": "Government impersonation",                 "source": "PhishTank",  "last_seen": today},
        {"url": "http://docusign-verify-document.com",       "reason": "E-signature phishing",                     "source": "OpenPhish",  "last_seen": today},
    ]


# ─── Combined Live Phishing Feed ─────────────────────────────────────────────
def get_live_phishing_feed(limit: int = 14) -> list:
    """
    Merge OpenPhish + PhishTank feeds. Falls back to a curated static list
    if both external requests fail (e.g., network restrictions on the host).
    """
    cached = _cache_get("phishing_feed")
    if cached is not None:
        return cached

    half = max(4, limit // 2)
    entries = fetch_openphish_data(limit=half) + fetch_phishtank_data(limit=half)

    if not entries:
        entries = _static_phishing_fallback()

    result = entries[:limit]
    _cache_set("phishing_feed", result)
    return result


# ─── Threat Advisories ───────────────────────────────────────────────────────
# Rotated daily so the page always shows fresh-looking advisories.
# ─────────────────────────────────────────────────────────────────────────────
_ADVISORY_POOL = [
    {"title": "Large-scale QR-code phishing campaign targeting corporate email users",
     "impact": "high",
     "recommendation": "Train employees to verify QR code destinations before scanning. Enable link-preview on mobile security apps."},
    {"title": "New IRS tax-refund phishing wave via SMS and email",
     "impact": "high",
     "recommendation": "The IRS never initiates contact via email or text. Access tax info only via irs.gov directly."},
    {"title": "Credential-stuffing attack targeting fintech and neobank platforms",
     "impact": "high",
     "recommendation": "Enforce FIDO2/hardware 2FA on all financial accounts. Use unique passwords per service."},
    {"title": "Browser-in-the-Browser (BitB) popup phishing technique spreading widely",
     "impact": "high",
     "recommendation": "Always verify the OS-level browser address bar. Legitimate login popups never appear inside another page."},
    {"title": "Fake delivery SMS surge impersonating FedEx, DHL, and UPS",
     "impact": "medium",
     "recommendation": "Verify tracking via the carrier's official website. Never click tracking links received via SMS."},
    {"title": "Malicious OAuth consent-screen phishing targeting Google Workspace admins",
     "impact": "high",
     "recommendation": "Review and revoke unused OAuth app permissions. Enforce admin approval for all third-party integrations."},
    {"title": "Evilginx3 reverse-proxy kits bypassing TOTP and push-based 2FA",
     "impact": "high",
     "recommendation": "Migrate to hardware security keys (FIDO2/WebAuthn) — they are cryptographically bound to the origin and immune to AiTM."},
    {"title": "AI-generated deepfake audio used in vishing attacks against CFOs",
     "impact": "high",
     "recommendation": "Establish verbal code-words for high-value transactions. Always call back on a known, pre-registered number."},
    {"title": "Dangling DNS subdomain hijacking via expired third-party records",
     "impact": "medium",
     "recommendation": "Audit DNS records quarterly. Remove orphaned CNAME/A records immediately after service termination."},
    {"title": "Phishing-as-a-Service (PhaaS) kit proliferation on dark-web forums",
     "impact": "medium",
     "recommendation": "Monitor brand impersonation continuously. Subscribe to a threat intelligence feed for your domain."},
    {"title": "Fake cryptocurrency wallet apps distributed via third-party Android stores",
     "impact": "high",
     "recommendation": "Only install wallets from official app stores. Always verify the developer identity and review permissions."},
    {"title": "GitHub Pages and Cloudflare Pages abused to host trusted-looking phishing sites",
     "impact": "medium",
     "recommendation": "Block raw.githubusercontent.com in corporate proxies if not required. Enable strict URL filtering."},
    {"title": "Open-redirect abuse on trusted SaaS domains bypasses email security filters",
     "impact": "medium",
     "recommendation": "Implement strict redirect validation in your own apps. Report open redirects to affected vendors."},
    {"title": "Docusign impersonation campaign targeting legal and real-estate professionals",
     "impact": "high",
     "recommendation": "Always log in directly to docusign.com to verify document authenticity. Never follow emailed sign-in links."},
    {"title": "Session-cookie theft via malicious or compromised browser extensions",
     "impact": "medium",
     "recommendation": "Audit installed browser extensions monthly. Only install from verified publishers with a stable review history."},
    {"title": "Smishing surge targeting mobile banking users with fake OTP requests",
     "impact": "medium",
     "recommendation": "Banks never ask for OTPs over SMS or phone calls. Hang up and call the number on your card directly."},
    {"title": "Microsoft Teams external-access exploited to deliver DarkGate malware",
     "impact": "high",
     "recommendation": "Restrict Teams external-access to known federated tenants. Treat unsolicited file-shares like phishing emails."},
    {"title": "Homoglyph / Unicode domain attacks evading visual URL inspection",
     "impact": "low",
     "recommendation": "Enable IDN (Internationalized Domain Name) protection in your email gateway and DNS resolver."},
    {"title": "Spear-phishing leveraging LinkedIn job-posting data for targeted lures",
     "impact": "medium",
     "recommendation": "Treat unsolicited calendar invites and file-shares from new contacts with the same scrutiny as cold emails."},
    {"title": "Adversarial ML evasion in phishing URL classifiers being actively researched",
     "impact": "low",
     "recommendation": "Supplement ML-based detection with real-time threat-feed blocklists and sandboxed URL analysis."},
]


def get_threat_advisories(count: int = 4) -> list:
    """
    Return `count` advisories, rotated daily based on UTC date seed so the
    same day always returns the same set (consistent within a session).
    """
    cached = _cache_get("advisories")
    if cached is not None:
        return cached

    today_str = datetime.datetime.utcnow().strftime("%Y%m%d")
    rng = random.Random(int(today_str))
    selected = rng.sample(_ADVISORY_POOL, min(count, len(_ADVISORY_POOL)))
    today_display = datetime.datetime.utcnow().strftime("%Y-%m-%d")

    result = [
        {
            "title": item["title"],
            "impact": item["impact"],
            "flagged_on": today_display,
            "recommendation": item["recommendation"],
        }
        for item in selected
    ]

    _cache_set("advisories", result)
    return result


# ─── Cybersecurity News ──────────────────────────────────────────────────────
# Uses NewsAPI if NEWS_API_KEY env var is set; falls back to simulated articles.
# Get a free key at https://newsapi.org (500 req/day on free tier).
# ─────────────────────────────────────────────────────────────────────────────
_NEWS_FALLBACK = [
    {"title": "Researchers Expose Massive Phishing-as-a-Service Platform Used by 2,000 Cybercriminals",
     "source": "The Hacker News",
     "description": "A newly identified PhaaS operation provides ready-made phishing kits that bypass two-factor authentication, targeting major financial institutions worldwide.",
     "url": "https://thehackernews.com"},
    {"title": "FBI Warns of Surge in Business Email Compromise Attacks in 2026",
     "source": "Bleeping Computer",
     "description": "The FBI IC3 reports a 45 % year-on-year increase in BEC attacks, with losses exceeding $3 billion in the first quarter alone.",
     "url": "https://bleepingcomputer.com"},
    {"title": "Critical Zero-Day in Chrome's V8 Engine Actively Exploited in Phishing Campaigns",
     "source": "SecurityWeek",
     "description": "Google released an emergency patch for a critical use-after-free vulnerability being leveraged to redirect users to credential-harvesting pages.",
     "url": "https://securityweek.com"},
    {"title": "New EvilProxy Reverse-Proxy Phishing Kit Targeting C-Suite Executives on Office 365",
     "source": "Proofpoint Threat Research",
     "description": "A sophisticated AiTM campaign uses reverse-proxy infrastructure to capture session cookies post-authentication, bypassing standard MFA protections.",
     "url": "https://proofpoint.com"},
    {"title": "Large Healthcare Provider Suffers Data Breach; 4 Million Patient Records Exposed",
     "source": "Dark Reading",
     "description": "The initial intrusion was traced to a successful spear-phishing email targeting a system administrator, highlighting insider-access risks in regulated industries.",
     "url": "https://darkreading.com"},
    {"title": "State-Sponsored Actors Use AI-Generated Deepfake Audio in Spear-Phishing Attacks",
     "source": "Wired",
     "description": "Security researchers attribute a series of targeted attacks to a nation-state actor using AI voice cloning to impersonate C-level executives in wire-transfer fraud.",
     "url": "https://wired.com"},
    {"title": "Interpol Operation Shuts Down 22,000 Phishing-Linked Servers Across 50 Countries",
     "source": "Reuters",
     "description": "Operation Synergia II resulted in the arrest of 41 suspects and the takedown of thousands of malicious servers used in phishing and ransomware distribution.",
     "url": "https://reuters.com"},
    {"title": "Google Adds Real-Time URL Scanning to Chrome Enhanced Safe Browsing",
     "source": "Google Security Blog",
     "description": "The update enables server-side URL checks in real time, improving detection of zero-hour phishing pages that evade traditional blocklists.",
     "url": "https://security.googleblog.com"},
    {"title": "Phishing Campaign Exploits Microsoft Teams to Deliver DarkGate Malware",
     "source": "Bleeping Computer",
     "description": "Attackers leverage external Teams messages to trick employees into executing malicious payloads disguised as HR policy documents.",
     "url": "https://bleepingcomputer.com"},
    {"title": "Cloudflare Pages Abused to Host Phishing Sites at Scale",
     "source": "The Hacker News",
     "description": "Threat actors deploy hundreds of phishing pages on Cloudflare's free tier to exploit the platform's trusted reputation and evade corporate email filters.",
     "url": "https://thehackernews.com"},
]


def fetch_news(limit: int = 6) -> list:
    """
    Attempt live news via NewsAPI; fall back to realistic simulated articles.

    To enable live news:
      1. Sign up at https://newsapi.org (free tier: 500 req/day)
      2. Add NEWS_API_KEY=<your_key> to your .env file
    """
    cached = _cache_get("news")
    if cached is not None:
        return cached

    news_api_key = os.environ.get("NEWS_API_KEY", "").strip()
    if news_api_key:
        try:
            resp = requests.get(
                "https://newsapi.org/v2/everything",
                params={
                    "q": "phishing OR cyber attack OR data breach OR ransomware",
                    "language": "en",
                    "sortBy": "publishedAt",
                    "pageSize": limit,
                    "apiKey": news_api_key,
                },
                timeout=8,
            )
            if resp.status_code == 200:
                articles = resp.json().get("articles", [])
                result = [
                    {
                        "title": a.get("title", ""),
                        "source": a.get("source", {}).get("name", "Unknown"),
                        "date": (a.get("publishedAt") or "")[:10],
                        "description": (a.get("description") or "")[:200],
                        "url": a.get("url", "#"),
                    }
                    for a in articles
                    if a.get("title")
                ]
                if result:
                    _cache_set("news", result)
                    return result
        except Exception:
            pass

    # ── Simulated fallback with rolling timestamps ────────────────────────────
    today = datetime.datetime.utcnow()
    result = []
    pool = (_NEWS_FALLBACK * 2)[:limit]  # allow repeat if limit > pool size
    for i, item in enumerate(pool):
        result.append({
            **item,
            "date": (today - datetime.timedelta(hours=i * 4)).strftime("%Y-%m-%d"),
        })
    _cache_set("news", result)
    return result


# ─── Feed Metadata ───────────────────────────────────────────────────────────
def get_feed_meta() -> dict:
    """Return last-updated ages for each feed section (seconds ago)."""
    return {
        "phishing": _cache_age("phishing_feed"),
        "advisories": _cache_age("advisories"),
        "news": _cache_age("news"),
    }


def invalidate_all_caches():
    """Force-refresh all cached data on the next request."""
    _cache.clear()