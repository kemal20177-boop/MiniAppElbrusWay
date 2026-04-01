import "server-only";
import { runTextProvider } from "@/lib/providers/router-text";
import { callExternalProvider, isProviderConfigured, resolveArtifactContent } from "@/lib/providers/shared";

export async function generateVideoArtifact(params: {
  mode: "storyboard" | "task";
  prompt: string;
  durationSec: number;
}) {
  if (isProviderConfigured("VIDEO_PROVIDER_BASE_URL", "VIDEO_PROVIDER_API_KEY")) {
    const payload = await callExternalProvider({
      apiKeyEnv: "VIDEO_PROVIDER_API_KEY",
      baseUrlEnv: "VIDEO_PROVIDER_BASE_URL",
      path: params.mode === "storyboard" ? "/storyboard" : "/task",
      payload: {
        prompt: params.prompt,
        durationSec: params.durationSec,
        model: process.env.VIDEO_PROVIDER_MODEL || null
      }
    });

    return {
      mimeType: payload.mimeType || "application/json",
      content: await resolveArtifactContent(payload),
      metadata: {
        provider: "external-video",
        providerMode: "remote",
        mode: params.mode,
        durationSec: params.durationSec,
        ...payload.metadata
      }
    };
  }

  const response = await runTextProvider({
    system: "Ты video planning assistant. Верни production-ready storyboard или job spec.",
    prompt: `Mode: ${params.mode}\nDuration: ${params.durationSec}s\nPrompt:\n${params.prompt}`,
    maxTokens: 1000
  });

  return {
    mimeType: "text/markdown",
    content: response.text || params.prompt,
    metadata: {
      provider: "router-text",
      providerMode: "dev-fallback",
      mode: params.mode,
      durationSec: params.durationSec
    }
  };
}
