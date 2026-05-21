import type { Client } from "@/lib/supabase/types";

export type AppUserRole = "admin" | "user";

export type AppUser = {
  id: string;
  name: string;
  slug: string;
  role: AppUserRole | string | null;
  active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

export type CurrentAppUser = {
  id: string;
  name: string;
  slug: string;
  role: AppUserRole;
};

type ClientAccessRecord = Pick<Client, "responsible_name"> & {
  assigned_user_id?: string | null;
  assigned_user_name?: string | null;
};

function normalizeAccessValue(value?: string | null) {
  return `${value ?? ""}`
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function isAdminUser(user?: CurrentAppUser | null) {
  return user?.role === "admin";
}

export function responsibleNameForUser(user?: CurrentAppUser | null) {
  if (!user || isAdminUser(user)) return "";

  return user.name;
}

export function canSeeClient(user: CurrentAppUser | null | undefined, client: ClientAccessRecord | null | undefined) {
  if (!user || !client) return false;
  if (isAdminUser(user)) return true;

  const userName = normalizeAccessValue(user.name);
  const userId = normalizeAccessValue(user.id);
  const assignedUserId = normalizeAccessValue(client.assigned_user_id);
  const assignedUserName = normalizeAccessValue(client.assigned_user_name);
  const responsibleName = normalizeAccessValue(client.responsible_name);

  return Boolean(
    (assignedUserId && assignedUserId === userId) ||
      (assignedUserName && assignedUserName === userName) ||
      (responsibleName && responsibleName === userName),
  );
}

export function canEditSettings(user?: CurrentAppUser | null) {
  return isAdminUser(user);
}
