import { NextRequest } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { createCanvasForUser, listCanvasDocumentsForUser } from "@/lib/canvas";
import { apiError, apiSuccess, resolveErrorMessage } from "@/lib/http";
import { canvasCreateSchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  try {
    const user = await requireCurrentUser(request);
    const projectId = request.nextUrl.searchParams.get("projectId") || undefined;
    const canvases = await listCanvasDocumentsForUser(user.id, projectId);
    return apiSuccess({ canvases });
  } catch (error) {
    const message = resolveErrorMessage(error);
    return apiError(message, message === "UNAUTHORIZED" ? "Требуется авторизация" : message, message === "UNAUTHORIZED" ? 401 : 400);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireCurrentUser(request);
    const body = await request.json().catch(() => ({}));
    const payload = canvasCreateSchema.parse(body);
    const canvas = await createCanvasForUser({
      userId: user.id,
      title: payload.title,
      content: payload.content,
      projectId: payload.projectId,
      kind: payload.kind,
      language: payload.language,
      prompt: payload.prompt
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
