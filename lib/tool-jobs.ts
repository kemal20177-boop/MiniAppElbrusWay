import "server-only";
import { JobStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { createArtifactFileForUser, getFileForUser } from "@/lib/files";
import { generateImageArtifact, generateVideoArtifact, runVisionProvider, synthesizeSpeechArtifact, transcribeAudioArtifact } from "@/lib/providers";

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
      input: (params.input || undefined) as Prisma.InputJsonValue | undefined
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

export async function startToolJob(jobId: string) {
  return prisma.apiJob.update({
    where: { id: jobId },
    data: {
      status: JobStatus.RUNNING,
      startedAt: new Date()
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

async function executeJob(jobId: string) {
  const job = await prisma.apiJob.findUnique({ where: { id: jobId } });
  if (!job || !job.userId || job.status !== JobStatus.PENDING) {
    return;
  }

  const input = ((job.input || {}) as Record<string, unknown>) || {};

  try {
    await startToolJob(job.id);
    let output: Record<string, unknown> = {};

    if (job.jobType.startsWith("image.")) {
      const artifact = await generateImageArtifact({
        mode: String(input.mode || "text-to-image") as "text-to-image" | "image-to-image",
        prompt: String(input.prompt || ""),
        aspectRatio: String(input.aspectRatio || "1:1"),
        sourceHint: input.sourceFileId ? `sourceFileId=${String(input.sourceFileId)}` : undefined
      });
      const file = await persistToolArtifact({
        userId: job.userId,
        projectId: job.projectId,
        fileName: `image-${job.id}.svg`,
        mimeType: artifact.mimeType,
        content: artifact.content,
        metadata: artifact.metadata
      });
      output = { fileId: file.id, previewUrl: file.previewUrl, provider: artifact.metadata.provider };
      await writeAuditLog({ action: "image.generate", actorId: job.userId, entityType: "apiJob", entityId: job.id, details: output });
    } else if (job.jobType.startsWith("audio.transcription")) {
      const sourceFile = input.sourceFileId ? await getFileForUser(job.userId, String(input.sourceFileId)) : null;
      if (!sourceFile) {
        throw new Error("FILE_NOT_FOUND");
      }
      const artifact = await transcribeAudioArtifact({
        fileName: sourceFile.originalName,
        extractedText: sourceFile.extractedText,
        mimeType: sourceFile.mimeType
      });
      const file = await persistToolArtifact({
        userId: job.userId,
        projectId: job.projectId,
        fileName: `transcription-${job.id}.txt`,
        mimeType: artifact.mimeType,
        content: artifact.content,
        metadata: artifact.metadata
      });
      output = { fileId: file.id, textPreview: String(artifact.content).slice(0, 600) };
      await writeAuditLog({ action: "audio.transcribe", actorId: job.userId, entityType: "apiJob", entityId: job.id, details: output });
    } else if (job.jobType.startsWith("audio.tts")) {
      const artifact = await synthesizeSpeechArtifact({
        text: String(input.text || ""),
        voice: typeof input.voice === "string" ? input.voice : undefined
      });
      const file = await persistToolArtifact({
        userId: job.userId,
        projectId: job.projectId,
        fileName: `tts-${job.id}.txt`,
        mimeType: artifact.mimeType,
        content: artifact.content,
        metadata: artifact.metadata
      });
      output = { fileId: file.id, textPreview: String(artifact.content).slice(0, 600) };
      await writeAuditLog({ action: "audio.tts", actorId: job.userId, entityType: "apiJob", entityId: job.id, details: output });
    } else if (job.jobType.startsWith("video.")) {
      const artifact = await generateVideoArtifact({
        mode: String(input.mode || "storyboard") as "storyboard" | "task",
        prompt: String(input.prompt || ""),
        durationSec: Number(input.durationSec || 15)
      });
      const file = await persistToolArtifact({
        userId: job.userId,
        projectId: job.projectId,
        fileName: `video-${job.id}.md`,
        mimeType: artifact.mimeType,
        content: artifact.content,
        metadata: artifact.metadata
      });
      output = { fileId: file.id, status: "queued", provider: artifact.metadata.provider };
      await writeAuditLog({ action: "video.create", actorId: job.userId, entityType: "apiJob", entityId: job.id, details: output });
    } else if (job.jobType.startsWith("vision.")) {
      const sourceFile = input.sourceFileId ? await getFileForUser(job.userId, String(input.sourceFileId)) : null;
      if (!sourceFile) {
        throw new Error("FILE_NOT_FOUND");
      }
      const result = await runVisionProvider({
        mode: String(input.mode || "describe") as "ocr" | "describe" | "screenshot-analysis" | "chart-analysis" | "ask",
        fileName: sourceFile.originalName,
        extractedText: sourceFile.extractedText,
        question: typeof input.question === "string" ? input.question : undefined
      });
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
      output = { fileId: file.id, result: result.structured };
      await writeAuditLog({ action: "vision.run", actorId: job.userId, entityType: "apiJob", entityId: job.id, details: output });
    } else {
      throw new Error("UNSUPPORTED_TOOL_JOB");
    }

    await completeToolJob({
      jobId: job.id,
      output
    });
  } catch (error) {
    await failToolJob(job.id, error instanceof Error ? error.message : "TOOL_JOB_FAILED");
  }
}

export function queueToolJob(jobId: string) {
  setTimeout(() => {
    void executeJob(jobId);
  }, 20);
}
