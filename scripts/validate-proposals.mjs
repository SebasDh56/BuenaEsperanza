import { access, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

function assert(condition, message) {
  if (!condition) errors.push(message);
}

async function source(path) {
  return readFile(join(root, path), "utf8");
}

async function validate() {
  const [schema, policies, edge, publicController, adminService, build] =
    await Promise.all([
      source("supabase/migrations/202607300008_proposals_schema.sql"),
      source("supabase/policies/202607300009_proposals_rls_storage.sql"),
      source("supabase/functions/submit-proposal/index.ts"),
      source("js/modules/proposal-controller.js"),
      source("js/modules/proposal-admin-service.js"),
      source("scripts/build.mjs"),
    ]);

  assert(
    /alter table public\.propuestas enable row level security/i.test(policies),
    "La tabla de propuestas no activa RLS.",
  );
  assert(
    /revoke all on table public\.propuestas from anon/i.test(policies) &&
      !/grant\s+insert[\s\S]*public\.propuestas[\s\S]*authenticated/i.test(policies),
    "El navegador no autorizado podría insertar propuestas directamente.",
  );
  assert(
    /create policy propuestas_delete_admin[\s\S]*private\.is_admin/i.test(policies),
    "La eliminación permanente no está limitada al administrador.",
  );
  assert(
    /values\s*\(\s*'propuestas',\s*'propuestas',\s*false,/i.test(policies) &&
      /allowed_mime_types[\s\S]*application\/pdf/i.test(policies),
    "El bucket de propuestas no está limitado a PDF privado.",
  );
  assert(
    /descripcion is not null or archivo_path is not null/i.test(schema),
    "La base no exige descripción o PDF.",
  );
  assert(
    /retention_until[\s\S]*12 months/i.test(schema),
    "La retención máxima de 12 meses no está definida.",
  );
  assert(
    /TURNSTILE_SECRET_KEY/.test(edge) &&
      /siteverify/.test(edge) &&
      /ALLOWED_ORIGINS/.test(edge),
    "La función pública no verifica Turnstile y el origen.",
  );
  assert(
    /signature !== "%PDF-"/.test(edge) &&
      /MAX_PDF_BYTES/.test(edge),
    "La función no valida la firma y el tamaño del PDF.",
  );
  assert(
    !/(?:sb_secret_|service_role|postgresql:\/\/)/i.test(
      [publicController, adminService, build].join("\n"),
    ),
    "El código del navegador contiene una referencia de credencial elevada.",
  );

  for (const path of [
    "dist/colabora.html",
    "dist/privacidad.html",
    "dist/admin/propuestas.html",
    "dist/admin/propuesta.html",
  ]) {
    try {
      await access(join(root, path));
    } catch {
      errors.push(`Falta el archivo generado ${path}.`);
    }
  }

  if (errors.length) {
    console.error("La validación de propuestas encontró problemas:");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    "Validación de propuestas completada: privacidad, PDF, Turnstile, RLS y panel revisados.",
  );
}

validate().catch((error) => {
  console.error(`No se pudieron validar las propuestas: ${error.message}`);
  process.exitCode = 1;
});
