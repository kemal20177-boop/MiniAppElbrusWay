import "server-only";
import { generateRouterImage } from "@/lib/routerai/image";

export async function generateImageArtifact(params: {
  userId: string;
  projectId?: string;
  model: string;
  mode: "text-to-image" | "image-to-image";
  prompt: string;
  aspectRatio: string;
  imageSize?: string;
  sourceFileId?: string;
  sourceHint?: string;
}) {
  const result = await generateRouterImage({
    userId: params.userId,
    projectId: params.projectId,
    prompt: params.prompt,
    model: params.model,
    aspectRatio: params.aspectRatio,
    imageSize: params.imageSize,
    sourceFileId: params.sourceFileId
  });
  const dataUrl = result.imageUrl;
  const [header, base64] = dataUrl.split(",", 2);
  const mimeType = header.match(/^data:([^;]+);base64$/)?.[1] || "image/png";

  return {
    mimeType,
    content: Buffer.from(base64 || "", "base64"),
    metadata: {
      provider: "routerai",
      providerMode: "remote",
      text: result.text
    }
  };
}
