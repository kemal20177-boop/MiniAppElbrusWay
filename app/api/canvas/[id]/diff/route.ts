import { NextRequest } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { getCanvasDiffForUser } from "@/lib/canvas";
import { apiError, apiSuccess, resolveErrorMessage } from "@/lib/http";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireCurrentUser(request);
    const fromVersion = Number(request.nextUrl.searchParams.get("from"));
    const toVersion = Number(request.nextUrl.searchParams.get("to"));

    if (!Number.isInteger(fromVersion) || !Number.isInteger(toVersion)) {
      return apiError("CANVAS_DIFF_INVALID", "Нужны query-параметры from и to", 400);
    }

    const diff = await getCanvasDiffForUser({
      userId: user.id,
      canvasId: params.id,
      fromVersion,
      toVersion
    });

    return apiSuccess({ diff });
  } catch (error) {
    const message = resolveErrorMessage(error);
    return apiError("CANVAS_DIFF_FAILED", message, message === "UNAUTHORIZED" ? 401 : message.includes("NOT_FOUND") ? 404 : 400);
  }
}
