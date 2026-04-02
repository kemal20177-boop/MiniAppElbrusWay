import { NextRequest } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { apiError, apiSuccess, resolveErrorMessage } from "@/lib/http";
import { createToolJob, listToolJobsForUser, queueToolJob } from "@/lib/tool-jobs";
import { getPreferredRouterModel } from "@/lib/routerai/models";
import { toolVisionSchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  try {
    const user = await requireCurrentUser(request);
    const projectId = request.nextUrl.searchParams.get("projectId") || undefined;
    const jobs = await listToolJobsForUser({
      userId: user.id,
      projectId,
      jobTypePrefix: "vision.",
      take: 20
    });
    const model = await getPreferredRouterModel({ forImageInput: true });
    return apiSuccess({ jobs, setup: { ready: Boolean(model) } });
  } catch (error) {
    return apiError("VISION_LIST_FAILED", resolveErrorMessage(error), 400);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireCurrentUser(request);
    const body = await request.json().catch(() => ({}));
    const payload = toolVisionSchema.parse(body);
    const model = await getPreferredRouterModel({ forImageInput: true });
    if (!model) {
      return apiError("VISION_MODEL_UNAVAILABLE", "Анализ изображений сейчас недоступен", 400);
    }
    const job = await createToolJob({
      userId: user.id,
      projectId: payload.projectId,
      jobType: `vision.${payload.mode}`,
      input: payload
    });

    queueToolJob(job.id);
    return apiSuccess({ job }, { status: 202 });
  } catch (error) {
    return apiError("VISION_RUN_FAILED", resolveErrorMessage(error), 400);
  }
}
