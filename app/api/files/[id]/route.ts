import { NextRequest } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { deleteFileForUser, getFileForUser } from "@/lib/files";
import { apiError, apiSuccess, resolveErrorMessage } from "@/lib/http";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireCurrentUser(request);
    const file = await getFileForUser(user.id, params.id);
    if (!file) {
      return apiError("FILE_NOT_FOUND", "Файл не найден", 404);
    }

    return apiSuccess({ file });
  } catch (error) {
    const message = resolveErrorMessage(error);
    return apiError(message, message === "UNAUTHORIZED" ? "Требуется авторизация" : message, message === "UNAUTHORIZED" ? 401 : 400);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireCurrentUser(request);
    const file = await deleteFileForUser(user.id, params.id);

    await writeAuditLog({
      action: "file.delete",
      actorId: user.id,
      entityType: "file",
      entityId: file.id,
      details: {
        originalName: file.originalName
      }
    });

    return apiSuccess({ id: file.id });
  } catch (error) {
    const message = resolveErrorMessage(error);
    return apiError("FILE_DELETE_FAILED", message, message === "UNAUTHORIZED" ? 401 : message === "FILE_NOT_FOUND" ? 404 : 400);
  }
}
