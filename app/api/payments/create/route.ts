import { NextRequest, NextResponse } from "next/server";
import { createPayment } from "@/lib/app";
import { getCurrentUserFromRequest } from "@/lib/auth";
import { paymentCreateSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const payload = paymentCreateSchema.parse(body);
    const result = await createPayment(user.id, payload);

    return NextResponse.json({
      ok: true,
      payment: result.payment,
      confirmationUrl: result.confirmationUrl
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "PAYMENT_CREATE_FAILED", message: (error as Error).message },
      { status: 400 }
    );
  }
}
