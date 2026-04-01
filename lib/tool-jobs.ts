import "server-only";
import { JobStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

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
