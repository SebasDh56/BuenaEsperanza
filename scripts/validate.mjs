import { access, readFile, readdir } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptsDirectory, "..");
const outputDirectory = join(projectRoot, "dist");
const errors = [];
const pageTitles = new Map();

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listFiles(path)));
    } else {
      files.push(path);
    }
  }

  return files;
}

function collectAttributes(tag) {
  const attributes = new Map();
  const pattern = /([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let match;

  while ((match = pattern.exec(tag)) !== null) {
    attributes.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? "");
  }

  return attributes;
}

function localTarget(currentFile, reference) {
  const [pathWithoutFragment] = reference.split("#");
  const cleanPath = pathWithoutFragment.split("?")[0];

  if (!cleanPath) {
    return currentFile;
  }

  return cleanPath.startsWith("/")
    ? join(outputDirectory, cleanPath.slice(1))
    : resolve(dirname(currentFile), cleanPath);
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function validateReference(currentFile, reference, label) {
  if (
    !reference ||
    /^(?:https?:|mailto:|tel:|data:)/i.test(reference)
  ) {
    return;
  }

  if (reference === "#") {
    errors.push(`${currentFile}: ${label} usa un destino vacío (#).`);
    return;
  }

  const target = localTarget(currentFile, reference);

  if (!(await exists(target))) {
    errors.push(`${currentFile}: no existe ${reference}.`);
    return;
  }

  const fragment = reference.includes("#") ? reference.split("#")[1] : "";

  if (fragment && extname(target).toLowerCase() === ".html") {
    const targetHtml = await readFile(target, "utf8");
    const escapedFragment = fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const idPattern = new RegExp(`\\bid=["']${escapedFragment}["']`);

    if (!idPattern.test(targetHtml)) {
      errors.push(`${currentFile}: el fragmento #${fragment} no existe en ${target}.`);
    }
  }
}

async function validateHtml(file) {
  const html = await readFile(file, "utf8");

  if (html.includes("@include:")) {
    errors.push(`${file}: contiene parciales sin resolver.`);
  }

  if (!/<html\b[^>]*\blang=["']es["']/i.test(html)) {
    errors.push(`${file}: falta lang="es".`);
  }

  if (!/<title>[^<]+<\/title>/i.test(html)) {
    errors.push(`${file}: falta un título de página.`);
  } else {
    const title = html.match(/<title>([^<]+)<\/title>/i)[1].trim();
    const existingFile = pageTitles.get(title);

    if (existingFile) {
      errors.push(`${file}: repite el título usado en ${existingFile}.`);
    } else {
      pageTitles.set(title, file);
    }
  }

  if (!/<meta\b[^>]*\bname=["']description["']/i.test(html)) {
    errors.push(`${file}: falta meta description.`);
  }

  for (const property of ["og:title", "og:description"]) {
    const propertyPattern = new RegExp(
      `<meta\\b[^>]*\\bproperty=["']${property}["']`,
      "i",
    );

    if (!propertyPattern.test(html)) {
      errors.push(`${file}: falta ${property}.`);
    }
  }

  const h1Count = (html.match(/<h1\b/gi) ?? []).length;

  if (h1Count !== 1) {
    errors.push(`${file}: debe tener exactamente un h1; se encontraron ${h1Count}.`);
  }

  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/gi)].map(
    (match) => match[1],
  );
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);

  for (const id of new Set(duplicateIds)) {
    errors.push(`${file}: el id "${id}" está duplicado.`);
  }

  const filename = file.split(/[\\/]/).at(-1);
  const relativePath = file
    .slice(outputDirectory.length + 1)
    .replaceAll("\\", "/");

  if (
    !["index.html", "404.html"].includes(filename) &&
    !relativePath.startsWith("admin/") &&
    !/<nav\b[^>]*\baria-label=["']Migas de pan["']/i.test(html)
  ) {
    errors.push(`${file}: falta la navegación de migas de pan.`);
  }

  const imageTags = html.match(/<img\b[^>]*>/gi) ?? [];

  for (const tag of imageTags) {
    const attributes = collectAttributes(tag);

    for (const required of ["src", "alt", "width", "height"]) {
      if (!attributes.has(required)) {
        errors.push(`${file}: una imagen no tiene el atributo ${required}.`);
      }
    }

    await validateReference(file, attributes.get("src"), "src");
  }

  const referenceTags = html.match(/<(?:a|link|script)\b[^>]*>/gi) ?? [];

  for (const tag of referenceTags) {
    const attributes = collectAttributes(tag);
    const reference = attributes.get("href") ?? attributes.get("src");

    await validateReference(file, reference, "enlace");
  }
}

async function validateJavaScript(file) {
  const source = await readFile(file, "utf8");

  if (/\binnerHTML\b/.test(source)) {
    errors.push(`${file}: usa innerHTML; revisa el riesgo XSS.`);
  }
}

async function validate() {
  const files = await listFiles(outputDirectory);

  for (const file of files) {
    const extension = extname(file).toLowerCase();

    if (extension === ".html") {
      await validateHtml(file);
    } else if (extension === ".js") {
      await validateJavaScript(file);
    }
  }

  if (errors.length > 0) {
    console.error("La validación encontró problemas:");

    for (const error of errors) {
      console.error(`- ${error}`);
    }

    process.exitCode = 1;
    return;
  }

  console.log(
    `Validación completada: ${files.length} archivos revisados sin errores.`,
  );
}

validate().catch((error) => {
  console.error(`No se pudo validar el sitio: ${error.message}`);
  process.exitCode = 1;
});
