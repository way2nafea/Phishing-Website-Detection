import ipaddress
import re
import urllib.request
from bs4 import BeautifulSoup
import socket
import requests
from googlesearch import search
import whois
from datetime import date, datetime
from dateutil.parser import parse as date_parse
from urllib.parse import urlparse


class FeatureExtraction:
    def __init__(self, url):
        self.features = []
        self.url = url
        self.domain = ""
        self.whois_response = None
        self.urlparse = None
        self.response = None
        self.soup = None

        try:
            self.response = requests.get(url, timeout=5)
            self.soup = BeautifulSoup(self.response.text, 'html.parser')
        except:
            pass

        try:
            self.urlparse = urlparse(url)
            self.domain = self.urlparse.netloc
        except:
            pass

        try:
            self.whois_response = whois.whois(self.domain)
        except:
            pass

        self.features.append(self.UsingIp())
        self.features.append(self.longUrl())
        self.features.append(self.shortUrl())
        self.features.append(self.symbol())
        self.features.append(self.redirecting())
        self.features.append(self.prefixSuffix())
        self.features.append(self.SubDomains())
        self.features.append(self.Https())
        self.features.append(self.DomainRegLen())
        self.features.append(self.Favicon())
        self.features.append(self.NonStdPort())
        self.features.append(self.HTTPSDomainURL())
        self.features.append(self.RequestURL())
        self.features.append(self.AnchorURL())
        self.features.append(self.LinksInScriptTags())
        self.features.append(self.ServerFormHandler())
        self.features.append(self.InfoEmail())
        self.features.append(self.AbnormalURL())
        self.features.append(self.WebsiteForwarding())
        self.features.append(self.StatusBarCust())
        self.features.append(self.DisableRightClick())
        self.features.append(self.UsingPopupWindow())
        self.features.append(self.IframeRedirection())
        self.features.append(self.AgeofDomain())
        self.features.append(self.DNSRecording())
        self.features.append(self.WebsiteTraffic())
        self.features.append(self.PageRank())
        self.features.append(self.GoogleIndex())
        self.features.append(self.LinksPointingToPage())
        self.features.append(self.StatsReport())

    # 1
    def UsingIp(self):
        try:
            ipaddress.ip_address(self.url)
            return -1
        except:
            return 1

    # 2
    def longUrl(self):
        if len(self.url) < 54:
            return 1
        elif len(self.url) <= 75:
            return 0
        return -1

    # 3
    def shortUrl(self):
        match = re.search(r"bit\.ly|goo\.gl|tinyurl|ow\.ly|t\.co", self.url)
        return -1 if match else 1

    # 4
    def symbol(self):
        return -1 if "@" in self.url else 1

    # 5
    def redirecting(self):
        return -1 if self.url.rfind('//') > 6 else 1

    # 6
    def prefixSuffix(self):
        return -1 if "-" in self.domain else 1

    # 7
    def SubDomains(self):
        dots = self.domain.count(".")
        if dots == 1:
            return 1
        elif dots == 2:
            return 0
        return -1

    # 8
    def Https(self):
        return 1 if self.urlparse and self.urlparse.scheme == "https" else -1

    # 9
    def DomainRegLen(self):
        try:
            exp = self.whois_response.expiration_date
            crt = self.whois_response.creation_date
            if isinstance(exp, list):
                exp = exp[0]
            if isinstance(crt, list):
                crt = crt[0]
            age = (exp.year - crt.year) * 12 + (exp.month - crt.month)
            return 1 if age >= 12 else -1
        except:
            return -1

    # 10
    def Favicon(self):
        try:
            for link in self.soup.find_all('link', href=True):
                if self.domain in link['href']:
                    return 1
            return -1
        except:
            return -1

    # 11
    def NonStdPort(self):
        return -1 if ":" in self.domain else 1

    # 12
    def HTTPSDomainURL(self):
        return -1 if "https" in self.domain else 1

    # 13
    def RequestURL(self):
        try:
            i, success = 0, 0
            for tag in self.soup.find_all(['img', 'audio', 'embed', 'iframe'], src=True):
                i += 1
                if self.domain in tag['src']:
                    success += 1
            if i == 0:
                return 0
            percent = (success / i) * 100
            if percent < 22:
                return 1
            elif percent < 61:
                return 0
            return -1
        except:
            return -1

    # 14
    def AnchorURL(self):
        try:
            unsafe, total = 0, 0
            for a in self.soup.find_all('a', href=True):
                total += 1
                if "#" in a['href'] or "javascript" in a['href'].lower():
                    unsafe += 1
            if total == 0:
                return 0
            percent = (unsafe / total) * 100
            if percent < 31:
                return 1
            elif percent < 67:
                return 0
            return -1
        except:
            return -1

    # 15
    def LinksInScriptTags(self):
        try:
            i, success = 0, 0
            for tag in self.soup.find_all(['link', 'script'], src=True):
                i += 1
                if self.domain in tag['src']:
                    success += 1
            if i == 0:
                return 0
            percent = (success / i) * 100
            if percent < 17:
                return 1
            elif percent < 81:
                return 0
            return -1
        except:
            return -1

    # 16
    def ServerFormHandler(self):
        try:
            forms = self.soup.find_all('form', action=True)
            if len(forms) == 0:
                return 1
            for form in forms:
                if form['action'] in ["", "about:blank"]:
                    return -1
            return 1
        except:
            return -1

    # 17
    def InfoEmail(self):
        try:
            return -1 if re.search(r"mailto:", self.soup.text) else 1
        except:
            return -1

    # 18
    def AbnormalURL(self):
        try:
            return 1 if self.domain in self.response.text else -1
        except:
            return -1

    # 19
    def WebsiteForwarding(self):
        try:
            redirects = len(self.response.history)
            if redirects <= 1:
                return 1
            elif redirects <= 4:
                return 0
            return -1
        except:
            return -1

    # 20
    def StatusBarCust(self):
        try:
            return -1 if "onmouseover" in self.response.text else 1
        except:
            return -1

    # 21
    def DisableRightClick(self):
        try:
            return -1 if "event.button" in self.response.text else 1
        except:
            return -1

    # 22
    def UsingPopupWindow(self):
        try:
            return -1 if "alert(" in self.response.text else 1
        except:
            return -1

    # 23
    def IframeRedirection(self):
        try:
            return -1 if "<iframe" in self.response.text else 1
        except:
            return -1

    # 24
    def AgeofDomain(self):
        try:
            crt = self.whois_response.creation_date
            if isinstance(crt, list):
                crt = crt[0]
            age = (date.today().year - crt.year) * 12
            return 1 if age >= 6 else -1
        except:
            return -1

    # 25
    def DNSRecording(self):
        return self.AgeofDomain()

    # 26
    def WebsiteTraffic(self):
        return 0  # deprecated Alexa

    # 27
    def PageRank(self):
        return 0  # external service removed

    # 28
    def GoogleIndex(self):
        try:
            return 1 if list(search(self.url, num_results=5)) else -1
        except:
            return 1

    # 29
    def LinksPointingToPage(self):
        try:
            links = len(re.findall(r"<a ", self.response.text))
            if links == 0:
                return 1
            elif links <= 2:
                return 0
            return -1
        except:
            return -1

    # 30
    def StatsReport(self):
        try:
            ip = socket.gethostbyname(self.domain)
            return -1 if ip else 1
        except:
            return 1

    def getFeaturesList(self):
        return self.features