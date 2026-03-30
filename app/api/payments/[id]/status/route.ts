import { NextRequest, NextResponse } from "next/server";
import { getPaymentStatusForUser } from "@/lib/app";
import { getCurrentUserFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const payment = await getPaymentStatusForUser(user.id, params.id);
    return NextResponse.json({ ok: true, payment });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "PAYMENT_STATUS_FAILED", message: (error as Error).message },
      { status: 400 }
    );
  }
}
