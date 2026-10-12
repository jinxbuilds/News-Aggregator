import { describe, expect, it } from "vitest";
import { cleanArticles, demoPage, PAGE_SIZE } from "../lib/news";
import { briefingPrompt, summaryPrompt } from "../lib/ai";
import { rateLimited, sanitizeArticle } from "../lib/guard";

describe("cleanArticles", () => {
  it("drops removed and invalid articles and fills defaults", () => {
    const out = cleanArticles([
      { title: "[Removed]", url: "https://x.com" },
      { title: "No url", url: "ftp://x" },
      { title: " Ok ", url: "https://x.com/a", source: null, urlToImage: "http://insecure.png" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ title: "Ok", source: "Unknown source", image: "" });
  });
});

describe("demoPage", () => {
  it("matches whole words case-insensitively and paginates", () => {
    const ai = demoPage("AI", 1);
    expect(ai.total).toBe(3);
    expect(ai.articles.length).toBeLessThanOrEqual(PAGE_SIZE);
    expect(demoPage("spa", 1).total).toBe(0);
    expect(demoPage("(", 1).total).toBe(0); // regex characters are escaped
  });
});

describe("prompts", () => {
  it("wrap article text in tags", () => {
    const a = { title: "T", description: "D", content: "", url: "u", image: "", source: "S", published: "" };
    expect(summaryPrompt(a)).toContain("<article>\nTitle: T\nSource: S\nDescription: D\n</article>");
    expect(briefingPrompt([a], "x")).toContain("[1] Title: T");
  });
});

describe("guard", () => {
  it("trims article fields and rejects empty titles", () => {
    expect(sanitizeArticle({ title: "" })).toBeNull();
    expect(sanitizeArticle({ title: "x".repeat(400) })!.title).toHaveLength(300);
  });
  it("limits requests per minute", () => {
    const now = 1_000_000;
    for (let i = 0; i < 6; i++) expect(rateLimited("1.1.1.1", now + i)).toBeNull();
    expect(rateLimited("1.1.1.1", now + 10)).toBeGreaterThan(0);
  });
});
