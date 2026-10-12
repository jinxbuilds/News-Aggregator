import { generate, summaryPrompt } from "@/lib/ai";
import { sanitizeArticle } from "@/lib/guard";
import { aiFailure, checkAIRequest, jsonError } from "@/lib/http";

// Summaries are cached per instance for an hour to save quota.
const cache = new Map<string, { text: string; at: number }>();
const TTL = 3_600_000;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { article?: unknown; provider?: unknown } | null;
  const checked = checkAIRequest(req, body?.provider);
  if (checked instanceof Response) return checked;
  const article = sanitizeArticle(body?.article);
  if (!article) return jsonError("Missing article.", 400);

  const key = `${checked}:${article.url || article.title}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return Response.json({ summary: hit.text });
  try {
    const text = await generate(summaryPrompt(article), checked);
    cache.set(key, { text, at: Date.now() });
    if (cache.size > 500) cache.delete(cache.keys().next().value as string);
    return Response.json({ summary: text });
  } catch (error) {
    return aiFailure(error);
  }
}
