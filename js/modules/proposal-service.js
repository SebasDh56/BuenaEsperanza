import { runtimeConfig } from "../config/runtime-config.js";

export async function submitProposal(formData) {
  const { supabasePublishableKey, supabaseUrl } = runtimeConfig;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("El servicio de propuestas no está disponible.");
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/submit-proposal`, {
    method: "POST",
    headers: {
      apikey: supabasePublishableKey,
      Authorization: `Bearer ${supabasePublishableKey}`,
    },
    body: formData,
  });
  let result = {};

  try {
    result = await response.json();
  } catch {
    // La respuesta puede no incluir JSON si el servicio está indisponible.
  }

  if (!response.ok) {
    throw new Error(
      result?.error ||
        "No se pudo enviar la propuesta. Inténtalo nuevamente.",
    );
  }

  return result;
}
