# Despliegue en Cloudflare Pages

El repositorio está preparado para generar un sitio estático en `dist/`. La
base de datos, RLS y Storage ya están aplicados en el proyecto Supabase
`ygxufgloqjpukfbnaojf`.

## 1. Crear Turnstile

1. En Cloudflare, abre **Turnstile** y crea un widget administrado.
2. Añade el hostname definitivo de Pages.
3. Conserva la **site key** para Cloudflare Pages.
4. Conserva la **secret key** únicamente para Supabase Edge Functions.

No guardes la clave secreta en `.env`, Git ni el frontend.

## 2. Desplegar la función de propuestas

Vincula la CLI con el proyecto y configura los secretos:

```powershell
npx supabase login
npx supabase link --project-ref ygxufgloqjpukfbnaojf
npx supabase secrets set TURNSTILE_SECRET_KEY=TU_SECRETO
npx supabase secrets set ALLOWED_ORIGINS=https://TU-SITIO.pages.dev
npx supabase functions deploy submit-proposal --no-verify-jwt
```

`ALLOWED_ORIGINS` acepta varios orígenes separados por comas. Si después se
añade un dominio propio, incluye ambas URL HTTPS.

## 3. Configurar Cloudflare Pages

- Comando de compilación: `npm run build`
- Directorio de salida: `dist`
- Versión de Node.js: 20 o posterior

Si el proyecto de Cloudflare utiliza **Workers Builds** y muestra un campo
**Deploy command**, usa:

```text
npx wrangler deploy
```

El archivo `wrangler.jsonc` indica que `dist/` contiene los recursos estáticos,
por lo que Wrangler no necesita un script Worker.

Variables de producción:

```text
SITE_URL=https://TU-SITIO.pages.dev
SUPABASE_URL=https://ygxufgloqjpukfbnaojf.supabase.co
SUPABASE_PUBLISHABLE_KEY=TU_CLAVE_PUBLICABLE
TURNSTILE_SITE_KEY=TU_SITE_KEY
```

El build genera canonical, sitemap, robots, configuración pública, política de
cabeceras y página 404. Cloudflare Pages reconoce `404.html` de forma nativa.
`_headers` permite Supabase, Turnstile y Cloudflare Web Analytics sin habilitar
scripts arbitrarios.

## 4. Verificación previa

Completa las variables en `.env` sin versionarlo y ejecuta:

```powershell
npm run check
npm run verify:production
```

## 5. Después del primer despliegue

1. Abre **Supabase > Authentication > URL Configuration**.
2. Define `Site URL` con la URL de Pages.
3. Añade la URL de Pages a **Redirect URLs**.
4. Activa **Cloudflare Web Analytics** desde el proyecto Pages.
5. Prueba inicio de sesión, envío de propuesta, publicación programada,
   miniaturas y eliminación como administrador.

Cloudflare Web Analytics se activa desde Pages; no necesita un token escrito en
este repositorio.
