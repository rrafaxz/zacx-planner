import { supabase } from "@/lib/supabase/client";

type PublicSlugTable = "copy_plannings" | "visual_presentations";

type ResolveUniquePublicSlugOptions = {
  excludeId?: string;
  preferredCandidate?: string;
};

async function isPublicSlugAvailable(
  table: PublicSlugTable,
  slug: string,
  excludeId?: string,
) {
  let query = supabase
    .from(table)
    .select("id")
    .eq("public_slug", slug)
    .limit(1);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return !data?.length;
}

export async function resolveUniquePublicSlug(
  table: PublicSlugTable,
  baseSlug: string,
  options: ResolveUniquePublicSlugOptions = {},
) {
  const normalizedBaseSlug = baseSlug.trim().replace(/-+/g, "-").replace(/^-+|-+$/g, "") || "link";
  const preferredCandidate = options.preferredCandidate
    ?.trim()
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (preferredCandidate && (await isPublicSlugAvailable(table, preferredCandidate, options.excludeId))) {
    return preferredCandidate;
  }

  let suffix = 1;

  while (suffix < 1000) {
    const candidate = suffix === 1 ? normalizedBaseSlug : `${normalizedBaseSlug}-${suffix}`;

    if (await isPublicSlugAvailable(table, candidate, options.excludeId)) {
      return candidate;
    }

    suffix += 1;
  }

  return `${normalizedBaseSlug}-${Date.now()}`;
}
