import { NextRequest } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { apiError, apiSuccess, resolveErrorMessage } from "@/lib/http";
import { createToolJob, listToolJobsForUser, queueToolJob } from "@/lib/tool-jobs";
import { getPreferredRouterModel } from "@/lib/routerai/models";
import { toolAudioSchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  try {
    const user = await requireCurrentUser(request);
    const projectId = request.nextUrl.searchParams.get("projectId") || undefined;
    const jobs = await listToolJobsForUser({
      userId: user.id,
      projectId,
      jobTypePrefix: "audio.",
      take: 20
    });
    const transcriptionModel = await getPreferredRouterModel({ forAudioInput: true });
    const ttsModel = await getPreferredRouterModel({ forAudioOutput: true });
    return apiSuccess({ jobs, capability: { transcription: transcriptionModel?.id || null, tts: ttsModel?.id || null } });
  } catch (error) {
    return apiError("AUDIO_LIST_FAILED", resolveErrorMessage(error), 400);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireCurrentUser(request);
    const body = await request.json().catch(() => ({}));
    const payload = toolAudioSchema.parse(body);
    const model =
      payload.mode === "transcription"
        ? await getPreferredRouterModel({ forAudioInput: true })
        : await getPreferredRouterModel({ forAudioOutput: true });
    if (!model) {
      return apiError("AUDIO_MODEL_UNAVAILABLE", payload.mode === "tts" ? "TTS capability недоступен в live catalog RouterAI" : "Audio transcription capability недоступен в live catalog RouterAI", 400);
    }
    const job = await createToolJob({
      userId: user.id,
      projectId: payload.projectId,
      jobType: `audio.${payload.mode}`,
      input: payload
    });

    queueToolJob(job.id);
    return apiSuccess({ job, modelId: model.id }, { status: 202 });
  } catch (error) {
    return apiError("AUDIO_RUN_FAILED", resolveErrorMessage(error), 400);
  }
}
