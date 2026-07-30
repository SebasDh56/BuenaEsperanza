import {
  deleteAdminProposal,
  getAdminProposal,
  getProposalDocumentUrl,
  proposalAdminMessage,
  updateAdminProposal,
} from "../modules/proposal-admin-service.js";
import { setButtonBusy, showNotification } from "../modules/notifications.js";

const TYPE_LABELS = {
  pasantia: "Pasantía o práctica",
  tesis: "Tesis",
  investigacion: "Investigación académica",
  proyecto_comunitario: "Proyecto comunitario",
  apoyo_institucional: "Apoyo institucional",
  otro: "Otra propuesta",
};
const dateFormatter = new Intl.DateTimeFormat("es-EC", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "America/Guayaquil",
});

function detailRow(label, value, { href = null } = {}) {
  const wrapper = document.createElement("div");
  const term = document.createElement("dt");
  const detail = document.createElement("dd");
  term.textContent = label;
  if (href) {
    const link = document.createElement("a");
    link.href = href;
    link.textContent = value;
    detail.append(link);
  } else {
    detail.textContent = value || "No indicado";
  }
  wrapper.append(term, detail);
  return wrapper;
}

function renderDetail(container, proposal) {
  const panel = document.createElement("section");
  panel.className = "admin-panel admin-proposal-detail";
  const heading = document.createElement("div");
  heading.className = "admin-panel__heading";
  const title = document.createElement("h2");
  title.textContent = "Información recibida";
  heading.append(title);
  const list = document.createElement("dl");
  list.append(
    detailRow("Tipo", TYPE_LABELS[proposal.tipo]),
    detailRow("Responsable", proposal.nombre_responsable),
    detailRow("Organización", proposal.organizacion),
    detailRow("Correo", proposal.email, { href: `mailto:${proposal.email}` }),
    detailRow(
      "Teléfono",
      proposal.telefono,
      proposal.telefono ? { href: `tel:${proposal.telefono.replace(/[^\d+]/g, "")}` } : {},
    ),
    detailRow("Duración", proposal.duracion_estimada),
    detailRow("Recibida", dateFormatter.format(new Date(proposal.created_at))),
    detailRow("Conservar hasta", dateFormatter.format(new Date(proposal.retention_until))),
  );
  const descriptionTitle = document.createElement("h3");
  descriptionTitle.textContent = "Descripción";
  const description = document.createElement("p");
  description.className = "admin-proposal-detail__description";
  description.textContent = proposal.descripcion || "La propuesta fue enviada mediante un documento PDF.";
  panel.append(heading, list, descriptionTitle, description);

  if (proposal.archivo_path) {
    const download = document.createElement("button");
    download.className = "admin-button admin-button--ghost";
    download.type = "button";
    download.textContent = `Descargar ${proposal.archivo_nombre}`;
    download.addEventListener("click", async () => {
      setButtonBusy(download, true, "Preparando…");
      try {
        const url = await getProposalDocumentUrl(proposal.archivo_path);
        window.open(url, "_blank", "noopener,noreferrer");
      } finally {
        setButtonBusy(download, false);
      }
    });
    panel.append(download);
  }

  container.replaceChildren(panel);
  container.removeAttribute("aria-busy");
}

export async function initialize(context) {
  const id = new URLSearchParams(window.location.search).get("id") ?? "";
  const container = document.querySelector("[data-proposal-detail]");
  const form = document.querySelector("[data-proposal-review]");
  const notification = document.querySelector("[data-proposal-notification]");
  const title = document.querySelector("[data-proposal-title]");
  const deleteButton = document.querySelector("[data-proposal-delete]");
  const dialog = document.querySelector("[data-proposal-delete-dialog]");
  const cancel = dialog.querySelector("[data-delete-cancel]");
  const confirm = dialog.querySelector("[data-delete-confirm]");
  let proposal;

  try {
    proposal = await getAdminProposal(id);
    if (!proposal) throw new Error("La propuesta no existe.");
    title.textContent = proposal.titulo;
    renderDetail(container, proposal);
    form.elements.estado.value = proposal.estado;
    form.elements.notas.value = proposal.notas_internas ?? "";
    form.hidden = false;
    deleteButton.hidden = context.profile.rol !== "administrador";
  } catch (error) {
    container.removeAttribute("aria-busy");
    showNotification(notification, proposalAdminMessage(error), "error");
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector('[type="submit"]');
    setButtonBusy(button, true, "Guardando…");
    try {
      proposal = await updateAdminProposal(id, {
        state: form.elements.estado.value,
        notes: form.elements.notas.value,
      });
      showNotification(notification, "El seguimiento fue actualizado.", "success");
    } catch (error) {
      showNotification(notification, proposalAdminMessage(error), "error");
    } finally {
      setButtonBusy(button, false);
    }
  });

  deleteButton.addEventListener("click", () => dialog.showModal());
  cancel.addEventListener("click", () => dialog.close());
  confirm.addEventListener("click", async () => {
    setButtonBusy(confirm, true, "Eliminando…");
    try {
      await deleteAdminProposal(id);
      window.location.replace("/admin/propuestas.html");
    } catch (error) {
      showNotification(notification, proposalAdminMessage(error), "error");
      dialog.close();
      setButtonBusy(confirm, false);
    }
  });
}
