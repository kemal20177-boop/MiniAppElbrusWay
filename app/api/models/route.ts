import { NextRequest, NextResponse } from "next/server";
import { getModels } from "@/lib/app";
import { getCurrentUserFromRequest } from "@/lib/auth";
import { Plan } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    const models = await getModels(user?.plan ?? Plan.FREE);
    return NextResponse.json({ ok: true, data: models });
  } catch (error) {
    return NextResponse.json(
      { error: "MODELS_UNAVAILABLE", message: (error as Error).message },
      { status: 502 }
    );
  }
}
