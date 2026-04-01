import { routerAiJsonRequest } from "@/lib/routerai/client";
import { createRouterChatCompletion, createRouterChatStream, type RouterMessage } from "@/lib/routerai/chat";
import { fetchRouterModelCatalogLive, getRouterModelCatalog, type RouterModelCatalogItem } from "@/lib/routerai/models";
import { defaultModelId } from "@/lib/site";

export const DEFAULT_ROUTER_MODEL = process.env.ROUTERAI_DEFAULT_MODEL || defaultModelId;
export type RouterResponsesInput = string | RouterMessage[];
export type { RouterMessage };

export async function fetchRouterModels() {
  const data = await fetchRouterModelCatalogLive();
  return {
    data: data.map((model) => ({
      id: model.id,
      name: model.name,
      pricing: model.pricing,
      context_length: model.contextLength,
      supported_parameters: [
        ...(model.supportsWebSearch ? ["web_search_options"] : []),
        ...(model.supportsTools ? ["plugins"] : []),
        ...(model.supportsReasoning ? ["reasoning"] : [])
      ],
      architecture: {
        input_modalities: model.inputModalities,
        output_modalities: model.outputModalities
      }
    }))
  };
}

export { getRouterModelCatalog, type RouterModelCatalogItem };

export function getModelPricingMap(models: RouterModelCatalogItem[]) {
  return new Map(models.map((model) => [model.id, model.pricing]));
}

export async function createRouterCompletion(model: string, messages: RouterMessage[], options?: { maxTokens?: number }) {
  return createRouterChatCompletion({
    model,
    messages,
    maxTokens: options?.maxTokens
  });
}

export async function createRouterCompletionStream(model: string, messages: RouterMessage[], options?: { maxTokens?: number }) {
  const { response } = await createRouterChatStream({
    model,
    messages,
    maxTokens: options?.maxTokens
  });
  return response;
}

export async function createRouterResponse(model: string, input: RouterResponsesInput, options?: { maxOutputTokens?: number }) {
  const messages = typeof input === "string" ? [{ role: "user", content: input } as RouterMessage] : input;
  const completion = await createRouterChatCompletion({
    model,
    messages,
    maxTokens: options?.maxOutputTokens
  });
  const message = completion.choices?.[0]?.message;
  return {
    id: completion.id || "routerai-response",
    model,
    output: [
      {
        id: "message",
        role: "assistant",
        type: "message",
        status: "completed",
        content: [{ type: "output_text", text: message?.content || "" }]
      }
    ],
    usage: {
      input_tokens: Number(completion.usage?.prompt_tokens || 0),
      output_tokens: Number(completion.usage?.completion_tokens || 0),
      total_tokens: Number(completion.usage?.total_tokens || 0)
    }
  };
}

export async function createRouterEmbedding(params: { model: string; input: string | string[]; encodingFormat?: "float" | "base64" }) {
  return routerAiJsonRequest({
    path: "/embeddings",
    method: "POST",
    body: {
      model: params.model,
      input: params.input,
      encoding_format: params.encodingFormat || "float"
    }
  });
}

export async function fetchRouterCredits() {
  const payload = await routerAiJsonRequest<{ data?: { credits?: number }; credits?: number }>({
    path: "/credits",
    method: "GET"
  });
  if (payload.data?.credits != null) {
    return { credits: Number(payload.data.credits) };
  }
  return { credits: Number(payload.credits || 0) };
}
