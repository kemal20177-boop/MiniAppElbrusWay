import { JobStatus } from "@prisma/client";

export type ToolJobMeta = {
  attemptCount: number;
  maxAttempts: number;
  lastQueuedAt?: string;
};

export function getToolJobMeta(input: Record<string, unknown> | null | undefined): ToolJobMeta {
  const nested = input && typeof input.__meta === "object" && input.__meta ? (input.__meta as Record<string, unknown>) : {};
  return {
    attemptCount: Number(nested.attemptCount || 0),
    maxAttempts: Number(nested.maxAttempts || process.env.TOOL_JOB_MAX_ATTEMPTS || 2),
    lastQueuedAt: typeof nested.lastQueuedAt === "string" ? nested.lastQueuedAt : undefined
  };
}

export function buildToolJobMeta(meta: Partial<ToolJobMeta>) {
  return {
    attemptCount: meta.attemptCount ?? 0,
    maxAttempts: meta.maxAttempts ?? Number(process.env.TOOL_JOB_MAX_ATTEMPTS || 2),
    lastQueuedAt: meta.lastQueuedAt ?? new Date().toISOString()
  };
}

export function isTerminalJobStatus(status: JobStatus) {
  return status === JobStatus.SUCCEEDED || status === JobStatus.FAILED || status === JobStatus.CANCELLED;
}

export function shouldRetryJob(params: { attemptCount: number; maxAttempts: number; errorMessage: string }) {
  const retryable = !/FILE_NOT_FOUND|UNSUPPORTED_TOOL_JOB|PROVIDER_NOT_CONFIGURED/.test(params.errorMessage);
  return retryable && params.attemptCount < params.maxAttempts;
}
