import NewsApp from "@/components/NewsApp";

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-5 pb-16 pt-16 md:pt-24">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-zinc-500">jinxbuilds · Unsaid Spaces</p>
      <h1 className="mt-5 font-serif text-6xl leading-[0.9] tracking-tight text-white md:text-8xl">
        News <em className="text-sky-400">Aggregator</em>
      </h1>
      <p className="mb-12 mt-6 max-w-2xl text-lg leading-8 text-zinc-400">
        Search the news by topic, then let Claude or Gemini summarise an article or brief you on the whole set.
      </p>
      <NewsApp />
      <footer className="mt-20 flex flex-wrap justify-between gap-3 border-t border-white/10 pt-6 font-mono text-xs text-zinc-600">
        <span>Next.js · NewsAPI · Claude · Gemini</span>
        <span>
          <a className="text-zinc-400 hover:text-white" href="https://github.com/jinxbuilds/News-Aggregator" target="_blank" rel="noopener noreferrer">Source ↗</a>
          {" · "}
          <a className="text-zinc-400 hover:text-white" href="https://unsaidspaces.com" target="_blank" rel="noopener noreferrer">Unsaid Spaces ↗</a>
        </span>
      </footer>
    </main>
  );
}
