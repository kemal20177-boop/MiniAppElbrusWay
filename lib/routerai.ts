import { defaultModelId, modelCatalog } from "@/lib/site";

const baseUrl = process.env.ROUTERAI_BASE_URL || "https://routerai.ru/api/v1";
const apiKey = process.env.ROUTERAI_API_KEY;
export const DEFAULT_ROUTER_MODEL = process.env.ROUTERAI_DEFAULT_MODEL || defaultModelId;
const preferredModelOrder = [
  "openai/gpt-4o-mini",
  "qwen/qwen-2.5-7b-instruct",
  "mistralai/mistral-small-3.1-24b-instruct",
  "deepseek/deepseek-chat",
  "openai/gpt-4o"
] as const;

export type RouterMessage = {
  role: string;
  content: string;
};

export type RouterResponsesInput = string | RouterMessage[];

type RouterPricing = Partial<Record<"prompt" | "completion" | "image" | "audio" | "web_search" | "input_cache_read", number>>;

type RouterRemoteModel = {
  id: string;
  name?: string;
  pricing?: RouterPricing;
  context_length?: number;
  supported_parameters?: string[];
  architecture?: {
    modality?: string;
    input_modalities?: string[];
    output_modalities?: string[];
  };
};

export type RouterModelCatalogItem = {
  id: string;
  name: string;
  provider: string;
  pricing: RouterPricing | null;
  contextLength: number | null;
  supportsImages: boolean;
  supportsFiles: boolean;
  supportsAudio: boolean;
  supportsVideo: boolean;
  supportsWebSearch: boolean;
  supportsReasoning: boolean;
  supportsTools: boolean;
  supportsTextOutput: boolean;
  source: "routerai" | "fallback";
};

export type RouterCredits = {
  credits: number;
};

function getAuthHeaders() {
  return apiKey ? ({ Authorization: `Bearer ${apiKey}` } as Record<string, string>) : {};
}

function toProviderName(modelId: string) {
  const raw = modelId.split("/")[0] || "routerai";
  return raw
    .split("-")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function toModelName(remote: RouterRemoteModel) {
  return String(remote.name || remote.id || "Unknown model");
}

export function normalizeRouterModel(remote: RouterRemoteModel): RouterModelCatalogItem {
  const inputModalities = remote.architecture?.input_modalities || [];
  const outputModalities = remote.architecture?.output_modalities || [];
  const supportedParameters = remote.supported_parameters || [];

  return {
    id: String(remote.id || ""),
    name: toModelName(remote),
    provider: toProviderName(String(remote.id || "")),
    pricing: remote.pricing || null,
    contextLength: typeof remote.context_length === "number" ? remote.context_length : null,
    supportsImages: inputModalities.includes("image"),
    supportsFiles: inputModalities.includes("file"),
    supportsAudio: inputModalities.includes("audio"),
    supportsVideo: inputModalities.includes("video"),
    supportsWebSearch: supportedParameters.includes("web_search_options") || typeof remote.pricing?.web_search === "number",
    supportsReasoning: supportedParameters.includes("reasoning") || supportedParameters.includes("include_reasoning"),
    supportsTools: supportedParameters.includes("tools") || supportedParameters.includes("tool_choice"),
    supportsTextOutput: outputModalities.includes("text"),
    source: "routerai"
  };
}

export function getFallbackModels(): RouterModelCatalogItem[] {
  return modelCatalog.map((model) => ({
    id: model.id,
    name: model.name,
    provider: model.provider,
    pricing: null,
    contextLength: null,
    supportsImages: model.id.includes("image") || model.id.includes("gpt"),
    supportsFiles: false,
    supportsAudio: false,
    supportsVideo: false,
    supportsWebSearch: model.id.includes("gpt") || model.id.includes("deepseek"),
    supportsReasoning: model.id.includes("claude") || model.id.includes("deepseek"),
    supportsTools: false,
    supportsTextOutput: true,
    source: "fallback"
  }));
}

export async function fetchRouterModels() {
  const response = await fetch(`${baseUrl}/models`, {
    headers: getAuthHeaders(),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`RouterAI models request failed: ${response.status}`);
  }

  return (await response.json()) as { data?: RouterRemoteModel[] };
}

export async function getRouterModelCatalog() {
  try {
    const remote = await fetchRouterModels();
    const normalized = Array.isArray(remote.data)
      ? remote.data
          .map(normalizeRouterModel)
          .filter((entry) => entry.id && entry.supportsTextOutput)
          .sort((left, right) => {
            const leftPriority = preferredModelOrder.indexOf(left.id as (typeof preferredModelOrder)[number]);
            const rightPriority = preferredModelOrder.indexOf(right.id as (typeof preferredModelOrder)[number]);

            if (leftPriority !== -1 || rightPriority !== -1) {
              if (leftPriority === -1) {
                return 1;
              }

              if (rightPriority === -1) {
                return -1;
              }

              return leftPriority - rightPriority;
            }

            return left.name.localeCompare(right.name, "ru");
          })
      : [];

    if (normalized.length > 0) {
      return normalized;
    }
  } catch {}

  return getFallbackModels();
}

export function getModelPricingMap(models: RouterModelCatalogItem[]) {
  return new Map(models.map((model) => [model.id, model.pricing]));
}

async function sendRouterCompletionRequest(payload: Record<string, unknown>) {
  return fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders()
    },
    body: JSON.stringify(payload),
    cache: "no-store"
  });
}

async function sendRouterStreamCompletionRequest(payload: Record<string, unknown>) {
  return fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders()
    },
    body: JSON.stringify(payload),
    cache: "no-store"
  });
}

async function sendRouterPostRequest(path: string, payload: Record<string, unknown>) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders()
    },
    body: JSON.stringify(payload),
    cache: "no-store"
  });
}

export async function createRouterCompletion(model: string, messages: RouterMessage[], options?: { maxTokens?: number }) {
  if (!apiKey) {
    const lastMessage = messages.at(-1)?.content || "";
    return {
      model,
      usage: {
        prompt_tokens: Math.ceil(lastMessage.length / 3),
        completion_tokens: 120,
        total_tokens: Math.ceil(lastMessage.length / 3) + 120
      },
      choices: [
        {
          message: {
            role: "assistant",
            content:
              "ROUTERAI_API_KEY не задан. Это локальный fallback-ответ для MVP. Подключите ключ в .env, чтобы получать реальные ответы от RouterAI."
          }
        }
      ]
    };
  }

  const providerCountry = process.env.ROUTERAI_PROVIDER_COUNTRY;
  const basePayload = {
    model,
    messages,
    stream: false,
    temperature: 0.7,
    max_tokens: options?.maxTokens ?? 2048
  } as Record<string, unknown>;

  let response = await sendRouterCompletionRequest({
    ...basePayload,
    ...(providerCountry ? { provider: { country: providerCountry } } : {})
  });

  if (!response.ok && providerCountry) {
    const text = await response.text();
    const shouldRetryWithoutCountry =
      response.status === 503 &&
      text.includes("No available providers");

    if (shouldRetryWithoutCountry) {
      response = await sendRouterCompletionRequest(basePayload);
    } else {
      throw new Error(`RouterAI chat request failed: ${response.status} ${text}`);
    }
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`RouterAI chat request failed: ${response.status} ${text}`);
  }

  return response.json();
}

export async function createRouterCompletionStream(model: string, messages: RouterMessage[], options?: { maxTokens?: number }) {
  if (!apiKey) {
    const lastMessage = messages.at(-1)?.content || "";
    const fallbackText =
      "ROUTERAI_API_KEY не задан. Это локальный fallback-ответ для MVP. Подключите ключ в .env, чтобы получать реальные ответы от RouterAI.";
    const body =
      `data: ${JSON.stringify({ choices: [{ delta: { content: fallbackText } }] })}\n\n` +
      `data: ${JSON.stringify({
        usage: {
          prompt_tokens: Math.ceil(lastMessage.length / 3),
          completion_tokens: Math.ceil(fallbackText.length / 3),
          total_tokens: Math.ceil(lastMessage.length / 3) + Math.ceil(fallbackText.length / 3)
        }
      })}\n\n` +
      "data: [DONE]\n\n";

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8"
      }
    });
  }

  const providerCountry = process.env.ROUTERAI_PROVIDER_COUNTRY;
  const attemptPayloads = [
    {
      model,
      messages,
      stream: true,
      stream_options: { include_usage: true },
      temperature: 0.7,
      max_tokens: options?.maxTokens ?? 2048
    },
    {
      model,
      messages,
      stream: true,
      temperature: 0.7,
      max_tokens: options?.maxTokens ?? 2048
    }
  ] as Record<string, unknown>[];

  for (const basePayload of attemptPayloads) {
    let response = await sendRouterStreamCompletionRequest({
      ...basePayload,
      ...(providerCountry ? { provider: { country: providerCountry } } : {})
    });

    if (!response.ok) {
      const text = await response.text();

      if (providerCountry && response.status === 503 && text.includes("No available providers")) {
        response = await sendRouterStreamCompletionRequest(basePayload);
      } else if (
        response.status === 400 &&
        "stream_options" in basePayload &&
        (text.includes("stream_options") || text.includes("include_usage"))
      ) {
        continue;
      } else {
        throw new Error(`RouterAI stream request failed: ${response.status} ${text}`);
      }
    }

    if (response.ok) {
      return response;
    }
  }

  throw new Error("RouterAI stream request failed: STREAM_OPTIONS_NOT_SUPPORTED");
}

export async function createRouterResponse(
  model: string,
  input: RouterResponsesInput,
  options?: { maxOutputTokens?: number }
) {
  if (!apiKey) {
    const content = typeof input === "string" ? input : input.at(-1)?.content || "";
    return {
      id: "fallback-response",
      object: "response",
      created_at: Math.floor(Date.now() / 1000),
      model,
      status: "completed",
      error: null,
      incomplete_details: null,
      instructions: null,
      metadata: {},
      parallel_tool_calls: false,
      temperature: 0.7,
      tool_choice: "none",
      tools: [],
      top_p: 1,
      max_output_tokens: options?.maxOutputTokens ?? 2048,
      output: [
        {
          id: "fallback-output",
          role: "assistant",
          type: "message",
          status: "completed",
          content: [
            {
              type: "output_text",
              text: `ROUTERAI_API_KEY не задан. Локальный fallback для: ${content}`
            }
          ]
        }
      ],
      usage: {
        input_tokens: Math.ceil(content.length / 3),
        input_tokens_details: {},
        output_tokens: 32,
        output_tokens_details: {},
        total_tokens: Math.ceil(content.length / 3) + 32
      }
    };
  }

  const response = await sendRouterPostRequest("/responses", {
    model,
    input,
    stream: false,
    temperature: 0.7,
    ...(typeof options?.maxOutputTokens === "number" ? { max_output_tokens: options.maxOutputTokens } : {})
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`RouterAI responses request failed: ${response.status} ${text}`);
  }

  return response.json();
}

export async function createRouterEmbedding(params: {
  model: string;
  input: string | string[];
  encodingFormat?: "float" | "base64";
}) {
  if (!apiKey) {
    throw new Error("ROUTERAI_API_KEY_MISSING");
  }

  const response = await sendRouterPostRequest("/embeddings", {
    model: params.model,
    input: params.input,
    encoding_format: params.encodingFormat || "float"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`RouterAI embeddings request failed: ${response.status} ${text}`);
  }

  return response.json();
}

export async function fetchRouterCredits(): Promise<RouterCredits> {
  if (!apiKey) {
    throw new Error("ROUTERAI_API_KEY_MISSING");
  }

  const response = await fetch(`${baseUrl}/credits`, {
    headers: getAuthHeaders(),
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`RouterAI credits request failed: ${response.status} ${text}`);
  }

  const payload = (await response.json()) as { data?: RouterCredits } | RouterCredits;
  if ("data" in payload && payload.data && typeof payload.data.credits === "number") {
    return payload.data;
  }

  return payload as RouterCredits;
}
