import { NextRequest } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { createArtifactFileForUser } from "@/lib/files";
import { apiError, apiSuccess, resolveErrorMessage } from "@/lib/http";
import { createToolJob, completeToolJob, failToolJob, listToolJobsForUser, startToolJob } from "@/lib/tool-jobs";
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
    return apiSuccess({ jobs });
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

    await startToolJob(job.id);

    try {
      const content =
        payload.mode === "storyboard"
          ? `Storyboard prompt\n\nPrompt: ${payload.prompt}\nDuration: ${payload.durationSec}s\n\n1. Opening frame\n2. Product context\n3. Key action\n4. Closing CTA`
          : `Video task created\n\nPrompt: ${payload.prompt}\nDuration: ${payload.durationSec}s\nStatus: queued`;
      const artifact = await createArtifactFileForUser({
        userId: user.id,
        projectId: payload.projectId,
        fileName: `video-${payload.mode}-${job.id}.md`,
        mimeType: "text/markdown",
        content
      });
      const completed = await completeToolJob({
        jobId: job.id,
        output: {
          fileId: artifact.id,
          mode: payload.mode,
          status: "queued"
        }
      });

      await writeAuditLog({
        action: "video.create",
        actorId: user.id,
        entityType: "apiJob",
        entityId: completed.id,
        details: payload
      });

      return apiSuccess({ job: completed, file: artifact }, { status: 201 });
    } catch (error) {
      await failToolJob(job.id, resolveErrorMessage(error));
      throw error;
    }
  } catch (error) {
    return apiError("VIDEO_RUN_FAILED", resolveErrorMessage(error), 400);
  }
}
