import "server-only";
import { createRouterChatCompletion } from "@/lib/routerai/chat";
import { toRouterContentPartForFile } from "@/lib/routerai/files";

export async function generateRouterImage(params: {
  userId: string;
  projectId?: string;
  prompt: string;
  model: string;
  aspectRatio?: string;
  imageSize?: string;
  sourceFileId?: string;
}) {
  const content = [{ type: "text", text: params.prompt } as const];
  if (params.sourceFileId) {
    content.push((await toRouterContentPartForFile(params.userId, params.sourceFileId)) as never);
  }

  const completion = await createRouterChatCompletion({
    userId: params.userId,
    projectId: params.projectId,
    model: params.model,
    messages: [{ role: "user", content }],
    modalities: ["image", "text"],
    imageConfig: {
      ...(params.aspectRatio ? { aspect_ratio: params.aspectRatio } : {}),
      ...(params.imageSize ? { image_size: params.imageSize } : {})
    }
  });

  const message = completion.choices?.[0]?.message;
  const firstImage = message?.images?.[0]?.image_url?.url;
  if (!firstImage) {
    throw new Error("ROUTERAI_IMAGE_EMPTY");
  }

  return {
    text: message?.content || "",
    imageUrl: firstImage,
    usage: completion.usage
  };
}
