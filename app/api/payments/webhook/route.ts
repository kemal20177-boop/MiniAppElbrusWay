import { NextRequest, NextResponse } from "next/server";
import { syncPaymentStatus } from "@/lib/app";
import { verifyPlategaCallbackHeaders } from "@/lib/platega";
import { plategaCallbackSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  try {
    if (!verifyPlategaCallbackHeaders(request.headers)) {
      return new NextResponse(null, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const payload = plategaCallbackSchema.parse(body);
    await syncPaymentStatus(payload.id, payload.status);

    return new NextResponse(null, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "PAYMENT_WEBHOOK_FAILED", message: (error as Error).message },
      { status: 400 }
    );
  }
}
