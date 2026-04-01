import "server-only";
import { routerAiJsonRequest, routerAiStreamRequest, type RouterUsage } from "@/lib/routerai/client";

export type RouterChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "video_url"; video_url: { url: string } }
  | { type: "input_audio"; input_audio: { data: string; format: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

export type RouterMessage = {
  role: "user" | "assistant" | "system" | "developer" | "tool";
  content: string | RouterChatContentPart[];
};

export type RouterChatOptions = {
  userId?: string;
  projectId?: string;
  chatId?: string;
  model: string;
  messages: RouterMessage[];
  stream?: boolean;
  maxTokens?: number;
  modalities?: Array<"text" | "image" | "audio">;
  imageConfig?: Record<string, unknown>;
  plugins?: Array<{ id: string }>;
  webSearchOptions?: Record<string, unknown>;
};

export async function createRouterChatCompletion(options: RouterChatOptions) {
  return routerAiJsonRequest<{
    id?: string;
    model?: string;
    usage?: RouterUsage;
    choices?: Array<{
      message?: {
        role?: string;
        content?: string;
        images?: Array<{ image_url?: { url?: string } }>;
        audio?: { data?: string; transcript?: string; format?: string };
      };
    }>;
  }>({
    path: "/chat/completions",
    method: "POST",
    userId: options.userId,
    projectId: options.projectId,
    chatId: options.chatId,
    eventType: "routerai.chat",
    model: options.model,
    body: {
      model: options.model,
      messages: options.messages,
      stream: false,
      max_tokens: options.maxTokens || 2048,
      ...(options.modalities?.length ? { modalities: options.modalities } : {}),
      ...(options.imageConfig ? { image_config: options.imageConfig } : {}),
      ...(options.plugins?.length ? { plugins: options.plugins } : {}),
      ...(options.webSearchOptions ? { web_search_options: options.webSearchOptions } : {})
    }
  });
}

export async function createRouterChatStream(options: RouterChatOptions) {
  return routerAiStreamRequest({
    path: "/chat/completions",
    method: "POST",
    userId: options.userId,
    projectId: options.projectId,
    chatId: options.chatId,
    eventType: "routerai.chat.stream",
    model: options.model,
    body: {
      model: options.model,
      messages: options.messages,
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: options.maxTokens || 2048,
      ...(options.modalities?.length ? { modalities: options.modalities } : {}),
      ...(options.imageConfig ? { image_config: options.imageConfig } : {}),
      ...(options.plugins?.length ? { plugins: options.plugins } : {}),
      ...(options.webSearchOptions ? { web_search_options: options.webSearchOptions } : {})
    }
  });
}
