# Configuración de Supabase

Esta guía conecta el proyecto de Supabase de **ComunaPage** sin exponer
credenciales elevadas. La configuración pública local ya utiliza la URL y la
clave `sb_publishable_…` proporcionadas; ambas viven únicamente en `.env`, que
Git ignora.

El esquema, RLS y Storage fueron aplicados y verificados en el proyecto remoto
el 28 de julio de 2026. No vuelvas a ejecutar los cuatro scripts aplicados.

## 1. Credenciales y alcance

El navegador utilizará solamente:

- `SUPABASE_URL`;
- `SUPABASE_PUBLISHABLE_KEY`.

La clave publicable identifica al proyecto, pero la autorización real depende
de RLS. Nunca agregues al frontend una clave `sb_secret_…`, `service_role`, una
contraseña de PostgreSQL ni una cadena de conexión.

La cadena compartida todavía contiene `[YOUR-PASSWORD]`; no es una credencial
utilizable y no se guardó. Para la aplicación de esta fase basta el SQL Editor
de Supabase Dashboard, que evita copiar la contraseña al repositorio o al chat.

## 2. Generar la configuración del navegador

El archivo local `.env` contiene:

```text
SUPABASE_URL=https://<proyecto>.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_<valor>
SITE_URL=
```

Al ejecutar `npm run build`, el generador valida los dos primeros valores y crea
`dist/js/config/runtime-config.js`. El archivo generado contiene únicamente
configuración pública. `SITE_URL` seguirá vacío hasta confirmar el dominio.

Comprueba siempre:

```powershell
git check-ignore .env
git status --short
```

`.env` debe aparecer como ignorado y nunca en el estado de Git.

## 3. Aplicación del esquema en Supabase Dashboard

Los siguientes archivos ya fueron ejecutados en este orden:

1. `supabase/migrations/202607280001_initial_schema.sql`;
2. `supabase/policies/202607280002_row_level_security.sql`;
3. `supabase/policies/202607280003_storage.sql`;
4. `supabase/policies/202607280004_storage_admin_upload.sql`.

`supabase/tests/verify_deployment.sql` devolvió 13 resultados verdaderos y
ningún fallo. La API pública de `publicaciones` también respondió HTTP 200.

## 4. Configurar Authentication

Las cuentas se crean manualmente y no existe registro público. El 28 de julio
de 2026 se desactivó **Allow new users to sign up** y el endpoint Auth confirmó
`disable_signup = true`.

La configuración aplicada es:

1. El proveedor de correo permanece habilitado.
2. El registro público está desactivado.
3. En la configuración de URL, usa temporalmente la URL local del sitio.
4. Cuando exista el dominio, configura la URL oficial y sus redirecciones
   permitidas.
5. En **Authentication > Users**, crea la primera cuenta.

El trigger `on_auth_user_created` crea automáticamente un perfil con rol
`editor`. Los datos modificables del usuario nunca determinan el rol.

El 29 de julio de 2026 se creó la primera cuenta real. El trigger generó su
perfil como `editor`, se verificó ese rol y finalmente se asignó
`administrador`. La contraseña no se copió al repositorio ni al chat.

## 5. Asignar el primer administrador

Después de crear la primera cuenta, consulta su UUID:

```sql
select id, email, created_at
from auth.users
order by created_at;
```

Reemplaza el UUID y ejecuta:

```sql
update public.profiles
set rol = 'administrador'
where id = '<UUID-DE-LA-CUENTA>';
```

Verifica el resultado sin mostrar información sensible:

```sql
select id, nombre, rol, created_at
from public.profiles
order by created_at;
```

Las cuentas adicionales nacen como `editor`. Un administrador puede cambiar
roles; un editor no puede ascenderse a sí mismo.

La verificación autenticada alternó temporalmente la primera cuenta entre ambos
roles. Administrador y editor pudieron ejecutar sus flujos permitidos; el rol
final quedó restaurado a `administrador`.

## 6. Matriz de permisos

| Acción | Visitante | Editor | Administrador |
| --- | --- | --- | --- |
| Leer publicación vigente | Sí | Sí | Sí |
| Leer publicación futura | No | Sólo propia | Sí |
| Leer borrador | No | Sólo propio | Sí |
| Crear publicación | No | Sí, propia | Sí |
| Publicar inmediatamente | No | Sí, propia | Sí |
| Programar publicación | No | Sí, propia | Sí |
| Editar o archivar | No | Sólo propia | Cualquiera |
| Eliminar | No | Sólo propia | Cualquiera |
| Cambiar roles | No | No | Sí |

Una publicación con estado `publicado` y fecha futura permanece oculta hasta
que `fecha_publicacion <= now()`. No requiere una tarea programada externa.

## 7. Storage

El script crea el bucket privado `publicaciones` con:

- máximo de 5 MB por archivo almacenado;
- MIME permitidos: JPEG, PNG y WebP;
- rutas `<uuid-del-autor>/<uuid-del-archivo>.<extensión>`;
- lectura anónima únicamente de imágenes asociadas a publicaciones vigentes;
- escritura y eliminación del editor sólo dentro de su carpeta;
- acceso completo del administrador.

En la Fase 5, el navegador recibe una imagen original de hasta 20 MB,
corregirla y comprimirla antes de subirla. Supabase sólo aceptará el resultado
procesado de hasta 5 MB.

Al eliminar una publicación, la aplicación la archiva, elimina su objeto de
Storage y finalmente elimina la fila. Si falla el archivo, la publicación
permanece archivada para evitar que quede visible con una imagen ausente.

## 8. Datos de demostración

`supabase/seed/seed.sql` no inserta nada por defecto. Para usarlo:

1. copia el archivo al SQL Editor;
2. sustituye `null::uuid` por el UUID de un perfil existente;
3. ejecútalo;
4. confirma que sólo creó dos registros con estado `borrador`.

Los textos están identificados como demostración y nunca se publican de forma
automática.

## 9. Pruebas automatizadas de base de datos

Los archivos pgTAP están en `supabase/tests/database/`:

- `schema.test.sql` comprueba tablas, tipos, triggers, permisos, RLS y bucket;
- `rls.test.sql` simula visitante, dos editores y un administrador.

Para ejecutarlos se requiere Supabase CLI y un motor de contenedores activo:

```powershell
npx supabase start
npx supabase test db
```

En este equipo la CLI no está instalada y Docker Desktop no está iniciado. No
se agregó ninguna dependencia sin autorización. La verificación estática local
se ejecuta siempre mediante `npm run check`; la consulta
`verify_deployment.sql` permite confirmar el proyecto remoto desde Dashboard.

## 10. Conexión de la Fase 4

La Fase 4 ya carga el cliente oficial de Supabase en una versión fijada y
consume `public.publicaciones` con la clave publicable. El navegador solicita
únicamente filas publicadas y vigentes; RLS aplica la misma condición como
control autoritativo.

Las imágenes se leen desde el bucket privado mediante URLs firmadas por una
hora. Los listados cargan seis registros por solicitud, la portada carga cuatro
y los detalles validan el `slug` antes de consultar.

La comprobación específica requiere que el build local contenga la conexión:

```powershell
npm run verify:publications
```
