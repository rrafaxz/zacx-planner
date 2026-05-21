import { createHmac, timingSafeEqual } from "crypto";

import type { CurrentAppUser } from "@/lib/auth/types";

export const ADMIN_COOKIE_NAME = "zacx_admin_session";
export const APP_USER_COOKIE_NAME = "zacx_app_user";

function base64Url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

function signPayload(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createUserSessionCookie(user: CurrentAppUser, secret: string) {
  const payload = base64Url(JSON.stringify(user));
  const signature = signPayload(payload, secret);

  return `${payload}.${signature}`;
}

export function readUserSessionCookie(value: string | undefined, secret: string): CurrentAppUser | null {
  if (!value) return null;

  const [payload, signature] = value.split(".");

  if (!payload || !signature) return null;

  const expectedSignature = signPayload(payload, secret);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const user = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as CurrentAppUser;

    if (!user?.id || !user?.name || !user?.slug || !["admin", "user"].includes(user.role)) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}
