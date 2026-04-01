import "server-only";
import { runTextProvider } from "@/lib/providers/router-text";

export async function transcribeAudioArtifact(params: {
  fileName: string;
  extractedText?: string | null;
  mimeType: string;
}) {
  const response = await runTextProvider({
    system: "Ты транскрибируешь аудио по доступному контексту. Верни чистую транскрипцию и краткое summary.",
    prompt: [
      `File: ${params.fileName}`,
      `Mime: ${params.mimeType}`,
      params.extractedText ? `Available extraction:\n${params.extractedText.slice(0, 4000)}` : "No extracted text available."
    ].join("\n\n"),
    maxTokens: 800
  });

  return {
    mimeType: "text/plain",
    content: response.text || `Transcription unavailable for ${params.fileName}`,
    metadata: {
      provider: "router-text"
    }
  };
}

export async function synthesizeSpeechArtifact(params: {
  text: string;
  voice?: string;
}) {
  const response = await runTextProvider({
    system: "Ты TTS preprocessor. Верни SSML-ready narration script.",
    prompt: `Voice: ${params.voice || "default"}\n\nText:\n${params.text}`,
    maxTokens: 900
  });

  return {
    mimeType: "text/plain",
    content: response.text || params.text,
    metadata: {
      provider: "router-text",
      voice: params.voice || "default"
    }
  };
}
