import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { type SessionRecord, type UserRecord, createSessionRecord, deleteSessionByToken, findSessionWithUser } from "@/lib/store";

export const sessionCookieName = "elbrusway_session";

export async function createSession(userId: string) {
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await createSessionRecord(userId, token, expiresAt);

  return { token, expiresAt: expiresAt.toISOString() };
}

export async function getSessionByToken(token: string | undefined | null) {
  if (!token) {
    return null;
  }

  const session = await findSessionWithUser(token);
  if (!session) {
    return null;
  }

  if (session.expiresAt.getTime() < Date.now()) {
    return null;
  }

  const user = session.user;
  if (!user) {
    return null;
  }

  return {
    session: {
      id: session.id,
      userId: session.userId,
      token: session.token,
      expiresAt: session.expiresAt.toISOString(),
      createdAt: session.createdAt.toISOString()
    },
    user: {
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
    }
  };
}

export async function getCurrentUserFromRequest(request: NextRequest) {
  const token = request.cookies.get(sessionCookieName)?.value;
  const payload = await getSessionByToken(token);
  return payload?.user || null;
}

export async function getCurrentUserFromCookies() {
  const token = cookies().get(sessionCookieName)?.value;
  const payload = await getSessionByToken(token);
  return payload?.user || null;
}

export async function destroySession(token: string | undefined) {
  if (!token) {
    return;
  }

  await deleteSessionByToken(token);
}

export function sanitizeUser(user: UserRecord) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    plan: user.plan,
    tokenBalance: user.tokenBalance,
    planExpiresAt: user.planExpiresAt,
    createdAt: user.createdAt
  };
}

export function sanitizeSession(session: SessionRecord) {
  return {
    id: session.id,
    expiresAt: session.expiresAt,
    createdAt: session.createdAt
  };
}
