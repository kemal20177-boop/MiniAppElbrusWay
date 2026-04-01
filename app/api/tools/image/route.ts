import { NextRequest } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { createArtifactFileForUser } from "@/lib/files";
import { apiError, apiSuccess, resolveErrorMessage } from "@/lib/http";
import { createToolJob, completeToolJob, failToolJob, listToolJobsForUser, startToolJob } from "@/lib/tool-jobs";
import { toolImageSchema } from "@/lib/validators";

function buildSvg(prompt: string, aspectRatio: string) {
  const [w, h] = aspectRatio === "16:9" ? [1280, 720] : aspectRatio === "9:16" ? [720, 1280] : aspectRatio === "4:3" ? [1200, 900] : [1024, 1024];
  const safePrompt = prompt.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#102133"/>
      <stop offset="100%" stop-color="#f97316"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <circle cx="${Math.round(w * 0.72)}" cy="${Math.round(h * 0.28)}" r="${Math.round(Math.min(w, h) * 0.12)}" fill="rgba(255,255,255,0.18)"/>
  <text x="64" y="120" fill="white" font-size="42" font-family="sans-serif">ElbrusWay AI</text>
  <foreignObject x="64" y="180" width="${w - 128}" height="${h - 220}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:sans-serif;color:white;font-size:28px;line-height:1.35;">
      <p><strong>Generated concept</strong></p>
      <p>${safePrompt}</p>
    </div>
  </foreignObject>
</svg>`;
}

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
    return apiSuccess({ jobs });
  } catch (error) {
    return apiError("IMAGE_LIST_FAILED", resolveErrorMessage(error), 400);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireCurrentUser(request);
    const body = await request.json().catch(() => ({}));
    const payload = toolImageSchema.parse(body);
    const job = await createToolJob({
      userId: user.id,
      projectId: payload.projectId,
      jobType: `image.${payload.mode}`,
      input: payload
    });

    await startToolJob(job.id);

    try {
      const artifact = await createArtifactFileForUser({
        userId: user.id,
        projectId: payload.projectId,
        fileName: `${payload.mode}-${job.id}.svg`,
        mimeType: "image/svg+xml",
        content: buildSvg(payload.prompt, payload.aspectRatio)
      });
      const completed = await completeToolJob({
        jobId: job.id,
        output: {
          fileId: artifact.id,
          projectId: payload.projectId || null,
          mode: payload.mode
        }
      });

      await writeAuditLog({
        action: "image.generate",
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
    return apiError("IMAGE_GENERATE_FAILED", resolveErrorMessage(error), 400);
  }
}
