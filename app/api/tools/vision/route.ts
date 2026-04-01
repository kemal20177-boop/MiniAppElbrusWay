import { NextRequest } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { getFileForUser } from "@/lib/files";
import { apiError, apiSuccess, resolveErrorMessage } from "@/lib/http";
import { createToolJob, completeToolJob, failToolJob, listToolJobsForUser, startToolJob } from "@/lib/tool-jobs";
import { toolVisionSchema } from "@/lib/validators";

function buildVisionResult(mode: string, fileName: string, question?: string) {
  if (mode === "ocr") {
    return {
      summary: `OCR для ${fileName}`,
      blocks: ["Header", "Body", "Footer"],
      text: `Извлечённый текст из ${fileName}`
    };
  }

  if (mode === "chart-analysis") {
    return {
      summary: `Chart analysis для ${fileName}`,
      chartType: "bar",
      findings: ["Обнаружены категории", "Есть сравнительная динамика", "Стоит проверить шкалу"]
    };
  }

  if (mode === "screenshot-analysis") {
    return {
      summary: `Screenshot analysis для ${fileName}`,
      uiElements: ["header", "sidebar", "primary action"],
      issues: ["Проверить перегрузку интерфейса", "Уточнить иерархию CTA"]
    };
  }

  if (mode === "ask") {
    return {
      summary: `Ответ по изображению ${fileName}`,
      answer: question ? `Вопрос: ${question}\nОтвет: изображение содержит достаточный визуальный контекст для дальнейшего анализа.` : "Вопрос не передан."
    };
  }

  return {
    summary: `Описание изображения ${fileName}`,
    objects: ["foreground subject", "background context", "visual emphasis"]
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireCurrentUser(request);
    const projectId = request.nextUrl.searchParams.get("projectId") || undefined;
    const jobs = await listToolJobsForUser({
      userId: user.id,
      projectId,
      jobTypePrefix: "vision.",
      take: 20
    });
    return apiSuccess({ jobs });
  } catch (error) {
    return apiError("VISION_LIST_FAILED", resolveErrorMessage(error), 400);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireCurrentUser(request);
    const body = await request.json().catch(() => ({}));
    const payload = toolVisionSchema.parse(body);
    const file = await getFileForUser(user.id, payload.sourceFileId);
    if (!file) {
      return apiError("FILE_NOT_FOUND", "Файл не найден", 404);
    }

    const job = await createToolJob({
      userId: user.id,
      projectId: payload.projectId,
      jobType: `vision.${payload.mode}`,
      input: payload
    });
    await startToolJob(job.id);

    try {
      const result = buildVisionResult(payload.mode, file.originalName, payload.question);
      const completed = await completeToolJob({
        jobId: job.id,
        output: {
          fileId: file.id,
          result
        }
      });

      await writeAuditLog({
        action: "vision.run",
        actorId: user.id,
        entityType: "apiJob",
        entityId: completed.id,
        details: payload
      });

      return apiSuccess({ job: completed, result, file });
    } catch (error) {
      await failToolJob(job.id, resolveErrorMessage(error));
      throw error;
    }
  } catch (error) {
    return apiError("VISION_RUN_FAILED", resolveErrorMessage(error), 400);
  }
}
