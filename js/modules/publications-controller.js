import {
  getPublishedPublicationBySlug,
  listPublishedPublications,
} from "./publication-service.js";
import {
  createDetailState,
  createEmptyState,
  createErrorState,
  createLoadMoreButton,
  createLoadingState,
  createPublicationDetail,
  createPublicationGrid,
  updateDetailMetadata,
} from "./publication-view.js";

const PAGE_SIZE = 6;
const HOME_LIMIT = 4;

function replaceContent(container, child) {
  container.replaceChildren(child);
}

function initializePublicationList(container) {
  const type = container.dataset.publicationType;
  let offset = 0;
  let isLoading = false;
  let grid;
  let controls;

  async function loadPage({ reset = false } = {}) {
    if (isLoading) {
      return;
    }

    isLoading = true;
    container.setAttribute("aria-busy", "true");

    if (reset) {
      offset = 0;
      grid = undefined;
      controls = undefined;
      replaceContent(container, createLoadingState());
    } else if (controls?.button) {
      controls.button.disabled = true;
      controls.button.textContent = "Cargando…";
    }

    try {
      const { publications, total } = await listPublishedPublications({
        type,
        offset,
        limit: PAGE_SIZE,
      });

      if (offset === 0 && publications.length === 0) {
        replaceContent(container, createEmptyState(type));
        return;
      }

      if (!grid) {
        grid = createPublicationGrid(publications);
        container.replaceChildren(grid);
      } else {
        for (const card of [...createPublicationGrid(publications).children]) {
          grid.append(card);
        }
      }

      offset += publications.length;

      if (offset < total) {
        controls = createLoadMoreButton(() => loadPage());
        container.append(controls.wrapper);
      } else {
        controls = undefined;
      }
    } catch {
      if (!grid) {
        replaceContent(
          container,
          createErrorState({ onRetry: () => loadPage({ reset: true }) }),
        );
      } else {
        controls?.wrapper.remove();
        const error = createErrorState({
          compact: true,
          onRetry: () => {
            error.remove();
            loadPage();
          },
        });
        container.append(error);
      }
    } finally {
      isLoading = false;
      container.removeAttribute("aria-busy");
    }
  }

  loadPage({ reset: true });
}

function initializeLatestPublications(container) {
  async function loadLatest() {
    container.setAttribute("aria-busy", "true");
    replaceContent(
      container,
      createLoadingState("Cargando la actualidad comunitaria…"),
    );

    try {
      const { publications } = await listPublishedPublications({
        limit: HOME_LIMIT,
      });

      replaceContent(
        container,
        publications.length
          ? createPublicationGrid(publications, { compact: true })
          : createEmptyState(),
      );
    } catch {
      replaceContent(
        container,
        createErrorState({
          compact: true,
          onRetry: loadLatest,
        }),
      );
    } finally {
      container.removeAttribute("aria-busy");
    }
  }

  loadLatest();
}

function initializePublicationDetail(container) {
  const type = container.dataset.publicationType;
  const copy = type === "noticia" ? "noticia" : "proyecto";
  const slug = new URLSearchParams(window.location.search).get("slug")?.trim();

  if (
    !slug ||
    slug.length < 3 ||
    slug.length > 180 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
  ) {
    replaceContent(
      container,
      createDetailState({
        type,
        note: "Publicación no seleccionada",
        title: `No hay ${copy === "noticia" ? "una noticia seleccionada" : "un proyecto seleccionado"}`,
        message: `Abre ${copy === "noticia" ? "una noticia" : "un proyecto"} desde el listado para consultar su información.`,
      }),
    );
    return;
  }

  async function loadDetail() {
    container.setAttribute("aria-busy", "true");
    replaceContent(
      container,
      createDetailState({
        type,
        note: "Cargando información",
        title: `Cargando ${copy}…`,
        message: "Estamos consultando la publicación verificada.",
      }),
    );

    try {
      const publication = await getPublishedPublicationBySlug({ type, slug });

      if (!publication) {
        replaceContent(
          container,
          createDetailState({
            type,
            note: "No disponible",
            title:
              copy === "noticia"
                ? "Noticia no encontrada"
                : "Proyecto no encontrado",
            message:
              "La publicación no existe, aún no está vigente o ya no está publicada.",
          }),
        );
        return;
      }

      replaceContent(container, createPublicationDetail(publication));
      updateDetailMetadata(publication);
    } catch {
      replaceContent(
        container,
        createDetailState({
          type,
          note: "Error de conexión",
          title: `No pudimos cargar ${copy === "noticia" ? "la" : "el"} ${copy}`,
          message: "Comprueba tu conexión e inténtalo nuevamente.",
          onRetry: loadDetail,
        }),
      );
    } finally {
      container.removeAttribute("aria-busy");
    }
  }

  loadDetail();
}

export function initializePublications() {
  const list = document.querySelector("[data-publication-list]");
  const latest = document.querySelector("[data-latest-publications]");
  const detail = document.querySelector("[data-publication-detail]");

  if (list) {
    initializePublicationList(list);
  }

  if (latest) {
    initializeLatestPublications(latest);
  }

  if (detail) {
    initializePublicationDetail(detail);
  }
}
