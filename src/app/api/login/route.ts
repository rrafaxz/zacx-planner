import { NextRequest, NextResponse } from "next/server";

import { getSessionSecret } from "@/lib/auth/session-secret";
import { ADMIN_COOKIE_NAME, APP_USER_COOKIE_NAME, createUserSessionCookie } from "@/lib/auth/session-cookie";
import type { CurrentAppUser } from "@/lib/auth/types";
import { supabase } from "@/lib/supabase/client";

const defaultAppUsers = [
  { name: "Rafael", slug: "rafael", role: "user", active: true },
  { name: "Matheus", slug: "matheus", role: "user", active: true },
  { name: "ADM", slug: "adm", role: "admin", active: true },
];

const userPasswordConfig: Record<string, { envName: string; developmentFallback?: string }> = {
  adm: { envName: "ADMIN_PASSWORD", developmentFallback: "GRUPOZACX" },
  rafael: { envName: "RAFAEL_PASSWORD", developmentFallback: "RAFAELZACX" },
  matheus: { envName: "MATHEUS_PASSWORD", developmentFallback: "MATHEUSZACX" },
};

function normalizeUserSlug(value: unknown) {
  return `${value ?? "adm"}`
    .trim()
    .toLowerCase();
}

function expectedPasswordFor(slug: string) {
  const config = userPasswordConfig[slug];

  if (!config) return "";

  return (
    process.env[config.envName]?.trim() ||
    config.developmentFallback?.trim() ||
    ""
  );
}

async function ensureDefaultAppUsers() {
  const { data, error: selectError } = await supabase
    .from("app_users")
    .select("slug");

  if (selectError) {
    return {
      ok: false,
      message: "Usuários não encontrados no Supabase. Rode o seed de app_users.",
    };
  }

  const existingSlugs = new Set(
    (data ?? []).map((user) => normalizeUserSlug(user.slug)),
  );
  const missingUsers = defaultAppUsers.filter((user) => !existingSlugs.has(user.slug));

  if (!missingUsers.length) {
    return { ok: true, message: "" };
  }

  const { error: upsertError } = await supabase
    .from("app_users")
    .upsert(missingUsers as never, { onConflict: "slug" });

  if (upsertError) {
    return {
      ok: false,
      message: "Usuários não encontrados no Supabase. Rode o seed de app_users.",
    };
  }

  return { ok: true, message: "" };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const slug = normalizeUserSlug(body?.slug);
    const password = `${body?.password ?? ""}`.trim();

    const sessionSecret = getSessionSecret();

    if (!sessionSecret) {
      return NextResponse.json(
        {
          ok: false,
          message: "Configuração de sessão inválida.",
        },
        { status: 500 }
      );
    }

    const expectedPassword = expectedPasswordFor(slug);

    if (!expectedPassword) {
      return NextResponse.json(
        {
          ok: false,
          message: "Senha deste usuário não foi configurada.",
        },
        { status: 500 }
      );
    }

    const seedResult = await ensureDefaultAppUsers();

    const { data: appUser, error: userError } = await supabase
      .from("app_users")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (userError) {
      return NextResponse.json(
        {
          ok: false,
          message: "Não foi possível carregar os usuários internos.",
        },
        { status: 500 }
      );
    }

    if (!appUser) {
      if (!seedResult.ok) {
        return NextResponse.json(
          {
            ok: false,
            message: seedResult.message,
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          ok: false,
          message: "Usuário não encontrado no Supabase. Verifique a tabela app_users.",
        },
        { status: 401 }
      );
    }

    if (appUser.active === false) {
      return NextResponse.json(
        {
          ok: false,
          message: "Usuário inativo.",
        },
        { status: 401 }
      );
    }

    if (!password || password !== expectedPassword) {
      return NextResponse.json(
        {
          ok: false,
          message: "Senha incorreta.",
        },
        { status: 401 }
      );
    }

    const currentUser: CurrentAppUser = {
      id: appUser.id,
      name: appUser.name,
      slug: appUser.slug,
      role: appUser.role === "admin" ? "admin" : "user",
    };
    const response = NextResponse.json({
      ok: true,
      message: "Login realizado com sucesso.",
      user: currentUser,
    });

    response.cookies.set(ADMIN_COOKIE_NAME, sessionSecret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    response.cookies.set(APP_USER_COOKIE_NAME, createUserSessionCookie(currentUser, sessionSecret), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "Erro ao tentar fazer login.",
      },
      { status: 500 }
    );
  }
}
