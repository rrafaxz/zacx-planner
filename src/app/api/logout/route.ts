import { NextResponse } from "next/server";

const ADMIN_COOKIE_NAME = "zacx_admin_session";

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

  return response;
}