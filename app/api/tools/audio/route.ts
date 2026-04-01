import { NextRequest } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { createArtifactFileForUser, getFileForUser } from "@/lib/files";
import { apiError, apiSuccess, resolveErrorMessage } from "@/lib/http";
import { createToolJob, completeToolJob, failToolJob, listToolJobsForUser, startToolJob } from "@/lib/tool-jobs";
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
    return apiSuccess({ jobs });
  } catch (error) {
    return apiError("AUDIO_LIST_FAILED", resolveErrorMessage(error), 400);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireCurrentUser(request);
    const body = await request.json().catch(() => ({}));
    const payload = toolAudioSchema.parse(body);
    const job = await createToolJob({
      userId: user.id,
      projectId: payload.projectId,
      jobType: `audio.${payload.mode}`,
      input: payload
    });

    await startToolJob(job.id);

    try {
      let artifact;
      let outputText = "";

      if (payload.mode === "transcription") {
        const file = await getFileForUser(user.id, payload.sourceFileId!);
        if (!file) {
          throw new Error("FILE_NOT_FOUND");
        }
        outputText = [
          `Транскрипция для ${file.originalName}.`,
          `Автоматический разбор файла ${file.mimeType}.`,
          file.extractedText ? file.extractedText.slice(0, 2000) : "Текстовое извлечение недоступно, нужен внешний ASR provider."
        ].join("\n\n");
        artifact = await createArtifactFileForUser({
          userId: user.id,
          projectId: payload.projectId,
          fileName: `transcription-${job.id}.txt`,
          mimeType: "text/plain",
          content: outputText
        });
      } else {
        outputText = payload.text || "";
        artifact = await createArtifactFileForUser({
          userId: user.id,
          projectId: payload.projectId,
          fileName: `tts-${job.id}.txt`,
          mimeType: "text/plain",
          content: `TTS request\nVoice: ${payload.voice || "default"}\n\n${outputText}`
        });
      }

      const completed = await completeToolJob({
        jobId: job.id,
        output: {
          fileId: artifact.id,
          text: outputText.slice(0, 2000),
          mode: payload.mode
        }
      });

      await writeAuditLog({
        action: payload.mode === "transcription" ? "audio.transcribe" : "audio.tts",
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
    return apiError("AUDIO_RUN_FAILED", resolveErrorMessage(error), 400);
  }
}
