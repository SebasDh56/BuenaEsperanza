import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptsDirectory, "..");
const errors = [];
const requireRuntimeConfig = process.argv.includes("--require-config");
const publicationPages = [
  ["index.html", "data-latest-publications"],
  ["noticias.html", 'data-publication-type="noticia"'],
  ["proyectos.html", 'data-publication-type="proyecto"'],
  ["noticia.html", "data-publication-detail"],
  ["proyecto.html", "data-publication-detail"],
];
const sdkUrl =
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.106.2";

function assert(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

async function validatePages() {
  for (const [filename, requiredMarker] of publicationPages) {
    const path = join(projectRoot, "dist", filename);
    const html = await readFile(path, "utf8");

    assert(
      html.includes(requiredMarker),
      `${filename} no contiene ${requiredMarker}.`,
    );
    assert(
      html.includes(sdkUrl),
      `${filename} no carga la versión fijada del cliente de Supabase.`,
    );
  }
}

async function validateModules() {
  const moduleNames = [
    "publication-service.js",
    "publication-view.js",
    "publications-controller.js",
  ];
  const moduleSources = new Map();

  for (const filename of moduleNames) {
    const path = join(projectRoot, "js", "modules", filename);
    const source = await readFile(path, "utf8");
    moduleSources.set(filename, source);

    assert(
      !/\b(?:innerHTML|outerHTML|insertAdjacentHTML|document\.write)\b/.test(
        source,
      ),
      `${filename} usa una API de inserción HTML no permitida.`,
    );
  }

  const service = moduleSources.get("publication-service.js");
  assert(
    /\.eq\("estado", "publicado"\)/.test(service),
    "El servicio no filtra el estado publicado.",
  );
  assert(
    /\.lte\("fecha_publicacion", new Date\(\)\.toISOString\(\)\)/.test(service),
    "El servicio no restringe las publicaciones futuras.",
  );
  assert(
    /\.range\(offset, offset \+ limit - 1\)/.test(service),
    "El servicio no aplica un rango de carga progresiva.",
  );
  assert(
    /\.createSignedUrl\(imagePath, SIGNED_IMAGE_LIFETIME_SECONDS\)/.test(
      service,
    ),
    "El servicio no crea una URL temporal para el bucket privado.",
  );

  const controller = moduleSources.get("publications-controller.js");
  assert(
    /new URLSearchParams\(window\.location\.search\)/.test(controller),
    "El detalle no obtiene el slug desde la URL.",
  );
  assert(
    /createLoadMoreButton/.test(controller),
    "El listado no ofrece carga progresiva.",
  );
}

async function validateRuntimeConfig() {
  const runtimeConfig = await readFile(
    join(projectRoot, "dist", "js", "config", "runtime-config.js"),
    "utf8",
  );

  const hasUrl = /"supabaseUrl":"https:\/\/[^"]+\.supabase\.co"/.test(
    runtimeConfig,
  );
  const hasKey =
    /"supabasePublishableKey":"sb_publishable_[A-Za-z0-9_-]+"/.test(
      runtimeConfig,
    );

  assert(
    hasUrl === hasKey,
    "La URL y la clave publicable deben configurarse juntas.",
  );

  if (requireRuntimeConfig) {
    assert(
      hasUrl && hasKey,
      "El build local no contiene la configuración pública de Supabase.",
    );
  }

  assert(
    !/(?:service_role|sb_secret_|postgresql:\/\/)/i.test(runtimeConfig),
    "La configuración del navegador contiene una credencial elevada.",
  );
}

async function validate() {
  await validatePages();
  await validateModules();
  await validateRuntimeConfig();

  if (errors.length > 0) {
    console.error("La validación de publicaciones encontró problemas:");

    for (const error of errors) {
      console.error(`- ${error}`);
    }

    process.exitCode = 1;
    return;
  }

  console.log([
    "Validación de publicaciones completada:",
    "conexión pública, filtros, URLs firmadas y vistas revisadas.",
    requireRuntimeConfig ? "Configuración local requerida y confirmada." : "",
  ].filter(Boolean).join(" "));
}

validate().catch((error) => {
  console.error(`No se pudo validar la Fase 4: ${error.message}`);
  process.exitCode = 1;
});
