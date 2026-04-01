import "server-only";
import { prisma } from "@/lib/prisma";

function diffTextLines(from: string, to: string) {
  const fromLines = from.split("\n");
  const toLines = to.split("\n");
  const maxLength = Math.max(fromLines.length, toLines.length);
  const parts: Array<{ added: boolean; removed: boolean; value: string }> = [];

  for (let index = 0; index < maxLength; index += 1) {
    const fromLine = fromLines[index];
    const toLine = toLines[index];

    if (fromLine === toLine) {
      if (fromLine !== undefined) {
        parts.push({
          added: false,
          removed: false,
          value: `${fromLine}\n`
        });
      }
      continue;
    }

    if (fromLine !== undefined) {
      parts.push({
        added: false,
        removed: true,
        value: `${fromLine}\n`
      });
    }

    if (toLine !== undefined) {
      parts.push({
        added: true,
        removed: false,
        value: `${toLine}\n`
      });
    }
  }

  return parts;
}

function rewriteSelection(params: {
  content: string;
  selection?: string;
  action: "improve" | "shorten" | "translate" | "explain" | "refactor";
}) {
  const target = params.selection?.trim() || params.content.trim();
  if (!target) {
    return params.content;
  }

  let rewritten = target;
  switch (params.action) {
    case "shorten":
      rewritten = target
        .split(/\s+/)
        .slice(0, Math.max(8, Math.ceil(target.split(/\s+/).length * 0.6)))
        .join(" ");
      break;
    case "translate":
      rewritten = `English version:\n${target}`;
      break;
    case "explain":
      rewritten = `${target}\n\nExplanation:\n- Main idea\n- Constraints\n- Expected outcome`;
      break;
    case "refactor":
      rewritten = target
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .join("\n");
      break;
    default:
      rewritten = `${target}\n\nImproved version:\n- Clarified wording\n- Added explicit next steps`;
      break;
  }

  if (!params.selection?.trim()) {
    return rewritten;
  }

  return params.content.replace(params.selection, rewritten);
}

export async function listCanvasDocumentsForUser(userId: string, projectId?: string, query?: string) {
  return prisma.canvasDocument.findMany({
    where: {
      userId,
      deletedAt: null,
      ...(projectId ? { projectId } : {}),
      ...(query
        ? {
            OR: [
              { title: { contains: query, mode: "insensitive" } },
              { currentContent: { contains: query, mode: "insensitive" } }
            ]
          }
        : {})
    },
    include: {
      versions: {
        orderBy: { version: "desc" },
        take: 3
      }
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
  });
}

export async function getCanvasForUser(userId: string, canvasId: string) {
  return prisma.canvasDocument.findFirst({
    where: {
      id: canvasId,
      userId,
      deletedAt: null
    },
    include: {
      versions: {
        orderBy: { version: "desc" }
      }
    }
  });
}

export async function createCanvasForUser(params: {
  userId: string;
  title: string;
  content: string;
  projectId?: string;
  kind?: "TEXT" | "MARKDOWN" | "CODE" | "JSON" | "HTML" | "SQL";
  language?: string;
  prompt?: string;
  sourceChatId?: string;
  sourceFileId?: string;
}) {
  const canvas = await prisma.$transaction(async (tx) => {
    const created = await tx.canvasDocument.create({
      data: {
        userId: params.userId,
        projectId: params.projectId || null,
        sourceChatId: params.sourceChatId || null,
        sourceFileId: params.sourceFileId || null,
        title: params.title,
        kind: params.kind || "MARKDOWN",
        language: params.language || null,
        currentContent: params.content
      }
    });

    await tx.canvasVersion.create({
      data: {
        canvasId: created.id,
        userId: params.userId,
        version: 1,
        content: params.content,
        prompt: params.prompt || null
      }
    });

    return created;
  });

  return getCanvasForUser(params.userId, canvas.id);
}

export async function updateCanvasForUser(params: {
  userId: string;
  canvasId: string;
  title?: string;
  content: string;
  prompt?: string;
}) {
  const current = await prisma.canvasDocument.findFirst({
    where: {
      id: params.canvasId,
      userId: params.userId,
      deletedAt: null
    },
    include: {
      versions: {
        orderBy: { version: "desc" },
        take: 1
      }
    }
  });

  if (!current) {
    throw new Error("CANVAS_NOT_FOUND");
  }

  const latest = current.versions[0];
  if (latest?.content === params.content && (!params.title || params.title === current.title)) {
    return getCanvasForUser(params.userId, current.id);
  }

  const nextVersion = (latest?.version || 0) + 1;

  await prisma.$transaction(async (tx) => {
    await tx.canvasDocument.update({
      where: { id: current.id },
      data: {
        title: params.title || current.title,
        currentContent: params.content,
        updatedAt: new Date()
      }
    });

    await tx.canvasVersion.create({
      data: {
        canvasId: current.id,
        userId: params.userId,
        version: nextVersion,
        content: params.content,
        prompt: params.prompt || null
      }
    });
  });

  return getCanvasForUser(params.userId, current.id);
}

export async function autosaveCanvasDraft(params: {
  userId: string;
  canvasId: string;
  content: string;
  prompt?: string;
}) {
  return updateCanvasForUser({
    userId: params.userId,
    canvasId: params.canvasId,
    content: params.content,
    prompt: params.prompt
  });
}

export async function rewriteCanvasSelectionForUser(params: {
  userId: string;
  canvasId: string;
  selection?: string;
  action: "improve" | "shorten" | "translate" | "explain" | "refactor";
  prompt?: string;
}) {
  const canvas = await getCanvasForUser(params.userId, params.canvasId);
  if (!canvas) {
    throw new Error("CANVAS_NOT_FOUND");
  }

  const nextContent = rewriteSelection({
    content: canvas.currentContent,
    selection: params.selection,
    action: params.action
  });

  return updateCanvasForUser({
    userId: params.userId,
    canvasId: params.canvasId,
    content: nextContent,
    prompt: params.prompt || params.action
  });
}

export async function rollbackCanvasForUser(params: {
  userId: string;
  canvasId: string;
  version: number;
}) {
  const canvas = await prisma.canvasDocument.findFirst({
    where: {
      id: params.canvasId,
      userId: params.userId,
      deletedAt: null
    },
    include: {
      versions: {
        orderBy: { version: "desc" }
      }
    }
  });

  if (!canvas) {
    throw new Error("CANVAS_NOT_FOUND");
  }

  const target = canvas.versions.find((entry) => entry.version === params.version);
  if (!target) {
    throw new Error("CANVAS_VERSION_NOT_FOUND");
  }

  return updateCanvasForUser({
    userId: params.userId,
    canvasId: params.canvasId,
    content: target.content,
    prompt: `rollback:${params.version}`
  });
}

export async function createCanvasFromDocument(params: {
  userId: string;
  documentId: string;
}) {
  const document = await prisma.document.findFirst({
    where: {
      id: params.documentId,
      userId: params.userId,
      deletedAt: null
    },
    include: {
      projectLinks: {
        take: 1
      }
    }
  });

  if (!document) {
    throw new Error("DOCUMENT_NOT_FOUND");
  }

  const source = (document.source || {}) as { sections?: Array<{ title?: string; content?: string }> };
  const content = Array.isArray(source.sections)
    ? source.sections.flatMap((section) => [`## ${section.title || "Section"}`, section.content || "", ""]).join("\n")
    : "";

  return createCanvasForUser({
    userId: params.userId,
    title: document.title,
    content,
    projectId: document.projectLinks[0]?.projectId
  });
}

export async function createCanvasFromChat(params: {
  userId: string;
  chatId: string;
}) {
  const chat = await prisma.chat.findFirst({
    where: {
      id: params.chatId,
      userId: params.userId,
      deletedAt: null
    },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 6
      }
    }
  });

  if (!chat) {
    throw new Error("CHAT_NOT_FOUND");
  }

  const content = chat.messages
    .reverse()
    .map((message) => `### ${message.role}\n${message.content}`)
    .join("\n\n");

  return createCanvasForUser({
    userId: params.userId,
    title: chat.title,
    content,
    projectId: chat.projectId || undefined,
    sourceChatId: chat.id
  });
}

export async function getCanvasDiffForUser(params: {
  userId: string;
  canvasId: string;
  fromVersion: number;
  toVersion: number;
}) {
  const canvas = await prisma.canvasDocument.findFirst({
    where: {
      id: params.canvasId,
      userId: params.userId,
      deletedAt: null
    },
    include: {
      versions: {
        where: {
          version: {
            in: [params.fromVersion, params.toVersion]
          }
        },
        orderBy: { version: "asc" }
      }
    }
  });

  if (!canvas) {
    throw new Error("CANVAS_NOT_FOUND");
  }

  const from = canvas.versions.find((entry) => entry.version === params.fromVersion);
  const to = canvas.versions.find((entry) => entry.version === params.toVersion);

  if (!from || !to) {
    throw new Error("CANVAS_VERSION_NOT_FOUND");
  }

  return diffTextLines(from.content, to.content);
}
