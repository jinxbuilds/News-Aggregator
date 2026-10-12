# News Aggregator (web)

Next.js version of the Streamlit app in the repo root, built to run on Vercel.

- **Demo mode** (no keys): built-in sample articles, AI hidden. Try `ai`, `space`, `climate`, `solar`.
- **Live mode**: real news from NewsAPI, plus Claude and/or Gemini summaries and briefings.

```bash
npm install
cp .env.example .env.local   # fill in only the keys you want
npm run dev
npm test
```

API keys stay on the server (route handlers in `app/api`). The AI routes only accept same-origin requests, trim article input, and are rate limited per IP (`AI_RATE_PER_MINUTE`, `AI_RATE_PER_DAY`). Limits are per serverless instance, so also set a monthly spend limit in the Anthropic / Google console.

Note: NewsAPI's free Developer plan is intended for development; check its terms before running a public live deployment.
