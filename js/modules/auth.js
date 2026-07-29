import { getAuthenticatedSupabaseClient } from "../config/supabase-client.js";

const AUTHORIZED_ROLES = new Set(["administrador", "editor"]);
const SAFE_ADMIN_PATHS = new Set([
  "/admin/dashboard.html",
  "/admin/editor.html",
  "/admin/publicaciones.html",
]);

export class AuthorizationError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export function safeAdminReturnPath(value) {
  if (typeof value !== "string") {
    return "/admin/dashboard.html";
  }

  try {
    const url = new URL(value, window.location.origin);

    if (
      url.origin !== window.location.origin ||
      !SAFE_ADMIN_PATHS.has(url.pathname)
    ) {
      return "/admin/dashboard.html";
    }

    return `${url.pathname}${url.search}`;
  } catch {
    return "/admin/dashboard.html";
  }
}

export async function signInWithPassword({ email, password }) {
  const client = getAuthenticatedSupabaseClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error || !data.user) {
    throw new AuthorizationError(
      "No se pudo iniciar sesión. Revisa el correo y la contraseña.",
    );
  }

  return getAuthorizedContext();
}

export async function getAuthorizedContext() {
  const client = getAuthenticatedSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("id,nombre,rol,created_at,updated_at")
    .eq("id", user.id)
    .limit(1)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (!profile || !AUTHORIZED_ROLES.has(profile.rol)) {
    await client.auth.signOut({ scope: "local" });
    throw new AuthorizationError(
      "La cuenta no tiene un rol autorizado para administrar el sitio.",
    );
  }

  return {
    client,
    profile,
    user,
  };
}

export async function signOutCurrentSession() {
  const client = getAuthenticatedSupabaseClient();
  const { error } = await client.auth.signOut({ scope: "local" });

  if (error) {
    throw error;
  }
}

export function loginUrlForCurrentPage() {
  const returnTo = `${window.location.pathname}${window.location.search}`;
  const url = new URL("/admin/login.html", window.location.origin);
  url.searchParams.set("returnTo", safeAdminReturnPath(returnTo));

  return `${url.pathname}${url.search}`;
}
