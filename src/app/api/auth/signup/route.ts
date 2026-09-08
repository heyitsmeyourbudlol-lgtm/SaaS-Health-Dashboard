import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { createSessionToken } from "@/lib/session";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isValidEmail(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

export async function POST(request: Request) {
  const body = await request.formData();
  const agencyName = String(body.get("agencyName") ?? "").trim();
  const email = String(body.get("email") ?? "").trim().toLowerCase();
  const password = String(body.get("password") ?? "");

  try {
    if (agencyName.length < 2) {
      return NextResponse.redirect(
        new URL("/signup?error=agency", request.url),
      );
    }
    if (!isValidEmail(email)) {
      return NextResponse.redirect(
        new URL("/signup?error=email", request.url),
      );
    }
    if (password.length < 8) {
      return NextResponse.redirect(
        new URL("/signup?error=password", request.url),
      );
    }

    const baseSlug = slugify(agencyName) || "agency";
    const slugSuffix = randomBytes(4).toString("hex");
    const slug = `${baseSlug}-${slugSuffix}`;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.redirect(
        new URL("/signup?error=email-in-use", request.url),
      );
    }

    const agency = await prisma.agency.create({
      data: {
        name: agencyName,
        slug,
        plan: "trial",
        status: "trial",
        users: {
          create: {
            email,
            name: "Owner",
            role: "owner",
            passwordHash: await bcrypt.hash(password, 10),
          },
        },
      },
      include: { users: true },
    });

    const owner = agency.users[0];
    const token = await createSessionToken({
      userId: owner.id,
      agencyId: agency.id,
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
    return NextResponse.redirect(new URL("/signup?error=server", request.url));
  }
}

