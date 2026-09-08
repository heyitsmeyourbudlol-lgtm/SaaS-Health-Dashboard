import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const res = NextResponse.redirect(new URL("/login", request.url));
  res.cookies.delete("shd_session");
  return res;
}

export async function GET(request: Request) {
  return POST(request);
}

