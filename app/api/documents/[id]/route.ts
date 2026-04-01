import { NextRequest } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { archiveDocumentForUser, deleteDocumentForUser, getDocumentForUser, updateDocumentForUser } from "@/lib/documents";
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
      sectionKey: payload.sectionKey,
      changeSummary: payload.changeSummary,
      regenerateSummary: payload.regenerateSummary,
      archived: payload.archived
    });

    await writeAuditLog({
      action: "document.update",
      actorId: user.id,
      entityType: "document",
      entityId: params.id,
      details: {
        title: payload.title || null,
        changeSummary: payload.changeSummary || null,
        sectionKey: payload.sectionKey || null,
        regenerateSummary: payload.regenerateSummary || false,
        archived: payload.archived || false
      }
    });

    return apiSuccess({ document });
  } catch (error) {
    const message = resolveErrorMessage(error);
    return apiError("DOCUMENT_UPDATE_FAILED", message, message === "UNAUTHORIZED" ? 401 : message === "DOCUMENT_NOT_FOUND" ? 404 : 400);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireCurrentUser(request);
    const mode = request.nextUrl.searchParams.get("mode");
    const result =
      mode === "archive" ? await archiveDocumentForUser(user.id, params.id) : await deleteDocumentForUser(user.id, params.id);

    await writeAuditLog({
      action: mode === "archive" ? "document.archive" : "document.delete",
      actorId: user.id,
      entityType: "document",
      entityId: params.id
    });

    return apiSuccess({ document: result });
  } catch (error) {
    const message = resolveErrorMessage(error);
    return apiError("DOCUMENT_DELETE_FAILED", message, message === "UNAUTHORIZED" ? 401 : message === "DOCUMENT_NOT_FOUND" ? 404 : 400);
  }
}
