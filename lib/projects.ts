import "server-only";
import { prisma } from "@/lib/prisma";

type ProjectActivityInput = {
  chats: Array<{ id: string; title: string; updatedAt: Date }>;
  files: Array<{ createdAt: Date; file: { id: string; originalName: string } }>;
  documents: Array<{ createdAt: Date; document: { id: string; title: string } }>;
  canvasDocs: Array<{ id: string; title: string; updatedAt: Date }>;
};

function normalizeSlug(title: string, rawSlug?: string) {
  const base = (rawSlug || title)
    .toLowerCase()
    .replace(/[^a-z0-9а-яё\s-]/gi, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);

  return base || null;
}

function buildProjectActivity(project: ProjectActivityInput | null) {
  if (!project) {
    return [];
  }

  return [
    ...project.chats.map((chat) => ({
      kind: "chat",
      id: chat.id,
      title: chat.title,
      createdAt: chat.updatedAt
    })),
    ...project.files.map((entry) => ({
      kind: "file",
      id: entry.file.id,
      title: entry.file.originalName,
      createdAt: entry.createdAt
    })),
    ...project.documents.map((entry) => ({
      kind: "document",
      id: entry.document.id,
      title: entry.document.title,
      createdAt: entry.createdAt
    })),
    ...project.canvasDocs.map((canvas) => ({
      kind: "canvas",
      id: canvas.id,
      title: canvas.title,
      createdAt: canvas.updatedAt
    }))
  ]
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, 20);
}

export async function listProjectsForUser(userId: string, options?: { query?: string; includeArchived?: boolean }) {
  return prisma.project.findMany({
    where: {
      ownerId: userId,
      deletedAt: null,
      ...(options?.includeArchived ? {} : { isArchived: false }),
      ...(options?.query
        ? {
            OR: [
              { title: { contains: options.query, mode: "insensitive" } },
              { description: { contains: options.query, mode: "insensitive" } }
            ]
          }
        : {})
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    include: {
      _count: {
        select: {
          chats: true,
          files: true,
          documents: true,
          canvasDocs: true,
          instructions: true,
          searchSessions: true
        }
      }
    }
  });
}

export async function createProjectForUser(userId: string, input: {
  title: string;
  slug?: string;
  description?: string;
  systemPrompt?: string;
  color?: string;
  icon?: string;
}) {
  const slug = normalizeSlug(input.title, input.slug);

  return prisma.project.create({
    data: {
      ownerId: userId,
      title: input.title,
      slug,
      description: input.description || null,
      systemPrompt: input.systemPrompt || null,
      color: input.color || null,
      icon: input.icon || null,
      members: {
        create: {
          userId,
          role: "OWNER"
        }
      }
    },
    include: {
      _count: {
        select: {
          chats: true,
          files: true,
          documents: true,
          canvasDocs: true,
          instructions: true,
          searchSessions: true
        }
      }
    }
  });
}

export async function getProjectForUser(userId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      ownerId: userId,
      deletedAt: null
    },
    include: {
      instructions: {
        where: { isEnabled: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      },
      chats: {
        where: { deletedAt: null },
        orderBy: { updatedAt: "desc" },
        take: 8
      },
      files: {
        orderBy: { createdAt: "desc" },
        take: 8,
        include: {
          file: true
        }
      },
      documents: {
        orderBy: { createdAt: "desc" },
        take: 8,
        include: {
          document: true
        }
      },
      canvasDocs: {
        where: { deletedAt: null },
        orderBy: { updatedAt: "desc" },
        take: 8
      },
      searchSessions: {
        orderBy: { createdAt: "desc" },
        take: 8,
        include: {
          sources: {
            orderBy: { position: "asc" },
            take: 3
          }
        }
      },
      _count: {
        select: {
          chats: true,
          files: true,
          documents: true,
          canvasDocs: true,
          instructions: true,
          searchSessions: true
        }
      }
    }
  });

  if (!project) {
    return null;
  }

  return {
    ...project,
    overview: {
      counters: {
        chats: project._count.chats,
        files: project._count.files,
        documents: project._count.documents,
        canvas: project._count.canvasDocs,
        instructions: project._count.instructions,
        searchSessions: project._count.searchSessions
      },
      activity: buildProjectActivity(project)
    }
  };
}

export async function updateProjectForUser(userId: string, projectId: string, input: {
  title?: string;
  slug?: string;
  description?: string;
  systemPrompt?: string;
  color?: string;
  icon?: string;
  isArchived?: boolean;
}) {
  const current = await prisma.project.findFirst({
    where: {
      id: projectId,
      ownerId: userId,
      deletedAt: null
    }
  });

  if (!current) {
    throw new Error("PROJECT_NOT_FOUND");
  }

  const nextTitle = input.title ?? current.title;
  const nextSlug = input.slug !== undefined ? normalizeSlug(nextTitle, input.slug) : current.slug;

  return prisma.project.update({
    where: { id: current.id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.slug !== undefined ? { slug: nextSlug } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.systemPrompt !== undefined ? { systemPrompt: input.systemPrompt || null } : {}),
      ...(input.color !== undefined ? { color: input.color || null } : {}),
      ...(input.icon !== undefined ? { icon: input.icon || null } : {}),
      ...(input.isArchived !== undefined ? { isArchived: input.isArchived } : {})
    },
    include: {
      _count: {
        select: {
          chats: true,
          files: true,
          documents: true,
          canvasDocs: true,
          instructions: true,
          searchSessions: true
        }
      }
    }
  });
}

export async function softDeleteProjectForUser(userId: string, projectId: string) {
  const current = await prisma.project.findFirst({
    where: {
      id: projectId,
      ownerId: userId,
      deletedAt: null
    }
  });

  if (!current) {
    throw new Error("PROJECT_NOT_FOUND");
  }

  return prisma.project.update({
    where: { id: current.id },
    data: {
      deletedAt: new Date(),
      isArchived: true
    }
  });
}
