export type SearchSourceCandidate = {
  title: string;
  url: string;
  snippet: string;
  domain: string | null;
  content: string;
  score: number;
};

export function stripHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractMainContent(html: string) {
  const articleMatch =
    html.match(/<article[\s\S]*?>([\s\S]*?)<\/article>/i) ||
    html.match(/<main[\s\S]*?>([\s\S]*?)<\/main>/i) ||
    html.match(/<body[\s\S]*?>([\s\S]*?)<\/body>/i);
  return stripHtml(articleMatch?.[1] || html).slice(0, 8000);
}

export function computeSearchScore(query: string, source: Pick<SearchSourceCandidate, "title" | "snippet" | "content" | "domain">) {
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 2);
  const haystack = `${source.title} ${source.snippet} ${source.content}`.toLowerCase();
  let score = 0;

  for (const token of tokens) {
    if (source.title.toLowerCase().includes(token)) {
      score += 5;
    }
    if (source.snippet.toLowerCase().includes(token)) {
      score += 3;
    }
    if (haystack.includes(token)) {
      score += 1;
    }
  }

  if (source.domain?.includes("wikipedia")) {
    score += 2;
  }

  if (source.content.length > 400) {
    score += 2;
  }

  return score;
}

function normalizedUrl(url: string) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    if (parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function normalizedText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 280);
}

export function dedupeSearchSources(sources: SearchSourceCandidate[]) {
  const seen = new Set<string>();
  const unique: SearchSourceCandidate[] = [];

  for (const source of sources) {
    const key = `${normalizedUrl(source.url)}|${normalizedText(source.title)}|${normalizedText(source.snippet || source.content)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(source);
  }

  return unique;
}
