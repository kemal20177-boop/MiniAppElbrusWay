import { NextRequest } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { apiError, apiSuccess, resolveErrorMessage } from "@/lib/http";
import { cancelToolJobForUser, getToolJobForUser, retryToolJobForUser } from "@/lib/tool-jobs";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireCurrentUser(request);
    const job = await getToolJobForUser(params.id, user.id);
    if (!job) {
      return apiError("JOB_NOT_FOUND", "Job не найден", 404);
    }

    return apiSuccess({ job });
  } catch (error) {
    return apiError("TOOL_JOB_FETCH_FAILED", resolveErrorMessage(error), 400);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireCurrentUser(request);
    const body = await request.json().catch(() => ({}));

    if (body?.action === "cancel") {
      const job = await cancelToolJobForUser(params.id, user.id);
      return apiSuccess({ job });
    }

    if (body?.action === "retry") {
      const job = await retryToolJobForUser(params.id, user.id);
      return apiSuccess({ job });
    }

    return apiError("TOOL_JOB_ACTION_INVALID", "Неподдерживаемое действие", 400);
  } catch (error) {
    return apiError("TOOL_JOB_UPDATE_FAILED", resolveErrorMessage(error), 400);
  }
}
