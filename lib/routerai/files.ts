import "server-only";
import { getFileBufferForUser, getFileForUser } from "@/lib/files";
import type { RouterChatContentPart } from "@/lib/routerai/chat";

export async function toDataUrlForUserFile(userId: string, fileId: string) {
  const { file, buffer } = await getFileBufferForUser(userId, fileId);
  return {
    file,
    dataUrl: `data:${file.mimeType};base64,${buffer.toString("base64")}`
  };
}

export async function toRouterContentPartForFile(userId: string, fileId: string): Promise<RouterChatContentPart> {
  const { file } = await getFileBufferForUser(userId, fileId);
  const { dataUrl } = await toDataUrlForUserFile(userId, fileId);

  if (file.kind === "IMAGE") {
    return {
      type: "image_url",
      image_url: { url: dataUrl }
    };
  }

  if (file.kind === "AUDIO") {
    return {
      type: "input_audio",
      input_audio: {
        data: dataUrl.split(",")[1],
        format: file.mimeType.split("/")[1] || "wav"
      }
    };
  }

  if (file.kind === "VIDEO") {
    return {
      type: "video_url",
      video_url: { url: dataUrl }
    };
  }

  return {
    type: "file",
    file: {
      filename: file.originalName,
      file_data: dataUrl
    }
  };
}

export async function summarizeAttachmentForRouter(userId: string, fileId: string) {
  const file = await getFileForUser(userId, fileId);
  if (!file) throw new Error("FILE_NOT_FOUND");
  return {
    id: file.id,
    name: file.originalName,
    kind: file.kind,
    mimeType: file.mimeType,
    extractedText: file.extractedText
  };
}
