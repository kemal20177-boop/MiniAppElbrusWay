import "server-only";
import { synthesizeRouterAudio, transcribeRouterAudio } from "@/lib/routerai/audio";

export async function transcribeAudioArtifact(params: {
  userId: string;
  projectId?: string;
  sourceFileId: string;
  model: string;
}) {
  const response = await transcribeRouterAudio(params);

  return {
    mimeType: "text/plain",
    content: response.text,
    metadata: {
      provider: "routerai"
    }
  };
}

export async function synthesizeSpeechArtifact(params: {
  userId: string;
  projectId?: string;
  text: string;
  model: string;
  voice?: string;
}) {
  const response = await synthesizeRouterAudio(params);

  return {
    mimeType: response.audioBase64 ? `audio/${response.format}` : "text/plain",
    content: response.audioBase64 ? Buffer.from(response.audioBase64, "base64") : response.text,
    metadata: {
      provider: "routerai",
      voice: params.voice || "default"
    }
  };
}
