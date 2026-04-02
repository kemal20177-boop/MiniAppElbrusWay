import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { ZodError } from "zod";
import { createSession, sanitizeUser, sessionCookieName } from "@/lib/auth";
import { loginSchema } from "@/lib/validators";
import { ensureStore } from "@/lib/store";
import { prisma } from "@/lib/prisma";

function resolveLoginError(error: unknown) {
  if (error instanceof ZodError) {
    return error.issues[0]?.message || "Проверьте email и пароль";
  }
  if (error instanceof Error && error.message === "INVALID_CREDENTIALS") {
    return "Неверный email или пароль";
  }
  return error instanceof Error ? error.message : "Не удалось войти";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payload = loginSchema.parse(body);
    await ensureStore();
    const user = await prisma.user.findUnique({
      where: { email: payload.email.toLowerCase() }
    });

    if (!user?.passwordHash) {
      throw new Error("INVALID_CREDENTIALS");
    }

    const valid = await bcrypt.compare(payload.password, user.passwordHash);
    if (!valid) {
      throw new Error("INVALID_CREDENTIALS");
    }

    const session = await createSession(user.id);
    const response = NextResponse.json({
      ok: true,
      user: sanitizeUser({
        id: user.id,
        email: user.email,
        name: user.name || "",
        passwordHash: user.passwordHash || "",
        role: user.role,
        plan: user.plan,
        tokenBalance: user.tokenBalance,
        planExpiresAt: user.planExpiresAt?.toISOString() || null,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString()
      })
    });

    response.cookies.set(sessionCookieName, session.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      expires: new Date(session.expiresAt),
      path: "/"
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "LOGIN_FAILED", message: resolveLoginError(error) },
      { status: 400 }
    );
  }
}
