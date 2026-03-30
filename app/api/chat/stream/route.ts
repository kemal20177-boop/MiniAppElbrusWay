import { NextRequest } from "next/server";
import { calculateChatCostRub, createChatStream, persistChatCompletion } from "@/lib/app";
import { getCurrentUserFromRequest } from "@/lib/auth";
import { checkChatRateLimit, toRateLimitHeaders } from "@/lib/rate-limit";
import { chatSchema } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StreamUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimated: boolean;
};

function toSseEvent(event: string, payload: Record<string, unknown>) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

function estimateTokenCount(text: string) {
  return Math.max(1, Math.ceil(text.trim().length / 4));
}

function parseUsageFromChunk(payload: Record<string, unknown>) {
  const usage = payload.usage as Record<string, unknown> | undefined;
  if (!usage) {
    return null;
  }

  const promptTokens = Number(usage.prompt_tokens || 0);
  const completionTokens = Number(usage.completion_tokens || 0);
  const totalTokens = Number(usage.total_tokens || promptTokens + completionTokens);

  return {
    promptTokens,
    completionTokens,
    totalTokens
  };
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) {
    return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const rateLimit = await checkChatRateLimit({
      userId: user.id,
      plan: user.plan
    });

    if (!rateLimit.allowed) {
      return Response.json(
        {
          ok: false,
          error: "RATE_LIMIT_EXCEEDED",
          message: "CHAT_RATE_LIMIT_EXCEEDED"
        },
        {
          status: 429,
          headers: toRateLimitHeaders(rateLimit.result)
        }
      );
    }

    const body = await request.json();
    const payload = chatSchema.parse(body);
    const { response, modelConfig } = await createChatStream({
      user,
      model: payload.model,
      messages: payload.messages
    });
    const upstream = response.body;

    if (!upstream) {
      throw new Error("ROUTERAI_STREAM_EMPTY");
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = upstream.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let content = "";
        let usage: StreamUsage | null = null;

        controller.enqueue(encoder.encode(toSseEvent("meta", { model: payload.model })));

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }

            buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
            let boundaryIndex = buffer.indexOf("\n\n");

            while (boundaryIndex !== -1) {
              const block = buffer.slice(0, boundaryIndex);
              buffer = buffer.slice(boundaryIndex + 2);
              boundaryIndex = buffer.indexOf("\n\n");

              const dataLines = block
                .split("\n")
                .filter((line) => line.startsWith("data:"))
                .map((line) => line.slice(5).trim())
                .filter(Boolean);

              for (const line of dataLines) {
                if (line === "[DONE]") {
                  continue;
                }

                const chunk = JSON.parse(line) as Record<string, unknown>;
                const parsedUsage = parseUsageFromChunk(chunk);
                if (parsedUsage) {
                  usage = { ...parsedUsage, estimated: false };
                }

                const choice = Array.isArray(chunk.choices) ? (chunk.choices[0] as Record<string, unknown> | undefined) : undefined;
                const delta = choice?.delta as Record<string, unknown> | undefined;
                const message = choice?.message as Record<string, unknown> | undefined;
                const piece =
                  typeof delta?.content === "string"
                    ? delta.content
                    : typeof message?.content === "string"
                      ? message.content
                      : "";

                if (piece) {
                  content += piece;
                  controller.enqueue(encoder.encode(toSseEvent("delta", { content: piece })));
                }
              }
            }
          }

          const promptEstimate = estimateTokenCount(payload.messages.map((entry) => entry.content).join("\n"));
          const completionEstimate = estimateTokenCount(content);
          const finalUsage =
            usage ||
            ({
              promptTokens: promptEstimate,
              completionTokens: completionEstimate,
              totalTokens: promptEstimate + completionEstimate,
              estimated: true
            } satisfies StreamUsage);
          const costRub = await calculateChatCostRub({
            model: payload.model,
            inputPrice: modelConfig.inputPrice,
            outputPrice: modelConfig.outputPrice,
            promptTokens: finalUsage.promptTokens,
            completionTokens: finalUsage.completionTokens
          });
          const persisted = await persistChatCompletion({
            userId: user.id,
            chatId: payload.chatId,
            model: payload.model,
            messages: payload.messages,
            content,
            promptTokens: finalUsage.promptTokens,
            completionTokens: finalUsage.completionTokens,
            totalTokens: finalUsage.totalTokens,
            costRub
          });

          controller.enqueue(
            encoder.encode(
              toSseEvent("done", {
                chatId: persisted.chatId,
                content,
                usage: {
                  prompt_tokens: persisted.usage.prompt_tokens,
                  completion_tokens: persisted.usage.completion_tokens,
                  total_tokens: persisted.usage.total_tokens,
                  estimated: finalUsage.estimated
                },
                tokenBalance: persisted.tokenBalance,
                costRub: persisted.costRub
              })
            )
          );
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              toSseEvent("error", {
                message: (error as Error).message || "STREAM_FAILED"
              })
            )
          );
        } finally {
          controller.close();
          reader.releaseLock();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        ...toRateLimitHeaders(rateLimit.result)
      }
    });
  } catch (error) {
    const message = (error as Error).message;
    return Response.json(
      {
        ok: false,
        error: "CHAT_STREAM_FAILED",
        message
      },
      {
        status: message === "TOKENS_EXHAUSTED" ? 402 : 400
      }
    );
  }
}
