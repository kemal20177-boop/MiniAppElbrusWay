import "server-only";
import { runTextProvider } from "@/lib/providers/router-text";
import { callExternalProvider, isProviderConfigured } from "@/lib/providers/shared";

export async function runVisionProvider(params: {
  mode: "ocr" | "describe" | "screenshot-analysis" | "chart-analysis" | "ask";
  fileName: string;
  extractedText?: string | null;
  question?: string;
}) {
  if (isProviderConfigured("VISION_PROVIDER_BASE_URL", "VISION_PROVIDER_API_KEY")) {
    const payload = await callExternalProvider({
      apiKeyEnv: "VISION_PROVIDER_API_KEY",
      baseUrlEnv: "VISION_PROVIDER_BASE_URL",
      path: "/analyze",
      payload: {
        mode: params.mode,
        fileName: params.fileName,
        extractedText: params.extractedText || null,
        question: params.question || null,
        model: process.env.VISION_PROVIDER_MODEL || null
      }
    });

    const structured = (payload.metadata?.structured || {}) as Record<string, unknown>;
    const text =
      typeof payload.text === "string"
        ? payload.text
        : typeof structured.summary === "string"
          ? structured.summary
          : "";

    return {
      text,
      structured: Object.keys(structured).length
        ? structured
        : {
            summary: text || "Vision result available.",
            answer: text || "Vision result available."
          }
    };
  }

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
