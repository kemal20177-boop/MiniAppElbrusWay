import { NextRequest, NextResponse } from "next/server";
import { Plan } from "@prisma/client";
import { getCurrentUserFromRequest } from "@/lib/auth";
import { getPaymentQuote, getPublicPlanConfigs, toFeatureList } from "@/lib/billing";
import { tokenPackages } from "@/lib/plans";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    const promoCode = request.nextUrl.searchParams.get("promoCode") || undefined;
    const plans = await getPublicPlanConfigs();
    const packageQuotes = await Promise.all(
      tokenPackages.map((pack) =>
        getPaymentQuote({
          userId: user?.id,
          packageId: pack.id,
          promoCode
        })
      )
    );
    const planQuotes = await Promise.all(
      plans.map((plan) =>
        getPaymentQuote({
          userId: user?.id,
          planConfigId: plan.id,
          promoCode
        })
      )
    );

    return NextResponse.json({
      ok: true,
      promoCode: promoCode || null,
      userPlan: user?.plan ?? Plan.FREE,
      plans: plans.map((plan) => ({
        ...plan,
        features: toFeatureList(plan.features),
        quote: planQuotes.find((entry) => entry.targetId === plan.id) || null
      })),
      packages: tokenPackages.map((pack) => ({
        ...pack,
        quote: packageQuotes.find((entry) => entry.targetId === pack.id) || null
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "PAYMENT_QUOTE_FAILED", message: (error as Error).message },
      { status: 400 }
    );
  }
}
