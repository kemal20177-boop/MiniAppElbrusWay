import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin";
import { toFeatureList } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { adminPlanSchema } from "@/lib/validators";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAdminUser(request);
    const body = await request.json();
    const payload = adminPlanSchema.parse(body);
    const plan = await prisma.planConfig.update({
      where: { id: params.id },
      data: {
        code: payload.code.trim().toUpperCase(),
        name: payload.name,
        basePlan: payload.basePlan,
        priceRub: payload.priceRub,
        tokensPerMonth: payload.tokensPerMonth,
        requestsPerHour: payload.requestsPerHour,
        description: payload.description,
        features: payload.features,
        sortOrder: payload.sortOrder,
        isActive: payload.isActive,
        isPublic: payload.isPublic
      }
    });

    return NextResponse.json({ ok: true, plan: { ...plan, features: toFeatureList(plan.features) } });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "ADMIN_PLAN_UPDATE_FAILED", message: (error as Error).message },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAdminUser(request);
    await prisma.planConfig.delete({
      where: { id: params.id }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "ADMIN_PLAN_DELETE_FAILED", message: (error as Error).message },
      { status: 400 }
    );
  }
}
