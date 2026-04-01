import { NextRequest } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { autosaveCanvasDraft, getCanvasForUser, rewriteCanvasSelectionForUser, rollbackCanvasForUser, updateCanvasForUser } from "@/lib/canvas";
import { apiError, apiSuccess, resolveErrorMessage } from "@/lib/http";
import { canvasRewriteSchema, canvasRollbackSchema, canvasUpdateSchema } from "@/lib/validators";

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
    if (body?.mode === "rewrite" || body?.action === "rewrite") {
      const payload = canvasRewriteSchema.parse(body);
      const canvas = await rewriteCanvasSelectionForUser({
        userId: user.id,
        canvasId: params.id,
        selection: payload.selection,
        action: payload.action,
        prompt: payload.prompt
      });

      await writeAuditLog({
        action: "canvas.rewrite",
        actorId: user.id,
        entityType: "canvas",
        entityId: params.id,
        details: {
          action: payload.action
        }
      });

      return apiSuccess({ canvas });
    }

    if (body?.mode === "rollback" || body?.action === "rollback") {
      const payload = canvasRollbackSchema.parse(body);
      const canvas = await rollbackCanvasForUser({
        userId: user.id,
        canvasId: params.id,
        version: payload.version
      });

      await writeAuditLog({
        action: "canvas.rollback",
        actorId: user.id,
        entityType: "canvas",
        entityId: params.id,
        details: {
          version: payload.version
        }
      });

      return apiSuccess({ canvas });
    }

    if (body?.mode === "autosave" || body?.action === "autosave") {
      const payload = canvasUpdateSchema.parse(body);
      const canvas = await autosaveCanvasDraft({
        userId: user.id,
        canvasId: params.id,
        content: payload.content,
        prompt: payload.prompt
      });

      return apiSuccess({ canvas });
    }

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
