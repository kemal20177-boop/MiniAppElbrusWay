import { NextRequest } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/auth";
import { apiError, apiSuccess, resolveErrorMessage } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { chatUpdateSchema } from "@/lib/validators";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) {
    return apiError("UNAUTHORIZED", "Требуется авторизация", 401);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const payload = chatUpdateSchema.parse(body);
    const chat = await prisma.chat.findFirst({
      where: {
        id: params.id,
        userId: user.id,
        deletedAt: null
      }
    });

    if (!chat) {
      return apiError("CHAT_NOT_FOUND", "Чат не найден", 404);
    }

    const updated = await prisma.chat.update({
      where: { id: chat.id },
      data: {
        ...(payload.title !== undefined ? { title: payload.title || "Новый чат" } : {}),
        ...(payload.isPinned !== undefined ? { isPinned: payload.isPinned } : {}),
        ...(payload.isArchived !== undefined ? { isArchived: payload.isArchived } : {})
      }
    });

    return apiSuccess({ chat: updated });
  } catch (error) {
    return apiError("CHAT_UPDATE_FAILED", resolveErrorMessage(error), 400);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) {
    return apiError("UNAUTHORIZED", "Требуется авторизация", 401);
  }

  const chat = await prisma.chat.findFirst({
    where: {
      id: params.id,
      userId: user.id,
      deletedAt: null
    }
  });

  if (!chat) {
    return apiError("CHAT_NOT_FOUND", "Чат не найден", 404);
  }

  await prisma.chat.update({
    where: { id: chat.id },
    data: {
      deletedAt: new Date(),
      isArchived: true
    }
  });

  return apiSuccess({ id: chat.id });
}
