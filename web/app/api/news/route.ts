import { getNews, MAX_RESULTS, NewsAPIError, PAGE_SIZE, SORT_OPTIONS, type SortBy } from "@/lib/news";
import { jsonError } from "@/lib/http";

const SORTS = new Set<string>(Object.values(SORT_OPTIONS));

export async function GET(req: Request) {
  const url = new URL(req.url);
  const topic = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const page = Math.max(1, Math.min(Number(url.searchParams.get("page")) || 1, MAX_RESULTS / PAGE_SIZE));
  const sort = url.searchParams.get("sort") ?? "publishedAt";
  if (!topic) return jsonError("Enter a topic to search for.", 400);
  if (!SORTS.has(sort)) return jsonError("Unknown sort option.", 400);
  try {
    const result = await getNews(topic, page, sort as SortBy);
    return Response.json({ ...result, page, pageSize: PAGE_SIZE, maxResults: MAX_RESULTS });
  } catch (error) {
    if (error instanceof NewsAPIError) return jsonError(error.message, error.status);
    console.error(error);
    return jsonError("Something went wrong fetching news.", 500);
  }
}
