import {
  getAdminImagePreview,
  getAdminPublication,
  publicationServiceMessage,
  saveAdminPublication,
} from "../modules/admin-service.js";
import { processPublicationImage } from "../modules/image-processor.js";
import {
  clearNotification,
  setButtonBusy,
  showNotification,
} from "../modules/notifications.js";
import {
  formatFileSize,
  slugify,
  validatePublicationInput,
} from "../modules/validation.js";

let existingPublication = null;
let processedImage = null;
let localPreviewUrl = null;
let slugWasEdited = false;

function dateTimeLocalValue(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    timeZone: "America/Guayaquil",
    year: "numeric",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function clearFieldErrors(form) {
  for (const field of form.querySelectorAll("[aria-invalid]")) {
    field.removeAttribute("aria-invalid");
  }

  for (const error of form.querySelectorAll("[data-field-error]")) {
    error.textContent = "";
  }
}

function showFieldErrors(form, errors) {
  const fieldNames = Object.keys(errors);

  for (const name of fieldNames) {
    const field = form.elements.namedItem(name);
    const error = form.querySelector(`[data-field-error="${name}"]`);

    if (field instanceof HTMLElement) {
      field.setAttribute("aria-invalid", "true");
    }

    if (error) {
      error.textContent = errors[name];
    }
  }

  const firstField = form.elements.namedItem(fieldNames[0]);

  if (firstField instanceof HTMLElement) {
    firstField.focus();
  }
}

function updatePublicationTiming(form) {
  const isPublished = form.elements.estado.value === "publicado";
  const timingFields = form.querySelector("[data-publication-timing-fields]");
  const scheduleField = form.querySelector("[data-schedule-field]");
  const isScheduled =
    isPublished && form.elements.publicationTiming.value === "programar";

  timingFields.hidden = !isPublished;
  scheduleField.hidden = !isScheduled;
  form.elements.scheduledAt.required = isScheduled;
}

function updatePreview(preview, url, alt) {
  const image = preview.querySelector("img");
  image.src = url;
  image.alt = alt || "Vista previa de la imagen principal";
  preview.hidden = false;
}

async function loadExistingImage(preview) {
  if (!existingPublication?.imagen_path) {
    return;
  }

  const signedUrl = await getAdminImagePreview(existingPublication.imagen_path);

  if (signedUrl) {
    updatePreview(preview, signedUrl, existingPublication.imagen_alt);
  }
}

function fillExistingPublication(form) {
  form.elements.tipo.value = existingPublication.tipo;
  form.elements.titulo.value = existingPublication.titulo;
  form.elements.slug.value = existingPublication.slug;
  form.elements.resumen.value = existingPublication.resumen;
  form.elements.contenido.value = existingPublication.contenido;
  form.elements.imagenAlt.value = existingPublication.imagen_alt ?? "";
  form.elements.estado.value = existingPublication.estado;

  const publicationDate = existingPublication.fecha_publicacion
    ? new Date(existingPublication.fecha_publicacion)
    : null;
  const isScheduled =
    existingPublication.estado === "publicado" &&
    publicationDate?.getTime() > Date.now();
  form.elements.publicationTiming.value = isScheduled ? "programar" : "ahora";
  form.elements.scheduledAt.value = isScheduled
    ? dateTimeLocalValue(existingPublication.fecha_publicacion)
    : "";
  slugWasEdited = true;
  updatePublicationTiming(form);
}

function publicationFromForm(form) {
  return {
    contenido: form.elements.contenido.value,
    estado: form.elements.estado.value,
    imagenAlt: form.elements.imagenAlt.value,
    publicationTiming: form.elements.publicationTiming.value,
    resumen: form.elements.resumen.value,
    scheduledAt: form.elements.scheduledAt.value,
    slug: form.elements.slug.value,
    tipo: form.elements.tipo.value,
    titulo: form.elements.titulo.value,
  };
}

export async function initialize(context) {
  const form = document.querySelector("[data-publication-editor]");
  const notification = document.querySelector("[data-editor-notification]");
  const imageInput = form.elements.imagen;
  const imageStatus = document.querySelector("[data-image-status]");
  const preview = document.querySelector("[data-image-preview]");
  const submitButton = form.querySelector('button[type="submit"]');
  const heading = document.querySelector("[data-editor-heading]");
  const id = new URLSearchParams(window.location.search).get("id");

  if (id) {
    try {
      existingPublication = await getAdminPublication(id);

      if (!existingPublication) {
        form.hidden = true;
        showNotification(
          notification,
          "La publicación no existe o no tienes permiso para editarla.",
          "error",
        );
        return;
      }

      heading.textContent = "Editar publicación";
      fillExistingPublication(form);
    } catch (error) {
      form.hidden = true;
      showNotification(
        notification,
        publicationServiceMessage(error),
        "error",
      );
      return;
    }

    try {
      await loadExistingImage(preview);
    } catch {
      showNotification(
        notification,
        "La publicación se cargó, pero la vista previa de la imagen no está disponible.",
        "warning",
      );
    }
  }

  if (new URLSearchParams(window.location.search).get("saved") === "1") {
    showNotification(notification, "La publicación fue guardada.", "success");
  }

  form.elements.titulo.addEventListener("input", () => {
    if (!slugWasEdited) {
      form.elements.slug.value = slugify(form.elements.titulo.value);
    }
  });
  form.elements.slug.addEventListener("input", () => {
    slugWasEdited = true;
    form.elements.slug.value = slugify(form.elements.slug.value);
  });
  form.elements.estado.addEventListener("change", () => {
    updatePublicationTiming(form);
  });
  form.elements.publicationTiming.addEventListener("change", () => {
    updatePublicationTiming(form);
  });

  imageInput.addEventListener("change", async () => {
    clearNotification(notification);
    const [file] = imageInput.files;

    if (!file) {
      return;
    }

    imageInput.disabled = true;
    imageStatus.textContent = "Procesando imagen…";

    try {
      processedImage = await processPublicationImage(file);

      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
      }

      localPreviewUrl = URL.createObjectURL(processedImage.blob);
      updatePreview(preview, localPreviewUrl, form.elements.imagenAlt.value);
      imageStatus.textContent = [
        `${processedImage.width} × ${processedImage.height} px`,
        `${formatFileSize(processedImage.inputBytes)} → ${formatFileSize(processedImage.outputBytes)}`,
        "WebP optimizado",
      ].join(" · ");
    } catch (error) {
      processedImage = null;
      imageInput.value = "";
      imageStatus.textContent = "";
      showNotification(notification, error.message, "error");
    } finally {
      imageInput.disabled = false;
    }
  });

  form.elements.imagenAlt.addEventListener("input", () => {
    const previewImage = preview.querySelector("img");

    if (!preview.hidden) {
      previewImage.alt =
        form.elements.imagenAlt.value ||
        "Vista previa de la imagen principal";
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearNotification(notification);
    clearFieldErrors(form);

    const hasImage = Boolean(
      processedImage || existingPublication?.imagen_path,
    );
    const validation = validatePublicationInput(publicationFromForm(form), {
      existingPublication,
      hasImage,
    });

    if (!validation.isValid) {
      showFieldErrors(form, validation.errors);
      showNotification(
        notification,
        "Revisa los campos señalados antes de guardar.",
        "error",
      );
      return;
    }

    setButtonBusy(submitButton, true, "Guardando…");

    try {
      const result = await saveAdminPublication({
        existingPublication,
        processedImage,
        user: context.user,
        values: validation.values,
      });
      existingPublication = result.publication;
      processedImage = null;

      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
        localPreviewUrl = null;
      }

      imageInput.value = "";
      let previewWarning = null;

      try {
        await loadExistingImage(preview);
        imageStatus.textContent = "Imagen principal guardada en Storage.";
      } catch {
        previewWarning =
          "La publicación se guardó, pero no se pudo actualizar la vista previa.";
      }

      heading.textContent = "Editar publicación";
      const url = new URL(window.location.href);
      url.searchParams.set("id", existingPublication.id);
      url.searchParams.delete("saved");
      window.history.replaceState({}, "", `${url.pathname}${url.search}`);
      showNotification(
        notification,
        result.cleanupWarning ||
          previewWarning ||
          "La publicación fue guardada correctamente.",
        result.cleanupWarning || previewWarning ? "warning" : "success",
      );
    } catch (error) {
      showNotification(
        notification,
        publicationServiceMessage(error),
        "error",
      );
    } finally {
      setButtonBusy(submitButton, false);
    }
  });

  updatePublicationTiming(form);
}
