import { NextRequest } from "next/server";
import { createArtifactFileForUser } from "@/lib/files";
import { requireCurrentUser } from "@/lib/auth";
import { apiError, apiSuccess, resolveErrorMessage } from "@/lib/http";
import { createToolJob, listToolJobsForUser, queueToolJob } from "@/lib/tool-jobs";
import { videoModels } from "@/lib/site";
import { toolVideoSchema } from "@/lib/validators";

function extractVideoUrl(payload: Record<string, unknown>) {
  const choices = Array.isArray(payload.choices) ? (payload.choices as Array<Record<string, unknown>>) : [];
  const message = (choices[0]?.message || {}) as Record<string, unknown>;
  const content = message.content;
  const directVideo = (message.video || {}) as Record<string, unknown>;

  if (typeof directVideo.url === "string" && directVideo.url) {
    return directVideo.url;
  }

  if (typeof content === "string" && /^https?:\/\//.test(content)) {
    return content;
  }

  if (Array.isArray(content)) {
    for (const part of content as Array<Record<string, unknown>>) {
      if (typeof part?.url === "string" && /^https?:\/\//.test(part.url)) {
        return part.url;
      }
      const nestedVideo = (part?.video || {}) as Record<string, unknown>;
      if (typeof nestedVideo.url === "string" && nestedVideo.url) {
        return nestedVideo.url;
      }
    }
  }

  return null;
}

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

    return apiSuccess({
      jobs,
      setup: {
        mode: "generate",
        videoGenerationReady: true,
        models: videoModels
      }
    });
  } catch (error) {
    return apiError("VIDEO_LIST_FAILED", resolveErrorMessage(error), 400);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireCurrentUser(request);
    const body = await request.json().catch(() => ({}));
    const payload = toolVideoSchema.parse(body);

    if (payload.mode === "generate") {
      const response = await fetch(`${process.env.ROUTERAI_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.ROUTERAI_API_KEY}`
        },
        body: JSON.stringify({
          model: payload.model || "minimax/video-01",
          messages: [{ role: "user", content: payload.prompt }],
          modalities: ["video", "text"]
        })
      });

      const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (!response.ok) {
        return apiError("VIDEO_GENERATION_FAILED", String(data.message || data.error || "RouterAI video request failed"), 400);
      }

      const videoUrl = extractVideoUrl(data);
      let file;

      if (videoUrl) {
        try {
          const videoResponse = await fetch(videoUrl);
          if (!videoResponse.ok) throw new Error("VIDEO_DOWNLOAD_FAILED");
          const arrayBuffer = await videoResponse.arrayBuffer();
          const mimeType = videoResponse.headers.get("content-type") || "video/mp4";
          const extension = mimeType.includes("webm") ? "webm" : mimeType.includes("quicktime") ? "mov" : "mp4";
          file = await createArtifactFileForUser({
            userId: user.id,
            projectId: payload.projectId,
            fileName: `video-${Date.now()}.${extension}`,
            mimeType,
            content: Buffer.from(arrayBuffer)
          });
        } catch {
          file = await createArtifactFileForUser({
            userId: user.id,
            projectId: payload.projectId,
            fileName: `video-${Date.now()}.txt`,
            mimeType: "text/plain",
            content: videoUrl
          });
        }
      } else {
        file = await createArtifactFileForUser({
          userId: user.id,
          projectId: payload.projectId,
          fileName: `video-${Date.now()}.json`,
          mimeType: "application/json",
          content: JSON.stringify(data, null, 2)
        });
      }

      return apiSuccess({
        file,
        videoUrl,
        model: payload.model || "minimax/video-01"
      });
    }

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
