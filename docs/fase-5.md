# Fase 5: autenticación y administración

## 1. Implementado

- Inicio y cierre de sesión con Supabase Auth.
- Verificación remota del usuario y consulta del rol en `profiles`.
- Protección de las tres páginas privadas.
- Dashboard con conteos y actividad reciente.
- Listado con búsqueda, filtros, estados, paginación y acciones.
- Creación y edición de noticias y proyectos.
- Publicación inmediata o programada.
- Archivado y eliminación definitiva con confirmación.
- Procesamiento local de JPG, PNG y WebP a WebP optimizado.
- Vista previa, texto alternativo y mensajes accesibles.

## 2. Archivos

- `src/pages/admin/`: las cuatro rutas administrativas.
- `src/partials/admin-sidebar.html`: navegación y cuenta compartidas.
- `css/admin.css`: sistema visual responsive del panel.
- `js/admin.js`: protección y arranque común.
- `js/pages/admin-*.js`: controladores de cada pantalla.
- `js/modules/auth.js`: sesión y autorización.
- `js/modules/admin-service.js`: CRUD y Storage.
- `js/modules/image-processor.js`: compresión en navegador.
- `js/modules/validation.js`: reglas compartidas.
- `scripts/validate-admin.mjs`: validación automatizada.
- `supabase/policies/202607280004_storage_admin_upload.sql`: ajuste de carga
  administrativa.
- `docs/administracion.md`: guía operativa.

## 3. Decisiones técnicas

- El rol se consulta en `public.profiles`; nunca se confía en datos editables
  del usuario.
- Las páginas se protegen en el navegador para la experiencia y RLS protege
  cada lectura o escritura.
- El editor puede publicar directamente, pero sólo administra sus filas.
- La sesión se conserva en el navegador y el cierre de sesión usa alcance
  local.
- El panel no contiene funciones para crear usuarios ni usa claves elevadas.
- La eliminación archiva primero para evitar contenido público con archivos
  ausentes.
- El administrador puede subir una imagen dentro de la carpeta del autor
  original; el editor conserva el límite de su propia carpeta.

## 4. Verificación

`npm run check` confirmó:

- 79 archivos generados y revisados sin errores;
- estructura de Supabase, RLS, Storage y pruebas válida;
- rutas administrativas `noindex,nofollow`;
- uso de `getUser()` para verificar la sesión;
- cierre de sesión local;
- reglas de borrador, publicación, programación y slug;
- orden seguro de eliminación;
- ausencia de APIs de inserción HTML inseguras.

En navegador se confirmó:

- acceso visible y responsive;
- validación nativa de correo y contraseña;
- redirección de las páginas privadas cuando no existe sesión;
- consola sin errores durante el flujo anónimo;
- un intento de inserción anónima contra `publicaciones` fue bloqueado por
  Supabase con estado `401`; no se creó ningún dato;
- la política de carga administrativa se aplicó en Supabase y la consulta
  remota devolvió 13 verificaciones verdaderas, sin fallos;
- una cuenta real inició sesión y fue reconocida como administrador;
- el flujo administrador completó creación, lectura, edición, programación,
  archivo y eliminación definitiva;
- una imagen PNG de 1015 KB y 1254 × 1254 px se convirtió a WebP de 53 KB,
  se subió, se previsualizó y se eliminó de Storage;
- la misma cuenta se probó temporalmente como editor y pudo programar,
  archivar y eliminar su propia publicación sin aprobación;
- las dos publicaciones futuras de prueba permanecieron ocultas para la vista
  pública;
- la limpieza remota final confirmó `0` publicaciones, `0` archivos y el rol
  restaurado a `administrador`.

## 5. Incidencias

No se encontraron fallos de build, autenticación, consola, CRUD, RLS ni
Storage durante la prueba autenticada.

## 6. Pendiente

- Confirmar la URL oficial antes de configurar redirecciones de producción.
- Crear cuentas editor adicionales sólo cuando existan responsables reales.

## 7. Revisión manual

El responsable de la comunidad debe decidir los correos de las cuentas
iniciales y mantener sus contraseñas fuera del repositorio y del chat.

La primera publicación real debe comprobarse en borrador antes de hacerla
pública.

## 8. Siguiente paso

La Fase 6 definirá la galería y el contacto únicamente cuando sus requisitos y
datos reales estén confirmados.
