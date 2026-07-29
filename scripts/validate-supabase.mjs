import { access, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptsDirectory, "..");
const errors = [];

const files = {
  schema: join(
    projectRoot,
    "supabase",
    "migrations",
    "202607280001_initial_schema.sql",
  ),
  rls: join(
    projectRoot,
    "supabase",
    "policies",
    "202607280002_row_level_security.sql",
  ),
  storage: join(
    projectRoot,
    "supabase",
    "policies",
    "202607280003_storage.sql",
  ),
  storageAdminUpload: join(
    projectRoot,
    "supabase",
    "policies",
    "202607280004_storage_admin_upload.sql",
  ),
  seed: join(projectRoot, "supabase", "seed", "seed.sql"),
  schemaTest: join(
    projectRoot,
    "supabase",
    "tests",
    "database",
    "schema.test.sql",
  ),
  rlsTest: join(
    projectRoot,
    "supabase",
    "tests",
    "database",
    "rls.test.sql",
  ),
  deploymentTest: join(
    projectRoot,
    "supabase",
    "tests",
    "verify_deployment.sql",
  ),
};

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function requirePattern(source, pattern, message) {
  if (!pattern.test(source)) {
    errors.push(message);
  }
}

function forbidPattern(source, pattern, message) {
  if (pattern.test(source)) {
    errors.push(message);
  }
}

function countMatches(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

async function validate() {
  const contents = {};

  for (const [name, path] of Object.entries(files)) {
    if (!(await fileExists(path))) {
      errors.push(`Falta el archivo requerido: ${path}`);
      continue;
    }

    contents[name] = await readFile(path, "utf8");
  }

  if (errors.length > 0) {
    throw new Error("No se encontraron todos los archivos de Supabase.");
  }

  requirePattern(
    contents.schema,
    /create table public\.profiles/i,
    "El esquema no crea public.profiles.",
  );
  requirePattern(
    contents.schema,
    /create table public\.publicaciones/i,
    "El esquema no crea public.publicaciones.",
  );
  requirePattern(
    contents.schema,
    /references auth\.users\s*\(id\)\s*on delete cascade/i,
    "Profiles no referencia la clave primaria de auth.users con cascada.",
  );
  requirePattern(
    contents.schema,
    /security definer\s+set search_path = ''/i,
    "Una función security definer no fija un search_path seguro.",
  );
  requirePattern(
    contents.schema,
    /create trigger on_auth_user_created/i,
    "Falta el trigger de creación de perfiles.",
  );
  requirePattern(
    contents.schema,
    /new\.estado = 'publicado' and new\.fecha_publicacion is null/i,
    "Falta la fecha automática para publicación inmediata.",
  );

  if (
    countMatches(
      contents.rls,
      /create policy\s+[a-z0-9_]+\s+on public\./gi,
    ) !== 7
  ) {
    errors.push("RLS debe declarar exactamente siete políticas públicas.");
  }

  requirePattern(
    contents.rls,
    /alter table public\.profiles enable row level security/i,
    "RLS no está habilitado en profiles.",
  );
  requirePattern(
    contents.rls,
    /alter table public\.publicaciones enable row level security/i,
    "RLS no está habilitado en publicaciones.",
  );
  requirePattern(
    contents.rls,
    /to anon[\s\S]*estado = 'publicado'[\s\S]*fecha_publicacion <= now\(\)/i,
    "La lectura anónima no restringe estado y fecha.",
  );
  requirePattern(
    contents.rls,
    /creado_por = \(select auth\.uid\(\)\)[\s\S]*private\.is_admin\(\)/i,
    "Las escrituras no distinguen autor y administrador.",
  );
  forbidPattern(
    contents.rls,
    /grant\s+(?:all|insert|update|delete)[\s\S]{0,80}\bto anon\b/i,
    "Anon recibió un privilegio de escritura.",
  );

  requirePattern(
    contents.storage,
    /'publicaciones',[\s\S]*false,[\s\S]*5242880/i,
    "El bucket no es privado o no limita archivos a 5 MB.",
  );
  requirePattern(
    contents.storage,
    /array\['image\/jpeg', 'image\/png', 'image\/webp'\]/i,
    "Storage no limita los MIME permitidos.",
  );
  requirePattern(
    contents.storage,
    /storage\.foldername\(name\)/i,
    "Storage no separa los archivos por usuario.",
  );
  requirePattern(
    contents.storageAdminUpload,
    /drop policy if exists storage_publicaciones_insert_authorized[\s\S]*or \(select private\.is_admin\(\)\)/i,
    "Storage no permite que el administrador reemplace imágenes de otros autores.",
  );

  if (
    countMatches(
      contents.storage,
      /create policy\s+storage_publicaciones_/gi,
    ) !== 5
  ) {
    errors.push("Storage debe declarar exactamente cinco políticas.");
  }

  requirePattern(
    contents.seed,
    /seed_user_id constant uuid := null::uuid/i,
    "El seed no es inerte por defecto.",
  );
  requirePattern(
    contents.seed,
    /'borrador'/i,
    "Los datos de demostración no están limitados a borradores.",
  );
  forbidPattern(
    contents.seed,
    /'publicado'/i,
    "El seed contiene una publicación visible.",
  );

  requirePattern(
    contents.schemaTest,
    /select plan\(\d+\)/i,
    "La prueba de esquema no declara un plan pgTAP.",
  );
  requirePattern(
    contents.rlsTest,
    /set local role anon/i,
    "La prueba RLS no simula el rol anon.",
  );
  requirePattern(
    contents.rlsTest,
    /set local role authenticated/i,
    "La prueba RLS no simula usuarios autenticados.",
  );
  requirePattern(
    contents.rlsTest,
    /rollback;\s*$/i,
    "La prueba RLS no revierte sus datos.",
  );
  requirePattern(
    contents.deploymentTest,
    /verificación de sólo lectura/i,
    "Falta la verificación de despliegue de sólo lectura.",
  );

  const trackedTextFiles = [
    join(projectRoot, ".env.example"),
    join(projectRoot, "README.md"),
    join(projectRoot, "docs", "supabase-configuracion.md"),
    ...Object.values(files),
  ];

  for (const path of trackedTextFiles) {
    if (!(await fileExists(path))) {
      continue;
    }

    const source = await readFile(path, "utf8");
    forbidPattern(
      source,
      /\bsb_(?:secret|service_role)_[a-z0-9_-]+\b/i,
      `${path} contiene una clave elevada.`,
    );
    forbidPattern(
      source,
      /postgres(?:ql)?:\/\/[^:\s]+:[^@[\]\s]+@/i,
      `${path} contiene una contraseña de PostgreSQL.`,
    );
  }

  if (errors.length > 0) {
    console.error("La validación de Supabase encontró problemas:");

    for (const error of errors) {
      console.error(`- ${error}`);
    }

    process.exitCode = 1;
    return;
  }

  console.log(
    "Validación de Supabase completada: esquema, RLS, Storage, seed y pruebas revisados.",
  );
}

validate().catch((error) => {
  console.error(`No se pudo validar Supabase: ${error.message}`);
  process.exitCode = 1;
});
