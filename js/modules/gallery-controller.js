import { listPublishedGalleryItems } from "./gallery-service.js";

const PAGE_SIZE = 12;
const dateFormatter = new Intl.DateTimeFormat("es-EC", {
  dateStyle: "long",
  timeZone: "UTC",
});

function element(tagName, { className, text, attributes = {} } = {}) {
  const node = document.createElement(tagName);

  if (className) {
    node.className = className;
  }

  if (text !== undefined) {
    node.textContent = text;
  }

  for (const [name, value] of Object.entries(attributes)) {
    node.setAttribute(name, value);
  }

  return node;
}

function formattedDate(value) {
  if (!value) {
    return null;
  }

  return dateFormatter.format(new Date(`${value}T12:00:00Z`));
}

function createFigure(item, openDetail) {
  const figure = element("figure", { className: "gallery-card" });
  const button = element("button", {
    className: "gallery-card__button",
    attributes: {
      type: "button",
      "aria-label": `Ver fotografía: ${item.titulo}`,
    },
  });
  const image = element("img", {
    attributes: {
      src: item.thumbnailUrl,
      alt: item.imagen_alt,
      loading: "lazy",
      decoding: "async",
      width: "960",
      height: "720",
    },
  });
  const caption = element("figcaption");
  caption.append(element("strong", { text: item.titulo }));

  const metadata = [formattedDate(item.fecha_toma), item.credito]
    .filter(Boolean)
    .join(" · ");

  if (metadata) {
    caption.append(element("span", { text: metadata }));
  }

  button.append(image, caption);
  button.addEventListener("click", () => openDetail(item));
  figure.append(button);

  return figure;
}

function showEmptyState(container) {
  const empty = element("div", { className: "empty-state" });
  empty.append(
    element("p", { className: "eyebrow", text: "Memoria visual" }),
    element("h2", { text: "No hay fotografías publicadas" }),
    element("p", {
      text: "La galería mostrará únicamente imágenes reales, autorizadas y contextualizadas por la comunidad.",
    }),
  );
  container.replaceChildren(empty);
}

function initializeDialog() {
  const dialog = document.querySelector("[data-gallery-dialog]");

  if (!dialog) {
    return () => {};
  }

  const image = dialog.querySelector("[data-gallery-dialog-image]");
  const title = dialog.querySelector("[data-gallery-dialog-title]");
  const description = dialog.querySelector("[data-gallery-dialog-description]");
  const metadata = dialog.querySelector("[data-gallery-dialog-metadata]");
  const close = dialog.querySelector("[data-gallery-dialog-close]");

  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });

  return (item) => {
    image.src = item.imageUrl;
    image.alt = item.imagen_alt;
    title.textContent = item.titulo;
    description.textContent = item.descripcion;
    metadata.textContent = [formattedDate(item.fecha_toma), item.credito]
      .filter(Boolean)
      .join(" · ");
    metadata.hidden = !metadata.textContent;
    dialog.showModal();
  };
}

export function initializeGallery() {
  const container = document.querySelector("[data-gallery-list]");

  if (!container) {
    return;
  }

  const loadMore = document.querySelector("[data-gallery-load-more]");
  const status = document.querySelector("[data-gallery-status]");
  const openDetail = initializeDialog();
  let offset = 0;
  let visibleCount = 0;
  let loading = false;

  async function loadItems({ replace = false } = {}) {
    if (loading) {
      return;
    }

    loading = true;
    container.setAttribute("aria-busy", "true");
    loadMore.disabled = true;
    status.textContent = replace
      ? "Cargando fotografías…"
      : "Cargando más fotografías…";

    try {
      const result = await listPublishedGalleryItems({
        limit: PAGE_SIZE,
        offset,
      });

      if (replace && result.items.length === 0) {
        showEmptyState(container);
      } else {
        const fragment = document.createDocumentFragment();

        for (const item of result.items) {
          fragment.append(createFigure(item, openDetail));
        }

        if (replace) {
          container.replaceChildren(fragment);
        } else {
          container.append(fragment);
        }
      }

      offset += result.consumed;
      visibleCount += result.items.length;
      loadMore.hidden = offset >= result.total || result.consumed === 0;
      status.textContent =
        result.total > 0
          ? `${visibleCount} de ${result.total} fotografías mostradas.`
          : "No hay fotografías publicadas.";
    } catch {
      const error = element("div", { className: "empty-state" });
      error.append(
        element("h2", { text: "No se pudo cargar la galería" }),
        element("p", {
          text: "Inténtalo nuevamente. No se publicará contenido sin verificar.",
        }),
      );
      container.replaceChildren(error);
      loadMore.hidden = true;
      status.textContent = "Error al cargar la galería.";
    } finally {
      loading = false;
      container.removeAttribute("aria-busy");
      loadMore.disabled = false;
    }
  }

  loadMore.addEventListener("click", () => loadItems());
  loadItems({ replace: true });
}
