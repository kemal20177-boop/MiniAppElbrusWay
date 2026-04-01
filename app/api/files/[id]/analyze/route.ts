import { NextRequest } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { analyzeFileForUser } from "@/lib/files";
import { apiError, apiSuccess, resolveErrorMessage } from "@/lib/http";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireCurrentUser(request);
    const analysis = await analyzeFileForUser(user.id, params.id);

    await writeAuditLog({
      action: "file.analyze",
      actorId: user.id,
      entityType: "file",
      entityId: params.id,
      details: {
        mode: "summary"
      }
    });

    return apiSuccess({ analysis });
  } catch (error) {
    const message = resolveErrorMessage(error);
    return apiError("FILE_ANALYZE_FAILED", message, message === "UNAUTHORIZED" ? 401 : message === "FILE_NOT_FOUND" ? 404 : 400);
  }
}
