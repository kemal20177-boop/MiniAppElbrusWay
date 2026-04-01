import { NextRequest } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { apiError, apiSuccess, resolveErrorMessage } from "@/lib/http";
import { createToolJob, listToolJobsForUser, queueToolJob } from "@/lib/tool-jobs";
import { getPreferredRouterModel } from "@/lib/routerai/models";
import { toolVideoSchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  try {
    const user = await requireCurrentUser(request);
    const projectId = request.nextUrl.searchParams.get("projectId") || undefined;
    const jobs = await listToolJobsForUser({
      userId: user.id,
      projectId,
      jobTypePrefix: "video.",
      take: 20
    });
    const model = await getPreferredRouterModel({ forVideoInput: true });
    return apiSuccess({ jobs, capability: { videoAnalysis: model?.id || null, generation: false, beta: true } });
  } catch (error) {
    return apiError("VIDEO_LIST_FAILED", resolveErrorMessage(error), 400);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireCurrentUser(request);
    const body = await request.json().catch(() => ({}));
    const payload = toolVideoSchema.parse(body);
    const job = await createToolJob({
      userId: user.id,
      projectId: payload.projectId,
      jobType: `video.${payload.mode}`,
      input: payload
    });

    queueToolJob(job.id);
    return apiSuccess({ job }, { status: 202 });
  } catch (error) {
    return apiError("VIDEO_RUN_FAILED", resolveErrorMessage(error), 400);
  }
}
