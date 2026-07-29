const TYPE_COPY = {
  noticia: {
    label: "Noticia",
    pluralLabel: "Noticias",
    listHref: "/noticias.html",
    detailHref: "/noticia.html",
    fallbackImage: "/assets/images/noticia-minga.svg",
  },
  proyecto: {
    label: "Proyecto",
    pluralLabel: "Proyectos",
    listHref: "/proyectos.html",
    detailHref: "/proyecto.html",
    fallbackImage: "/assets/images/noticia-proyecto.svg",
  },
};

const dateFormatter = new Intl.DateTimeFormat("es-EC", {
  dateStyle: "long",
  timeZone: "America/Guayaquil",
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

function append(parent, ...children) {
  parent.append(...children.filter(Boolean));
  return parent;
}

function publicationDate(publication) {
  const date = new Date(publication.fecha_publicacion);

  return {
    iso: date.toISOString(),
    label: dateFormatter.format(date),
  };
}

function detailUrl(publication) {
  const url = new URL(TYPE_COPY[publication.tipo].detailHref, window.location.origin);
  url.searchParams.set("slug", publication.slug);
  return `${url.pathname}${url.search}`;
}

function createImage(publication, { eager = false } = {}) {
  const typeCopy = TYPE_COPY[publication.tipo];
  const hasPublishedImage = Boolean(publication.imageUrl);
  const image = element("img", {
    attributes: {
      src: publication.imageUrl ?? typeCopy.fallbackImage,
      alt: hasPublishedImage
        ? publication.imagen_alt
        : `Ilustración temporal para ${typeCopy.label.toLowerCase()}`,
      width: "800",
      height: "500",
      loading: eager ? "eager" : "lazy",
      decoding: "async",
    },
  });

  return image;
}

export function createPublicationCard(publication, { compact = false } = {}) {
  const copy = TYPE_COPY[publication.tipo];
  const date = publicationDate(publication);
  const article = element("article", {
    className: compact
      ? "publication-card publication-card--compact"
      : "publication-card",
  });
  const imageLink = element("a", {
    className: "publication-card__image",
    attributes: {
      href: detailUrl(publication),
      "aria-label": `Leer ${publication.titulo}`,
    },
  });
  imageLink.append(createImage(publication));

  const content = element("div", { className: "publication-card__content" });
  const meta = element("div", { className: "publication-card__meta" });
  const type = element("span", {
    className: "content-note",
    text: copy.label,
  });
  const time = element("time", {
    text: date.label,
    attributes: { datetime: date.iso },
  });
  const heading = element("h3");
  const titleLink = element("a", {
    text: publication.titulo,
    attributes: { href: detailUrl(publication) },
  });
  heading.append(titleLink);
  meta.append(type, time);
  content.append(meta, heading);

  if (!compact) {
    content.append(
      element("p", {
        className: "publication-card__summary",
        text: publication.resumen,
      }),
    );
  }

  const readLink = element("a", {
    className: "text-link",
    attributes: { href: detailUrl(publication) },
  });
  readLink.append(
    document.createTextNode(`Leer ${copy.label.toLowerCase()} `),
    element("span", { text: "→", attributes: { "aria-hidden": "true" } }),
  );
  content.append(readLink);
  article.append(imageLink, content);

  return article;
}

export function createPublicationGrid(publications, { compact = false } = {}) {
  const grid = element("div", {
    className: compact
      ? "publication-grid publication-grid--compact"
      : "publication-grid",
  });

  for (const publication of publications) {
    grid.append(createPublicationCard(publication, { compact }));
  }

  return grid;
}

export function createLoadingState(label = "Cargando publicaciones…") {
  const status = element("div", {
    className: "publication-status publication-status--loading",
    attributes: { role: "status" },
  });
  const indicator = element("span", {
    className: "loading-indicator",
    attributes: { "aria-hidden": "true" },
  });

  return append(status, indicator, element("p", { text: label }));
}

export function createEmptyState(type = null) {
  const isSingleType = Boolean(type);
  const copy = isSingleType ? TYPE_COPY[type] : null;
  const state = element("div", { className: "empty-state" });
  const icon = element("img", {
    attributes: {
      src: type === "proyecto"
        ? "/assets/icons/proyectos.png"
        : "/assets/icons/noticias.png",
      width: "48",
      height: "48",
      alt: "",
      "aria-hidden": "true",
    },
  });
  const note = element("span", {
    className: "content-note",
    text: "Información verificada",
  });
  const heading = element("h3", {
    text: isSingleType
      ? `Todavía no hay ${copy.pluralLabel.toLowerCase()} ${
          type === "noticia" ? "publicadas" : "publicados"
        }`
      : "Todavía no hay publicaciones",
  });
  const paragraph = element("p", {
    text: isSingleType
      ? `Cuando la comunidad publique ${copy.pluralLabel.toLowerCase()}, aparecerán aquí.`
      : "Cuando la comunidad publique noticias o proyectos, aparecerán aquí.",
  });

  return append(state, icon, note, heading, paragraph);
}

export function createErrorState({ onRetry, compact = false } = {}) {
  const state = element("div", {
    className: compact
      ? "publication-error publication-error--compact"
      : "empty-state publication-error",
    attributes: { role: "alert" },
  });
  const heading = element(compact ? "strong" : "h3", {
    text: "No pudimos cargar las publicaciones",
  });
  const paragraph = element("p", {
    text: "Comprueba tu conexión e inténtalo nuevamente.",
  });
  const retry = element("button", {
    className: "button button--primary",
    text: "Reintentar",
    attributes: { type: "button" },
  });
  retry.addEventListener("click", onRetry, { once: true });

  return append(state, heading, paragraph, retry);
}

export function createLoadMoreButton(onClick) {
  const wrapper = element("div", { className: "publication-list__actions" });
  const button = element("button", {
    className: "button button--outline",
    text: "Cargar más",
    attributes: { type: "button" },
  });
  button.addEventListener("click", onClick);
  wrapper.append(button);

  return { wrapper, button };
}

export function createDetailState({
  type,
  title,
  message,
  note,
  onRetry,
}) {
  const copy = TYPE_COPY[type];
  const state = element("div", { className: "empty-state" });
  const icon = element("img", {
    attributes: {
      src: type === "proyecto"
        ? "/assets/icons/proyectos.png"
        : "/assets/icons/noticias.png",
      width: "48",
      height: "48",
      alt: "",
      "aria-hidden": "true",
    },
  });
  const noteElement = element("span", {
    className: "content-note",
    text: note,
  });
  const heading = element("h1", {
    text: title,
    attributes: { id: `${type}-detail-title` },
  });
  const paragraph = element("p", { text: message });
  const action = onRetry
    ? element("button", {
        className: "button button--primary",
        text: "Reintentar",
        attributes: { type: "button" },
      })
    : element("a", {
        className: "button button--primary",
        text: `Volver a ${copy.pluralLabel.toLowerCase()}`,
        attributes: { href: copy.listHref },
      });

  if (onRetry) {
    action.addEventListener("click", onRetry, { once: true });
  }

  return append(state, icon, noteElement, heading, paragraph, action);
}

export function createPublicationDetail(publication) {
  const copy = TYPE_COPY[publication.tipo];
  const date = publicationDate(publication);
  const article = element("article", { className: "publication-detail" });
  const header = element("header", { className: "publication-detail__header" });
  const meta = element("div", { className: "publication-detail__meta" });
  meta.append(
    element("span", { className: "content-note", text: copy.label }),
    element("time", {
      text: date.label,
      attributes: { datetime: date.iso },
    }),
  );
  header.append(
    meta,
    element("h1", {
      text: publication.titulo,
      attributes: { id: `${publication.tipo}-detail-title` },
    }),
    element("p", {
      className: "publication-detail__lead",
      text: publication.resumen,
    }),
  );
  article.append(header);

  if (publication.imageUrl) {
    const figure = element("figure", {
      className: "publication-detail__figure",
    });
    figure.append(createImage(publication, { eager: true }));
    article.append(figure);
  }

  const body = element("div", {
    className: "publication-detail__body prose",
  });
  const paragraphs = publication.contenido
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  for (const paragraph of paragraphs) {
    body.append(element("p", { text: paragraph }));
  }

  const backLink = element("a", {
    className: "button button--outline publication-detail__back",
    text: `Volver a ${copy.pluralLabel.toLowerCase()}`,
    attributes: { href: copy.listHref },
  });
  article.append(body, backLink);

  return article;
}

export function updateDetailMetadata(publication) {
  const copy = TYPE_COPY[publication.tipo];
  const title = `${publication.titulo} | La Buena Esperanza`;
  document.title = title;

  const description = document.querySelector('meta[name="description"]');
  const openGraphTitle = document.querySelector('meta[property="og:title"]');
  const openGraphDescription = document.querySelector(
    'meta[property="og:description"]',
  );
  const currentBreadcrumb = document.querySelector(
    "[data-detail-breadcrumb-current]",
  );

  if (description) {
    description.setAttribute("content", publication.resumen);
  }

  if (openGraphTitle) {
    openGraphTitle.setAttribute("content", title);
  }

  if (openGraphDescription) {
    openGraphDescription.setAttribute("content", publication.resumen);
  }

  if (currentBreadcrumb) {
    currentBreadcrumb.textContent = publication.titulo;
  }

  document.body.dataset.publicationType = copy.label.toLowerCase();
}
