import { NextRequest, NextResponse } from "next/server";
import { getModels } from "@/lib/app";
import { getCurrentUserFromRequest } from "@/lib/auth";
import { Plan } from "@prisma/client";
import { getCuratedModelSections } from "@/lib/routerai/models";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    const plan = user?.plan ?? Plan.FREE;
    const [models, curated] = await Promise.all([getModels(plan), getCuratedModelSections(plan)]);
    return NextResponse.json({ ok: true, data: models, curated });
  } catch (error) {
    return NextResponse.json(
      { error: "MODELS_UNAVAILABLE", message: (error as Error).message },
      { status: 502 }
    );
  }
}
