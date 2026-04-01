import { NextRequest } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { createDocumentForUser, listDocumentsForUser } from "@/lib/documents";
import { apiError, apiSuccess, resolveErrorMessage } from "@/lib/http";
import { documentCreateSchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  try {
    const user = await requireCurrentUser(request);
    const projectId = request.nextUrl.searchParams.get("projectId") || undefined;
    const documents = await listDocumentsForUser(user.id, projectId);
    return apiSuccess({ documents });
  } catch (error) {
    const message = resolveErrorMessage(error);
    return apiError(message, message === "UNAUTHORIZED" ? "Требуется авторизация" : message, message === "UNAUTHORIZED" ? 401 : 400);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireCurrentUser(request);
    const body = await request.json().catch(() => ({}));
    const payload = documentCreateSchema.parse(body);
    const document = await createDocumentForUser({
      userId: user.id,
      title: payload.title,
      prompt: payload.prompt,
      projectId: payload.projectId,
      sourceFileId: payload.sourceFileId
    });

    await writeAuditLog({
      action: "document.create",
      actorId: user.id,
      entityType: "document",
      entityId: document?.id,
      details: {
        title: payload.title,
        projectId: payload.projectId || null
      }
    });

    return apiSuccess({ document }, { status: 201 });
  } catch (error) {
    const message = resolveErrorMessage(error);
    return apiError("DOCUMENT_CREATE_FAILED", message, message === "UNAUTHORIZED" ? 401 : 400);
  }
}
