# News Aggregator (demo)

A small Streamlit app that searches news by topic and can summarize articles with AI (Claude or Gemini).

**It runs with zero setup.** Every API key is optional:

| Key | If missing |
|---|---|
| `NEWS_API_KEY` | Demo mode with built-in sample articles (try `ai`, `space`, `climate`, `solar`) |
| `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` | AI buttons are hidden |

## Features

- Search news by topic, sorted by newest, relevance or popularity
- Article cards with image, source and publish time
- **✨ Summarize** any article and **🧠 Generate briefing** for the whole result set
- Switch between Claude and Gemini in the sidebar when both keys are set
- "Load more" pagination that only fetches the next page
- Response caching (news 10 min, summaries 1 h) to save quota
- Clear error messages for bad keys, rate limits and network failures

## Quick start

```bash
pip install -r requirements.txt
streamlit run app.py
```

## Using real keys for testing

```bash
cp .streamlit/secrets.toml.example .streamlit/secrets.toml
# edit the file and fill in only the keys you want
```

You can also use environment variables, e.g. `export GEMINI_API_KEY=...`.
`.streamlit/secrets.toml` is git-ignored. Never commit real keys.

Models are set in `ai.py` (`DEFAULT_MODELS`); change them there if you prefer another one.

## Tests

```bash
pip install pytest
pytest
```

All network calls are mocked, so tests need no keys.

## Project layout

```
app.py            Streamlit UI
news_client.py    NewsAPI client + demo-mode paging
ai.py             Claude / Gemini summarization (plain REST)
sample_data.py    Fictional sample articles for demo mode
tests/            pytest suite
```

## Notes

- Summaries use the title, description and the short excerpt NewsAPI provides, not the full article, so they're brief by design.
- The free NewsAPI plan allows about 100 requests/day and at most 100 results per search.
