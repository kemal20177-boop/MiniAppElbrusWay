import "server-only";
import { createRouterCompletion, DEFAULT_ROUTER_MODEL, type RouterMessage } from "@/lib/routerai";

export async function runTextProvider(params: {
  prompt: string;
  system?: string;
  model?: string;
  maxTokens?: number;
}) {
  const messages: RouterMessage[] = [
    ...(params.system ? [{ role: "system", content: params.system }] : []),
    { role: "user", content: params.prompt }
  ];
  const response = await createRouterCompletion(params.model || DEFAULT_ROUTER_MODEL, messages, {
    maxTokens: params.maxTokens || 1500
  });
  const choice = Array.isArray((response as { choices?: unknown[] }).choices)
    ? ((response as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0] || null)
    : null;

  return {
    text: choice?.message?.content || "",
    raw: response
  };
}
