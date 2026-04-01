import { NextRequest } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { apiError, apiSuccess, resolveErrorMessage } from "@/lib/http";
import { getProjectForUser, softDeleteProjectForUser, updateProjectForUser } from "@/lib/projects";
import { projectUpdateSchema } from "@/lib/validators";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireCurrentUser(request);
    const project = await getProjectForUser(user.id, params.id);
    if (!project) {
      return apiError("PROJECT_NOT_FOUND", "Проект не найден", 404);
    }

    return apiSuccess({ project });
  } catch (error) {
    const message = resolveErrorMessage(error);
    return apiError(message, message === "UNAUTHORIZED" ? "Требуется авторизация" : message, message === "UNAUTHORIZED" ? 401 : 400);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireCurrentUser(request);
    const body = await request.json().catch(() => ({}));
    const payload = projectUpdateSchema.parse(body);
    const project = await updateProjectForUser(user.id, params.id, payload);

    await writeAuditLog({
      action: "project.update",
      actorId: user.id,
      entityType: "project",
      entityId: project.id,
      details: payload
    });

    return apiSuccess({ project });
  } catch (error) {
    const message = resolveErrorMessage(error);
    return apiError("PROJECT_UPDATE_FAILED", message, message === "UNAUTHORIZED" ? 401 : message === "PROJECT_NOT_FOUND" ? 404 : 400);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireCurrentUser(request);
    const project = await softDeleteProjectForUser(user.id, params.id);

    await writeAuditLog({
      action: "project.delete",
      actorId: user.id,
      entityType: "project",
      entityId: project.id
    });

    return apiSuccess({ id: project.id });
  } catch (error) {
    const message = resolveErrorMessage(error);
    return apiError("PROJECT_DELETE_FAILED", message, message === "UNAUTHORIZED" ? 401 : message === "PROJECT_NOT_FOUND" ? 404 : 400);
  }
}
