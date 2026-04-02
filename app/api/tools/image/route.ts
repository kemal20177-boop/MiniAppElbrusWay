import { NextRequest } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { apiError, apiSuccess, resolveErrorMessage } from "@/lib/http";
import { createToolJob, listToolJobsForUser, queueToolJob } from "@/lib/tool-jobs";
import { getPreferredRouterModel } from "@/lib/routerai/models";
import { toolImageSchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  try {
    const user = await requireCurrentUser(request);
    const projectId = request.nextUrl.searchParams.get("projectId") || undefined;
    const jobs = await listToolJobsForUser({
      userId: user.id,
      projectId,
      jobTypePrefix: "image.",
      take: 20
    });
    const model = await getPreferredRouterModel({ forImageOutput: true });
    return apiSuccess({ jobs, setup: { ready: Boolean(model) } });
  } catch (error) {
    return apiError("IMAGE_LIST_FAILED", resolveErrorMessage(error), 400);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireCurrentUser(request);
    const body = await request.json().catch(() => ({}));
    const payload = toolImageSchema.parse(body);
    const model = await getPreferredRouterModel({ forImageOutput: true });
    if (!model) {
      return apiError("IMAGE_MODEL_UNAVAILABLE", "Генерация изображений сейчас недоступна", 400);
    }
    const job = await createToolJob({
      userId: user.id,
      projectId: payload.projectId,
      jobType: `image.${payload.mode}`,
      input: payload
    });

    queueToolJob(job.id);
    return apiSuccess({ job }, { status: 202 });
  } catch (error) {
    return apiError("IMAGE_GENERATE_FAILED", resolveErrorMessage(error), 400);
  }
}
