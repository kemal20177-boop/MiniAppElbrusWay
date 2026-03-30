import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { adminPromoCodeSchema } from "@/lib/validators";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAdminUser(request);
    const body = await request.json();
    const payload = adminPromoCodeSchema.parse(body);
    const promoCode = await prisma.promoCode.update({
      where: { id: params.id },
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
      { ok: false, error: "ADMIN_PROMOCODE_UPDATE_FAILED", message: (error as Error).message },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAdminUser(request);
    await prisma.promoCode.delete({
      where: { id: params.id }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "ADMIN_PROMOCODE_DELETE_FAILED", message: (error as Error).message },
      { status: 400 }
    );
  }
}
