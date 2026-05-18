import { supabase } from "@/lib/supabase/client";

type PublicSlugTable = "copy_plannings" | "visual_presentations";

export async function resolveUniquePublicSlug(table: PublicSlugTable, baseSlug: string) {
  const normalizedBaseSlug = baseSlug.trim().replace(/-+/g, "-").replace(/^-+|-+$/g, "") || "link";
  let suffix = 1;

  while (suffix < 1000) {
    const candidate = suffix === 1 ? normalizedBaseSlug : `${normalizedBaseSlug}-${suffix}`;
    const { data, error } = await supabase
      .from(table)
      .select("id")
      .eq("public_slug", candidate)
      .limit(1);

    if (error) {
      throw error;
    }

    if (!data?.length) {
      return candidate;
    }

    suffix += 1;
  }

  return `${normalizedBaseSlug}-${Date.now()}`;
}
