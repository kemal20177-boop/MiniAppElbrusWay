import { NextRequest } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { getFileStatsForUser, listFilesForUser, uploadUserFile } from "@/lib/files";
import { apiError, apiSuccess, resolveErrorMessage } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await requireCurrentUser(request);
    const projectId = request.nextUrl.searchParams.get("projectId") || undefined;
    const [files, stats] = await Promise.all([
      listFilesForUser(user.id, { projectId }),
      getFileStatsForUser(user.id)
    ]);

    return apiSuccess({ files, stats });
  } catch (error) {
    const message = resolveErrorMessage(error);
    return apiError(message, message === "UNAUTHORIZED" ? "Требуется авторизация" : message, message === "UNAUTHORIZED" ? 401 : 400);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireCurrentUser(request);
    const formData = await request.formData();
    const upload = formData.get("file");
    const projectId = typeof formData.get("projectId") === "string" ? String(formData.get("projectId")) : undefined;

    if (!(upload instanceof File)) {
      return apiError("FILE_REQUIRED", "Нужно передать файл", 400);
    }

    const file = await uploadUserFile({
      userId: user.id,
      file: upload,
      projectId
    });

    await writeAuditLog({
      action: "file.upload",
      actorId: user.id,
      entityType: "file",
      entityId: file.id,
      details: {
        originalName: file.originalName,
        sizeBytes: file.sizeBytes,
        projectId: projectId || null
      }
    });

    return apiSuccess({ file }, { status: 201 });
  } catch (error) {
    const message = resolveErrorMessage(error);
    return apiError("FILE_UPLOAD_FAILED", message, message === "UNAUTHORIZED" ? 401 : 400);
  }
}
