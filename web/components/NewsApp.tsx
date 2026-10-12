"use client";

import { useEffect, useState } from "react";
import RichText from "./RichText";

type Article = { title: string; description: string; content: string; url: string; image: string; source: string; published: string };
type Config = { newsMode: "live" | "demo"; providers: ("Claude" | "Gemini")[] };

const SORTS = [
  ["publishedAt", "Newest"],
  ["relevancy", "Most relevant"],
  ["popularity", "Most popular"],
] as const;
const SUGGESTIONS = ["ai", "space", "climate", "solar"];

function formatDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

const post = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export default function NewsApp() {
  const [config, setConfig] = useState<Config | null>(null);
  const [provider, setProvider] = useState<string>("");
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("");
  const [sort, setSort] = useState<string>("publishedAt");
  const [articles, setArticles] = useState<Article[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [summarizing, setSummarizing] = useState<string | null>(null);
  const [briefing, setBriefing] = useState("");
  const [briefingBusy, setBriefingBusy] = useState(false);
  const [aiError, setAiError] = useState("");

  useEffect(() => {
    api<Config>("/api/config")
      .then((c) => {
        setConfig(c);
        setProvider(c.providers[0] ?? "");
      })
      .catch(() => setConfig({ newsMode: "demo", providers: [] }));
  }, []);

  const demo = config?.newsMode !== "live";
  const reachable = Math.min(total, 100);

  async function search(nextTopic: string, nextSort = sort, nextPage = 1) {
    const t = nextTopic.trim();
    if (!t) return;
    setLoading(true);
    setError("");
    if (nextPage === 1) {
      setBriefing("");
      setAiError("");
    }
    try {
      const params = new URLSearchParams({ q: t, sort: nextSort, page: String(nextPage) });
      const data = await api<{ articles: Article[]; total: number }>(`/api/news?${params}`);
      setTopic(t);
      setTotal(data.total);
      setPage(nextPage);
      setArticles((prev) => (nextPage === 1 ? data.articles : [...prev, ...data.articles]));
    } catch (e) {
      setError((e as Error).message);
      if (nextPage === 1) setArticles([]);
    } finally {
      setLoading(false);
    }
  }

  async function summarize(a: Article) {
    setSummarizing(a.url);
    setAiError("");
    try {
      const { summary } = await api<{ summary: string }>("/api/summarize", post({ article: a, provider }));
      setSummaries((s) => ({ ...s, [a.url]: summary }));
    } catch (e) {
      setAiError((e as Error).message);
    } finally {
      setSummarizing(null);
    }
  }

  async function makeBriefing() {
    setBriefingBusy(true);
    setAiError("");
    try {
      const { briefing } = await api<{ briefing: string }>("/api/briefing", post({ articles, topic, provider }));
      setBriefing(briefing);
    } catch (e) {
      setAiError((e as Error).message);
    } finally {
      setBriefingBusy(false);
    }
  }

  return (
    <div>
      {/* status row */}
      <div className="mb-8 flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em]">
        <span className={`rounded-full border px-3 py-1.5 ${demo ? "border-amber-300/30 text-amber-300" : "border-emerald-400/30 text-emerald-400"}`}>
          {config ? (demo ? "● Demo mode · sample articles" : "● Live · NewsAPI") : "Loading…"}
        </span>
        <span className="rounded-full border border-white/10 px-3 py-1.5 text-zinc-400">
          {config?.providers.length ? `AI · ${config.providers.join(" / ")}` : "AI summaries off"}
        </span>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          search(query);
        }}
        className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-3 sm:flex-row"
      >
        <label htmlFor="q" className="sr-only">Topic</label>
        <input
          id="q"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a topic, e.g. climate"
          maxLength={100}
          className="min-h-12 flex-1 rounded-2xl bg-transparent px-4 text-lg text-white placeholder:text-zinc-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
        />
        <label htmlFor="sort" className="sr-only">Sort by</label>
        <select
          id="sort"
          value={sort}
          disabled={demo}
          onChange={(e) => {
            setSort(e.target.value);
            if (topic) search(topic, e.target.value);
          }}
          className="min-h-12 rounded-2xl border border-white/10 bg-[#111] px-4 text-sm text-zinc-300 disabled:opacity-40"
          title={demo ? "Sorting needs live news" : undefined}
        >
          {SORTS.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        {config && config.providers.length > 1 && (
          <>
            <label htmlFor="provider" className="sr-only">AI provider</label>
            <select
              id="provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="min-h-12 rounded-2xl border border-white/10 bg-[#111] px-4 text-sm text-zinc-300"
            >
              {config.providers.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </>
        )}
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="min-h-12 rounded-2xl bg-sky-400 px-6 font-medium text-black transition hover:bg-sky-300 disabled:opacity-50"
        >
          {loading && page === 1 ? "Searching…" : "Search"}
        </button>
      </form>

      {demo && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
          Try:
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setQuery(s);
                search(s);
              }}
              className="rounded-full border border-white/10 px-3 py-1 text-zinc-300 transition hover:border-sky-400/60 hover:text-white"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {error && <p role="alert" className="mt-6 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-red-200">{error}</p>}
      {aiError && <p role="alert" className="mt-6 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-amber-100">{aiError}</p>}

      {topic && !loading && !error && articles.length === 0 && (
        <p className="mt-10 text-zinc-400">No articles found for “{topic}”. Try a different topic.</p>
      )}

      {articles.length > 0 && (
        <section className="mt-10" aria-live="polite">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-zinc-500">
              Showing {articles.length} of up to {reachable} articles for <span className="text-zinc-200">“{topic}”</span>
            </p>
            {provider && (
              <button
                type="button"
                onClick={makeBriefing}
                disabled={briefingBusy}
                className="rounded-full border border-sky-400/40 px-4 py-2 text-sm text-sky-300 transition hover:bg-sky-400/10 disabled:opacity-50"
              >
                {briefingBusy ? `Asking ${provider}…` : "🧠 Generate briefing"}
              </button>
            )}
          </div>

          {briefing && (
            <div className="mb-8 rounded-3xl border border-sky-400/30 bg-sky-400/[0.06] p-6 text-[15px] leading-7 text-zinc-200">
              <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-sky-300">Briefing · {provider}</p>
              <RichText text={briefing} />
            </div>
          )}

          <ul className="grid gap-5 md:grid-cols-2">
            {articles.map((a) => (
              <li key={a.url} className="flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] transition hover:border-white/20">
                {a.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.image} alt="" loading="lazy" className="aspect-[16/9] w-full object-cover" />
                )}
                <div className="flex flex-1 flex-col p-6">
                  <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                    {[a.source, formatDate(a.published)].filter(Boolean).join(" · ")}
                  </p>
                  <h3 className="mt-3 font-serif text-2xl leading-tight text-white">{a.title}</h3>
                  {a.description && <p className="mt-3 text-[15px] leading-7 text-zinc-400">{a.description}</p>}
                  {summaries[a.url] && (
                    <div className="mt-4 rounded-2xl bg-sky-400/[0.07] p-4 text-sm leading-6 text-zinc-200">
                      <span className="mr-1">✨</span>
                      {summaries[a.url]}
                    </div>
                  )}
                  <div className="mt-auto flex flex-wrap items-center gap-3 pt-5">
                    {provider && !summaries[a.url] && (
                      <button
                        type="button"
                        onClick={() => summarize(a)}
                        disabled={summarizing !== null}
                        className="rounded-full border border-white/15 px-4 py-2 text-sm text-zinc-200 transition hover:border-sky-400/60 disabled:opacity-50"
                      >
                        {summarizing === a.url ? `Asking ${provider}…` : "✨ Summarize"}
                      </button>
                    )}
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-sm text-sky-300 hover:text-sky-200">
                      Read more ↗
                    </a>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-10 flex justify-center">
            {page * 5 < reachable ? (
              <button
                type="button"
                onClick={() => search(topic, sort, page + 1)}
                disabled={loading}
                className="rounded-full border border-white/15 px-6 py-3 text-sm text-zinc-200 transition hover:border-white/40 disabled:opacity-50"
              >
                {loading ? "Loading…" : "Load more"}
              </button>
            ) : (
              <p className="text-sm text-zinc-600">That&apos;s everything available for this search.</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
