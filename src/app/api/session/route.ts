import { NextRequest, NextResponse } from "next/server";

import { getSessionSecret } from "@/lib/auth/session-secret";
import { ADMIN_COOKIE_NAME, APP_USER_COOKIE_NAME, readUserSessionCookie } from "@/lib/auth/session-cookie";
import type { CurrentAppUser } from "@/lib/auth/types";
import { supabase } from "@/lib/supabase/client";

async function fallbackAdminUser(): Promise<CurrentAppUser> {
  const { data } = await supabase
    .from("app_users")
    .select("*")
    .eq("slug", "adm")
    .eq("active", true)
    .maybeSingle();

  if (data) {
    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      role: data.role === "admin" ? "admin" : "user",
    };
  }

  return {
    id: "adm",
    name: "ADM",
    slug: "adm",
    role: "admin",
  };
}

export async function GET(request: NextRequest) {
  const sessionSecret = getSessionSecret();
  const sessionCookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value;

  if (!sessionSecret || sessionCookie !== sessionSecret) {
    return NextResponse.json({ ok: false, user: null, message: "Sessão inválida." }, { status: 401 });
  }

  const cookieUser = readUserSessionCookie(request.cookies.get(APP_USER_COOKIE_NAME)?.value, sessionSecret);
  const user = cookieUser ?? (await fallbackAdminUser());

  return NextResponse.json({ ok: true, user });
}
