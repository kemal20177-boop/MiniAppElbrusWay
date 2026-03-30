import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const chat = await prisma.chat.findFirst({
    where: {
      id: params.id,
      userId: user.id
    }
  });
  if (!chat) {
    return NextResponse.json({ ok: false, error: "CHAT_NOT_FOUND" }, { status: 404 });
  }

  const messages = await prisma.message.findMany({
    where: { chatId: chat.id },
    orderBy: { createdAt: "asc" }
  });

  return NextResponse.json({ ok: true, chat, messages });
}
