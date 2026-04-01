import { NextRequest } from "next/server";
import { createChatForUser } from "@/lib/app";
import { getCurrentUserFromRequest } from "@/lib/auth";
import { createChatSchema, chatListQuerySchema } from "@/lib/validators";
import { apiError, apiSuccess, buildPaginationMeta, resolveErrorMessage } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) {
    return apiError("UNAUTHORIZED", "Требуется авторизация", 401);
  }

  const query = chatListQuerySchema.parse({
    query: request.nextUrl.searchParams.get("query") || undefined,
    pinned: request.nextUrl.searchParams.get("pinned") || undefined,
    page: request.nextUrl.searchParams.get("page") || undefined,
    pageSize: request.nextUrl.searchParams.get("pageSize") || undefined
  });
  const page = query.page || 1;
  const pageSize = query.pageSize || 20;
  const where = {
    userId: user.id,
    deletedAt: null,
    ...(query.query ? { title: { contains: query.query, mode: "insensitive" as const } } : {}),
    ...(query.pinned !== undefined ? { isPinned: query.pinned } : {})
  };
  const [chats, total] = await Promise.all([
    prisma.chat.findMany({
      where,
      orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.chat.count({ where })
  ]);

  return apiSuccess({ chats }, undefined, buildPaginationMeta({ page, pageSize, total }));
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) {
    return apiError("UNAUTHORIZED", "Требуется авторизация", 401);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const payload = createChatSchema.parse(body);
    const chat = await createChatForUser(user.id, payload.model, payload.title || "Новый чат", payload.projectId);
    return apiSuccess({ chat }, { status: 201 });
  } catch (error) {
    return apiError("CHAT_CREATE_FAILED", resolveErrorMessage(error), 400);
  }
}
