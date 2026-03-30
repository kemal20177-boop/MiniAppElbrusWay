import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin";
import { getReferralDashboard } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { referralProgramSchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  try {
    await requireAdminUser(request);
    const dashboard = await getReferralDashboard();
    return NextResponse.json({ ok: true, ...dashboard });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 403 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdminUser(request);
    const body = await request.json();
    const payload = referralProgramSchema.parse(body);
    const program = await prisma.referralProgram.update({
      where: { id: "default" },
      data: payload
    });
    return NextResponse.json({ ok: true, program });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "ADMIN_REFERRAL_UPDATE_FAILED", message: (error as Error).message },
      { status: 400 }
    );
  }
}
