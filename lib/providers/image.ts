import "server-only";
import { runTextProvider } from "@/lib/providers/router-text";
import { callExternalProvider, isProviderConfigured, resolveArtifactContent } from "@/lib/providers/shared";

function renderSvg(params: { prompt: string; concept: string; aspectRatio: string }) {
  const [w, h] = params.aspectRatio === "16:9" ? [1280, 720] : params.aspectRatio === "9:16" ? [720, 1280] : params.aspectRatio === "4:3" ? [1200, 900] : [1024, 1024];
  const safePrompt = params.prompt.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const safeConcept = params.concept.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#091b2b"/>
      <stop offset="100%" stop-color="#dc6b20"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <text x="64" y="110" fill="white" font-size="40" font-family="sans-serif">ElbrusWay AI</text>
  <foreignObject x="64" y="170" width="${w - 128}" height="${h - 220}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:sans-serif;color:white;font-size:26px;line-height:1.35;">
      <p><strong>${safePrompt}</strong></p>
      <p>${safeConcept}</p>
    </div>
  </foreignObject>
</svg>`;
}

export async function generateImageArtifact(params: {
  mode: "text-to-image" | "image-to-image";
  prompt: string;
  aspectRatio: string;
  sourceHint?: string;
}) {
  if (isProviderConfigured("IMAGE_PROVIDER_BASE_URL", "IMAGE_PROVIDER_API_KEY")) {
    const payload = await callExternalProvider({
      apiKeyEnv: "IMAGE_PROVIDER_API_KEY",
      baseUrlEnv: "IMAGE_PROVIDER_BASE_URL",
      path: "/generate",
      payload: {
        mode: params.mode,
        prompt: params.prompt,
        aspectRatio: params.aspectRatio,
        sourceHint: params.sourceHint || null,
        model: process.env.IMAGE_PROVIDER_MODEL || null
      }
    });

    return {
      mimeType: payload.mimeType || "image/png",
      content: await resolveArtifactContent(payload),
      metadata: {
        provider: "external-image",
        providerMode: "remote",
        ...payload.metadata
      }
    };
  }

  const concept = await runTextProvider({
    system: "Ты visual concept generator. Верни короткое описание композиции, палитры и визуальной подачи.",
    prompt: [
      `Mode: ${params.mode}`,
      `Prompt: ${params.prompt}`,
      params.sourceHint ? `Source image context: ${params.sourceHint}` : null
    ].filter(Boolean).join("\n"),
    maxTokens: 300
  });

  return {
    mimeType: "image/svg+xml",
    content: renderSvg({
      prompt: params.prompt,
      concept: concept.text || "Generated visual concept",
      aspectRatio: params.aspectRatio
    }),
    metadata: {
      provider: "router-text",
      providerMode: "dev-fallback",
      concept: concept.text
    }
  };
}
