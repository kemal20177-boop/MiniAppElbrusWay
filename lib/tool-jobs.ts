import "server-only";
import { JobStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { createArtifactFileForUser, getFileForUser } from "@/lib/files";
import { generateImageArtifact, generateVideoArtifact, runVisionProvider, synthesizeSpeechArtifact, transcribeAudioArtifact } from "@/lib/providers";
import { buildToolJobMeta, getToolJobMeta, shouldRetryJob } from "@/lib/tool-job-utils";
import { getPreferredRouterModel } from "@/lib/routerai/models";

const DEFAULT_TIMEOUT_MS = Number(process.env.TOOL_JOB_TIMEOUT_MS || 60000);

export async function createToolJob(params: {
  userId?: string;
  projectId?: string;
  jobType: string;
  input?: Record<string, unknown>;
}) {
  return prisma.apiJob.create({
    data: {
      userId: params.userId || null,
      projectId: params.projectId || null,
      jobType: params.jobType,
      status: JobStatus.PENDING,
      input: {
        ...(params.input || {}),
        __meta: buildToolJobMeta({})
      } as Prisma.InputJsonValue
    }
  });
}

export async function getToolJobForUser(jobId: string, userId: string) {
  return prisma.apiJob.findFirst({
    where: {
      id: jobId,
      userId
    }
  });
}

export async function cancelToolJobForUser(jobId: string, userId: string) {
  const job = await getToolJobForUser(jobId, userId);
  if (!job) {
    throw new Error("JOB_NOT_FOUND");
  }
  if (job.status === JobStatus.SUCCEEDED || job.status === JobStatus.FAILED) {
    throw new Error("JOB_ALREADY_FINISHED");
  }

  return prisma.apiJob.update({
    where: { id: jobId },
    data: {
      status: JobStatus.CANCELLED,
      errorMessage: "Cancelled by user",
      completedAt: new Date()
    }
  });
}

export async function retryToolJobForUser(jobId: string, userId: string) {
  const job = await getToolJobForUser(jobId, userId);
  if (!job) {
    throw new Error("JOB_NOT_FOUND");
  }
  const meta = getToolJobMeta((job.input || {}) as Record<string, unknown>);

  const updated = await prisma.apiJob.update({
    where: { id: jobId },
    data: {
      status: JobStatus.PENDING,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
      input: {
        ...((job.input || {}) as Record<string, unknown>),
        __meta: buildToolJobMeta({
          attemptCount: meta.attemptCount,
          maxAttempts: meta.maxAttempts
        })
      } as Prisma.InputJsonValue
    }
  });

  queueToolJob(updated.id);
  return updated;
}

export async function startToolJob(jobId: string) {
  const job = await prisma.apiJob.findUnique({ where: { id: jobId } });
  if (!job) {
    throw new Error("JOB_NOT_FOUND");
  }
  const meta = getToolJobMeta((job.input || {}) as Record<string, unknown>);
  return prisma.apiJob.update({
    where: { id: jobId },
    data: {
      status: JobStatus.RUNNING,
      startedAt: new Date(),
      input: {
        ...((job.input || {}) as Record<string, unknown>),
        __meta: buildToolJobMeta({
          attemptCount: meta.attemptCount + 1,
          maxAttempts: meta.maxAttempts
        })
      } as Prisma.InputJsonValue
    }
  });
}

export async function completeToolJob(params: {
  jobId: string;
  output?: Record<string, unknown>;
}) {
  return prisma.apiJob.update({
    where: { id: params.jobId },
    data: {
      status: JobStatus.SUCCEEDED,
      output: (params.output || undefined) as Prisma.InputJsonValue | undefined,
      completedAt: new Date()
    }
  });
}

export async function failToolJob(jobId: string, errorMessage: string) {
  return prisma.apiJob.update({
    where: { id: jobId },
    data: {
      status: JobStatus.FAILED,
      errorMessage,
      completedAt: new Date()
    }
  });
}

async function requeueToolJob(jobId: string, input: Record<string, unknown>, errorMessage: string) {
  const meta = getToolJobMeta(input);
  await prisma.apiJob.update({
    where: { id: jobId },
    data: {
      status: JobStatus.PENDING,
      errorMessage,
      startedAt: null,
      completedAt: null,
      input: {
        ...input,
        __meta: buildToolJobMeta({
          attemptCount: meta.attemptCount,
          maxAttempts: meta.maxAttempts
        })
      } as Prisma.InputJsonValue
    }
  });
  queueToolJob(jobId);
}

export async function listToolJobsForUser(params: {
  userId: string;
  jobTypePrefix?: string;
  projectId?: string;
  take?: number;
}) {
  return prisma.apiJob.findMany({
    where: {
      userId: params.userId,
      ...(params.projectId ? { projectId: params.projectId } : {}),
      ...(params.jobTypePrefix ? { jobType: { startsWith: params.jobTypePrefix } } : {})
    },
    orderBy: { createdAt: "desc" },
    take: params.take || 30
  });
}

async function persistToolArtifact(params: {
  userId: string;
  projectId?: string | null;
  fileName: string;
  mimeType: string;
  content: string | Buffer;
  metadata?: Record<string, unknown>;
}) {
  const file = await createArtifactFileForUser({
    userId: params.userId,
    projectId: params.projectId || undefined,
    fileName: params.fileName,
    mimeType: params.mimeType,
    content: params.content
  });

  if (params.metadata) {
    await prisma.userFile.update({
      where: { id: file.id },
      data: {
        metadata: {
          ...((file.metadata || {}) as Record<string, unknown>),
          artifact: params.metadata
        } as Prisma.InputJsonValue
      }
    });
  }

  return file;
}

async function withTimeout<T>(task: Promise<T>, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return await Promise.race([
    task,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("TOOL_JOB_TIMEOUT")), timeoutMs);
    })
  ]);
}

async function executeJob(jobId: string) {
  const job = await prisma.apiJob.findUnique({ where: { id: jobId } });
  if (!job || !job.userId || job.status !== JobStatus.PENDING) {
    return;
  }

  const input = ((job.input || {}) as Record<string, unknown>) || {};
  const meta = getToolJobMeta(input);

  try {
    const started = await startToolJob(job.id);
    if (started.status === JobStatus.CANCELLED) {
      return;
    }
    let output: Record<string, unknown> = {};

    if (job.jobType.startsWith("image.")) {
      const model = await getPreferredRouterModel({ forImageOutput: true });
      if (!model) {
        throw new Error("ROUTERAI_IMAGE_MODEL_UNAVAILABLE");
      }
      const artifact = await withTimeout(generateImageArtifact({
        userId: job.userId,
        projectId: job.projectId || undefined,
        model: model.id,
        mode: String(input.mode || "text-to-image") as "text-to-image" | "image-to-image",
        prompt: String(input.prompt || ""),
        aspectRatio: String(input.aspectRatio || "1:1"),
        imageSize: typeof input.imageSize === "string" ? input.imageSize : undefined,
        sourceFileId: typeof input.sourceFileId === "string" ? input.sourceFileId : undefined,
        sourceHint: input.sourceFileId ? `sourceFileId=${String(input.sourceFileId)}` : undefined
      }));
      const file = await persistToolArtifact({
        userId: job.userId,
        projectId: job.projectId,
        fileName: `image-${job.id}.${artifact.mimeType.includes("svg") ? "svg" : artifact.mimeType.includes("png") ? "png" : "bin"}`,
        mimeType: artifact.mimeType,
        content: artifact.content,
        metadata: artifact.metadata
      });
      output = { fileId: file.id, previewUrl: file.previewUrl, provider: artifact.metadata.provider, model: model.id, attempts: meta.attemptCount + 1 };
      await writeAuditLog({ action: "image.generate", actorId: job.userId, entityType: "apiJob", entityId: job.id, details: output });
    } else if (job.jobType.startsWith("audio.transcription")) {
      const model = await getPreferredRouterModel({ forAudioInput: true });
      if (!model) {
        throw new Error("ROUTERAI_AUDIO_MODEL_UNAVAILABLE");
      }
      const sourceFile = input.sourceFileId ? await getFileForUser(job.userId, String(input.sourceFileId)) : null;
      if (!sourceFile) {
        throw new Error("FILE_NOT_FOUND");
      }
      const artifact = await withTimeout(transcribeAudioArtifact({
        userId: job.userId,
        projectId: job.projectId || undefined,
        sourceFileId: sourceFile.id,
        model: model.id
      }));
      const file = await persistToolArtifact({
        userId: job.userId,
        projectId: job.projectId,
        fileName: `transcription-${job.id}.txt`,
        mimeType: artifact.mimeType,
        content: artifact.content,
        metadata: artifact.metadata
      });
      output = { fileId: file.id, textPreview: String(artifact.content).slice(0, 600), model: model.id, attempts: meta.attemptCount + 1 };
      await writeAuditLog({ action: "audio.transcribe", actorId: job.userId, entityType: "apiJob", entityId: job.id, details: output });
    } else if (job.jobType.startsWith("audio.tts")) {
      const model = await getPreferredRouterModel({ forAudioOutput: true });
      if (!model) {
        throw new Error("ROUTERAI_TTS_MODEL_UNAVAILABLE");
      }
      const artifact = await withTimeout(synthesizeSpeechArtifact({
        userId: job.userId,
        projectId: job.projectId || undefined,
        text: String(input.text || ""),
        model: model.id,
        voice: typeof input.voice === "string" ? input.voice : undefined
      }));
      const file = await persistToolArtifact({
        userId: job.userId,
        projectId: job.projectId,
        fileName: `tts-${job.id}.${artifact.mimeType.includes("audio/") ? "mp3" : "txt"}`,
        mimeType: artifact.mimeType,
        content: artifact.content,
        metadata: artifact.metadata
      });
      output = { fileId: file.id, previewUrl: file.previewUrl, model: model.id, attempts: meta.attemptCount + 1 };
      await writeAuditLog({ action: "audio.tts", actorId: job.userId, entityType: "apiJob", entityId: job.id, details: output });
    } else if (job.jobType.startsWith("video.")) {
      const artifact = await withTimeout(generateVideoArtifact({
        mode: String(input.mode || "storyboard") as "storyboard" | "task",
        prompt: String(input.prompt || ""),
        durationSec: Number(input.durationSec || 15)
      }));
      const file = await persistToolArtifact({
        userId: job.userId,
        projectId: job.projectId,
        fileName: `video-${job.id}.${artifact.mimeType.includes("json") ? "json" : artifact.mimeType.includes("markdown") ? "md" : "bin"}`,
        mimeType: artifact.mimeType,
        content: artifact.content,
        metadata: artifact.metadata
      });
      output = { fileId: file.id, status: "done", provider: artifact.metadata.provider, attempts: meta.attemptCount + 1 };
      await writeAuditLog({ action: "video.create", actorId: job.userId, entityType: "apiJob", entityId: job.id, details: output });
    } else if (job.jobType.startsWith("vision.")) {
      const model = await getPreferredRouterModel({ forImageInput: true });
      if (!model) {
        throw new Error("ROUTERAI_VISION_MODEL_UNAVAILABLE");
      }
      const sourceFile = input.sourceFileId ? await getFileForUser(job.userId, String(input.sourceFileId)) : null;
      if (!sourceFile) {
        throw new Error("FILE_NOT_FOUND");
      }
      const result = await withTimeout(runVisionProvider({
        userId: job.userId,
        projectId: job.projectId || undefined,
        model: model.id,
        sourceFileId: sourceFile.id,
        mode: String(input.mode || "describe") as "ocr" | "describe" | "screenshot-analysis" | "chart-analysis" | "ask",
        fileName: sourceFile.originalName,
        extractedText: sourceFile.extractedText,
        question: typeof input.question === "string" ? input.question : undefined
      }));
      const file = await persistToolArtifact({
        userId: job.userId,
        projectId: job.projectId,
        fileName: `vision-${job.id}.json`,
        mimeType: "application/json",
        content: JSON.stringify(result.structured, null, 2),
        metadata: {
          provider: "router-text",
          sourceFileId: sourceFile.id
        }
      });
      output = { fileId: file.id, result: result.structured, model: model.id, attempts: meta.attemptCount + 1 };
      await writeAuditLog({ action: "vision.run", actorId: job.userId, entityType: "apiJob", entityId: job.id, details: output });
    } else {
      throw new Error("UNSUPPORTED_TOOL_JOB");
    }

    await completeToolJob({
      jobId: job.id,
      output
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "TOOL_JOB_FAILED";
    if (message === "JOB_CANCELLED") {
      await cancelToolJobForUser(job.id, job.userId);
      return;
    }
    if (shouldRetryJob({ attemptCount: meta.attemptCount + 1, maxAttempts: meta.maxAttempts, errorMessage: message })) {
      await requeueToolJob(job.id, input, message);
      return;
    }
    await failToolJob(job.id, message);
  }
}

export function queueToolJob(jobId: string) {
  setTimeout(() => {
    void executeJob(jobId);
  }, 20);
}
