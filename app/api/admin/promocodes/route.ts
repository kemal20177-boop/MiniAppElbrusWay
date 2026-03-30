import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { adminPromoCodeSchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  try {
    await requireAdminUser(request);
    const promoCodes = await prisma.promoCode.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        billingPlan: {
          select: { id: true, name: true, code: true }
        }
      }
    });
    return NextResponse.json({ ok: true, promoCodes });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 403 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminUser(request);
    const body = await request.json();
    const payload = adminPromoCodeSchema.parse(body);
    const promoCode = await prisma.promoCode.create({
      data: {
        code: payload.code.trim().toUpperCase(),
        description: payload.description || null,
        billingPlanId: payload.billingPlanId || null,
        discountPercent: payload.discountPercent,
        bonusTokens: payload.bonusTokens,
        referralPercent: payload.referralPercent ?? null,
        maxUses: payload.maxUses ?? null,
        expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
        isActive: payload.isActive
      },
      include: {
        billingPlan: {
          select: { id: true, name: true, code: true }
        }
      }
    });
    return NextResponse.json({ ok: true, promoCode });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "ADMIN_PROMOCODE_CREATE_FAILED", message: (error as Error).message },
      { status: 400 }
    );
  }
}
