import { runtimeConfig } from "../config/runtime-config.js";
import { getAuthenticatedSupabaseClient } from "../config/supabase-client.js";

const GALLERY_BUCKET = "galeria";
const ADMIN_GALLERY_FIELDS = [
  "id",
  "titulo",
  "descripcion",
  "imagen_url",
  "imagen_path",
  "imagen_miniatura_url",
  "imagen_miniatura_path",
  "imagen_alt",
  "fecha_toma",
  "credito",
  "estado",
  "orden",
  "creado_por",
  "created_at",
  "updated_at",
].join(",");
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function assertUuid(value) {
  if (!UUID_PATTERN.test(value)) {
    throw new TypeError("El identificador de la fotografía no es válido.");
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

  return `${runtimeConfig.supabaseUrl}/storage/v1/object/authenticated/${GALLERY_BUCKET}/${encodedPath}`;
}

async function removeImage(client, path) {
  if (!path) {
    return;
  }

  const { error } = await client.storage.from(GALLERY_BUCKET).remove([path]);

  if (error) {
    throw error;
  }
}

async function uploadImage(client, authorId, processedImage) {
  const path = `${authorId}/${crypto.randomUUID()}.webp`;
  const thumbnailPath = `${authorId}/${crypto.randomUUID()}.webp`;
  const { error } = await client.storage
    .from(GALLERY_BUCKET)
    .upload(path, processedImage.blob, {
      cacheControl: "3600",
      contentType: "image/webp",
      upsert: false,
    });

  if (error) {
    throw error;
  }

  const { error: thumbnailError } = await client.storage
    .from(GALLERY_BUCKET)
    .upload(thumbnailPath, processedImage.thumbnailBlob, {
      cacheControl: "3600",
      contentType: "image/webp",
      upsert: false,
    });

  if (thumbnailError) {
    await removeImage(client, path).catch(() => {});
    throw thumbnailError;
  }

  return {
    imagen_path: path,
    imagen_url: authenticatedStorageUrl(path),
    imagen_miniatura_path: thumbnailPath,
    imagen_miniatura_url: authenticatedStorageUrl(thumbnailPath),
  };
}

export async function listAdminGalleryItems({
  limit = 20,
  offset = 0,
  search = "",
  state = "",
} = {}) {
  const client = getAuthenticatedSupabaseClient();
  let query = client
    .from("galeria_items")
    .select(ADMIN_GALLERY_FIELDS, { count: "exact" })
    .order("orden", { ascending: true })
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);
  const searchTerm = cleanSearchTerm(search);

  if (searchTerm) {
    query = query.ilike("titulo", `%${searchTerm}%`);
  }

  if (["borrador", "publicado", "archivado"].includes(state)) {
    query = query.eq("estado", state);
  }

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  return {
    items: data ?? [],
    total: count ?? 0,
  };
}

export async function getAdminGalleryItem(id) {
  assertUuid(id);

  const client = getAuthenticatedSupabaseClient();
  const { data, error } = await client
    .from("galeria_items")
    .select(ADMIN_GALLERY_FIELDS)
    .eq("id", id)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function getAdminGalleryImagePreview(path) {
  if (!path) {
    return null;
  }

  const client = getAuthenticatedSupabaseClient();
  const { data, error } = await client.storage
    .from(GALLERY_BUCKET)
    .createSignedUrl(path, 60 * 30);

  if (error) {
    throw error;
  }

  return data?.signedUrl ?? null;
}

export async function saveAdminGalleryItem({
  existingItem = null,
  processedImage = null,
  user,
  values,
}) {
  const client = getAuthenticatedSupabaseClient();
  const authorId = existingItem?.creado_por ?? user.id;
  let uploadedImage = null;

  if (processedImage) {
    uploadedImage = await uploadImage(client, authorId, processedImage);
  }

  const payload = {
    titulo: values.titulo,
    descripcion: values.descripcion,
    imagen_alt: values.imagen_alt,
    imagen_path: uploadedImage
      ? uploadedImage.imagen_path
      : existingItem?.imagen_path,
    imagen_url: uploadedImage
      ? uploadedImage.imagen_url
      : existingItem?.imagen_url,
    imagen_miniatura_path: uploadedImage
      ? uploadedImage.imagen_miniatura_path
      : existingItem?.imagen_miniatura_path,
    imagen_miniatura_url: uploadedImage
      ? uploadedImage.imagen_miniatura_url
      : existingItem?.imagen_miniatura_url,
    fecha_toma: values.fecha_toma,
    credito: values.credito,
    estado: values.estado,
    orden: values.orden,
  };

  let result;

  if (existingItem) {
    assertUuid(existingItem.id);
    result = await client
      .from("galeria_items")
      .update(payload)
      .eq("id", existingItem.id)
      .select(ADMIN_GALLERY_FIELDS)
      .limit(1)
      .maybeSingle();
  } else {
    result = await client
      .from("galeria_items")
      .insert({ ...payload, creado_por: user.id })
      .select(ADMIN_GALLERY_FIELDS)
      .single();
  }

  if (result.error || !result.data) {
    if (uploadedImage) {
      await removeImage(client, uploadedImage.imagen_path).catch(() => {});
      await removeImage(client, uploadedImage.imagen_miniatura_path).catch(() => {});
    }

    throw result.error ?? new Error("No se pudo guardar la fotografía.");
  }

  let cleanupWarning = null;

  if (
    uploadedImage &&
    existingItem?.imagen_path &&
    existingItem.imagen_path !== uploadedImage.imagen_path
  ) {
    try {
      await removeImage(client, existingItem.imagen_path);
      await removeImage(client, existingItem.imagen_miniatura_path);
    } catch {
      cleanupWarning =
        "La fotografía se guardó, pero el archivo anterior requiere limpieza manual.";
    }
  }

  return { cleanupWarning, item: result.data };
}

export async function archiveAdminGalleryItem(id) {
  assertUuid(id);

  const client = getAuthenticatedSupabaseClient();
  const { data, error } = await client
    .from("galeria_items")
    .update({ estado: "archivado" })
    .eq("id", id)
    .select("id,estado")
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw error ?? new Error("No tienes permiso para archivar la fotografía.");
  }

  return data;
}

export async function deleteAdminGalleryItem(id) {
  const item = await getAdminGalleryItem(id);

  if (!item) {
    throw new Error("La fotografía ya no existe o no tienes acceso.");
  }

  const client = getAuthenticatedSupabaseClient();
  await archiveAdminGalleryItem(id);

  try {
    await removeImage(client, item.imagen_path);
    await removeImage(client, item.imagen_miniatura_path);
  } catch (error) {
    error.message =
      "La fotografía quedó archivada, pero no se pudo eliminar su archivo. Puedes reintentar.";
    throw error;
  }

  const { data, error } = await client
    .from("galeria_items")
    .delete()
    .eq("id", id)
    .select("id")
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw error ?? new Error(
      "La fotografía quedó archivada, pero no pudo eliminarse definitivamente.",
    );
  }

  return data;
}

export function galleryServiceMessage(error) {
  if (error?.code === "23505") {
    return "Ese archivo ya está asociado con otra fotografía.";
  }

  if (error?.code === "23514") {
    return "La fotografía no cumple las reglas de contenido, fecha o imagen.";
  }

  if (error?.code === "42501" || error?.statusCode === "403") {
    return "No tienes permiso para realizar esta acción.";
  }

  return error?.message || "Ocurrió un error inesperado.";
}
