import "server-only";
import { createRouterChatCompletion } from "@/lib/routerai/chat";
import { toRouterContentPartForFile } from "@/lib/routerai/files";

export async function transcribeRouterAudio(params: {
  userId: string;
  projectId?: string;
  sourceFileId: string;
  model: string;
}) {
  const audio = await toRouterContentPartForFile(params.userId, params.sourceFileId);
  const completion = await createRouterChatCompletion({
    userId: params.userId,
    projectId: params.projectId,
    model: params.model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "Сделай точную транскрипцию аудио, затем короткое summary." },
          audio as never
        ]
      }
    ]
  });
  return {
    text: completion.choices?.[0]?.message?.content || "",
    usage: completion.usage
  };
}

export async function synthesizeRouterAudio(params: {
  userId: string;
  projectId?: string;
  text: string;
  model: string;
  voice?: string;
}) {
  const completion = await createRouterChatCompletion({
    userId: params.userId,
    projectId: params.projectId,
    model: params.model,
    messages: [{ role: "user", content: `Озвучь этот текст голосом ${params.voice || "alloy"}:\n\n${params.text}` }],
    modalities: ["audio", "text"]
  });
  const message = completion.choices?.[0]?.message;
  return {
    text: message?.content || message?.audio?.transcript || params.text,
    audioBase64: message?.audio?.data || null,
    format: message?.audio?.format || "mp3",
    usage: completion.usage
  };
}
