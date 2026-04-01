import "server-only";
import { runTextProvider } from "@/lib/providers/router-text";
import { callExternalProvider, isProviderConfigured, resolveArtifactContent } from "@/lib/providers/shared";

export async function transcribeAudioArtifact(params: {
  fileName: string;
  extractedText?: string | null;
  mimeType: string;
}) {
  if (isProviderConfigured("AUDIO_PROVIDER_BASE_URL", "AUDIO_PROVIDER_API_KEY")) {
    const payload = await callExternalProvider({
      apiKeyEnv: "AUDIO_PROVIDER_API_KEY",
      baseUrlEnv: "AUDIO_PROVIDER_BASE_URL",
      path: "/transcribe",
      payload: {
        fileName: params.fileName,
        mimeType: params.mimeType,
        extractedText: params.extractedText || null,
        model: process.env.AUDIO_PROVIDER_MODEL || null
      }
    });

    return {
      mimeType: payload.mimeType || "text/plain",
      content: await resolveArtifactContent(payload),
      metadata: {
        provider: "external-audio",
        providerMode: "remote",
        ...payload.metadata
      }
    };
  }

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
      provider: "router-text",
      providerMode: "dev-fallback"
    }
  };
}

export async function synthesizeSpeechArtifact(params: {
  text: string;
  voice?: string;
}) {
  if (isProviderConfigured("AUDIO_PROVIDER_BASE_URL", "AUDIO_PROVIDER_API_KEY")) {
    const payload = await callExternalProvider({
      apiKeyEnv: "AUDIO_PROVIDER_API_KEY",
      baseUrlEnv: "AUDIO_PROVIDER_BASE_URL",
      path: "/tts",
      payload: {
        text: params.text,
        voice: params.voice || "default",
        model: process.env.AUDIO_PROVIDER_MODEL || null
      }
    });

    return {
      mimeType: payload.mimeType || "audio/mpeg",
      content: await resolveArtifactContent(payload),
      metadata: {
        provider: "external-audio",
        providerMode: "remote",
        voice: params.voice || "default",
        ...payload.metadata
      }
    };
  }

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
      providerMode: "dev-fallback",
      voice: params.voice || "default"
    }
  };
}
