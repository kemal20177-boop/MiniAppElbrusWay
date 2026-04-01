import "server-only";
import { createRouterChatCompletion } from "@/lib/routerai/chat";
import { toRouterContentPartForFile } from "@/lib/routerai/files";

export async function runVisionProvider(params: {
  userId: string;
  projectId?: string;
  model: string;
  sourceFileId: string;
  mode: "ocr" | "describe" | "screenshot-analysis" | "chart-analysis" | "ask";
  fileName: string;
  extractedText?: string | null;
  question?: string;
}) {
  const promptByMode = {
    ocr: "Выполни OCR. Верни краткое summary и блоки текста.",
    describe: "Опиши изображение для workspace. Верни summary и answer.",
    "screenshot-analysis": "Проанализируй скриншот интерфейса и ключевые проблемы.",
    "chart-analysis": "Проанализируй график и верни summary и findings.",
    ask: `Ответь на вопрос по изображению: ${params.question || ""}`
  } as const;

  const completion = await createRouterChatCompletion({
    userId: params.userId,
    projectId: params.projectId,
    model: params.model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: promptByMode[params.mode] },
          await toRouterContentPartForFile(params.userId, params.sourceFileId)
        ]
      }
    ]
  });
  const text = completion.choices?.[0]?.message?.content || "";
  return {
    text,
    structured:
      params.mode === "chart-analysis"
        ? {
            summary: text,
            findings: text.split("\n").filter(Boolean).slice(0, 6)
          }
        : params.mode === "ocr"
          ? {
              summary: text,
              blocks: text.split("\n").filter(Boolean).slice(0, 10)
            }
          : {
              summary: text,
            answer: text
            }
  };
}
