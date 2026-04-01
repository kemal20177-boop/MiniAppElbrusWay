import "server-only";
import { SearchDepth } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type SearchSourceDraft = {
  title: string;
  url: string;
  snippet: string;
  domain: string | null;
  content: string;
  score: number;
};

type SearchRunParams = {
  userId: string;
  query: string;
  projectId?: string;
  chatId?: string;
  sessionId?: string;
  depth?: SearchDepth;
  latestOnly?: boolean;
};

function stripHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
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

function buildSearchQuery(query: string, latestOnly?: boolean) {
  return latestOnly ? `${query} latest news update` : query;
}

function getResultLimit(depth: SearchDepth) {
  switch (depth) {
    case SearchDepth.SHORT:
      return 4;
    case SearchDepth.DEEP:
      return 8;
    default:
      return 6;
  }
}

function getFetchLimit(depth: SearchDepth) {
  switch (depth) {
    case SearchDepth.SHORT:
      return 2;
    case SearchDepth.DEEP:
      return 5;
    default:
      return 3;
  }
}

function extractMainContent(html: string) {
  const articleMatch =
    html.match(/<article[\s\S]*?>([\s\S]*?)<\/article>/i) ||
    html.match(/<main[\s\S]*?>([\s\S]*?)<\/main>/i) ||
    html.match(/<body[\s\S]*?>([\s\S]*?)<\/body>/i);
  return stripHtml(articleMatch?.[1] || html).slice(0, 6000);
}

function computeScore(query: string, source: Pick<SearchSourceDraft, "title" | "snippet" | "content" | "domain">) {
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

  return score;
}

function dedupeSources(sources: SearchSourceDraft[]) {
  const seen = new Set<string>();
  const unique: SearchSourceDraft[] = [];

  for (const source of sources) {
    const key = `${source.url}|${source.title.toLowerCase()}|${source.domain || ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(source);
  }

  return unique;
}

async function fetchDuckDuckGoResults(query: string, depth: SearchDepth, latestOnly?: boolean) {
  const limit = getResultLimit(depth);
  const response = await fetch(`https://duckduckgo.com/html/?q=${encodeURIComponent(buildSearchQuery(query, latestOnly))}&kl=ru-ru`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; ElbrusWayAI/1.0; +https://elbrusway.ru)"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`SEARCH_UPSTREAM_FAILED_${response.status}`);
  }

  const html = await response.text();
  const results: Array<Omit<SearchSourceDraft, "content" | "score">> = [];
  const regex =
    /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>|<div[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/div>)/g;
  let match = regex.exec(html);

  while (match && results.length < limit) {
    const rawUrl = match[1];
    const title = stripHtml(match[2]);
    const snippet = stripHtml(match[3] || match[4] || "");

    if (title && rawUrl) {
      let url = rawUrl;
      let domain: string | null = null;

      try {
        const parsed = new URL(rawUrl);
        url = parsed.searchParams.get("uddg") || rawUrl;
      } catch {}

      try {
        domain = new URL(url).hostname;
      } catch {}

      results.push({
        title,
        url,
        snippet,
        domain
      });
    }

    match = regex.exec(html);
  }

  return results;
}

async function fetchPageContent(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ElbrusWayAI/1.0; +https://elbrusway.ru)"
      },
      redirect: "follow",
      cache: "no-store"
    });

    if (!response.ok) {
      return "";
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      return "";
    }

    return extractMainContent(await response.text());
  } catch {
    return "";
  }
}

function synthesizeAnswer(query: string, sources: SearchSourceDraft[], previousQuery?: string) {
  if (sources.length === 0) {
    return `По запросу "${query}" не удалось извлечь источники.`;
  }

  const sections = sources.slice(0, 4).map((source, index) => {
    const body = source.content || source.snippet;
    return `[${index + 1}] ${source.title}\n${body.slice(0, 320).trim()}`;
  });

  return [
    previousQuery ? `Follow-up к предыдущему запросу "${previousQuery}".` : null,
    `Синтез по запросу "${query}":`,
    ...sections,
    "",
    "Источники:",
    ...sources.slice(0, 4).map((source, index) => `[${index + 1}] ${source.title} — ${source.url}`)
  ]
    .filter(Boolean)
    .join("\n");
}

async function buildSearchSources(query: string, depth: SearchDepth, latestOnly?: boolean) {
  const rawResults = await fetchDuckDuckGoResults(query, depth, latestOnly);
  const fetchLimit = getFetchLimit(depth);
  const enriched = await Promise.all(
    rawResults.slice(0, fetchLimit).map(async (entry) => {
      const content = await fetchPageContent(entry.url);
      const score = computeScore(query, {
        title: entry.title,
        snippet: entry.snippet,
        content,
        domain: entry.domain
      });

      return {
        ...entry,
        content,
        score
      } satisfies SearchSourceDraft;
    })
  );

  const untouched = rawResults.slice(fetchLimit).map((entry) => ({
    ...entry,
    content: "",
    score: computeScore(query, {
      title: entry.title,
      snippet: entry.snippet,
      content: "",
      domain: entry.domain
    })
  }));

  return dedupeSources([...enriched, ...untouched]).sort((left, right) => right.score - left.score);
}

export async function runWebSearch(params: SearchRunParams) {
  const depth = params.depth || SearchDepth.STANDARD;
  const previousSession =
    params.sessionId
      ? await prisma.searchSession.findFirst({
          where: {
            id: params.sessionId,
            userId: params.userId
          }
        })
      : null;
  const combinedQuery = previousSession ? `${previousSession.query}\n${params.query}` : params.query;
  const sources = await buildSearchSources(combinedQuery, depth, params.latestOnly);
  const answer = synthesizeAnswer(params.query, sources, previousSession?.query);

  const session = await prisma.searchSession.create({
    data: {
      userId: params.userId,
      projectId: params.projectId || previousSession?.projectId || null,
      chatId: params.chatId || previousSession?.chatId || null,
      query: params.query,
      depth,
      latestOnly: Boolean(params.latestOnly),
      answer,
      sources: {
        create: sources.map((source, index) => ({
          userId: params.userId,
          title: source.title,
          url: source.url,
          domain: source.domain,
          snippet: source.content || source.snippet,
          position: index
        }))
      }
    },
    include: {
      sources: {
        orderBy: { position: "asc" }
      }
    }
  });

  return {
    ...session,
    mode: depth === SearchDepth.SHORT ? "fast" : depth === SearchDepth.DEEP ? "deep" : "standard"
  };
}

export async function listSearchSessionsForUser(userId: string, projectId?: string) {
  return prisma.searchSession.findMany({
    where: {
      userId,
      ...(projectId ? { projectId } : {})
    },
    include: {
      sources: {
        orderBy: { position: "asc" },
        take: 5
      }
    },
    orderBy: { createdAt: "desc" },
    take: 20
  });
}
