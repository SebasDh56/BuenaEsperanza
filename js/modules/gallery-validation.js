import {
  PUBLICATION_LIMITS,
  validateImageFile,
} from "./validation.js";

export const GALLERY_LIMITS = Object.freeze({
  titleMin: 5,
  titleMax: 140,
  descriptionMin: 20,
  descriptionMax: 1000,
  imageAltMin: PUBLICATION_LIMITS.imageAltMin,
  imageAltMax: PUBLICATION_LIMITS.imageAltMax,
  creditMin: 2,
  creditMax: 160,
  orderMin: 0,
  orderMax: 9999,
});

const GALLERY_STATES = new Set(["borrador", "publicado", "archivado"]);

function addLengthError(errors, field, value, min, max, label) {
  if (value.length < min || value.length > max) {
    errors[field] = `${label} debe tener entre ${min} y ${max} caracteres.`;
  }
}

export function validateGalleryInput(raw, { hasImage = false } = {}) {
  const order = Number(raw.orden);
  const values = {
    titulo: String(raw.titulo ?? "").trim(),
    descripcion: String(raw.descripcion ?? "").trim(),
    imagen_alt: String(raw.imagenAlt ?? "").trim(),
    fecha_toma: String(raw.fechaToma ?? "").trim() || null,
    credito: String(raw.credito ?? "").trim() || null,
    estado: String(raw.estado ?? "").trim(),
    orden: Number.isInteger(order) ? order : null,
  };
  const errors = {};

  addLengthError(
    errors,
    "titulo",
    values.titulo,
    GALLERY_LIMITS.titleMin,
    GALLERY_LIMITS.titleMax,
    "El título",
  );
  addLengthError(
    errors,
    "descripcion",
    values.descripcion,
    GALLERY_LIMITS.descriptionMin,
    GALLERY_LIMITS.descriptionMax,
    "La descripción",
  );
  addLengthError(
    errors,
    "imagenAlt",
    values.imagen_alt,
    GALLERY_LIMITS.imageAltMin,
    GALLERY_LIMITS.imageAltMax,
    "El texto alternativo",
  );

  if (values.credito) {
    addLengthError(
      errors,
      "credito",
      values.credito,
      GALLERY_LIMITS.creditMin,
      GALLERY_LIMITS.creditMax,
      "El crédito",
    );
  }

  if (
    values.orden === null ||
    values.orden < GALLERY_LIMITS.orderMin ||
    values.orden > GALLERY_LIMITS.orderMax
  ) {
    errors.orden = "El orden debe ser un número entero entre 0 y 9999.";
  }

  if (!GALLERY_STATES.has(values.estado)) {
    errors.estado = "Selecciona un estado válido.";
  }

  if (
    values.fecha_toma &&
    (
      !/^\d{4}-\d{2}-\d{2}$/.test(values.fecha_toma) ||
      values.fecha_toma > new Date().toISOString().slice(0, 10)
    )
  ) {
    errors.fechaToma = "La fecha de la fotografía no puede estar en el futuro.";
  }

  if (!hasImage) {
    errors.imagen = "Selecciona una fotografía antes de guardar.";
  }

  return {
    errors,
    isValid: Object.keys(errors).length === 0,
    values,
  };
}

export function validateGalleryImageFile(file) {
  return validateImageFile(file);
}
