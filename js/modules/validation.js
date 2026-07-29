export const PUBLICATION_LIMITS = Object.freeze({
  titleMin: 5,
  titleMax: 180,
  slugMin: 3,
  slugMax: 180,
  summaryMin: 20,
  summaryMax: 500,
  contentMin: 50,
  contentMax: 50000,
  imageAltMin: 5,
  imageAltMax: 250,
  inputImageMaxBytes: 20 * 1024 * 1024,
  outputImageMaxBytes: 5 * 1024 * 1024,
});

const PUBLICATION_TYPES = new Set(["noticia", "proyecto"]);
const PUBLICATION_STATES = new Set(["borrador", "publicado", "archivado"]);
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function slugify(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, PUBLICATION_LIMITS.slugMax)
    .replace(/-+$/g, "");
}

function addLengthError(errors, field, value, min, max, label) {
  if (value.length < min || value.length > max) {
    errors[field] = `${label} debe tener entre ${min} y ${max} caracteres.`;
  }
}

function publicationDate(raw, existingPublication) {
  if (raw.estado !== "publicado") {
    return null;
  }

  if (raw.publicationTiming === "programar") {
    const scheduledDate = new Date(raw.scheduledAt);

    if (
      Number.isNaN(scheduledDate.getTime()) ||
      scheduledDate.getTime() <= Date.now() + 60_000
    ) {
      return {
        error: "Selecciona una fecha futura válida.",
        value: null,
      };
    }

    return { error: null, value: scheduledDate.toISOString() };
  }

  const existingDate = existingPublication?.fecha_publicacion
    ? new Date(existingPublication.fecha_publicacion)
    : null;
  const canPreserveDate =
    existingPublication?.estado === "publicado" &&
    existingDate &&
    !Number.isNaN(existingDate.getTime()) &&
    existingDate.getTime() <= Date.now();

  return {
    error: null,
    value: canPreserveDate
      ? existingDate.toISOString()
      : new Date().toISOString(),
  };
}

export function validatePublicationInput(
  raw,
  { existingPublication = null, hasImage = false } = {},
) {
  const values = {
    tipo: String(raw.tipo ?? "").trim(),
    titulo: String(raw.titulo ?? "").trim(),
    slug: slugify(raw.slug),
    resumen: String(raw.resumen ?? "").trim(),
    contenido: String(raw.contenido ?? "").trim(),
    imagen_alt: String(raw.imagenAlt ?? "").trim(),
    estado: String(raw.estado ?? "").trim(),
  };
  const errors = {};

  if (!PUBLICATION_TYPES.has(values.tipo)) {
    errors.tipo = "Selecciona un tipo de publicación válido.";
  }

  addLengthError(
    errors,
    "titulo",
    values.titulo,
    PUBLICATION_LIMITS.titleMin,
    PUBLICATION_LIMITS.titleMax,
    "El título",
  );
  addLengthError(
    errors,
    "slug",
    values.slug,
    PUBLICATION_LIMITS.slugMin,
    PUBLICATION_LIMITS.slugMax,
    "El slug",
  );

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.slug)) {
    errors.slug = "El slug sólo puede contener letras, números y guiones.";
  }

  addLengthError(
    errors,
    "resumen",
    values.resumen,
    PUBLICATION_LIMITS.summaryMin,
    PUBLICATION_LIMITS.summaryMax,
    "El resumen",
  );
  addLengthError(
    errors,
    "contenido",
    values.contenido,
    PUBLICATION_LIMITS.contentMin,
    PUBLICATION_LIMITS.contentMax,
    "El contenido",
  );

  if (!PUBLICATION_STATES.has(values.estado)) {
    errors.estado = "Selecciona un estado válido.";
  }

  if (hasImage) {
    addLengthError(
      errors,
      "imagenAlt",
      values.imagen_alt,
      PUBLICATION_LIMITS.imageAltMin,
      PUBLICATION_LIMITS.imageAltMax,
      "El texto alternativo",
    );
  } else if (values.estado === "publicado") {
    errors.imagen = "Necesitas una imagen principal antes de publicar.";
  } else {
    values.imagen_alt = null;
  }

  const dateResult = publicationDate(raw, existingPublication);

  if (dateResult?.error) {
    errors.scheduledAt = dateResult.error;
  }

  values.fecha_publicacion = dateResult?.value ?? null;

  return {
    errors,
    isValid: Object.keys(errors).length === 0,
    values,
  };
}

export function validateImageFile(file) {
  if (!(file instanceof File)) {
    return "Selecciona un archivo de imagen.";
  }

  if (!IMAGE_TYPES.has(file.type)) {
    return "La imagen debe ser JPG, PNG o WebP.";
  }

  if (file.size < 1 || file.size > PUBLICATION_LIMITS.inputImageMaxBytes) {
    return "La imagen original no puede superar 20 MB.";
  }

  return null;
}

export function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "0 KB";
  }

  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
