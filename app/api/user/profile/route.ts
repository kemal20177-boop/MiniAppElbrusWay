import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest, sanitizeUser } from "@/lib/auth";
import { getUserReferralStats } from "@/lib/billing";
import { profileUpdateSchema } from "@/lib/validators";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const payments = await prisma.payment.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      billingPlan: {
        select: { id: true, name: true, code: true }
      },
      promoCode: {
        select: { id: true, code: true }
      }
    }
  });
  const referral = await getUserReferralStats(user.id);
  return NextResponse.json(
    { ok: true, user: sanitizeUser(user), payments, referral },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate"
      }
    }
  );
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const payload = profileUpdateSchema.parse(body);
    const nextUser = await prisma.user.update({
      where: { id: user.id },
      data: { name: payload.name }
    });

    return NextResponse.json({
      ok: true,
      user: sanitizeUser({
        id: nextUser.id,
        email: nextUser.email,
        name: nextUser.name || "",
        passwordHash: nextUser.passwordHash || "",
        role: nextUser.role,
        plan: nextUser.plan,
        tokenBalance: nextUser.tokenBalance,
        planExpiresAt: nextUser.planExpiresAt?.toISOString() || null,
        createdAt: nextUser.createdAt.toISOString(),
        updatedAt: nextUser.updatedAt.toISOString()
      })
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: "PROFILE_UPDATE_FAILED", message: (error as Error).message }, { status: 400 });
  }
}
