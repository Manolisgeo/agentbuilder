import type { WebSearchResult, WebSearchSource } from "@/lib/preview-types";

type TavilyResult = {
  title: string;
  url: string;
  content: string;
};

type TavilyResponse = {
  results?: TavilyResult[];
  answer?: string;
};

export class WebSearchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebSearchError";
  }
}

export function isWebSearchConfigured(): boolean {
  return Boolean(process.env.TAVILY_API_KEY?.trim());
}

export async function webSearch(query: string): Promise<WebSearchResult> {
  const apiKey = process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) {
    throw new WebSearchError(
      "TAVILY_API_KEY is not set. Add it to .env.local to enable live web search."
    );
  }

  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    throw new WebSearchError("Search query cannot be empty.");
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query: trimmedQuery,
      search_depth: "basic",
      include_answer: true,
      max_results: 5,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new WebSearchError(
      `Web search failed (${response.status})${body ? `: ${body.slice(0, 200)}` : ""}`
    );
  }

  const data = (await response.json()) as TavilyResponse;
  const sources: WebSearchSource[] = (data.results ?? []).map((result) => ({
    title: result.title,
    url: result.url,
    snippet: result.content,
  }));

  return {
    query: trimmedQuery,
    sources,
    answer: data.answer,
  };
}

export function formatWebSearchForPrompt(result: WebSearchResult): string {
  const sourceLines =
    result.sources.length > 0
      ? result.sources
          .map(
            (source, index) =>
              `[${index + 1}] ${source.title}\nURL: ${source.url}\n${source.snippet}`
          )
          .join("\n\n")
      : "No sources returned.";

  return `Search query: ${result.query}

${result.answer ? `Summary: ${result.answer}\n\n` : ""}Sources:
${sourceLines}`;
}
