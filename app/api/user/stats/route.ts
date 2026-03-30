import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const [messages, transactions] = await Promise.all([
    prisma.message.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" }
    }),
    prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20
    })
  ]);
  const totalTokens = messages.reduce((sum, entry) => sum + entry.totalTokens, 0);
  const totalCost = messages.reduce((sum, entry) => sum + entry.costRub, 0);

  const topModels = Object.entries(
    messages.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.model] = (acc[entry.model] || 0) + entry.totalTokens;
      return acc;
    }, {})
  ).map(([model, tokens]) => ({ model, tokens }));

  return NextResponse.json({
    ok: true,
    stats: {
      totalTokens,
      totalCostRub: Number(totalCost.toFixed(6)),
      totalMessages: messages.length,
      topModels
    },
    transactions
  });
}
