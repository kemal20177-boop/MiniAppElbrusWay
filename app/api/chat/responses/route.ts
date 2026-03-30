import { NextRequest, NextResponse } from "next/server";
import { completeChatViaResponses } from "@/lib/app";
import { getCurrentUserFromRequest } from "@/lib/auth";
import { checkChatRateLimit, toRateLimitHeaders } from "@/lib/rate-limit";
import { responseChatSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const rateLimit = await checkChatRateLimit({
      userId: user.id,
      plan: user.plan
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
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
    const payload = responseChatSchema.parse(body);
    const result = await completeChatViaResponses({
      user,
      chatId: payload.chatId,
      model: payload.model,
      input: payload.input
    });

    return NextResponse.json(
      {
        ok: true,
        model: payload.model,
        chatId: result.chatId,
        content: result.content,
        usage: result.usage,
        tokenBalance: result.tokenBalance,
        costRub: result.costRub
      },
      {
        headers: toRateLimitHeaders(rateLimit.result)
      }
    );
  } catch (error) {
    const message = (error as Error).message;
    return NextResponse.json(
      {
        ok: false,
        error: "RESPONSES_REQUEST_FAILED",
        message
      },
      {
        status:
          message === "TOKENS_EXHAUSTED"
            ? 402
            : message === "RATE_LIMIT_EXCEEDED" || message === "CHAT_RATE_LIMIT_EXCEEDED"
              ? 429
              : 400
      }
    );
  }
}
