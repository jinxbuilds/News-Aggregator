import { secret } from "./env";
import { SAMPLE_ARTICLES } from "./sample-data";

export const PAGE_SIZE = 5;
export const MAX_RESULTS = 100; // NewsAPI Developer plan caps results at 100
export const SORT_OPTIONS = { Newest: "publishedAt", "Most relevant": "relevancy", "Most popular": "popularity" } as const;
export type SortBy = (typeof SORT_OPTIONS)[keyof typeof SORT_OPTIONS];

export type RawArticle = {
  title?: string | null;
  description?: string | null;
  content?: string | null;
  url?: string | null;
  urlToImage?: string | null;
  publishedAt?: string | null;
  source?: { name?: string | null } | null;
};

export type Article = {
  title: string;
  description: string;
  content: string;
  url: string;
  image: string;
  source: string;
  published: string;
};

export type NewsPage = { articles: Article[]; total: number; mode: "live" | "demo" };

export class NewsAPIError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

/** Drop removed/invalid articles and normalise missing (null) fields. */
export function cleanArticles(raw: RawArticle[]): Article[] {
  const out: Article[] = [];
  for (const a of raw) {
    const title = (a.title ?? "").trim();
    const url = (a.url ?? "").trim();
    if (!title || title === "[Removed]" || !/^https?:\/\//.test(url)) continue;
    const image = (a.urlToImage ?? "").trim();
    out.push({
      title,
      description: (a.description ?? "").trim(),
      content: (a.content ?? "").trim(),
      url,
      image: /^https:\/\//.test(image) ? image : "",
      source: a.source?.name || "Unknown source",
      published: a.publishedAt ?? "",
    });
  }
  return out;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** One page of bundled sample articles (used when no NewsAPI key is set). */
export function demoPage(topic: string, page: number): NewsPage {
  const pattern = new RegExp(`\\b${escapeRegExp(topic.trim())}\\b`, "i");
  const matches = cleanArticles(SAMPLE_ARTICLES).filter((a) =>
    pattern.test(`${a.title} ${a.description} ${a.source}`),
  );
  const start = (page - 1) * PAGE_SIZE;
  return { articles: matches.slice(start, start + PAGE_SIZE), total: matches.length, mode: "demo" };
}

const HINTS: Record<number, string> = {
  401: "The NewsAPI key looks invalid.",
  426: "This plan doesn't allow results this far back or deep.",
  429: "Rate limit reached. Try again later.",
};

/** One page from NewsAPI, cached for 10 minutes to save quota. */
export async function fetchPage(topic: string, page: number, sortBy: SortBy, apiKey: string): Promise<NewsPage> {
  const params = new URLSearchParams({ q: topic, pageSize: String(PAGE_SIZE), page: String(page), sortBy, language: "en" });
  let response: Response;
  try {
    response = await fetch(`https://newsapi.org/v2/everything?${params}`, {
      headers: { "X-Api-Key": apiKey }, // keep the key out of URLs and logs
      signal: AbortSignal.timeout(10_000),
      next: { revalidate: 600 },
    });
  } catch {
    throw new NewsAPIError("Couldn't reach NewsAPI. Please try again.");
  }
  const data = (await response.json().catch(() => ({}))) as { message?: string; articles?: RawArticle[]; totalResults?: number };
  if (!response.ok) {
    const hint = HINTS[response.status] ?? "";
    throw new NewsAPIError(`NewsAPI error ${response.status}: ${data.message ?? "Unknown error"} ${hint}`.trim(), response.status === 429 ? 429 : 502);
  }
  return { articles: cleanArticles(data.articles ?? []), total: data.totalResults ?? 0, mode: "live" };
}

export function newsMode(): "live" | "demo" {
  return secret("NEWS_API_KEY") ? "live" : "demo";
}

export async function getNews(topic: string, page: number, sortBy: SortBy): Promise<NewsPage> {
  const key = secret("NEWS_API_KEY");
  return key ? fetchPage(topic, page, sortBy, key) : demoPage(topic, page);
}
