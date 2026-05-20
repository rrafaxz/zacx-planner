import { NextRequest, NextResponse } from "next/server";

const ADMIN_COOKIE_NAME = "zacx_admin_session";
const REQUIRED_ADMIN_PASSWORD = "GRUPOZACX";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const password = body?.password;

    const adminPassword = process.env.ADMIN_PASSWORD;
    const sessionSecret = process.env.ADMIN_SESSION_SECRET;

    if (!adminPassword || adminPassword !== REQUIRED_ADMIN_PASSWORD || !sessionSecret) {
      return NextResponse.json(
        {
          ok: false,
          message: "Configuração de acesso ADM inválida.",
        },
        { status: 500 }
      );
    }

    if (!password || password !== adminPassword) {
      return NextResponse.json(
        {
          ok: false,
          message: "Senha incorreta.",
        },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      ok: true,
      message: "Login realizado com sucesso.",
    });

    response.cookies.set(ADMIN_COOKIE_NAME, sessionSecret, {
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
