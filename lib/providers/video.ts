import "server-only";
import { runTextProvider } from "@/lib/providers/router-text";

export async function generateVideoArtifact(params: {
  mode: "storyboard" | "task";
  prompt: string;
  durationSec: number;
}) {
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
      mode: params.mode
    }
  };
}
