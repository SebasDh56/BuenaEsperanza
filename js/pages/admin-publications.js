import {
  archiveAdminPublication,
  deleteAdminPublication,
  listAdminPublications,
  publicationServiceMessage,
} from "../modules/admin-service.js";
import {
  clearNotification,
  setButtonBusy,
  showNotification,
} from "../modules/notifications.js";

const PAGE_SIZE = 20;
const dateFormatter = new Intl.DateTimeFormat("es-EC", {
  dateStyle: "medium",
  timeZone: "America/Guayaquil",
});
let currentOffset = 0;
let publicationPendingDeletion = null;

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

function displayState(publication) {
  if (
    publication.estado === "publicado" &&
    new Date(publication.fecha_publicacion).getTime() > Date.now()
  ) {
    return {
      className: "programado",
      label: "Programado",
    };
  }

  return {
    className: publication.estado,
    label:
      publication.estado === "publicado"
        ? "Publicado"
        : publication.estado === "borrador"
          ? "Borrador"
          : "Archivado",
  };
}

function createActionButton(label, action, publication) {
  const button = element("button", {
    className: `admin-table-action admin-table-action--${action}`,
    text: label,
    attributes: {
      type: "button",
      "data-publication-action": action,
      "data-publication-id": publication.id,
    },
  });
  button.dataset.publicationTitle = publication.titulo;

  return button;
}

function renderTable(container, publications) {
  if (publications.length === 0) {
    const empty = element("div", { className: "admin-empty-state" });
    empty.append(
      element("h2", { text: "No hay resultados" }),
      element("p", {
        text: "Ajusta la búsqueda o crea una publicación con información confirmada.",
      }),
    );
    container.replaceChildren(empty);
    return;
  }

  const wrapper = element("div", { className: "admin-table-wrapper" });
  const table = element("table", { className: "admin-table" });
  const caption = element("caption", {
    className: "visually-hidden",
    text: "Publicaciones administrables",
  });
  const head = element("thead");
  const headRow = element("tr");

  for (const heading of ["Publicación", "Tipo", "Estado", "Actualización", "Acciones"]) {
    headRow.append(element("th", { text: heading, attributes: { scope: "col" } }));
  }

  head.append(headRow);
  const body = element("tbody");

  for (const publication of publications) {
    const row = element("tr");
    const publicationCell = element("td");
    const title = element("strong", { text: publication.titulo });
    const slug = element("small", { text: publication.slug });
    publicationCell.append(title, slug);

    const typeCell = element("td", {
      text: publication.tipo === "noticia" ? "Noticia" : "Proyecto",
    });
    typeCell.dataset.label = "Tipo";

    const stateInfo = displayState(publication);
    const stateCell = element("td");
    stateCell.dataset.label = "Estado";
    stateCell.append(
      element("span", {
        className: `admin-status admin-status--${stateInfo.className}`,
        text: stateInfo.label,
      }),
    );

    const dateCell = element("td", {
      text: dateFormatter.format(new Date(publication.updated_at)),
    });
    dateCell.dataset.label = "Actualización";

    const actions = element("td", { className: "admin-table__actions" });
    actions.dataset.label = "Acciones";
    const edit = element("a", {
      className: "admin-table-action",
      text: "Editar",
      attributes: {
        href: `/admin/editor.html?id=${encodeURIComponent(publication.id)}`,
      },
    });
    actions.append(edit);

    if (publication.estado !== "archivado") {
      actions.append(createActionButton("Archivar", "archive", publication));
    }

    actions.append(createActionButton("Eliminar", "delete", publication));
    row.append(publicationCell, typeCell, stateCell, dateCell, actions);
    body.append(row);
  }

  table.append(caption, head, body);
  wrapper.append(table);
  container.replaceChildren(wrapper);
}

function renderPagination(container, total, loadPage) {
  const page = Math.floor(currentOffset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const previous = container.querySelector("[data-page-previous]");
  const next = container.querySelector("[data-page-next]");
  const label = container.querySelector("[data-page-label]");

  previous.disabled = currentOffset === 0;
  next.disabled = currentOffset + PAGE_SIZE >= total;
  label.textContent = `Página ${page} de ${totalPages}`;

  previous.onclick = () => {
    currentOffset = Math.max(0, currentOffset - PAGE_SIZE);
    loadPage();
  };
  next.onclick = () => {
    currentOffset += PAGE_SIZE;
    loadPage();
  };
}

export async function initialize() {
  const filterForm = document.querySelector("[data-publication-filters]");
  const listContainer = document.querySelector("[data-admin-publication-list]");
  const notification = document.querySelector("[data-publications-notification]");
  const pagination = document.querySelector("[data-admin-pagination]");
  const deleteDialog = document.querySelector("[data-delete-dialog]");
  const deleteTitle = deleteDialog.querySelector("[data-delete-title]");
  const deleteConfirm = deleteDialog.querySelector("[data-delete-confirm]");
  const deleteCancel = deleteDialog.querySelector("[data-delete-cancel]");

  async function loadPage() {
    clearNotification(notification);
    listContainer.setAttribute("aria-busy", "true");

    const formData = new FormData(filterForm);

    try {
      const result = await listAdminPublications({
        limit: PAGE_SIZE,
        offset: currentOffset,
        search: formData.get("search"),
        state: formData.get("state"),
        type: formData.get("type"),
      });

      if (currentOffset >= result.total && currentOffset > 0) {
        currentOffset = Math.max(0, currentOffset - PAGE_SIZE);
        await loadPage();
        return;
      }

      renderTable(listContainer, result.publications);
      renderPagination(pagination, result.total, loadPage);
    } catch {
      showNotification(
        notification,
        "No se pudieron cargar las publicaciones.",
        "error",
      );
    } finally {
      listContainer.removeAttribute("aria-busy");
    }
  }

  filterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    currentOffset = 0;
    loadPage();
  });

  filterForm.addEventListener("reset", () => {
    window.setTimeout(() => {
      currentOffset = 0;
      loadPage();
    }, 0);
  });

  listContainer.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-publication-action]");

    if (!button) {
      return;
    }

    const id = button.dataset.publicationId;

    if (button.dataset.publicationAction === "delete") {
      publicationPendingDeletion = id;
      deleteTitle.textContent = button.dataset.publicationTitle;
      deleteDialog.showModal();
      return;
    }

    setButtonBusy(button, true, "Archivando…");

    try {
      await archiveAdminPublication(id);
      await loadPage();
      showNotification(
        notification,
        "La publicación fue archivada.",
        "success",
      );
    } catch (error) {
      showNotification(
        notification,
        publicationServiceMessage(error),
        "error",
      );
      setButtonBusy(button, false);
    }
  });

  deleteCancel.addEventListener("click", () => {
    publicationPendingDeletion = null;
    deleteDialog.close();
  });

  deleteConfirm.addEventListener("click", async () => {
    if (!publicationPendingDeletion) {
      return;
    }

    setButtonBusy(deleteConfirm, true, "Eliminando…");

    try {
      await deleteAdminPublication(publicationPendingDeletion);
      publicationPendingDeletion = null;
      deleteDialog.close();
      await loadPage();
      showNotification(
        notification,
        "La publicación y su imagen fueron eliminadas.",
        "success",
      );
    } catch (error) {
      showNotification(
        notification,
        publicationServiceMessage(error),
        "error",
      );
    } finally {
      setButtonBusy(deleteConfirm, false);
    }
  });

  await loadPage();
}
