import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateGalleryInput } from "../js/modules/gallery-validation.js";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptsDirectory, "..");
const errors = [];
const sdkUrl =
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.106.2";

function assert(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

async function validatePages() {
  const publicPage = await readFile(
    join(projectRoot, "dist", "galeria.html"),
    "utf8",
  );
  assert(
    publicPage.includes("data-gallery-list"),
    "La página pública no contiene el listado dinámico.",
  );
  assert(
    publicPage.includes("data-gallery-dialog"),
    "La página pública no contiene el detalle accesible.",
  );
  assert(
    publicPage.includes(sdkUrl),
    "La galería pública no carga la versión fijada de Supabase.",
  );

  for (const [filename, marker] of [
    ["galeria.html", "data-admin-gallery-list"],
    ["galeria-editor.html", "data-gallery-editor"],
  ]) {
    const html = await readFile(
      join(projectRoot, "dist", "admin", filename),
      "utf8",
    );
    assert(html.includes(marker), `${filename} no contiene ${marker}.`);
    assert(
      html.includes('name="robots" content="noindex,nofollow"'),
      `${filename} no está excluido de indexación.`,
    );
    assert(
      html.includes(sdkUrl),
      `${filename} no carga la versión fijada de Supabase.`,
    );
  }
}

async function validateModules() {
  const moduleNames = [
    "gallery-service.js",
    "gallery-controller.js",
    "gallery-admin-service.js",
    "gallery-validation.js",
  ];
  const sources = new Map();

  for (const filename of moduleNames) {
    const path = join(projectRoot, "js", "modules", filename);
    const source = await readFile(path, "utf8");
    sources.set(filename, source);
    assert(
      !/\b(?:innerHTML|outerHTML|insertAdjacentHTML|document\.write)\b/.test(
        source,
      ),
      `${filename} usa una API HTML insegura.`,
    );
    assert(
      !/(?:sb_secret_|service_role|postgresql:\/\/)/i.test(source),
      `${filename} contiene una referencia de credencial elevada.`,
    );
  }

  const publicService = sources.get("gallery-service.js");
  assert(
    /\.eq\("estado", "publicado"\)/.test(publicService),
    "El servicio público no limita el estado a publicado.",
  );
  assert(
    /\.createSignedUrls\([\s\S]*item\.imagen_path,[\s\S]*item\.imagen_miniatura_path/.test(
      publicService,
    ),
    "La galería no crea enlaces firmados para la imagen y su miniatura.",
  );
  assert(
    /\.range\(offset, offset \+ limit - 1\)/.test(publicService),
    "La galería pública no aplica paginación.",
  );

  const adminService = sources.get("gallery-admin-service.js");
  const archiveIndex = adminService.indexOf("await archiveAdminGalleryItem(id)");
  const storageDeleteIndex = adminService.indexOf(
    "await removeImage(client, item.imagen_path)",
  );
  const rowDeleteIndex = adminService.indexOf(
    '.from("galeria_items")\n    .delete()',
  );
  assert(
    archiveIndex >= 0 &&
      storageDeleteIndex > archiveIndex &&
      rowDeleteIndex > storageDeleteIndex,
    "La eliminación no sigue archivar, borrar archivo y borrar fila.",
  );
  assert(
    /\.upload\(path, processedImage\.blob/.test(adminService),
    "El servicio administrativo no sube la imagen procesada.",
  );
  assert(
    /\.upload\(thumbnailPath, processedImage\.thumbnailBlob/.test(adminService),
    "El servicio administrativo no sube la miniatura procesada.",
  );
}

function validateRules() {
  const valid = validateGalleryInput(
    {
      titulo: "Minga comunitaria",
      descripcion:
        "Fotografía autorizada que documenta una actividad comunitaria.",
      imagenAlt: "Personas participando en una minga comunitaria",
      fechaToma: "2025-06-10",
      credito: "Archivo comunitario",
      estado: "publicado",
      orden: "10",
    },
    { hasImage: true },
  );
  assert(valid.isValid, "Una fotografía válida fue rechazada.");

  const withoutImage = validateGalleryInput({
    titulo: "Minga comunitaria",
    descripcion:
      "Fotografía autorizada que documenta una actividad comunitaria.",
    imagenAlt: "Personas participando en una minga comunitaria",
    fechaToma: "",
    credito: "",
    estado: "borrador",
    orden: "0",
  });
  assert(
    Boolean(withoutImage.errors.imagen),
    "Se permite guardar una ficha sin fotografía.",
  );

  const futureDate = validateGalleryInput(
    {
      titulo: "Minga comunitaria",
      descripcion:
        "Fotografía autorizada que documenta una actividad comunitaria.",
      imagenAlt: "Personas participando en una minga comunitaria",
      fechaToma: "2999-01-01",
      credito: "",
      estado: "publicado",
      orden: "0",
    },
    { hasImage: true },
  );
  assert(
    Boolean(futureDate.errors.fechaToma),
    "Se permite una fecha de fotografía futura.",
  );
}

async function validateSql() {
  const schema = await readFile(
    join(
      projectRoot,
      "supabase",
      "migrations",
      "202607290005_gallery_schema.sql",
    ),
    "utf8",
  );
  const rls = await readFile(
    join(
      projectRoot,
      "supabase",
      "policies",
      "202607290006_gallery_rls.sql",
    ),
    "utf8",
  );
  const storage = await readFile(
    join(
      projectRoot,
      "supabase",
      "policies",
      "202607290007_gallery_storage.sql",
    ),
    "utf8",
  );

  assert(
    /create table public\.galeria_items/i.test(schema),
    "El esquema no crea galeria_items.",
  );
  assert(
    /alter table public\.galeria_items enable row level security/i.test(rls),
    "RLS no está habilitado en galeria_items.",
  );
  assert(
    /to anon[\s\S]*estado = 'publicado'/i.test(rls),
    "La lectura anónima no se limita a fotografías publicadas.",
  );
  assert(
    /'galeria',[\s\S]*false,[\s\S]*5242880/i.test(storage),
    "El bucket galeria no es privado o no limita los archivos a 5 MB.",
  );
  assert(
    (storage.match(/create policy\s+storage_galeria_/gi) ?? []).length === 5,
    "Storage debe declarar cinco políticas para la galería.",
  );
}

async function validate() {
  await validatePages();
  await validateModules();
  validateRules();
  await validateSql();

  if (errors.length > 0) {
    console.error("La validación de galería encontró problemas:");

    for (const error of errors) {
      console.error(`- ${error}`);
    }

    process.exitCode = 1;
    return;
  }

  console.log(
    "Validación de galería completada: interfaz, CRUD, imágenes, RLS y Storage revisados.",
  );
}

validate().catch((error) => {
  console.error(`No se pudo validar la Fase 6: ${error.message}`);
  process.exitCode = 1;
});
