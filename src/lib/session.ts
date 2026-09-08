import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

export interface SessionUser {
  userId: string;
  agencyId: string;
  email: string;
}

const COOKIE_NAME = "shd_session";

function getSessionSecret(): Uint8Array {
  const raw = process.env.SESSION_SECRET;
  if (!raw) throw new Error("SESSION_SECRET is not set");
  // Support base64/hex; fall back to raw bytes if it’s not decodable.
  try {
    return new Uint8Array(Buffer.from(raw, "base64"));
  } catch {
    // eslint-disable-next-line no-empty
  }
  try {
    return new Uint8Array(Buffer.from(raw, "hex"));
  } catch {
    // Use raw bytes.
  }
  return new TextEncoder().encode(raw);
}

export async function createSessionToken(user: {
  userId: string;
  agencyId: string;
}) {
  return new SignJWT({
    userId: user.userId,
    agencyId: user.agencyId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSessionSecret());
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const c = await cookies();
  const token = c.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSessionSecret(), {
      algorithms: ["HS256"],
    });
    const userId = String(payload.userId);
    const agencyId = String(payload.agencyId);

    // Basic integrity check (user still exists).
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, agencyId: true },
    });
    if (!user || user.agencyId !== agencyId) return null;

    return { userId, agencyId, email: user.email };
  } catch {
    return null;
  }
}

