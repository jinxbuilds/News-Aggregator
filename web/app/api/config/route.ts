import { availableProviders } from "@/lib/ai";
import { newsMode } from "@/lib/news";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ newsMode: newsMode(), providers: availableProviders() });
}
