import { NextRequest } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { attachFilesToChat, deleteFileForUser } from "@/lib/files";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess, resolveErrorMessage } from "@/lib/http";
import { fileBulkActionSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  try {
    const user = await requireCurrentUser(request);
    const body = await request.json().catch(() => ({}));
    const payload = fileBulkActionSchema.parse(body);

    if (payload.action === "delete") {
      await Promise.all(payload.fileIds.map((fileId) => deleteFileForUser(user.id, fileId)));
      return apiSuccess({ deleted: payload.fileIds });
    }

    if (payload.action === "attachToChat") {
      if (!payload.chatId) {
        return apiError("CHAT_REQUIRED", "Нужен chatId", 400);
      }
      const files = await attachFilesToChat({
        userId: user.id,
        chatId: payload.chatId,
        fileIds: payload.fileIds
      });
      return apiSuccess({ attached: files.map((file) => file.id) });
    }

    if (!payload.projectId) {
      return apiError("PROJECT_REQUIRED", "Нужен projectId", 400);
    }

    await Promise.all(
      payload.fileIds.map((fileId) =>
        prisma.projectFile.upsert({
          where: {
            projectId_fileId: {
              projectId: payload.projectId!,
              fileId
            }
          },
          update: {},
          create: {
            projectId: payload.projectId!,
            fileId,
            userId: user.id
          }
        })
      )
    );

    return apiSuccess({ projectId: payload.projectId, fileIds: payload.fileIds });
  } catch (error) {
    return apiError("FILE_BULK_FAILED", resolveErrorMessage(error), 400);
  }
}
