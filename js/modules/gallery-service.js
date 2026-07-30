import { getPublicSupabaseClient } from "../config/supabase-client.js";

const GALLERY_BUCKET = "galeria";
const PUBLIC_GALLERY_FIELDS = [
  "id",
  "titulo",
  "descripcion",
  "imagen_path",
  "imagen_alt",
  "fecha_toma",
  "credito",
  "orden",
].join(",");

export async function listPublishedGalleryItems({
  limit = 12,
  offset = 0,
} = {}) {
  const client = getPublicSupabaseClient();
  const { data, error, count } = await client
    .from("galeria_items")
    .select(PUBLIC_GALLERY_FIELDS, { count: "exact" })
    .eq("estado", "publicado")
    .order("orden", { ascending: true })
    .order("fecha_toma", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw error;
  }

  const items = await Promise.all(
    (data ?? []).map(async (item) => {
      const { data: signed, error: signedError } = await client.storage
        .from(GALLERY_BUCKET)
        .createSignedUrl(item.imagen_path, 60 * 30);

      if (signedError || !signed?.signedUrl) {
        return null;
      }

      return {
        ...item,
        imageUrl: signed.signedUrl,
      };
    }),
  );

  return {
    consumed: data?.length ?? 0,
    items: items.filter(Boolean),
    total: count ?? 0,
  };
}
