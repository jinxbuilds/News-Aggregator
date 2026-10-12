import type { Article } from "./news";

/**
 * Best-effort, per-instance protection for the paid AI endpoints. Serverless
 * instances don't share memory, so also set a spend limit in your provider
 * console. Limits: AI_RATE_PER_MINUTE (default 6) and AI_RATE_PER_DAY (default 40) per IP.
 */
const perMinute = Number(process.env.AI_RATE_PER_MINUTE ?? 6);
const perDay = Number(process.env.AI_RATE_PER_DAY ?? 40);
const hits = new Map<string, number[]>();

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

export function rateLimited(ip: string, now = Date.now()): number | null {
  const day = 86_400_000;
  const list = (hits.get(ip) ?? []).filter((t) => now - t < day);
  const lastMinute = list.filter((t) => now - t < 60_000);
  if (lastMinute.length >= perMinute) return Math.ceil((lastMinute[0] + 60_000 - now) / 1000);
  if (list.length >= perDay) return Math.ceil((list[0] + day - now) / 1000);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < day)) hits.delete(k);
  return null;
}

/** Same-origin check so other sites can't use this deployment as a free AI proxy. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

const clip = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n).trim() : "");

/** Accepts only the article fields the prompt needs, trimmed to sane lengths. */
export function sanitizeArticle(input: unknown): Article | null {
  if (!input || typeof input !== "object") return null;
  const a = input as Record<string, unknown>;
  const article: Article = {
    title: clip(a.title, 300),
    description: clip(a.description, 1000),
    content: clip(a.content, 1500),
    source: clip(a.source, 120) || "Unknown source",
    url: clip(a.url, 1000),
    image: "",
    published: clip(a.published, 40),
  };
  return article.title ? article : null;
}
