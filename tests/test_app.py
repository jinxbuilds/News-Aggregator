import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
import requests
from streamlit.testing.v1 import AppTest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
APP = str(ROOT / "app.py")

import ai  # noqa: E402
import news_client  # noqa: E402


def resp(status=200, payload=None):
    r = MagicMock()
    r.status_code = status
    r.json.return_value = payload if payload is not None else {}
    return r


def article(i, **over):
    base = {
        "title": f"Title {i}", "description": f"Desc {i}", "content": None,
        "url": f"https://example.com/{i}", "urlToImage": None,
        "publishedAt": "2026-10-10T12:00:00Z", "source": {"name": "Example"},
    }
    base.update(over)
    return base


CLAUDE_OK = {"content": [{"type": "text", "text": "Claude summary."}]}
GEMINI_OK = {"candidates": [{"content": {"parts": [{"text": "Gemini summary."}]}}]}


@pytest.fixture(autouse=True)
def _env(monkeypatch):
    for k in ("NEWS_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY"):
        monkeypatch.delenv(k, raising=False)
    import streamlit as st
    st.cache_data.clear()


def make_app():
    """Build the app under test, isolated from any real .streamlit/secrets.toml.

    Setting any test secrets makes Streamlit ignore the local secrets file, so a
    developer's real keys can't change test behaviour. Keys then come only from
    the environment variables each test sets via monkeypatch.
    """
    at = AppTest.from_file(APP, default_timeout=15)
    at.secrets["_TEST_ISOLATION"] = "1"
    return at


def start(topic="ai"):
    at = make_app().run()
    at.text_input[0].set_value(topic).run()
    return at


# ---------- news_client ----------
def test_clean_articles_filters_bad_and_handles_nulls():
    out = news_client.clean_articles([
        article(1, description=None), article(2, title="[Removed]"),
        article(3, url="javascript:alert(1)"), article(4, source=None),
    ])
    assert [a["title"] for a in out] == ["Title 1", "Title 4"]
    assert out[0]["description"] == "" and out[1]["source"] == "Unknown source"


def test_fetch_page_uses_header_timeout_and_page():
    with patch("requests.get", return_value=resp(payload={"totalResults": 1, "articles": [article(1)]})) as g:
        news_client.fetch_page("ai", 2, "publishedAt", "k")
    kw = g.call_args.kwargs
    assert kw["headers"] == {"X-Api-Key": "k"} and "apiKey" not in kw["params"]
    assert kw["params"]["page"] == 2 and kw["timeout"]


def test_fetch_page_errors():
    with patch("requests.get", return_value=resp(401, {"message": "bad key"})):
        with pytest.raises(news_client.NewsAPIError, match="401"):
            news_client.fetch_page("ai", 1, "publishedAt", "k")
    with patch("requests.get", side_effect=requests.ConnectionError("boom")):
        with pytest.raises(news_client.NewsAPIError, match="Couldn't reach"):
            news_client.fetch_page("ai", 1, "publishedAt", "k")


# ---------- ai ----------
def test_claude_request_shape():
    with patch("requests.post", return_value=resp(payload=CLAUDE_OK)) as p:
        out = ai.summarize_article(news_client.clean_articles([article(1)])[0], "Claude", "sk-test")
    assert out == "Claude summary."
    assert p.call_args.args[0] == "https://api.anthropic.com/v1/messages"
    assert p.call_args.kwargs["headers"]["x-api-key"] == "sk-test"
    assert p.call_args.kwargs["json"]["model"] == ai.DEFAULT_MODELS["Claude"]


def test_gemini_request_shape():
    with patch("requests.post", return_value=resp(payload=GEMINI_OK)) as p:
        out = ai.summarize_article(news_client.clean_articles([article(1)])[0], "Gemini", "g-test")
    assert out == "Gemini summary."
    assert ai.DEFAULT_MODELS["Gemini"] in p.call_args.args[0]
    assert p.call_args.kwargs["headers"]["x-goog-api-key"] == "g-test"
    assert "g-test" not in p.call_args.args[0]


def test_ai_errors():
    with patch("requests.post", return_value=resp(401, {"error": {"message": "invalid x-api-key"}})):
        with pytest.raises(ai.AIError, match="401"):
            ai.generate("hi", "Claude", "k")
    with patch("requests.post", return_value=resp(payload={"candidates": []})):
        with pytest.raises(ai.AIError, match="no text"):
            ai.generate("hi", "Gemini", "k")


# ---------- app ----------
def test_demo_mode_without_any_keys():
    at = start("space")
    assert not at.exception
    assert any("Demo mode" in i.value for i in at.info)
    assert len(at.subheader) == 2  # two sample space articles
    assert not [b for b in at.button if b.label.startswith("✨")]  # AI hidden


def test_demo_mode_no_results():
    at = start("zzzz-nothing")
    assert at.warning


def test_summarize_button_with_claude(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    at = start("ai")
    with patch("requests.post", return_value=resp(payload=CLAUDE_OK)):
        at.button(key="sum_0").click().run()
    assert any("Claude summary." in i.value for i in at.info)


def test_provider_switch_to_gemini(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    monkeypatch.setenv("GEMINI_API_KEY", "g-test")
    at = start("ai")
    at.sidebar.selectbox[0].set_value("Gemini").run()
    with patch("requests.post", return_value=resp(payload=GEMINI_OK)) as p:
        at.button(key="sum_0").click().run()
    assert "generativelanguage" in p.call_args.args[0]
    assert any("Gemini summary." in i.value for i in at.info)


def test_briefing(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "g-test")
    at = start("space")
    with patch("requests.post", return_value=resp(payload=GEMINI_OK)):
        at.button(key="briefing_btn").click().run()
    assert at.success and "Gemini summary." in at.success[0].value


def test_ai_failure_shows_error(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    at = start("ai")
    with patch("requests.post", return_value=resp(429, {"error": {"message": "rate limited"}})):
        at.button(key="sum_0").click().run()
    assert any("429" in e.value for e in at.error)


def test_placeholder_key_is_ignored(monkeypatch):
    monkeypatch.setenv("NEWS_API_KEY", "your-newsapi-key-here")
    at = start("ai")
    assert any("Demo mode" in i.value for i in at.info)


def test_live_mode_load_more(monkeypatch):
    monkeypatch.setenv("NEWS_API_KEY", "real")
    r = resp(payload={"totalResults": 12, "articles": [article(1)]})
    with patch("requests.get", return_value=r):
        at = start("ai")
    with patch("requests.get", return_value=r) as g:
        at.button[0].click().run()
    assert g.call_args.kwargs["params"]["page"] == 2


def test_live_mode_error(monkeypatch):
    monkeypatch.setenv("NEWS_API_KEY", "real")
    with patch("requests.get", return_value=resp(401, {"message": "bad"})):
        at = start("ai")
    assert "401" in at.error[0].value


def test_demo_search_is_whole_word():
    arts, total = news_client.demo_page("ai", 1)
    assert total == 3 and all("AI" in a["title"] or "AI" in a["description"] for a in arts)
    assert news_client.demo_page("climate", 1)[1] >= 1
