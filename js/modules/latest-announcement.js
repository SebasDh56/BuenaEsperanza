import { listPublishedPublications } from "./publication-service.js";

const STORAGE_KEY = "comuna-page-latest-announcement";

function detailUrl(publication) {
  const page = publication.tipo === "noticia" ? "noticia.html" : "proyecto.html";
  return `/${page}?slug=${encodeURIComponent(publication.slug)}`;
}

function createAnnouncement(publication) {
  const dialog = document.createElement("dialog");
  dialog.className = "latest-announcement";
  dialog.setAttribute("aria-labelledby", "latest-announcement-title");
  const content = document.createElement("article");
  content.className = "latest-announcement__content";
  const close = document.createElement("button");
  close.className = "latest-announcement__close";
  close.type = "button";
  close.setAttribute("aria-label", "Cerrar anuncio");
  close.textContent = "×";

  if (publication.thumbnailUrl || publication.imageUrl) {
    const image = document.createElement("img");
    image.src = publication.thumbnailUrl ?? publication.imageUrl;
    image.alt = publication.imagen_alt;
    image.width = 720;
    image.height = 480;
    image.decoding = "async";
    content.append(image);
  }

  const copy = document.createElement("div");
  copy.className = "latest-announcement__copy";
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent =
    publication.tipo === "noticia" ? "Nueva noticia" : "Nuevo proyecto";
  const title = document.createElement("h2");
  title.id = "latest-announcement-title";
  title.textContent = publication.titulo;
  const summary = document.createElement("p");
  summary.textContent = publication.resumen;
  const link = document.createElement("a");
  link.className = "button button--primary";
  link.href = detailUrl(publication);
  link.textContent =
    publication.tipo === "noticia" ? "Leer noticia" : "Conocer proyecto";
  copy.append(eyebrow, title, summary, link);
  content.append(close, copy);
  dialog.append(content);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, publication.id);
    } catch {
      // El aviso puede cerrarse aunque el navegador bloquee el almacenamiento.
    }
  };

  close.addEventListener("click", () => {
    dismiss();
    dialog.close();
  });
  dialog.addEventListener("cancel", dismiss);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      dismiss();
      dialog.close();
    }
  });
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  document.body.append(dialog);
  return dialog;
}

export async function initializeLatestAnnouncement() {
  if (document.body.dataset.page !== "inicio") {
    return;
  }

  try {
    const result = await listPublishedPublications({ limit: 1 });
    const latest = result.publications[0];

    if (!latest || localStorage.getItem(STORAGE_KEY) === latest.id) {
      return;
    }

    const dialog = createAnnouncement(latest);
    window.setTimeout(() => dialog.showModal(), 650);
  } catch {
    // La portada sigue siendo utilizable si no hay conexión o almacenamiento local.
  }
}
