import "server-only";
import { runTextProvider } from "@/lib/providers/router-text";

export async function runVisionProvider(params: {
  mode: "ocr" | "describe" | "screenshot-analysis" | "chart-analysis" | "ask";
  fileName: string;
  extractedText?: string | null;
  question?: string;
}) {
  const response = await runTextProvider({
    system: "Ты vision analysis assistant. Отвечай структурированно, коротко и полезно для workspace.",
    prompt: [
      `Mode: ${params.mode}`,
      `File: ${params.fileName}`,
      params.question ? `Question: ${params.question}` : null,
      params.extractedText ? `Available OCR/content:\n${params.extractedText.slice(0, 5000)}` : "No extracted text available."
    ].filter(Boolean).join("\n\n"),
    maxTokens: 900
  });

  const text = response.text || "";
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
