import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createSessionToken } from "@/lib/session";

function isValidEmail(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

export async function POST(request: Request) {
  const body = await request.formData();
  const email = String(body.get("email") ?? "").trim().toLowerCase();
  const password = String(body.get("password") ?? "");

  try {
    if (!isValidEmail(email) || !password) {
      return NextResponse.redirect(
        new URL("/login?error=missing", request.url),
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { agency: true },
    });

    if (!user || !user.passwordHash) {
      return NextResponse.redirect(
        new URL("/login?error=invalid", request.url),
      );
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return NextResponse.redirect(
        new URL("/login?error=invalid", request.url),
      );
    }

    const token = await createSessionToken({
      userId: user.id,
      agencyId: user.agencyId,
    });

    const res = NextResponse.redirect(new URL("/dashboard", request.url));
    res.cookies.set("shd_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30d
    });
    return res;
  } catch (e) {
    return NextResponse.redirect(new URL("/login?error=server", request.url));
  }
}

