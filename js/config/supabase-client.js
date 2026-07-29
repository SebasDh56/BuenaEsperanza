import { runtimeConfig } from "./runtime-config.js";

let publicClient;
let authenticatedClient;

export class PublicDataConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "PublicDataConfigurationError";
  }
}

export function getPublicSupabaseClient() {
  if (publicClient) {
    return publicClient;
  }

  const { supabaseUrl, supabasePublishableKey } = runtimeConfig;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new PublicDataConfigurationError(
      "La conexión pública con Supabase todavía no está configurada.",
    );
  }

  if (typeof globalThis.supabase?.createClient !== "function") {
    throw new PublicDataConfigurationError(
      "No se pudo cargar el cliente público de Supabase.",
    );
  }

  publicClient = globalThis.supabase.createClient(
    supabaseUrl,
    supabasePublishableKey,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
      db: {
        schema: "public",
      },
    },
  );

  return publicClient;
}

export function getAuthenticatedSupabaseClient() {
  if (authenticatedClient) {
    return authenticatedClient;
  }

  const { supabaseUrl, supabasePublishableKey } = runtimeConfig;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new PublicDataConfigurationError(
      "La conexión con Supabase todavía no está configurada.",
    );
  }

  if (typeof globalThis.supabase?.createClient !== "function") {
    throw new PublicDataConfigurationError(
      "No se pudo cargar el cliente de autenticación.",
    );
  }

  authenticatedClient = globalThis.supabase.createClient(
    supabaseUrl,
    supabasePublishableKey,
    {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
        storageKey: "comuna-page-auth",
      },
      db: {
        schema: "public",
      },
    },
  );

  return authenticatedClient;
}
