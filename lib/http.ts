import { NextResponse } from "next/server";

export type ApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; details?: unknown } };

export function apiSuccess<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiEnvelope<T>>({ ok: true, data }, init);
}

export function apiError(code: string, message: string, status = 400, details?: unknown) {
  return NextResponse.json<ApiEnvelope<never>>(
    {
      ok: false,
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {})
      }
    },
    { status }
  );
}

export function resolveErrorMessage(error: unknown, fallback = "UNEXPECTED_ERROR") {
  return error instanceof Error ? error.message : fallback;
}
