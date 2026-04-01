import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { adminUserUpdateSchema } from "@/lib/validators";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdminUser(request);
    const body = await request.json();
    const payload = adminUserUpdateSchema.parse(body);

    const current = await prisma.user.findUnique({
      where: { id: params.id }
    });
    if (!current) {
      throw new Error("USER_NOT_FOUND");
    }

    const nextTokenBalance =
      typeof payload.tokenBalance === "number"
        ? payload.tokenBalance
        : current.tokenBalance + (payload.tokenDelta || 0);

    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: params.id },
        data: {
          ...(payload.name !== undefined ? { name: payload.name } : {}),
          ...(payload.role ? { role: payload.role } : {}),
          ...(payload.plan ? { plan: payload.plan } : {}),
          ...(payload.billingPlanId !== undefined ? { billingPlanId: payload.billingPlanId || null } : {}),
          ...(payload.planExpiresAt !== undefined
            ? { planExpiresAt: payload.planExpiresAt ? new Date(payload.planExpiresAt) : null }
            : {}),
          ...(payload.referralRewardPercentOverride !== undefined
            ? { referralRewardPercentOverride: payload.referralRewardPercentOverride }
            : {}),
          ...(nextTokenBalance !== current.tokenBalance ? { tokenBalance: nextTokenBalance } : {})
        }
      });

      if (nextTokenBalance !== current.tokenBalance) {
        const delta = nextTokenBalance - current.tokenBalance;
        await tx.transaction.create({
          data: {
            userId: updated.id,
            type: delta >= 0 ? "credit" : "debit",
            tokens: Math.abs(delta),
            description: payload.reason || "Ручная корректировка администратором"
          }
        });
      }

      return updated;
    });

    await writeAuditLog({
      action: "admin.user.update",
      actorId: admin.id,
      entityType: "user",
      entityId: user.id,
      details: {
        role: payload.role,
        plan: payload.plan,
        billingPlanId: payload.billingPlanId,
        tokenBalance: payload.tokenBalance,
        tokenDelta: payload.tokenDelta
      }
    });

    return NextResponse.json({ ok: true, user });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "ADMIN_USER_UPDATE_FAILED", message: (error as Error).message },
      { status: 400 }
    );
  }
}
