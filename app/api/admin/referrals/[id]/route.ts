import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { referralRewardUpdateSchema } from "@/lib/validators";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAdminUser(request);
    const body = await request.json();
    const payload = referralRewardUpdateSchema.parse(body);

    const reward = await prisma.referralReward.update({
      where: { id: params.id },
      data: {
        status: payload.status
      },
      include: {
        referrer: { select: { id: true, email: true, name: true, referralCode: true, referralRewardPercentOverride: true } },
        referee: { select: { id: true, email: true, name: true } },
        payment: { select: { id: true, amount: true, status: true, createdAt: true } }
      }
    });

    return NextResponse.json({ ok: true, reward });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "ADMIN_REFERRAL_REWARD_UPDATE_FAILED", message: (error as Error).message },
      { status: 400 }
    );
  }
}
