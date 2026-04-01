import { NextRequest } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { apiError, apiSuccess, resolveErrorMessage } from "@/lib/http";
import { createToolJob, listToolJobsForUser, queueToolJob } from "@/lib/tool-jobs";
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
    return apiSuccess({ jobs });
  } catch (error) {
    return apiError("VISION_LIST_FAILED", resolveErrorMessage(error), 400);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireCurrentUser(request);
    const body = await request.json().catch(() => ({}));
    const payload = toolVisionSchema.parse(body);
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
