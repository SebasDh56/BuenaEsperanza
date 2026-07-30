import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const MAX_PDF_BYTES = 5 * 1024 * 1024;
const PROPOSAL_TYPES = new Set([
  "pasantia",
  "tesis",
  "investigacion",
  "proyecto_comunitario",
  "apoyo_institucional",
  "otro",
]);

function json(origin: string, body: Record<string, unknown>, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin",
    },
  });
}

function textValue(form: FormData, key: string, max: number) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim().slice(0, max + 1) : "";
}

function allowedOrigin(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  const configured = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter(Boolean);

  return configured.includes(origin.replace(/\/$/, "")) ? origin : null;
}

async function verifyTurnstile(token: string, request: Request) {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");

  if (!secret || !token) {
    return false;
  }

  const payload = new FormData();
  payload.set("secret", secret);
  payload.set("response", token);

  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  if (forwardedFor) {
    payload.set("remoteip", forwardedFor);
  }

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body: payload },
  );
  const result = await response.json();

  return response.ok && result?.success === true;
}

function safeFilename(name: string) {
  return name
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/]/g, "-")
    .trim()
    .slice(0, 180) || "propuesta.pdf";
}

Deno.serve(async (request) => {
  const origin = allowedOrigin(request);

  if (!origin) {
    return new Response("Origen no autorizado.", { status: 403 });
  }

  if (request.method === "OPTIONS") {
    return json(origin, {}, 204);
  }

  if (request.method !== "POST") {
    return json(origin, { error: "Método no permitido." }, 405);
  }

  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    return json(origin, { error: "El formulario no es válido." }, 400);
  }

  if (textValue(form, "website", 200)) {
    return json(origin, { received: true }, 202);
  }

  const turnstileToken = textValue(form, "cf-turnstile-response", 2048);

  if (!(await verifyTurnstile(turnstileToken, request))) {
    return json(
      origin,
      { error: "No se pudo verificar el envío. Recarga la página e inténtalo nuevamente." },
      400,
    );
  }

  const tipo = textValue(form, "tipo", 40);
  const nombreResponsable = textValue(form, "nombre_responsable", 120);
  const organizacion = textValue(form, "organizacion", 180);
  const email = textValue(form, "email", 254).toLowerCase();
  const telefono = textValue(form, "telefono", 30);
  const titulo = textValue(form, "titulo", 180);
  const duracion = textValue(form, "duracion_estimada", 120);
  const descripcion = textValue(form, "descripcion", 3000);
  const consent = textValue(form, "consentimiento", 10);
  const rawFile = form.get("archivo");
  const file = rawFile instanceof File && rawFile.size > 0 ? rawFile : null;

  if (
    !PROPOSAL_TYPES.has(tipo) ||
    nombreResponsable.length < 2 ||
    titulo.length < 5 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    (organizacion && organizacion.length < 2) ||
    (telefono && telefono.length < 7) ||
    (duracion && duracion.length < 2) ||
    (descripcion && descripcion.length < 50) ||
    (!descripcion && !file) ||
    consent !== "on"
  ) {
    return json(
      origin,
      { error: "Revisa los campos obligatorios y el contenido de la propuesta." },
      400,
    );
  }

  if (file) {
    const signature = await file.slice(0, 5).text();

    if (
      file.size > MAX_PDF_BYTES ||
      file.type !== "application/pdf" ||
      signature !== "%PDF-"
    ) {
      return json(origin, { error: "El documento debe ser un PDF válido de hasta 5 MB." }, 400);
    }
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return json(origin, { error: "El servicio no está disponible." }, 503);
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await client
    .from("propuestas")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .gte("created_at", oneHourAgo);

  if (countError) {
    return json(origin, { error: "No se pudo procesar la propuesta." }, 500);
  }

  if ((count ?? 0) >= 3) {
    return json(
      origin,
      { error: "Se alcanzó el límite de envíos. Inténtalo nuevamente más tarde." },
      429,
    );
  }

  const proposalId = crypto.randomUUID();
  let filePath: string | null = null;

  if (file) {
    filePath = `${proposalId}/${crypto.randomUUID()}.pdf`;
    const { error: uploadError } = await client.storage
      .from("propuestas")
      .upload(filePath, file, {
        contentType: "application/pdf",
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      return json(origin, { error: "No se pudo guardar el documento." }, 500);
    }
  }

  const { error: insertError } = await client.from("propuestas").insert({
    id: proposalId,
    tipo,
    nombre_responsable: nombreResponsable,
    organizacion: organizacion || null,
    email,
    telefono: telefono || null,
    titulo,
    duracion_estimada: duracion || null,
    descripcion: descripcion || null,
    archivo_path: filePath,
    archivo_nombre: file ? safeFilename(file.name) : null,
    archivo_tamano: file?.size ?? null,
    archivo_tipo: file ? "application/pdf" : null,
  });

  if (insertError) {
    if (filePath) {
      await client.storage.from("propuestas").remove([filePath]);
    }

    return json(origin, { error: "No se pudo guardar la propuesta." }, 500);
  }

  return json(
    origin,
    {
      received: true,
      message: "Tu propuesta fue recibida para revisión.",
    },
    201,
  );
});
