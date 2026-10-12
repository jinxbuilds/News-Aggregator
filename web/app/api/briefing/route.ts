import { briefingPrompt, generate } from "@/lib/ai";
import { sanitizeArticle } from "@/lib/guard";
import { aiFailure, checkAIRequest, jsonError } from "@/lib/http";
import type { Article } from "@/lib/news";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { articles?: unknown; topic?: unknown; provider?: unknown } | null;
  const checked = checkAIRequest(req, body?.provider);
  if (checked instanceof Response) return checked;
  const topic = typeof body?.topic === "string" ? body.topic.trim().slice(0, 100) : "";
  const articles = (Array.isArray(body?.articles) ? body.articles : [])
    .slice(0, 20)
    .map(sanitizeArticle)
    .filter((a): a is Article => a !== null);
  if (!topic || articles.length === 0) return jsonError("Search for some news first.", 400);
  try {
    return Response.json({ briefing: await generate(briefingPrompt(articles, topic), checked) });
  } catch (error) {
    return aiFailure(error);
  }
}
