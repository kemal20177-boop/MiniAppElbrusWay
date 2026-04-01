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

export async function listCanvasDocumentsForUser(userId: string, projectId?: string) {
  return prisma.canvasDocument.findMany({
    where: {
      userId,
      deletedAt: null,
      ...(projectId ? { projectId } : {})
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
}) {
  const canvas = await prisma.$transaction(async (tx) => {
    const created = await tx.canvasDocument.create({
      data: {
        userId: params.userId,
        projectId: params.projectId || null,
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
