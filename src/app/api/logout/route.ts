import { NextResponse } from "next/server";

import { ADMIN_COOKIE_NAME, APP_USER_COOKIE_NAME } from "@/lib/auth/session-cookie";

export async function POST() {
  const response = NextResponse.json({
    ok: true,
    message: "Sessão encerrada.",
  });

  response.cookies.set(ADMIN_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  response.cookies.set(APP_USER_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
