import { getAuthenticatedSupabaseClient } from "../config/supabase-client.js";

const PROPOSAL_BUCKET = "propuestas";
const PROPOSAL_FIELDS = [
  "id",
  "tipo",
  "nombre_responsable",
  "organizacion",
  "email",
  "telefono",
  "titulo",
  "duracion_estimada",
  "descripcion",
  "archivo_path",
  "archivo_nombre",
  "archivo_tamano",
  "archivo_tipo",
  "estado",
  "notas_internas",
  "retention_until",
  "created_at",
  "updated_at",
].join(",");
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const STATES = new Set([
  "nueva",
  "en_revision",
  "contactada",
  "aceptada",
  "cerrada",
]);
const TYPES = new Set([
  "pasantia",
  "tesis",
  "investigacion",
  "proyecto_comunitario",
  "apoyo_institucional",
  "otro",
]);

function assertUuid(value) {
  if (!UUID_PATTERN.test(value)) {
    throw new TypeError("El identificador de la propuesta no es válido.");
  }
}

function cleanSearch(value) {
  return String(value ?? "")
    .trim()
    .slice(0, 100)
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
}

export async function listAdminProposals({
  limit = 20,
  offset = 0,
  search = "",
  state = "",
  type = "",
} = {}) {
  const client = getAuthenticatedSupabaseClient();
  let query = client
    .from("propuestas")
    .select(PROPOSAL_FIELDS, { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);
  const searchTerm = cleanSearch(search);

  if (searchTerm) {
    query = query.ilike("titulo", `%${searchTerm}%`);
  }

  if (STATES.has(state)) {
    query = query.eq("estado", state);
  }

  if (TYPES.has(type)) {
    query = query.eq("tipo", type);
  }

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  return { proposals: data ?? [], total: count ?? 0 };
}

export async function countNewProposals() {
  const client = getAuthenticatedSupabaseClient();
  const { count, error } = await client
    .from("propuestas")
    .select("id", { count: "exact", head: true })
    .eq("estado", "nueva");

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function getAdminProposal(id) {
  assertUuid(id);
  const client = getAuthenticatedSupabaseClient();
  const { data, error } = await client
    .from("propuestas")
    .select(PROPOSAL_FIELDS)
    .eq("id", id)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateAdminProposal(id, { state, notes }) {
  assertUuid(id);

  if (!STATES.has(state) || String(notes ?? "").trim().length > 5000) {
    throw new TypeError("Revisa el estado y las notas de la propuesta.");
  }

  const client = getAuthenticatedSupabaseClient();
  const { data, error } = await client
    .from("propuestas")
    .update({
      estado: state,
      notas_internas: String(notes ?? "").trim() || null,
    })
    .eq("id", id)
    .select(PROPOSAL_FIELDS)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw error ?? new Error("No se pudo actualizar la propuesta.");
  }

  return data;
}

export async function getProposalDocumentUrl(path) {
  if (!path) {
    return null;
  }

  const client = getAuthenticatedSupabaseClient();
  const { data, error } = await client.storage
    .from(PROPOSAL_BUCKET)
    .createSignedUrl(path, 60 * 5, { download: true });

  if (error || !data?.signedUrl) {
    throw error ?? new Error("No se pudo preparar el documento.");
  }

  return data.signedUrl;
}

export async function deleteAdminProposal(id) {
  const proposal = await getAdminProposal(id);

  if (!proposal) {
    throw new Error("La propuesta ya no existe.");
  }

  const client = getAuthenticatedSupabaseClient();

  if (proposal.archivo_path) {
    const { error: storageError } = await client.storage
      .from(PROPOSAL_BUCKET)
      .remove([proposal.archivo_path]);

    if (storageError) {
      throw storageError;
    }
  }

  const { data, error } = await client
    .from("propuestas")
    .delete()
    .eq("id", id)
    .select("id")
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw error ?? new Error("No se pudo eliminar la propuesta.");
  }

  return data;
}

export function proposalAdminMessage(error) {
  if (error?.code === "42501" || error?.statusCode === "403") {
    return "No tienes permiso para realizar esta acción.";
  }

  return error?.message || "No se pudo completar la acción.";
}
