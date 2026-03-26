# security_checks.py
import re
import dns.resolver
import whois
import ssl
import socket
from datetime import datetime
from difflib import SequenceMatcher


TRUSTED_DOMAINS = {
    "google.com", "youtube.com", "amazon.com",
    "microsoft.com", "apple.com", "github.com",
    "chatgpt.com", "openai.com", "stackoverflow.com",
    "wikipedia.org", "linkedin.com", "gemini.com",
    "render.com"
}


# 1️⃣ IP Detection
def contains_ip(domain):
    ip_pattern = r"\d+\.\d+\.\d+\.\d+"
    return re.match(ip_pattern, domain)


# 2️⃣ DNS Validation
def dns_lookup(domain):
    try:
        dns.resolver.resolve(domain, 'A')
        return True
    except:
        return False


# 3️⃣ WHOIS Domain Age
def get_domain_age(domain):
    try:
        w = whois.whois(domain)
        creation_date = w.creation_date

        if isinstance(creation_date, list):
            creation_date = creation_date[0]

        if creation_date:
            return (datetime.now() - creation_date).days

        return None
    except:
        return None


# 4️⃣ SSL Validation
def check_ssl(domain):
    try:
        context = ssl.create_default_context()
        with socket.create_connection((domain, 443), timeout=5) as sock:
            with context.wrap_socket(sock, server_hostname=domain):
                return True
    except:
        return False


# 5️⃣ Look-alike detection
def is_similar_to_trusted(domain):
    for trusted in TRUSTED_DOMAINS:
        similarity = SequenceMatcher(None, domain, trusted).ratio()
        if similarity > 0.85 and domain != trusted:
            return True
    return False


# 6️⃣ Suspicious keywords
def suspicious_structure(domain):
    keywords = ["login", "verify", "secure", "update", "account", "bank"]
    if any(word in domain for word in keywords):
        return True
    if domain.count("-") >= 2:
        return True
    return False