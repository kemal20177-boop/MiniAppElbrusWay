import { NextRequest } from "next/server";
import { DocumentExportFormat } from "@prisma/client";
import { requireCurrentUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { exportDocumentForUser } from "@/lib/documents";
import { apiError, apiSuccess, resolveErrorMessage } from "@/lib/http";
import { documentExportSchema } from "@/lib/validators";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireCurrentUser(request);
    const body = await request.json().catch(() => ({}));
    const payload = documentExportSchema.parse(body);
    const result = await exportDocumentForUser({
      userId: user.id,
      documentId: params.id,
      format: payload.format as DocumentExportFormat
    });

    await writeAuditLog({
      action: "document.export",
      actorId: user.id,
      entityType: "document",
      entityId: params.id,
      details: {
        format: payload.format
      }
    });

    return apiSuccess({
      export: result.exportRecord,
      downloadPath: result.absolutePath
    });
  } catch (error) {
    const message = resolveErrorMessage(error);
    return apiError("DOCUMENT_EXPORT_FAILED", message, message === "UNAUTHORIZED" ? 401 : message === "DOCUMENT_NOT_FOUND" ? 404 : 400);
  }
}
