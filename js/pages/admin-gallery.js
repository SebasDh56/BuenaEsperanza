import {
  archiveAdminGalleryItem,
  deleteAdminGalleryItem,
  galleryServiceMessage,
  listAdminGalleryItems,
} from "../modules/gallery-admin-service.js";
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
let itemPendingDeletion = null;

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

function stateLabel(state) {
  return state === "publicado"
    ? "Publicado"
    : state === "borrador"
      ? "Borrador"
      : "Archivado";
}

function createActionButton(label, action, item) {
  const button = element("button", {
    className: `admin-table-action admin-table-action--${action}`,
    text: label,
    attributes: {
      type: "button",
      "data-gallery-action": action,
      "data-gallery-id": item.id,
    },
  });
  button.dataset.galleryTitle = item.titulo;

  return button;
}

function renderTable(container, items) {
  if (items.length === 0) {
    const empty = element("div", { className: "admin-empty-state" });
    empty.append(
      element("h2", { text: "No hay fotografías" }),
      element("p", {
        text: "Ajusta los filtros o incorpora una fotografía real y autorizada.",
      }),
    );
    container.replaceChildren(empty);
    return;
  }

  const wrapper = element("div", { className: "admin-table-wrapper" });
  const table = element("table", { className: "admin-table" });
  const caption = element("caption", {
    className: "visually-hidden",
    text: "Fotografías administrables",
  });
  const head = element("thead");
  const headRow = element("tr");

  for (const heading of ["Fotografía", "Orden", "Estado", "Actualización", "Acciones"]) {
    headRow.append(element("th", { text: heading, attributes: { scope: "col" } }));
  }

  head.append(headRow);
  const body = element("tbody");

  for (const item of items) {
    const row = element("tr");
    const titleCell = element("td");
    titleCell.append(
      element("strong", { text: item.titulo }),
      element("small", {
        text: item.credito ? `Crédito: ${item.credito}` : "Sin crédito registrado",
      }),
    );

    const orderCell = element("td", { text: String(item.orden) });
    orderCell.dataset.label = "Orden";

    const stateCell = element("td");
    stateCell.dataset.label = "Estado";
    stateCell.append(
      element("span", {
        className: `admin-status admin-status--${item.estado}`,
        text: stateLabel(item.estado),
      }),
    );

    const dateCell = element("td", {
      text: dateFormatter.format(new Date(item.updated_at)),
    });
    dateCell.dataset.label = "Actualización";

    const actions = element("td", { className: "admin-table__actions" });
    actions.dataset.label = "Acciones";
    actions.append(
      element("a", {
        className: "admin-table-action",
        text: "Editar",
        attributes: {
          href: `/admin/galeria-editor.html?id=${encodeURIComponent(item.id)}`,
        },
      }),
    );

    if (item.estado !== "archivado") {
      actions.append(createActionButton("Archivar", "archive", item));
    }

    actions.append(createActionButton("Eliminar", "delete", item));
    row.append(titleCell, orderCell, stateCell, dateCell, actions);
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
  const filterForm = document.querySelector("[data-gallery-filters]");
  const listContainer = document.querySelector("[data-admin-gallery-list]");
  const notification = document.querySelector("[data-gallery-notification]");
  const pagination = document.querySelector("[data-admin-pagination]");
  const deleteDialog = document.querySelector("[data-gallery-delete-dialog]");
  const deleteTitle = deleteDialog.querySelector("[data-delete-title]");
  const deleteConfirm = deleteDialog.querySelector("[data-delete-confirm]");
  const deleteCancel = deleteDialog.querySelector("[data-delete-cancel]");

  async function loadPage() {
    clearNotification(notification);
    listContainer.setAttribute("aria-busy", "true");
    const formData = new FormData(filterForm);

    try {
      const result = await listAdminGalleryItems({
        limit: PAGE_SIZE,
        offset: currentOffset,
        search: formData.get("search"),
        state: formData.get("state"),
      });

      if (currentOffset >= result.total && currentOffset > 0) {
        currentOffset = Math.max(0, currentOffset - PAGE_SIZE);
        await loadPage();
        return;
      }

      renderTable(listContainer, result.items);
      renderPagination(pagination, result.total, loadPage);
    } catch {
      showNotification(
        notification,
        "No se pudieron cargar las fotografías.",
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
    const button = event.target.closest("[data-gallery-action]");

    if (!button) {
      return;
    }

    if (button.dataset.galleryAction === "delete") {
      itemPendingDeletion = button.dataset.galleryId;
      deleteTitle.textContent = button.dataset.galleryTitle;
      deleteDialog.showModal();
      return;
    }

    setButtonBusy(button, true, "Archivando…");

    try {
      await archiveAdminGalleryItem(button.dataset.galleryId);
      await loadPage();
      showNotification(notification, "La fotografía fue archivada.", "success");
    } catch (error) {
      showNotification(notification, galleryServiceMessage(error), "error");
      setButtonBusy(button, false);
    }
  });

  deleteCancel.addEventListener("click", () => {
    itemPendingDeletion = null;
    deleteDialog.close();
  });
  deleteConfirm.addEventListener("click", async () => {
    if (!itemPendingDeletion) {
      return;
    }

    setButtonBusy(deleteConfirm, true, "Eliminando…");

    try {
      await deleteAdminGalleryItem(itemPendingDeletion);
      itemPendingDeletion = null;
      deleteDialog.close();
      await loadPage();
      showNotification(
        notification,
        "La fotografía y su archivo fueron eliminados.",
        "success",
      );
    } catch (error) {
      showNotification(notification, galleryServiceMessage(error), "error");
    } finally {
      setButtonBusy(deleteConfirm, false);
    }
  });

  await loadPage();
}
