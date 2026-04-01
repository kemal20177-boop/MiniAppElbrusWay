import { NextRequest } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { getCanvasForUser, updateCanvasForUser } from "@/lib/canvas";
import { apiError, apiSuccess, resolveErrorMessage } from "@/lib/http";
import { canvasUpdateSchema } from "@/lib/validators";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireCurrentUser(request);
    const canvas = await getCanvasForUser(user.id, params.id);
    if (!canvas) {
      return apiError("CANVAS_NOT_FOUND", "Canvas не найден", 404);
    }

    return apiSuccess({ canvas });
  } catch (error) {
    const message = resolveErrorMessage(error);
    return apiError(message, message === "UNAUTHORIZED" ? "Требуется авторизация" : message, message === "UNAUTHORIZED" ? 401 : 400);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireCurrentUser(request);
    const body = await request.json().catch(() => ({}));
    const payload = canvasUpdateSchema.parse(body);
    const canvas = await updateCanvasForUser({
      userId: user.id,
      canvasId: params.id,
      title: payload.title,
      content: payload.content,
      prompt: payload.prompt
    });

    await writeAuditLog({
      action: "canvas.update",
      actorId: user.id,
      entityType: "canvas",
      entityId: params.id,
      details: {
        title: payload.title || null
      }
    });

    return apiSuccess({ canvas });
  } catch (error) {
    const message = resolveErrorMessage(error);
    return apiError("CANVAS_UPDATE_FAILED", message, message === "UNAUTHORIZED" ? 401 : message === "CANVAS_NOT_FOUND" ? 404 : 400);
  }
}
