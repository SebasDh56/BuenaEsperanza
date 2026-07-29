import { access, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  slugify,
  validatePublicationInput,
} from "../js/modules/validation.js";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptsDirectory, "..");
const errors = [];
const sdkUrl =
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.106.2";
const adminPages = [
  ["login.html", "data-login-form"],
  ["dashboard.html", 'data-admin-page="dashboard"'],
  ["publicaciones.html", "data-admin-publication-list"],
  ["editor.html", "data-publication-editor"],
];

function assert(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function validatePages() {
  for (const [filename, marker] of adminPages) {
    const path = join(projectRoot, "dist", "admin", filename);
    assert(await exists(path), `Falta dist/admin/${filename}.`);

    if (!(await exists(path))) {
      continue;
    }

    const html = await readFile(path, "utf8");
    assert(html.includes(marker), `${filename} no contiene ${marker}.`);
    assert(
      html.includes('name="robots" content="noindex,nofollow"'),
      `${filename} no está excluido de indexación.`,
    );
    assert(
      html.includes(sdkUrl),
      `${filename} no carga la versión fijada de Supabase.`,
    );
    assert(
      html.includes('src="/js/admin.js"'),
      `${filename} no carga el controlador administrativo.`,
    );
  }
}

async function validateModules() {
  const modulePaths = [
    join(projectRoot, "js", "admin.js"),
    join(projectRoot, "js", "modules", "auth.js"),
    join(projectRoot, "js", "modules", "admin-service.js"),
    join(projectRoot, "js", "modules", "image-processor.js"),
    join(projectRoot, "js", "modules", "validation.js"),
    join(projectRoot, "js", "pages", "admin-login.js"),
    join(projectRoot, "js", "pages", "admin-dashboard.js"),
    join(projectRoot, "js", "pages", "admin-publications.js"),
    join(projectRoot, "js", "pages", "admin-editor.js"),
  ];
  const sources = new Map();

  for (const path of modulePaths) {
    const source = await readFile(path, "utf8");
    sources.set(path, source);
    assert(
      !/\b(?:innerHTML|outerHTML|insertAdjacentHTML|document\.write)\b/.test(
        source,
      ),
      `${path} usa una API HTML insegura.`,
    );
    assert(
      !/(?:sb_secret_|service_role|postgresql:\/\/)/i.test(source),
      `${path} contiene una referencia de credencial elevada.`,
    );
  }

  const auth = sources.get(join(projectRoot, "js", "modules", "auth.js"));
  assert(
    /\.auth\.getUser\(\)/.test(auth) && !/\.auth\.getSession\(\)/.test(auth),
    "La protección de rutas no verifica al usuario con Auth.",
  );
  assert(
    /signOut\(\{ scope: "local" \}\)/.test(auth),
    "El cierre de sesión no está limitado a la sesión actual.",
  );
  assert(
    /signInWithPassword/.test(auth),
    "El acceso no usa autenticación por contraseña.",
  );

  const service = sources.get(
    join(projectRoot, "js", "modules", "admin-service.js"),
  );
  const archiveIndex = service.indexOf("await archiveAdminPublication(id)");
  const storageDeleteIndex = service.indexOf(
    "await removeImage(client, publication.imagen_path)",
  );
  const rowDeleteIndex = service.indexOf('.from("publicaciones")\n    .delete()');
  assert(
    archiveIndex >= 0 &&
      storageDeleteIndex > archiveIndex &&
      rowDeleteIndex > storageDeleteIndex,
    "La eliminación no sigue el orden archivar, borrar imagen y borrar fila.",
  );
  assert(
    /\.upload\(path, processedImage\.blob/.test(service),
    "El servicio no sube la imagen procesada.",
  );

  const imageProcessor = sources.get(
    join(projectRoot, "js", "modules", "image-processor.js"),
  );
  assert(
    /MAX_LONG_EDGE = 2400/.test(imageProcessor) &&
      /"image\/webp"/.test(imageProcessor),
    "El procesamiento no limita dimensiones o no genera WebP.",
  );
}

function validateRules() {
  assert(
    slugify("Minga Comunitaria en Guachalá") ===
      "minga-comunitaria-en-guachala",
    "La generación de slug no normaliza correctamente.",
  );

  const baseInput = {
    contenido:
      "Contenido comunitario confirmado con extensión suficiente para validar correctamente el formulario editorial.",
    estado: "borrador",
    imagenAlt: "",
    publicationTiming: "ahora",
    resumen:
      "Resumen comunitario confirmado y suficientemente descriptivo.",
    scheduledAt: "",
    slug: "publicacion-comunitaria",
    tipo: "noticia",
    titulo: "Publicación comunitaria",
  };
  const draft = validatePublicationInput(baseInput);
  assert(draft.isValid, "Un borrador válido sin imagen fue rechazado.");

  const publishedWithoutImage = validatePublicationInput({
    ...baseInput,
    estado: "publicado",
  });
  assert(
    !publishedWithoutImage.isValid &&
      Boolean(publishedWithoutImage.errors.imagen),
    "Se permite publicar sin imagen principal.",
  );

  const published = validatePublicationInput(
    {
      ...baseInput,
      estado: "publicado",
      imagenAlt: "Familias reunidas en una actividad comunitaria",
    },
    { hasImage: true },
  );
  assert(
    published.isValid && Boolean(published.values.fecha_publicacion),
    "La publicación inmediata válida fue rechazada.",
  );

  const scheduledPast = validatePublicationInput(
    {
      ...baseInput,
      estado: "publicado",
      imagenAlt: "Familias reunidas en una actividad comunitaria",
      publicationTiming: "programar",
      scheduledAt: "2020-01-01T10:00",
    },
    { hasImage: true },
  );
  assert(
    Boolean(scheduledPast.errors.scheduledAt),
    "Se permite programar una publicación en el pasado.",
  );
}

async function validateStoragePolicy() {
  const policy = await readFile(
    join(
      projectRoot,
      "supabase",
      "policies",
      "202607280004_storage_admin_upload.sql",
    ),
    "utf8",
  );
  assert(
    /storage_publicaciones_insert_authorized[\s\S]*private\.is_admin\(\)/i.test(
      policy,
    ),
    "La política de carga no contempla al administrador.",
  );
}

async function validate() {
  await validatePages();
  await validateModules();
  validateRules();
  await validateStoragePolicy();

  if (errors.length > 0) {
    console.error("La validación administrativa encontró problemas:");

    for (const error of errors) {
      console.error(`- ${error}`);
    }

    process.exitCode = 1;
    return;
  }

  console.log(
    "Validación administrativa completada: rutas, autenticación, CRUD, imágenes y reglas revisadas.",
  );
}

validate().catch((error) => {
  console.error(`No se pudo validar la Fase 5: ${error.message}`);
  process.exitCode = 1;
});
