import { NextRequest } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { apiError, apiSuccess, resolveErrorMessage } from "@/lib/http";
import { createProjectForUser, listProjectsForUser } from "@/lib/projects";
import { projectCreateSchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  try {
    const user = await requireCurrentUser(request);
    const projects = await listProjectsForUser(user.id);
    return apiSuccess({ projects });
  } catch (error) {
    const message = resolveErrorMessage(error);
    return apiError(message, message === "UNAUTHORIZED" ? "Требуется авторизация" : message, message === "UNAUTHORIZED" ? 401 : 400);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireCurrentUser(request);
    const body = await request.json().catch(() => ({}));
    const payload = projectCreateSchema.parse(body);
    const project = await createProjectForUser(user.id, payload);

    await writeAuditLog({
      action: "project.create",
      actorId: user.id,
      entityType: "project",
      entityId: project.id,
      details: {
        title: project.title,
        slug: project.slug
      }
    });

    return apiSuccess({ project });
  } catch (error) {
    const message = resolveErrorMessage(error);
    return apiError("PROJECT_CREATE_FAILED", message, message === "UNAUTHORIZED" ? 401 : 400);
  }
}
