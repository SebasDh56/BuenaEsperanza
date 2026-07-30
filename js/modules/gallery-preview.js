import { listPublishedGalleryItems } from "./gallery-service.js";

function createPreview(item) {
  const figure = document.createElement("figure");
  const link = document.createElement("a");
  const image = document.createElement("img");
  const caption = document.createElement("figcaption");
  link.href = "/galeria.html";
  link.setAttribute("aria-label", `Ver galería: ${item.titulo}`);
  image.src = item.thumbnailUrl;
  image.alt = item.imagen_alt;
  image.width = 720;
  image.height = 540;
  image.loading = "lazy";
  image.decoding = "async";
  caption.textContent = item.titulo;
  link.append(image, caption);
  figure.append(link);
  return figure;
}

export async function initializeGalleryPreview() {
  const container = document.querySelector("[data-gallery-preview]");

  if (!container) {
    return;
  }

  try {
    const result = await listPublishedGalleryItems({ limit: 3 });

    if (!result.items.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      const heading = document.createElement("h3");
      const copy = document.createElement("p");
      heading.textContent = "No hay fotografías publicadas";
      copy.textContent =
        "La galería mostrará imágenes reales después de su revisión comunitaria.";
      empty.append(heading, copy);
      container.replaceChildren(empty);
      return;
    }

    container.replaceChildren(...result.items.map(createPreview));
  } catch {
    container.replaceChildren();
  }
}
