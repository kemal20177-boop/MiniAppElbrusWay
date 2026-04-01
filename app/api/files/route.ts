import { NextRequest } from "next/server";
import { FileKind, FileStatus } from "@prisma/client";
import { requireCurrentUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { getFileStatsForUser, listFilesForUser, uploadManyUserFiles, uploadUserFile } from "@/lib/files";
import { apiError, apiSuccess, buildPaginationMeta, resolveErrorMessage } from "@/lib/http";
import { fileListQuerySchema, multiUploadSchema } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await requireCurrentUser(request);
    const query = fileListQuerySchema.parse({
      projectId: request.nextUrl.searchParams.get("projectId") || undefined,
      query: request.nextUrl.searchParams.get("query") || undefined,
      kind: request.nextUrl.searchParams.get("kind") || undefined,
      status: request.nextUrl.searchParams.get("status") || undefined
    });
    const [files, stats] = await Promise.all([
      listFilesForUser(user.id, {
        projectId: query.projectId,
        ...(query.query ? { query: query.query } : {}),
        ...(query.kind ? { kind: query.kind as FileKind } : {}),
        ...(query.status ? { status: query.status as FileStatus } : {})
      }),
      getFileStatsForUser(user.id)
    ]);

    return apiSuccess({ files, stats }, undefined, buildPaginationMeta({ page: 1, pageSize: files.length || 1, total: files.length }));
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
    const uploads = formData.getAll("files").filter((entry): entry is File => entry instanceof File);
    const projectId = typeof formData.get("projectId") === "string" ? String(formData.get("projectId")) : undefined;
    const linkedChatId = typeof formData.get("chatId") === "string" ? String(formData.get("chatId")) : undefined;

    if (!(upload instanceof File) && uploads.length === 0) {
      return apiError("FILE_REQUIRED", "Нужно передать файл", 400);
    }

    if (uploads.length > 0) {
      const payload = multiUploadSchema.parse({
        projectId,
        files: uploads.map((file) => ({
          name: file.name,
          size: file.size,
          type: file.type
        }))
      });
      const result = await uploadManyUserFiles({
        userId: user.id,
        files: uploads,
        projectId: payload.projectId
      });

      await writeAuditLog({
        action: "file.multi-upload",
        actorId: user.id,
        entityType: "file",
        details: {
          projectId: payload.projectId || null,
          chatId: linkedChatId || null,
          uploaded: result.uploaded.length,
          failed: result.errors.length
        }
      });

      return apiSuccess(
        {
          files: result.uploaded,
          errors: result.errors
        },
        { status: 201 }
      );
    }

    const file = await uploadUserFile({
      userId: user.id,
      file: upload as File,
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
        projectId: projectId || null,
        chatId: linkedChatId || null
      }
    });

    return apiSuccess({ file }, { status: 201 });
  } catch (error) {
    const message = resolveErrorMessage(error);
    return apiError("FILE_UPLOAD_FAILED", message, message === "UNAUTHORIZED" ? 401 : 400);
  }
}
