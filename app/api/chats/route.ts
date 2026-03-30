import { NextRequest, NextResponse } from "next/server";
import { createChatForUser } from "@/lib/app";
import { getCurrentUserFromRequest } from "@/lib/auth";
import { createChatSchema } from "@/lib/validators";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const chats = await prisma.chat.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" }
  });

  return NextResponse.json({ ok: true, chats });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const payload = createChatSchema.parse(body);
    const chat = await createChatForUser(user.id, payload.model, payload.title || "Новый чат");
    return NextResponse.json({ ok: true, chat });
  } catch (error) {
    return NextResponse.json({ ok: false, error: "CHAT_CREATE_FAILED", message: (error as Error).message }, { status: 400 });
  }
}
