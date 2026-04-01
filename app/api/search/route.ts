import { NextRequest } from "next/server";
import { SearchDepth } from "@prisma/client";
import { requireCurrentUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { apiError, apiSuccess, buildPaginationMeta, resolveErrorMessage } from "@/lib/http";
import { listSearchSessionsForUser, runWebSearch } from "@/lib/search";
import { searchSessionCreateSchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  try {
    const user = await requireCurrentUser(request);
    const projectId = request.nextUrl.searchParams.get("projectId") || undefined;
    const sessions = await listSearchSessionsForUser(user.id, projectId);
    return apiSuccess({ sessions }, undefined, buildPaginationMeta({ page: 1, pageSize: sessions.length || 1, total: sessions.length }));
  } catch (error) {
    const message = resolveErrorMessage(error);
    return apiError(message, message === "UNAUTHORIZED" ? "Требуется авторизация" : message, message === "UNAUTHORIZED" ? 401 : 400);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireCurrentUser(request);
    const body = await request.json().catch(() => ({}));
    const payload = searchSessionCreateSchema.parse(body);
    const session = await runWebSearch({
      userId: user.id,
      projectId: payload.projectId,
      chatId: payload.chatId,
      sessionId: payload.sessionId,
      query: payload.query,
      latestOnly: payload.latestOnly,
      depth: payload.depth as SearchDepth
    });

    await writeAuditLog({
      action: "search.run",
      actorId: user.id,
      entityType: "searchSession",
      entityId: session.id,
      details: {
        query: payload.query,
        depth: payload.depth,
        sessionId: payload.sessionId || null
      }
    });

    return apiSuccess({ session }, { status: 201 });
  } catch (error) {
    const message = resolveErrorMessage(error);
    return apiError("SEARCH_RUN_FAILED", message, message === "UNAUTHORIZED" ? 401 : 400);
  }
}
