import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    await requireAdminUser(request);
    const models = await prisma.modelConfig.findMany({
      orderBy: { displayName: "asc" }
    });

    return NextResponse.json({ ok: true, models });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 403 });
  }
}
