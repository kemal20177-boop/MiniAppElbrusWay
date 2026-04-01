import { NextRequest } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { getDocumentForUser, updateDocumentForUser } from "@/lib/documents";
import { apiError, apiSuccess, resolveErrorMessage } from "@/lib/http";
import { documentUpdateSchema } from "@/lib/validators";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireCurrentUser(request);
    const document = await getDocumentForUser(user.id, params.id);
    if (!document) {
      return apiError("DOCUMENT_NOT_FOUND", "Документ не найден", 404);
    }

    return apiSuccess({ document });
  } catch (error) {
    const message = resolveErrorMessage(error);
    return apiError(message, message === "UNAUTHORIZED" ? "Требуется авторизация" : message, message === "UNAUTHORIZED" ? 401 : 400);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireCurrentUser(request);
    const body = await request.json().catch(() => ({}));
    const payload = documentUpdateSchema.parse(body);
    const document = await updateDocumentForUser({
      userId: user.id,
      documentId: params.id,
      title: payload.title,
      content: payload.content,
      changeSummary: payload.changeSummary
    });

    await writeAuditLog({
      action: "document.update",
      actorId: user.id,
      entityType: "document",
      entityId: params.id,
      details: {
        title: payload.title || null,
        changeSummary: payload.changeSummary || null
      }
    });

    return apiSuccess({ document });
  } catch (error) {
    const message = resolveErrorMessage(error);
    return apiError("DOCUMENT_UPDATE_FAILED", message, message === "UNAUTHORIZED" ? 401 : message === "DOCUMENT_NOT_FOUND" ? 404 : 400);
  }
}
