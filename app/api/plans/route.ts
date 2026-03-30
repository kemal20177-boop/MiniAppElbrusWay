import { NextResponse } from "next/server";
import { getPublicPlanConfigs, toFeatureList } from "@/lib/billing";

export async function GET() {
  try {
    const plans = await getPublicPlanConfigs();
    return NextResponse.json({
      ok: true,
      plans: plans.map((plan) => ({
        ...plan,
        features: toFeatureList(plan.features)
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "PLANS_UNAVAILABLE", message: (error as Error).message },
      { status: 500 }
    );
  }
}
