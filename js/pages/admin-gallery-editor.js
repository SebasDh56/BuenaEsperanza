import {
  galleryServiceMessage,
  getAdminGalleryImagePreview,
  getAdminGalleryItem,
  saveAdminGalleryItem,
} from "../modules/gallery-admin-service.js";
import { processPublicationImage } from "../modules/image-processor.js";
import {
  clearNotification,
  setButtonBusy,
  showNotification,
} from "../modules/notifications.js";
import { formatFileSize } from "../modules/validation.js";
import { validateGalleryInput } from "../modules/gallery-validation.js";

let existingItem = null;
let processedImage = null;
let localPreviewUrl = null;

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

function updatePreview(preview, url, alt) {
  const image = preview.querySelector("img");
  image.src = url;
  image.alt = alt || "Vista previa de la fotografía";
  preview.hidden = false;
}

async function loadExistingImage(preview) {
  if (!existingItem?.imagen_path) {
    return;
  }

  const signedUrl = await getAdminGalleryImagePreview(existingItem.imagen_path);

  if (signedUrl) {
    updatePreview(preview, signedUrl, existingItem.imagen_alt);
  }
}

function fillExistingItem(form) {
  form.elements.titulo.value = existingItem.titulo;
  form.elements.descripcion.value = existingItem.descripcion;
  form.elements.imagenAlt.value = existingItem.imagen_alt;
  form.elements.fechaToma.value = existingItem.fecha_toma ?? "";
  form.elements.credito.value = existingItem.credito ?? "";
  form.elements.estado.value = existingItem.estado;
  form.elements.orden.value = String(existingItem.orden);
}

function itemFromForm(form) {
  return {
    titulo: form.elements.titulo.value,
    descripcion: form.elements.descripcion.value,
    imagenAlt: form.elements.imagenAlt.value,
    fechaToma: form.elements.fechaToma.value,
    credito: form.elements.credito.value,
    estado: form.elements.estado.value,
    orden: form.elements.orden.value,
  };
}

export async function initialize(context) {
  const form = document.querySelector("[data-gallery-editor]");
  const notification = document.querySelector("[data-gallery-editor-notification]");
  const imageInput = form.elements.imagen;
  const imageStatus = document.querySelector("[data-image-status]");
  const preview = document.querySelector("[data-image-preview]");
  const submitButton = form.querySelector('button[type="submit"]');
  const heading = document.querySelector("[data-gallery-editor-heading]");
  const id = new URLSearchParams(window.location.search).get("id");

  form.elements.fechaToma.max = new Date().toISOString().slice(0, 10);

  if (id) {
    try {
      existingItem = await getAdminGalleryItem(id);

      if (!existingItem) {
        form.hidden = true;
        showNotification(
          notification,
          "La fotografía no existe o no tienes permiso para editarla.",
          "error",
        );
        return;
      }

      heading.textContent = "Editar fotografía";
      fillExistingItem(form);
    } catch (error) {
      form.hidden = true;
      showNotification(notification, galleryServiceMessage(error), "error");
      return;
    }

    try {
      await loadExistingImage(preview);
    } catch {
      showNotification(
        notification,
        "La información se cargó, pero la vista previa no está disponible.",
        "warning",
      );
    }
  }

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
    if (!preview.hidden) {
      preview.querySelector("img").alt =
        form.elements.imagenAlt.value || "Vista previa de la fotografía";
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearNotification(notification);
    clearFieldErrors(form);

    const validation = validateGalleryInput(itemFromForm(form), {
      hasImage: Boolean(processedImage || existingItem?.imagen_path),
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
      const result = await saveAdminGalleryItem({
        existingItem,
        processedImage,
        user: context.user,
        values: validation.values,
      });
      existingItem = result.item;
      processedImage = null;

      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
        localPreviewUrl = null;
      }

      imageInput.value = "";
      let previewWarning = null;

      try {
        await loadExistingImage(preview);
        imageStatus.textContent = "Fotografía guardada en Storage.";
      } catch {
        previewWarning =
          "La fotografía se guardó, pero no se pudo actualizar la vista previa.";
      }

      heading.textContent = "Editar fotografía";
      const url = new URL(window.location.href);
      url.searchParams.set("id", existingItem.id);
      window.history.replaceState({}, "", `${url.pathname}${url.search}`);
      showNotification(
        notification,
        result.cleanupWarning ||
          previewWarning ||
          "La fotografía fue guardada correctamente.",
        result.cleanupWarning || previewWarning ? "warning" : "success",
      );
    } catch (error) {
      showNotification(notification, galleryServiceMessage(error), "error");
    } finally {
      setButtonBusy(submitButton, false);
    }
  });
}
