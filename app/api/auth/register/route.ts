import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createSession, sanitizeUser, sessionCookieName } from "@/lib/auth";
import { getFirstValidationMessage, registerSchema } from "@/lib/validators";
import { ensureStore } from "@/lib/store";
import { prisma } from "@/lib/prisma";
import { ensureReferralProgram, generateReferralCode, resolveReferrerByCode } from "@/lib/billing";

function resolveSameSite() {
  return process.env.COOKIE_SAMESITE === "none" ? "none" : "lax";
}

function resolveRegisterError(error: unknown) {
  if (!(error instanceof Error)) {
    return "Регистрация не удалась";
  }
  if (error.message === "EMAIL_ALREADY_EXISTS") {
    return "Email уже используется";
  }
  if (error.message === "REFERRAL_CODE_NOT_FOUND") {
    return "Реферальный код не найден";
  }
  return getFirstValidationMessage(error, "Регистрация не удалась");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payload = registerSchema.parse(body);
    const passwordHash = await bcrypt.hash(payload.password, 12);
    await ensureStore();
    const referralProgram = await ensureReferralProgram();

    const existing = await prisma.user.findUnique({
      where: { email: payload.email.toLowerCase() }
    });
    if (existing) {
      throw new Error("EMAIL_ALREADY_EXISTS");
    }

    const referrer = payload.referralCode ? await resolveReferrerByCode(payload.referralCode) : null;
    if (payload.referralCode && !referrer) {
      throw new Error("REFERRAL_CODE_NOT_FOUND");
    }

    const user = await prisma.$transaction(async (tx) => {
      const starterTokens = 50_000 + (referrer ? referralProgram.refereeBonusTokens : 0);
      const nextUser = await tx.user.create({
        data: {
          email: payload.email.toLowerCase(),
          name: payload.name,
          passwordHash,
          role: "USER",
          plan: "FREE",
          tokenBalance: starterTokens,
          referredById: referrer?.id || null,
          referralCode: generateReferralCode(payload.email)
        }
      });

      await tx.transaction.create({
        data: {
          userId: nextUser.id,
          type: "credit",
          tokens: starterTokens,
          description: referrer
            ? "Стартовый баланс после регистрации с реферальным бонусом"
            : "Стартовый баланс после регистрации"
        }
      });

      return nextUser;
    });

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
      sameSite: resolveSameSite(),
      secure: process.env.NODE_ENV === "production",
      expires: new Date(session.expiresAt),
      path: "/"
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "REGISTER_FAILED", message: resolveRegisterError(error) },
      { status: 400 }
    );
  }
}
