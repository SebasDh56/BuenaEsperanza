import { listAdminProposals } from "../modules/proposal-admin-service.js";
import { showNotification } from "../modules/notifications.js";

const PAGE_SIZE = 20;
const dateFormatter = new Intl.DateTimeFormat("es-EC", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Guayaquil",
});
const TYPE_LABELS = {
  pasantia: "Pasantía",
  tesis: "Tesis",
  investigacion: "Investigación",
  proyecto_comunitario: "Proyecto comunitario",
  apoyo_institucional: "Apoyo institucional",
  otro: "Otra",
};
const STATE_LABELS = {
  nueva: "Nueva",
  en_revision: "En revisión",
  contactada: "Contactada",
  aceptada: "Aceptada",
  cerrada: "Cerrada",
};
let currentOffset = 0;

function element(tag, { text, className, attributes = {} } = {}) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  for (const [name, value] of Object.entries(attributes)) {
    node.setAttribute(name, value);
  }
  return node;
}

function renderTable(container, proposals) {
  if (!proposals.length) {
    const empty = element("div", { className: "admin-empty-state" });
    empty.append(
      element("h2", { text: "No hay propuestas" }),
      element("p", { text: "Ajusta los filtros o vuelve a consultar más tarde." }),
    );
    container.replaceChildren(empty);
    return;
  }

  const wrapper = element("div", { className: "admin-table-wrapper" });
  const table = element("table", { className: "admin-table" });
  const head = element("thead");
  const headRow = element("tr");
  for (const label of ["Propuesta", "Tipo", "Estado", "Recibida", "Acciones"]) {
    headRow.append(element("th", { text: label, attributes: { scope: "col" } }));
  }
  head.append(headRow);
  const body = element("tbody");

  for (const proposal of proposals) {
    const row = element("tr");
    const title = element("td");
    title.append(
      element("strong", { text: proposal.titulo }),
      element("small", { text: `${proposal.nombre_responsable} · ${proposal.email}` }),
    );
    const type = element("td", { text: TYPE_LABELS[proposal.tipo] });
    type.dataset.label = "Tipo";
    const state = element("td");
    state.dataset.label = "Estado";
    state.append(element("span", {
      text: STATE_LABELS[proposal.estado],
      className: `admin-status admin-status--${proposal.estado}`,
    }));
    const received = element("td", {
      text: dateFormatter.format(new Date(proposal.created_at)),
    });
    received.dataset.label = "Recibida";
    const actions = element("td", { className: "admin-table__actions" });
    actions.dataset.label = "Acciones";
    actions.append(element("a", {
      text: "Revisar",
      className: "admin-table-action",
      attributes: {
        href: `/admin/propuesta.html?id=${encodeURIComponent(proposal.id)}`,
      },
    }));
    row.append(title, type, state, received, actions);
    body.append(row);
  }

  table.append(head, body);
  wrapper.append(table);
  container.replaceChildren(wrapper);
}

export async function initialize() {
  const form = document.querySelector("[data-proposal-filters]");
  const container = document.querySelector("[data-admin-proposal-list]");
  const notification = document.querySelector("[data-proposals-notification]");
  const pagination = document.querySelector("[data-admin-pagination]");

  async function loadPage() {
    container.setAttribute("aria-busy", "true");
    const fields = new FormData(form);

    try {
      const result = await listAdminProposals({
        limit: PAGE_SIZE,
        offset: currentOffset,
        search: fields.get("search"),
        state: fields.get("state"),
        type: fields.get("type"),
      });

      if (currentOffset >= result.total && currentOffset > 0) {
        currentOffset = Math.max(0, currentOffset - PAGE_SIZE);
        await loadPage();
        return;
      }

      renderTable(container, result.proposals);
      const page = Math.floor(currentOffset / PAGE_SIZE) + 1;
      const pages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
      const previous = pagination.querySelector("[data-page-previous]");
      const next = pagination.querySelector("[data-page-next]");
      previous.disabled = currentOffset === 0;
      next.disabled = currentOffset + PAGE_SIZE >= result.total;
      pagination.querySelector("[data-page-label]").textContent = `Página ${page} de ${pages}`;
      previous.onclick = () => {
        currentOffset = Math.max(0, currentOffset - PAGE_SIZE);
        loadPage();
      };
      next.onclick = () => {
        currentOffset += PAGE_SIZE;
        loadPage();
      };
    } catch {
      showNotification(notification, "No se pudieron cargar las propuestas.", "error");
    } finally {
      container.removeAttribute("aria-busy");
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    currentOffset = 0;
    loadPage();
  });
  form.addEventListener("reset", () => {
    window.setTimeout(() => {
      currentOffset = 0;
      loadPage();
    }, 0);
  });
  await loadPage();
}
