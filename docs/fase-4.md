# Fase 4: publicaciones públicas

## 1. Implementado

- Cliente público oficial de Supabase, fijado en la versión `2.106.2`.
- Servicio separado para noticias y proyectos.
- Consulta exclusiva de publicaciones con estado `publicado` y fecha vigente.
- Listados públicos con carga progresiva de seis elementos.
- Últimas cuatro publicaciones en la portada.
- Detalle seguro por tipo y `slug`.
- Imágenes del bucket privado mediante URLs firmadas por una hora.
- Estados de carga, vacío, ausencia y error con reintento.
- Metadatos de título y descripción actualizados cuando existe un detalle.

## 2. Archivos

- `js/config/supabase-client.js`: cliente anónimo sin persistencia de sesión.
- `js/modules/publication-service.js`: consultas y acceso a Storage.
- `js/modules/publication-view.js`: creación segura de nodos de interfaz.
- `js/modules/publications-controller.js`: flujos de portada, listado y detalle.
- `scripts/validate-publications.mjs`: controles propios de esta fase.
- `src/pages/`: portada, listados y plantillas de detalle conectadas.
- `css/pages.css`: tarjetas, estados y artículo responsive.

## 3. Decisiones técnicas

- La RLS de PostgreSQL sigue siendo la autorización principal. Los filtros del
  navegador duplican las reglas públicas para hacer explícita la intención.
- El cliente público no guarda ni renueva sesiones; la autenticación del panel
  administrativo se configurará por separado en la Fase 5.
- El contenido editorial se crea con `textContent` y nodos DOM. No se acepta
  HTML arbitrario desde la base de datos.
- Las imágenes no hacen público el bucket: cada lectura genera una URL
  temporal. Si la imagen no está disponible, el listado conserva una
  ilustración local sin bloquear el texto.
- La carga progresiva usa un orden estable por fecha e identificador.
- Las páginas de detalle conservan `noindex` mientras no exista un dominio
  oficial y una estrategia canonical definitiva.

## 4. Verificación

Ejecuta:

```powershell
npm run check
npm run verify:publications
```

La revisión del 28 de julio de 2026 confirmó:

- 65 archivos generados y revisados sin errores;
- esquema, RLS y Storage válidos;
- configuración pública local presente y sin credenciales elevadas;
- endpoint remoto accesible desde el navegador;
- registro público desactivado y `disable_signup = true` confirmado por Auth;
- portada, noticias y proyectos muestran el estado vacío real;
- los detalles sin slug y con slug inexistente responden de forma controlada;
- un único `h1` en cada detalle;
- consola del navegador sin errores ni advertencias.

La base remota continúa con cero publicaciones públicas. No se añadieron datos
ficticios ni se publicaron borradores para probar la interfaz.

## 5. Incidencias resueltas

Durante la prueba en navegador se corrigieron dos concordancias de género en
los estados vacíos y de ausencia. No hubo errores de red ni de JavaScript.

## 6. Pendiente

- Crear las cuentas iniciales y asignar el primer administrador.
- Probar tarjetas e imagen firmada con la primera publicación real.
- Definir el dominio para canonical, sitemap y detalle indexable.

## 7. Revisión manual

Cuando exista la primera publicación real, revisar el recorte de su imagen, el
texto alternativo, el resumen y el formato de los párrafos en escritorio y
móvil. No se debe crear contenido ficticio para completar la vista pública.

## 8. Siguiente paso

La Fase 5 implementará autenticación cerrada y el panel administrativo para los
dos roles, con creación, edición, publicación inmediata o programada,
procesamiento de imágenes y eliminación coordinada con Storage.
