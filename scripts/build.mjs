import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptsDirectory, "..");
const sourcePagesDirectory = join(projectRoot, "src", "pages");
const partialsDirectory = join(projectRoot, "src", "partials");
const outputDirectory = join(projectRoot, "dist");
const runtimeConfigPath = join(
  outputDirectory,
  "js",
  "config",
  "runtime-config.js",
);

const includePattern = /<!--\s*@include:([a-z0-9-]+)\s*-->/gi;
const seoPattern = /<!--\s*@seo-meta\s*-->/gi;
const copyDirectories = ["assets", "css", "js"];
const sourceOnlyAssets = new Set([
  "logo-buena-esperanza.png",
  "logo-original-referencia.png",
  "og-la-buena-esperanza-master.png",
]);
const sitemapPages = [
  "index.html",
  "comunidad.html",
  "historia.html",
  "cultura.html",
  "territorio.html",
  "produccion.html",
  "deporte.html",
  "proyectos.html",
  "noticias.html",
  "galeria.html",
  "colabora.html",
  "contacto.html",
];

async function loadLocalEnvironment() {
  let source;

  try {
    source = await readFile(join(projectRoot, ".env"), "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return;
    }

    throw error;
  }

  const supportedVariables = new Set([
    "SITE_URL",
    "SUPABASE_URL",
    "SUPABASE_PUBLISHABLE_KEY",
  ]);

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex < 1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();

    if (!supportedVariables.has(key) || process.env[key] !== undefined) {
      continue;
    }

    let value = line.slice(separatorIndex + 1).trim();

    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function siteUrlFromEnvironment() {
  const rawSiteUrl = process.env.SITE_URL?.trim();

  if (!rawSiteUrl) {
    return "";
  }

  const parsedUrl = new URL(rawSiteUrl);

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("SITE_URL debe usar http o https.");
  }

  parsedUrl.pathname = parsedUrl.pathname.replace(/\/+$/, "");
  parsedUrl.search = "";
  parsedUrl.hash = "";

  return parsedUrl.toString().replace(/\/$/, "");
}

function supabaseConfigFromEnvironment() {
  const supabaseUrl = process.env.SUPABASE_URL?.trim() ?? "";
  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

  if (Boolean(supabaseUrl) !== Boolean(publishableKey)) {
    throw new Error(
      "SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY deben configurarse juntas.",
    );
  }

  if (!supabaseUrl) {
    return {
      supabaseUrl: null,
      supabasePublishableKey: null,
    };
  }

  const parsedUrl = new URL(supabaseUrl);

  if (
    parsedUrl.protocol !== "https:" ||
    parsedUrl.username ||
    parsedUrl.password ||
    parsedUrl.search ||
    parsedUrl.hash
  ) {
    throw new Error("SUPABASE_URL debe ser una URL HTTPS pública y limpia.");
  }

  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey)) {
    throw new Error(
      "SUPABASE_PUBLISHABLE_KEY no tiene el formato de una clave publicable.",
    );
  }

  return {
    supabaseUrl: parsedUrl.toString().replace(/\/$/, ""),
    supabasePublishableKey: publishableKey,
  };
}

function serializeForJavaScript(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function assertSafeOutputDirectory() {
  const expectedDirectory = resolve(projectRoot, "dist");

  if (
    outputDirectory !== expectedDirectory ||
    dirname(outputDirectory) !== projectRoot ||
    basename(outputDirectory) !== "dist"
  ) {
    throw new Error("La ruta de salida no es segura.");
  }
}

async function loadPartials() {
  const entries = await readdir(partialsDirectory, { withFileTypes: true });
  const partials = new Map();

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".html")) {
      continue;
    }

    const key = entry.name.replace(/\.html$/, "");
    const content = await readFile(join(partialsDirectory, entry.name), "utf8");
    partials.set(key, content.trim());
  }

  return partials;
}

function renderPage(source, partials, filename, siteUrl) {
  const withPartials = source.replace(includePattern, (_, partialName) => {
    const partial = partials.get(partialName);

    if (!partial) {
      throw new Error(
        `El parcial "${partialName}" usado por ${filename} no existe.`,
      );
    }

    return partial;
  });

  if (!siteUrl) {
    return withPartials.replace(seoPattern, "");
  }

  const webFilename = filename.replaceAll("\\", "/");
  const canonicalPath = webFilename === "index.html" ? "/" : `/${webFilename}`;
  const canonicalUrl = `${siteUrl}${canonicalPath}`;
  const seoMarkup = [
    `<link rel="canonical" href="${canonicalUrl}">`,
    `<meta property="og:url" content="${canonicalUrl}">`,
    `<meta property="og:image" content="${siteUrl}/assets/images/og-la-buena-esperanza.jpg">`,
  ].join("\n    ");

  return withPartials.replace(seoPattern, seoMarkup);
}

async function buildPages(
  partials,
  siteUrl,
  currentDirectory = sourcePagesDirectory,
  relativeDirectory = "",
) {
  const entries = await readdir(currentDirectory, { withFileTypes: true });

  for (const entry of entries) {
    const relativePath = join(relativeDirectory, entry.name);

    if (entry.isDirectory()) {
      await buildPages(
        partials,
        siteUrl,
        join(currentDirectory, entry.name),
        relativePath,
      );
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith(".html")) {
      continue;
    }

    const source = await readFile(
      join(currentDirectory, entry.name),
      "utf8",
    );
    const output = renderPage(source, partials, relativePath, siteUrl);
    const outputPath = join(outputDirectory, relativePath);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, output, "utf8");
  }
}

async function copyStaticDirectories() {
  for (const directory of copyDirectories) {
    await cp(join(projectRoot, directory), join(outputDirectory, directory), {
      recursive: true,
      filter: (source) => !sourceOnlyAssets.has(basename(source)),
    });
  }
}

async function writeRuntimeConfig(config) {
  await mkdir(dirname(runtimeConfigPath), { recursive: true });

  const source = [
    "// Generado durante el build. No editar este archivo dentro de dist/.",
    `export const runtimeConfig = Object.freeze(${serializeForJavaScript(config)});`,
    "",
  ].join("\n");

  await writeFile(runtimeConfigPath, source, "utf8");
}

async function writeSearchEngineFiles(siteUrl) {
  const robotsLines = ["User-agent: *", "Allow: /"];

  if (siteUrl) {
    robotsLines.push("", `Sitemap: ${siteUrl}/sitemap.xml`);
  }

  await writeFile(
    join(outputDirectory, "robots.txt"),
    `${robotsLines.join("\n")}\n`,
    "utf8",
  );

  if (!siteUrl) {
    return;
  }

  const urls = sitemapPages
    .map((page) => {
      const path = page === "index.html" ? "/" : `/${page}`;
      return `  <url><loc>${siteUrl}${path}</loc></url>`;
    })
    .join("\n");
  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    "</urlset>",
    "",
  ].join("\n");

  await writeFile(join(outputDirectory, "sitemap.xml"), sitemap, "utf8");
}

async function build() {
  assertSafeOutputDirectory();
  await loadLocalEnvironment();
  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });

  const siteUrl = siteUrlFromEnvironment();
  const supabaseConfig = supabaseConfigFromEnvironment();
  const partials = await loadPartials();
  await buildPages(partials, siteUrl);
  await copyStaticDirectories();
  await writeRuntimeConfig(supabaseConfig);
  await writeSearchEngineFiles(siteUrl);

  console.log(
    siteUrl
      ? `Sitio generado en dist/ con URL canónica ${siteUrl}.`
      : "Sitio generado en dist/. Canonical y sitemap esperan SITE_URL.",
  );
}

build().catch((error) => {
  console.error(`No se pudo generar el sitio: ${error.message}`);
  process.exitCode = 1;
});
