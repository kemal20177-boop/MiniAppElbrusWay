import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin";
import { ensureDefaultPlanConfigs, toFeatureList } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { adminPlanSchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  try {
    await requireAdminUser(request);
    await ensureDefaultPlanConfigs();
    const plans = await prisma.planConfig.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });

    return NextResponse.json({
      ok: true,
      plans: plans.map((plan) => ({
        ...plan,
        features: toFeatureList(plan.features)
      }))
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 403 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminUser(request);
    const body = await request.json();
    const payload = adminPlanSchema.parse(body);

    const plan = await prisma.planConfig.create({
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
      { ok: false, error: "ADMIN_PLAN_CREATE_FAILED", message: (error as Error).message },
      { status: 400 }
    );
  }
}
