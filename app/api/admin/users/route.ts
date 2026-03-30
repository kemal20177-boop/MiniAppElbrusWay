import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin";
import { getCurrentUserFromRequest, sanitizeUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    await requireAdminUser(request);
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        billingPlan: {
          select: { id: true, name: true, code: true }
        },
        referredBy: {
          select: { id: true, email: true, name: true, referralCode: true }
        },
        _count: {
          select: {
            referrals: true
          }
        }
      }
    });

    return NextResponse.json({
      ok: true,
      users: users.map((entry) => ({
        ...sanitizeUser({
          id: entry.id,
          email: entry.email,
          name: entry.name || "",
          passwordHash: entry.passwordHash || "",
          role: entry.role,
          plan: entry.plan,
          tokenBalance: entry.tokenBalance,
          planExpiresAt: entry.planExpiresAt?.toISOString() || null,
          createdAt: entry.createdAt.toISOString(),
          updatedAt: entry.updatedAt.toISOString()
        }),
        referralCode: entry.referralCode,
        referredById: entry.referredById,
        referredBy: entry.referredBy,
        referralRewardPercentOverride: entry.referralRewardPercentOverride,
        billingPlan: entry.billingPlan,
        referralsCount: entry._count.referrals
      }))
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 403 });
  }
}
