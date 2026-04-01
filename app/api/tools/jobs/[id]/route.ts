import { NextRequest } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { apiError, apiSuccess, resolveErrorMessage } from "@/lib/http";
import { getToolJobForUser } from "@/lib/tool-jobs";

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
