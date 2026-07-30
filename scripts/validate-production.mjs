import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

async function loadEnvironment() {
  const values = {};
  let source = "";

  try {
    source = await readFile(join(root, ".env"), "utf8");
  } catch {
    // Las variables también pueden llegar directamente desde Cloudflare.
  }

  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!match || match[1].startsWith("#")) continue;
    values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }

  return new Proxy(values, {
    get(target, key) {
      return process.env[key] ?? target[key] ?? "";
    },
  });
}

async function validate() {
  const env = await loadEnvironment();
  const siteUrl = env.SITE_URL.trim();
  const supabaseUrl = env.SUPABASE_URL.trim();
  const key = env.SUPABASE_PUBLISHABLE_KEY.trim();
  const turnstile = env.TURNSTILE_SITE_KEY.trim();

  if (!/^https:\/\/[^/\s]+(?:\/.*)?$/.test(siteUrl)) {
    errors.push("SITE_URL debe contener la URL HTTPS definitiva del sitio.");
  }
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(supabaseUrl)) {
    errors.push("SUPABASE_URL no tiene el formato público esperado.");
  }
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
    errors.push("SUPABASE_PUBLISHABLE_KEY no es una clave publicable válida.");
  }
  if (!/^[A-Za-z0-9_-]{10,100}$/.test(turnstile)) {
    errors.push("TURNSTILE_SITE_KEY debe contener la clave pública del widget.");
  }

  const tracked = await Promise.all([
    readFile(join(root, "src", "pages", "colabora.html"), "utf8"),
    readFile(join(root, "src", "partials", "site-footer.html"), "utf8"),
    readFile(join(root, "js", "main.js"), "utf8"),
  ]);
  const combined = tracked.join("\n");

  if (/<<<<<<<|=======|>>>>>>>/.test(combined)) {
    errors.push("Existen marcadores de conflicto sin resolver.");
  }
  if (/(?:sb_secret_|service_role|postgresql:\/\/)/i.test(combined)) {
    errors.push("El frontend contiene una referencia de credencial elevada.");
  }

  for (const file of ["_headers", "robots.txt", "sitemap.xml"]) {
    try {
      await readFile(join(root, "dist", file), "utf8");
    } catch {
      errors.push(`Falta dist/${file}; ejecuta npm run build con SITE_URL.`);
    }
  }

  if (errors.length) {
    console.error("La preparación de producción requiere:");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    "Producción verificada: URL, Supabase, Turnstile, SEO y cabeceras están listos.",
  );
}

validate().catch((error) => {
  console.error(`No se pudo verificar producción: ${error.message}`);
  process.exitCode = 1;
});
