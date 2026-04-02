import "server-only";
import { runTextProvider } from "@/lib/providers/router-text";

export async function generateVideoArtifact(params: {
  mode: "storyboard" | "task";
  prompt: string;
  durationSec: number;
}) {
  const response = await runTextProvider({
    system:
      "Ты ассистент по подготовке видеопроекта. Верни понятный сториборд или постановку задачи для съёмки и монтажа. Не имитируй готовый видеофайл и не называй текст финальным видео.",
    prompt: `Mode: ${params.mode}\nDuration: ${params.durationSec}s\nPrompt:\n${params.prompt}`,
    maxTokens: 1000
  });

  return {
    mimeType: "text/markdown",
    content: response.text || params.prompt,
    metadata: {
      flow: "video-planning",
      mode: params.mode,
      durationSec: params.durationSec,
      readyForVideoOutput: false
    }
  };
}
