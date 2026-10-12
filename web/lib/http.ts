import { AIError, availableProviders, type Provider } from "./ai";
import { clientIp, rateLimited, sameOrigin } from "./guard";

export const jsonError = (error: string, status: number, headers?: HeadersInit) =>
  Response.json({ error }, { status, headers });

/** Shared checks for the AI routes. Returns a Response to send, or the chosen provider. */
export function checkAIRequest(req: Request, provider: unknown): Response | Provider {
  if (!sameOrigin(req)) return jsonError("Requests must come from this site.", 403);
  const providers = availableProviders();
  if (!providers.includes(provider as Provider)) return jsonError("That AI provider isn't available here.", 400);
  const wait = rateLimited(clientIp(req));
  if (wait !== null) return jsonError(`Too many AI requests. Try again in ${wait}s.`, 429, { "Retry-After": String(wait) });
  return provider as Provider;
}

export function aiFailure(error: unknown): Response {
  if (error instanceof AIError) return jsonError(error.message, 502);
  console.error(error);
  return jsonError("Something went wrong. Please try again.", 500);
}
