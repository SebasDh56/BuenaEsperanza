import { runtimeConfig } from "../config/runtime-config.js";
import { getAuthenticatedSupabaseClient } from "../config/supabase-client.js";

const PUBLICATION_BUCKET = "publicaciones";
const ADMIN_PUBLICATION_FIELDS = [
  "id",
  "tipo",
  "titulo",
  "slug",
  "resumen",
  "contenido",
  "imagen_url",
  "imagen_path",
  "imagen_alt",
  "estado",
  "fecha_publicacion",
  "creado_por",
  "created_at",
  "updated_at",
].join(",");
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function assertUuid(value) {
  if (!UUID_PATTERN.test(value)) {
    throw new TypeError("El identificador de la publicación no es válido.");
  }
}

function cleanSearchTerm(value) {
  return String(value ?? "")
    .trim()
    .slice(0, 100)
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
}

function authenticatedStorageUrl(path) {
  const encodedPath = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${runtimeConfig.supabaseUrl}/storage/v1/object/authenticated/${PUBLICATION_BUCKET}/${encodedPath}`;
}

async function removeImage(client, path) {
  if (!path) {
    return;
  }

  const { error } = await client.storage
    .from(PUBLICATION_BUCKET)
    .remove([path]);

  if (error) {
    throw error;
  }
}

async function uploadImage(client, authorId, processedImage) {
  const path = `${authorId}/${crypto.randomUUID()}.webp`;
  const { error } = await client.storage
    .from(PUBLICATION_BUCKET)
    .upload(path, processedImage.blob, {
      cacheControl: "3600",
      contentType: "image/webp",
      upsert: false,
    });

  if (error) {
    throw error;
  }

  return {
    imagen_path: path,
    imagen_url: authenticatedStorageUrl(path),
  };
}

export async function listAdminPublications({
  limit = 20,
  offset = 0,
  search = "",
  state = "",
  type = "",
} = {}) {
  const client = getAuthenticatedSupabaseClient();
  let query = client
    .from("publicaciones")
    .select(ADMIN_PUBLICATION_FIELDS, { count: "exact" })
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);
  const searchTerm = cleanSearchTerm(search);

  if (searchTerm) {
    query = query.ilike("titulo", `%${searchTerm}%`);
  }

  if (["noticia", "proyecto"].includes(type)) {
    query = query.eq("tipo", type);
  }

  if (["borrador", "publicado", "archivado"].includes(state)) {
    query = query.eq("estado", state);
  }

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  return {
    publications: data ?? [],
    total: count ?? 0,
  };
}

async function countPublications({ state, scheduled = false } = {}) {
  const client = getAuthenticatedSupabaseClient();
  let query = client
    .from("publicaciones")
    .select("id", { count: "exact", head: true });

  if (state) {
    query = query.eq("estado", state);
  }

  if (scheduled) {
    query = query
      .eq("estado", "publicado")
      .gt("fecha_publicacion", new Date().toISOString());
  }

  const { count, error } = await query;

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function getAdminDashboardData() {
  const [total, drafts, published, archived, scheduled, recent] =
    await Promise.all([
      countPublications(),
      countPublications({ state: "borrador" }),
      countPublications({ state: "publicado" }),
      countPublications({ state: "archivado" }),
      countPublications({ scheduled: true }),
      listAdminPublications({ limit: 5 }),
    ]);

  return {
    archived,
    drafts,
    published,
    recent: recent.publications,
    scheduled,
    total,
  };
}

export async function getAdminPublication(id) {
  assertUuid(id);

  const client = getAuthenticatedSupabaseClient();
  const { data, error } = await client
    .from("publicaciones")
    .select(ADMIN_PUBLICATION_FIELDS)
    .eq("id", id)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function getAdminImagePreview(path) {
  if (!path) {
    return null;
  }

  const client = getAuthenticatedSupabaseClient();
  const { data, error } = await client.storage
    .from(PUBLICATION_BUCKET)
    .createSignedUrl(path, 60 * 30);

  if (error) {
    throw error;
  }

  return data?.signedUrl ?? null;
}

export async function saveAdminPublication({
  existingPublication = null,
  processedImage = null,
  user,
  values,
}) {
  const client = getAuthenticatedSupabaseClient();
  const authorId = existingPublication?.creado_por ?? user.id;
  let uploadedImage = null;

  if (processedImage) {
    uploadedImage = await uploadImage(client, authorId, processedImage);
  }

  const payload = {
    tipo: values.tipo,
    titulo: values.titulo,
    slug: values.slug,
    resumen: values.resumen,
    contenido: values.contenido,
    estado: values.estado,
    fecha_publicacion: values.fecha_publicacion,
    imagen_alt:
      uploadedImage || existingPublication?.imagen_path
        ? values.imagen_alt
        : null,
    imagen_path: uploadedImage
      ? uploadedImage.imagen_path
      : existingPublication?.imagen_path ?? null,
    imagen_url: uploadedImage
      ? uploadedImage.imagen_url
      : existingPublication?.imagen_url ?? null,
  };

  let result;

  if (existingPublication) {
    assertUuid(existingPublication.id);
    result = await client
      .from("publicaciones")
      .update(payload)
      .eq("id", existingPublication.id)
      .select(ADMIN_PUBLICATION_FIELDS)
      .limit(1)
      .maybeSingle();
  } else {
    result = await client
      .from("publicaciones")
      .insert({
        ...payload,
        creado_por: user.id,
      })
      .select(ADMIN_PUBLICATION_FIELDS)
      .single();
  }

  if (result.error || !result.data) {
    if (uploadedImage) {
      await removeImage(client, uploadedImage.imagen_path).catch(() => {});
    }

    throw result.error ?? new Error("No se pudo guardar la publicación.");
  }

  let cleanupWarning = null;

  if (
    uploadedImage &&
    existingPublication?.imagen_path &&
    existingPublication.imagen_path !== uploadedImage.imagen_path
  ) {
    try {
      await removeImage(client, existingPublication.imagen_path);
    } catch {
      cleanupWarning =
        "La publicación se guardó, pero la imagen anterior requiere limpieza manual.";
    }
  }

  return {
    cleanupWarning,
    publication: result.data,
  };
}

export async function archiveAdminPublication(id) {
  assertUuid(id);

  const client = getAuthenticatedSupabaseClient();
  const { data, error } = await client
    .from("publicaciones")
    .update({ estado: "archivado" })
    .eq("id", id)
    .select("id,estado")
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw error ?? new Error("No tienes permiso para archivar la publicación.");
  }

  return data;
}

export async function deleteAdminPublication(id) {
  const publication = await getAdminPublication(id);

  if (!publication) {
    throw new Error("La publicación ya no existe o no tienes acceso.");
  }

  const client = getAuthenticatedSupabaseClient();
  const archived = await archiveAdminPublication(id);

  if (archived.estado !== "archivado") {
    throw new Error("No se pudo ocultar la publicación antes de eliminarla.");
  }

  try {
    await removeImage(client, publication.imagen_path);
  } catch (error) {
    error.message =
      "La publicación quedó archivada, pero no se pudo eliminar su imagen. Puedes reintentar.";
    throw error;
  }

  const { data, error } = await client
    .from("publicaciones")
    .delete()
    .eq("id", id)
    .select("id")
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw error ?? new Error(
      "La publicación quedó archivada, pero no pudo eliminarse definitivamente.",
    );
  }

  return data;
}

export function publicationServiceMessage(error) {
  if (error?.code === "23505") {
    return "El slug ya está en uso. Elige uno diferente.";
  }

  if (error?.code === "23514") {
    return "La publicación no cumple las reglas de contenido o imagen.";
  }

  if (error?.code === "42501" || error?.statusCode === "403") {
    return "No tienes permiso para realizar esta acción.";
  }

  return error?.message || "Ocurrió un error inesperado.";
}
