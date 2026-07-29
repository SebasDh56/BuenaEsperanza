import { getAdminDashboardData } from "../modules/admin-service.js";
import { showNotification } from "../modules/notifications.js";

const dateFormatter = new Intl.DateTimeFormat("es-EC", {
  dateStyle: "medium",
  timeZone: "America/Guayaquil",
});

function createElement(tagName, { className, text, attributes = {} } = {}) {
  const element = document.createElement(tagName);

  if (className) {
    element.className = className;
  }

  if (text !== undefined) {
    element.textContent = text;
  }

  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }

  return element;
}

function detailLabel(publication) {
  if (
    publication.estado === "publicado" &&
    new Date(publication.fecha_publicacion).getTime() > Date.now()
  ) {
    return "Programado";
  }

  const labels = {
    archivado: "Archivado",
    borrador: "Borrador",
    publicado: "Publicado",
  };

  return labels[publication.estado];
}

function renderRecent(container, publications) {
  if (publications.length === 0) {
    const empty = createElement("div", { className: "admin-empty-state" });
    empty.append(
      createElement("h2", { text: "Todavía no hay publicaciones" }),
      createElement("p", {
        text: "Crea la primera publicación cuando exista información real confirmada.",
      }),
    );
    container.replaceChildren(empty);
    return;
  }

  const list = createElement("ul", { className: "admin-recent-list" });

  for (const publication of publications) {
    const item = createElement("li");
    const content = createElement("div");
    const title = createElement("a", {
      text: publication.titulo,
      attributes: {
        href: `/admin/editor.html?id=${encodeURIComponent(publication.id)}`,
      },
    });
    const meta = createElement("p", {
      text: `${publication.tipo === "noticia" ? "Noticia" : "Proyecto"} · ${dateFormatter.format(new Date(publication.updated_at))}`,
    });
    const state = createElement("span", {
      className: `admin-status admin-status--${publication.estado}`,
      text: detailLabel(publication),
    });
    content.append(title, meta);
    item.append(content, state);
    list.append(item);
  }

  container.replaceChildren(list);
}

export async function initialize() {
  const notification = document.querySelector("[data-dashboard-notification]");
  const recentContainer = document.querySelector("[data-dashboard-recent]");

  try {
    const data = await getAdminDashboardData();
    const values = {
      archived: data.archived,
      drafts: data.drafts,
      published: data.published,
      scheduled: data.scheduled,
      total: data.total,
    };

    for (const [name, value] of Object.entries(values)) {
      const target = document.querySelector(`[data-dashboard-stat="${name}"]`);

      if (target) {
        target.textContent = String(value);
      }
    }

    renderRecent(recentContainer, data.recent);
  } catch {
    showNotification(
      notification,
      "No se pudo cargar el resumen. Comprueba tu conexión e inténtalo nuevamente.",
      "error",
    );
  }
}
