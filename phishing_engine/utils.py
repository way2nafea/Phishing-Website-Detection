# utils.py
from urllib.parse import urlparse


def normalize_url(url):
    url = url.strip().lower()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    return url


def get_domain(url):
    parsed = urlparse(url)
    domain = parsed.netloc.lower()
    return domain.replace("www.", "")