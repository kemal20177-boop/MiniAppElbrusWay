import { NextRequest } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { createCanvasForUser, createCanvasFromChat, createCanvasFromDocument, listCanvasDocumentsForUser } from "@/lib/canvas";
import { apiError, apiSuccess, buildPaginationMeta, resolveErrorMessage } from "@/lib/http";
import { canvasCreateSchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  try {
    const user = await requireCurrentUser(request);
    const projectId = request.nextUrl.searchParams.get("projectId") || undefined;
    const query = request.nextUrl.searchParams.get("query") || undefined;
    const canvases = await listCanvasDocumentsForUser(user.id, projectId, query);
    return apiSuccess({ canvases }, undefined, buildPaginationMeta({ page: 1, pageSize: canvases.length || 1, total: canvases.length }));
  } catch (error) {
    const message = resolveErrorMessage(error);
    return apiError(message, message === "UNAUTHORIZED" ? "Требуется авторизация" : message, message === "UNAUTHORIZED" ? 401 : 400);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireCurrentUser(request);
    const body = await request.json().catch(() => ({}));
    if (body?.sourceChatId) {
      const canvas = await createCanvasFromChat({
        userId: user.id,
        chatId: String(body.sourceChatId)
      });
      return apiSuccess({ canvas }, { status: 201 });
    }

    if (body?.documentId) {
      const canvas = await createCanvasFromDocument({
        userId: user.id,
        documentId: String(body.documentId)
      });
      return apiSuccess({ canvas }, { status: 201 });
    }

    const payload = canvasCreateSchema.parse(body);
    const canvas = await createCanvasForUser({
      userId: user.id,
      title: payload.title,
      content: payload.content,
      projectId: payload.projectId,
      kind: payload.kind,
      language: payload.language,
      prompt: payload.prompt,
      sourceChatId: body?.sourceChatId,
      sourceFileId: body?.sourceFileId
    });

    await writeAuditLog({
      action: "canvas.create",
      actorId: user.id,
      entityType: "canvas",
      entityId: canvas?.id,
      details: {
        title: payload.title,
        kind: payload.kind || "MARKDOWN"
      }
    });

    return apiSuccess({ canvas }, { status: 201 });
  } catch (error) {
    const message = resolveErrorMessage(error);
    return apiError("CANVAS_CREATE_FAILED", message, message === "UNAUTHORIZED" ? 401 : 400);
  }
}
