"""News Aggregator: a small Streamlit demo that searches news and summarizes it with AI."""
from __future__ import annotations

import os
from datetime import datetime

import streamlit as st

import ai
from news_client import MAX_RESULTS, PAGE_SIZE, NewsAPIError, demo_page, fetch_page

CACHE_TTL = 600  # seconds; avoids burning API quotas
SORT_OPTIONS = {
    "Newest": "publishedAt",
    "Most relevant": "relevancy",
    "Most popular": "popularity",
}
KEY_NAMES = {
    "news": "NEWS_API_KEY",
    "Claude": "ANTHROPIC_API_KEY",
    "Gemini": "GEMINI_API_KEY",
}


def get_secret(name: str) -> str | None:
    """Read from Streamlit secrets, falling back to an environment variable."""
    try:
        value = st.secrets[name]
    except Exception:  # no secrets file / key missing
        value = os.getenv(name)
    value = (value or "").strip()
    # Treat the README placeholder as "not set"
    return None if not value or value.startswith("your-") else value


@st.cache_data(ttl=CACHE_TTL, show_spinner=False)
def cached_fetch(topic: str, page: int, sort_by: str, api_key: str):
    # Exceptions aren't cached by Streamlit, so failures are retried next run.
    return fetch_page(topic, page, sort_by, api_key)


@st.cache_data(ttl=3600, show_spinner=False)
def cached_summary(article: dict, provider: str, _api_key: str) -> str:
    return ai.summarize_article(article, provider, _api_key)


def format_date(iso: str) -> str:
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00")).strftime("%d %b %Y, %H:%M")
    except ValueError:
        return ""


def render_article(article: dict, idx: int, provider: str | None, ai_key: str | None) -> None:
    with st.container(border=True):
        if article["image"]:
            st.image(article["image"], width="stretch")
        st.subheader(article["title"])
        meta = " · ".join(p for p in (article["source"], format_date(article["published"])) if p)
        st.caption(meta)
        if article["description"]:
            st.write(article["description"])

        summaries = st.session_state.setdefault("summaries", {})
        if provider and st.button("✨ Summarize", key=f"sum_{idx}"):
            try:
                with st.spinner(f"Asking {provider}..."):
                    summaries[article["url"]] = cached_summary(article, provider, ai_key)
            except ai.AIError as exc:
                st.error(str(exc))
        if article["url"] in summaries:
            st.info(summaries[article["url"]], icon="✨")
        st.markdown(f"[Read more]({article['url']})")


def next_page() -> None:
    st.session_state["page"] += 1


def main() -> None:
    st.set_page_config(page_title="News Aggregator", page_icon="📰")
    st.title("📰 News Aggregator")

    news_key = get_secret(KEY_NAMES["news"])
    ai_keys = {p: get_secret(KEY_NAMES[p]) for p in ai.DEFAULT_MODELS}
    providers = ai.available_providers(ai_keys)

    # --- Sidebar: status + provider choice
    with st.sidebar:
        st.header("Settings")
        st.write("**News source:** " + ("Live (NewsAPI)" if news_key else "Demo (sample data)"))
        provider = None
        if providers:
            provider = st.selectbox("AI provider", providers)
        else:
            st.write("**AI:** off")
            st.caption("Add `ANTHROPIC_API_KEY` or `GEMINI_API_KEY` to enable summaries.")
    ai_key = ai_keys.get(provider) if provider else None

    if not news_key:
        st.info("Demo mode: using built-in sample articles. Try **ai**, **space**, or **climate**.")

    topic = st.text_input("Enter a topic to search for news articles:").strip()
    sort_by = SORT_OPTIONS[st.selectbox("Sort by", list(SORT_OPTIONS), disabled=not news_key)]

    # Reset pagination/briefing whenever the search changes
    search_key = (topic, sort_by, bool(news_key))
    if st.session_state.get("search_key") != search_key:
        st.session_state["search_key"] = search_key
        st.session_state["page"] = 1
        st.session_state.pop("briefing", None)

    if not topic:
        st.info("Type a topic above to get started.")
        return

    articles: list[dict] = []
    total = 0
    try:
        with st.spinner("Fetching news..."):
            # Earlier pages are cached, so this only hits the API for the new page.
            for page in range(1, st.session_state["page"] + 1):
                if news_key:
                    page_articles, total = cached_fetch(topic, page, sort_by, news_key)
                else:
                    page_articles, total = demo_page(topic, page)
                articles.extend(page_articles)
    except NewsAPIError as exc:
        st.error(str(exc))
        return

    if not articles:
        st.warning("No articles found. Try a different topic.")
        return

    # --- AI briefing
    if provider and st.button("🧠 Generate briefing", key="briefing_btn"):
        try:
            with st.spinner(f"Asking {provider}..."):
                st.session_state["briefing"] = ai.briefing(articles, topic, provider, ai_key)
        except ai.AIError as exc:
            st.error(str(exc))
    if "briefing" in st.session_state:
        st.success(st.session_state["briefing"], icon="🧠")

    for i, article in enumerate(articles):
        render_article(article, i, provider, ai_key)

    reachable = min(total, MAX_RESULTS)
    st.caption(f"Showing {len(articles)} articles (of up to {reachable} available)")

    if st.session_state["page"] * PAGE_SIZE < reachable:
        st.button("Load more", on_click=next_page)
    else:
        st.caption("That's everything available for this search.")


main()
