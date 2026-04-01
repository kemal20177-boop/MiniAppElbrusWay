import { NextResponse } from "next/server";

export type ApiEnvelope<T> =
  | { ok: true; data: T; meta?: Record<string, unknown> }
  | { ok: false; error: { code: string; message: string; details?: unknown }; meta?: Record<string, unknown> };

export function apiSuccess<T>(data: T, init?: ResponseInit, meta?: Record<string, unknown>) {
  return NextResponse.json<ApiEnvelope<T>>({ ok: true, data, ...(meta ? { meta } : {}) }, init);
}

export function apiError(code: string, message: string, status = 400, details?: unknown, meta?: Record<string, unknown>) {
  return NextResponse.json<ApiEnvelope<never>>(
    {
      ok: false,
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {})
      },
      ...(meta ? { meta } : {})
    },
    { status }
  );
}

export function resolveErrorMessage(error: unknown, fallback = "UNEXPECTED_ERROR") {
  return error instanceof Error ? error.message : fallback;
}

export function buildPaginationMeta(params: {
  page: number;
  pageSize: number;
  total: number;
}) {
  return {
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total: params.total,
      totalPages: Math.max(1, Math.ceil(params.total / params.pageSize))
    }
  };
}
