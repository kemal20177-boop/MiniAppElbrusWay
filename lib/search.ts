import "server-only";
import { SearchDepth } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  domain: string | null;
};

function stripHtml(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
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

async function fetchDuckDuckGoResults(query: string, depth: SearchDepth) {
  const limit = getResultLimit(depth);
  const response = await fetch(`https://duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=ru-ru`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; ElbrusWayAI/1.0; +https://elbrusway.ru)"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`SEARCH_UPSTREAM_FAILED_${response.status}`);
  }

  const html = await response.text();
  const results: SearchResult[] = [];
  const regex =
    /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  let match = regex.exec(html);

  while (match && results.length < limit) {
    const url = match[1];
    const title = stripHtml(match[2]);
    const snippet = stripHtml(match[3]);

    if (title && url) {
      let domain: string | null = null;

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

function synthesizeAnswer(query: string, sources: SearchResult[]) {
  if (sources.length === 0) {
    return `По запросу "${query}" не удалось извлечь источники.`;
  }

  const bulletSummary = sources
    .slice(0, 4)
    .map((source, index) => `[${index + 1}] ${source.title}: ${source.snippet}`)
    .join("\n");

  return `Сводка по запросу "${query}":\n${bulletSummary}`;
}

export async function runWebSearch(params: {
  userId: string;
  query: string;
  projectId?: string;
  chatId?: string;
  depth?: SearchDepth;
  latestOnly?: boolean;
}) {
  const depth = params.depth || SearchDepth.STANDARD;
  const sources = await fetchDuckDuckGoResults(params.query, depth);
  const answer = synthesizeAnswer(params.query, sources);

  const session = await prisma.searchSession.create({
    data: {
      userId: params.userId,
      projectId: params.projectId || null,
      chatId: params.chatId || null,
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
          snippet: source.snippet,
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

  return session;
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
