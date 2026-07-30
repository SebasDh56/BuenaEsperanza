import { getPublicSupabaseClient } from "../config/supabase-client.js";

const PUBLICATION_BUCKET = "publicaciones";
const SIGNED_IMAGE_LIFETIME_SECONDS = 60 * 60;
const PUBLICATION_FIELDS = [
  "id",
  "tipo",
  "titulo",
  "slug",
  "resumen",
  "contenido",
  "imagen_path",
  "imagen_miniatura_path",
  "imagen_alt",
  "fecha_publicacion",
].join(",");
const PUBLICATION_TYPES = new Set(["noticia", "proyecto"]);

function assertPublicationType(type) {
  if (type !== null && !PUBLICATION_TYPES.has(type)) {
    throw new TypeError("El tipo de publicación no es válido.");
  }
}

function assertRange(offset, limit) {
  if (
    !Number.isInteger(offset) ||
    offset < 0 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 12
  ) {
    throw new RangeError("El rango de publicaciones no es válido.");
  }
}

async function createSignedImageUrl(client, imagePath) {
  if (!imagePath) {
    return null;
  }

  const { data, error } = await client.storage
    .from(PUBLICATION_BUCKET)
    .createSignedUrl(imagePath, SIGNED_IMAGE_LIFETIME_SECONDS);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

async function withSignedImage(client, publication) {
  return {
    ...publication,
    imageUrl: await createSignedImageUrl(client, publication.imagen_path),
    thumbnailUrl: await createSignedImageUrl(
      client,
      publication.imagen_miniatura_path,
    ),
  };
}

function publishedQuery(client, type = null) {
  let query = client
    .from("publicaciones")
    .select(PUBLICATION_FIELDS, { count: "exact" })
    .eq("estado", "publicado")
    .lte("fecha_publicacion", new Date().toISOString());

  if (type) {
    query = query.eq("tipo", type);
  }

  return query;
}

export async function listPublishedPublications({
  type = null,
  offset = 0,
  limit = 6,
} = {}) {
  assertPublicationType(type);
  assertRange(offset, limit);

  const client = getPublicSupabaseClient();
  const { data, error, count } = await publishedQuery(client, type)
    .order("fecha_publicacion", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw error;
  }

  const publications = await Promise.all(
    (data ?? []).map((publication) => withSignedImage(client, publication)),
  );

  return {
    publications,
    total: count ?? publications.length,
  };
}

export async function getPublishedPublicationBySlug({ type, slug }) {
  assertPublicationType(type);

  if (
    typeof slug !== "string" ||
    slug.length < 3 ||
    slug.length > 180 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
  ) {
    return null;
  }

  const client = getPublicSupabaseClient();
  const { data, error } = await publishedQuery(client, type)
    .eq("slug", slug)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? withSignedImage(client, data) : null;
}
