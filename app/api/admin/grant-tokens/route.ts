import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const body = await request.json();
    const { userId, tokens, plan, reason } = body;

    if (!userId || !tokens || tokens <= 0) {
      return NextResponse.json({ ok: false, error: "INVALID_PARAMS" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      tokenBalance: { increment: tokens }
    };

    if (plan && ["FREE", "BASE", "PRO", "ULTRA", "BUSINESS"].includes(plan)) {
      updateData.plan = plan;
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);
      updateData.planExpiresAt = expiresAt;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: userId },
        data: updateData,
        select: { id: true, email: true, tokenBalance: true, plan: true }
      });

      await tx.transaction.create({
        data: {
          userId,
          type: "credit",
          tokens,
          description: reason || `Ручное начисление администратором (${user.email})`
        }
      });

      return u;
    });

    console.log("[ADMIN] Grant tokens:", { adminId: user.id, targetUserId: userId, tokens, plan });

    return NextResponse.json({ ok: true, user: updated });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "GRANT_FAILED", message: (error as Error).message },
      { status: 400 }
    );
  }
}
