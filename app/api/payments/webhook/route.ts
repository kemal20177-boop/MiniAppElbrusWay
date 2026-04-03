import { NextRequest, NextResponse } from "next/server";
import { syncPaymentStatus } from "@/lib/app";
import { verifyPlategaCallbackHeaders } from "@/lib/platega";
import { plategaCallbackSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let payloadId = "unknown";

  try {
    if (!verifyPlategaCallbackHeaders(request.headers)) {
      console.warn("[WEBHOOK] Unauthorized request from", request.headers.get("x-forwarded-for"));
      return new NextResponse(null, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    console.log("[WEBHOOK] Received payload:", JSON.stringify(body));

    const payload = plategaCallbackSchema.parse(body);
    payloadId = payload.id;

    console.log("[WEBHOOK] Processing payment:", { id: payload.id, status: payload.status });

    await syncPaymentStatus(payload.id, payload.status);

    console.log("[WEBHOOK] Success:", { id: payload.id, duration: Date.now() - startTime + "ms" });

    return new NextResponse(null, { status: 200 });
  } catch (error) {
    const message = (error as Error).message;
    console.error("[WEBHOOK] Failed:", { payloadId, message, duration: Date.now() - startTime + "ms" });

    return NextResponse.json(
      { ok: false, error: "PAYMENT_WEBHOOK_FAILED", message },
      { status: 400 }
    );
  }
}
