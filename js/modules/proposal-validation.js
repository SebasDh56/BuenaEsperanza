const MAX_PDF_BYTES = 5 * 1024 * 1024;
const TYPES = new Set([
  "pasantia",
  "tesis",
  "investigacion",
  "proyecto_comunitario",
  "apoyo_institucional",
  "otro",
]);

function value(formData, name) {
  const raw = formData.get(name);
  return typeof raw === "string" ? raw.trim() : "";
}

export function validateProposalForm(formData) {
  const tipo = value(formData, "tipo");
  const nombre = value(formData, "nombre_responsable");
  const organizacion = value(formData, "organizacion");
  const email = value(formData, "email");
  const telefono = value(formData, "telefono");
  const titulo = value(formData, "titulo");
  const duracion = value(formData, "duracion_estimada");
  const descripcion = value(formData, "descripcion");
  const fileValue = formData.get("archivo");
  const file = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;

  if (!TYPES.has(tipo)) {
    return "Selecciona el tipo de propuesta.";
  }

  if (nombre.length < 2 || nombre.length > 120) {
    return "Escribe el nombre de la persona responsable.";
  }

  if (organizacion && (organizacion.length < 2 || organizacion.length > 180)) {
    return "Revisa el nombre de la institución u organización.";
  }

  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return "Escribe un correo válido.";
  }

  if (telefono && (telefono.length < 7 || telefono.length > 30)) {
    return "Revisa el número de teléfono.";
  }

  if (titulo.length < 5 || titulo.length > 180) {
    return "El título debe tener entre 5 y 180 caracteres.";
  }

  if (duracion && (duracion.length < 2 || duracion.length > 120)) {
    return "Revisa la duración estimada.";
  }

  if (descripcion && (descripcion.length < 50 || descripcion.length > 3000)) {
    return "La descripción debe tener entre 50 y 3000 caracteres.";
  }

  if (!descripcion && !file) {
    return "Completa una descripción o adjunta un documento PDF.";
  }

  if (
    file &&
    (file.type !== "application/pdf" ||
      !file.name.toLowerCase().endsWith(".pdf") ||
      file.size > MAX_PDF_BYTES)
  ) {
    return "El documento debe ser un PDF de hasta 5 MB.";
  }

  if (formData.get("consentimiento") !== "on") {
    return "Debes aceptar la política de privacidad para enviar la propuesta.";
  }

  return null;
}
