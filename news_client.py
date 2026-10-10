"""NewsAPI client and demo data. No Streamlit imports so it's easy to test."""
from __future__ import annotations

import re

import requests

BASE_URL = "https://newsapi.org/v2/everything"
PAGE_SIZE = 5
MAX_RESULTS = 100  # NewsAPI free (Developer) plan caps results at 100
REQUEST_TIMEOUT = 10  # seconds


class NewsAPIError(Exception):
    """Raised when NewsAPI can't be reached or returns an error."""


def clean_articles(raw: list[dict]) -> list[dict]:
    """Drop removed/invalid articles and normalise missing (null) fields."""
    cleaned = []
    for a in raw:
        title = (a.get("title") or "").strip()
        url = (a.get("url") or "").strip()
        if not title or title == "[Removed]" or not url.startswith(("http://", "https://")):
            continue
        cleaned.append(
            {
                "title": title,
                "description": (a.get("description") or "").strip(),
                "content": (a.get("content") or "").strip(),
                "url": url,
                "image": a.get("urlToImage") or "",
                "source": (a.get("source") or {}).get("name") or "Unknown source",
                "published": a.get("publishedAt") or "",
            }
        )
    return cleaned


def fetch_page(topic: str, page: int, sort_by: str, api_key: str) -> tuple[list[dict], int]:
    """Fetch one page from NewsAPI. Returns (articles, total_results)."""
    try:
        response = requests.get(
            BASE_URL,
            params={
                "q": topic,
                "pageSize": PAGE_SIZE,
                "page": page,
                "sortBy": sort_by,
                "language": "en",
            },
            headers={"X-Api-Key": api_key},  # keep the key out of URLs/logs
            timeout=REQUEST_TIMEOUT,
        )
    except requests.RequestException as exc:
        raise NewsAPIError(f"Couldn't reach NewsAPI: {exc}") from exc

    try:
        data = response.json()
    except ValueError:
        data = {}

    if response.status_code != 200:
        message = data.get("message") or "Unknown error"
        hints = {
            401: "Your API key looks invalid.",
            426: "Your plan doesn't allow results this far back/deep.",
            429: "Rate limit reached. Try again later.",
        }
        hint = hints.get(response.status_code, "")
        raise NewsAPIError(f"NewsAPI error {response.status_code}: {message} {hint}".strip())

    return clean_articles(data.get("articles", [])), data.get("totalResults", 0)


def demo_page(topic: str, page: int) -> tuple[list[dict], int]:
    """Serve one page of bundled sample articles (used when no NewsAPI key is set)."""
    from sample_data import SAMPLE_ARTICLES

    pattern = re.compile(r"\b" + re.escape(topic.strip()) + r"\b", re.IGNORECASE)
    matches = [
        a
        for a in clean_articles(SAMPLE_ARTICLES)
        if pattern.search(f"{a['title']} {a['description']} {a['source']}")
    ]
    start = (page - 1) * PAGE_SIZE
    return matches[start : start + PAGE_SIZE], len(matches)
