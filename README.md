# La Buena Esperanza de Guachalá

Sitio institucional estático de la Comunidad La Buena Esperanza de Guachalá.
La aplicación usa HTML5, CSS3 y JavaScript ES6 modular, sin frameworks.

## Funcionalidad

- Arquitectura fuente y salida generada.
- Sistema visual basado en el logotipo oficial.
- Header y footer compartidos.
- Menú móvil accesible.
- Diseño responsive base.
- Módulo conceptual de colaboración comunitaria.
- Páginas públicas institucionales.
- Breadcrumbs, página 404 y estados vacíos.
- Títulos y descripciones únicos por página.
- Open Graph y tarjeta social.
- Canonical, robots y sitemap condicionados al dominio oficial.
- Esquema versionado de Supabase para perfiles y publicaciones.
- Permisos RLS de visitante, editor y administrador.
- Storage privado para imágenes editoriales.
- Configuración pública generada desde variables locales.
- Pruebas SQL y validación de seguridad sin dependencias.
- Cliente público oficial de Supabase con versión fijada.
- Portada, listados y detalles conectados a publicaciones reales.
- Carga progresiva, URLs de imagen firmadas y estados de interfaz completos.
- Autenticación cerrada para administradores y editores.
- Panel administrativo con CRUD, filtros y programación.
- Procesamiento local de imágenes a WebP antes de subirlas.
- Miniaturas WebP independientes para listados y vistas previas.
- Galería pública conectada a fotografías reales con carga progresiva y detalle.
- CRUD de galería para administrador y editor, con orden manual y estados.
- Bucket privado, RLS y pruebas por rol específicas para fotografías.
- Formulario privado de pasantías, tesis y proyectos con PDF opcional.
- Revisión de propuestas en el panel con roles administrador/editor.
- Contacto, privacidad y ubicación oficial.
- Aviso accesible de la publicación más reciente.

El esquema, RLS y Storage están aplicados en ComunaPage. Las propuestas y sus
PDF permanecen privadas; el navegador público sólo puede enviarlas mediante una
Edge Function protegida con Turnstile.

## Requisitos

- Node.js 20 o posterior.
- Un navegador moderno.

No es necesario instalar paquetes: el proyecto no tiene dependencias de npm.

## Generar y validar

```powershell
npm run check
```

La salida lista para previsualizar o desplegar se genera en `dist/`.

Para verla localmente:

```powershell
python -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Después abre `http://127.0.0.1:4173/index.html`.

## Estructura

- `src/pages/`: documentos HTML fuente.
- `src/pages/admin/`: acceso y CRUD protegido de publicaciones, galería y propuestas.
- `src/partials/`: header y footer reutilizables.
- `css/`: tokens, base, layout, componentes y estilos de páginas.
- `js/`: módulos JavaScript.
- `scripts/`: generación y validación sin dependencias.
- `assets/`: imágenes, logotipo e iconos.
- `supabase/`: esquema, políticas, función, Storage y pruebas de base de datos.
- `docs/`: decisiones técnicas y guías.
- `dist/`: salida generada; no se versiona.

## Páginas públicas

El sitio incluye inicio, comunidad, historia, cultura, territorio, producción,
deporte, noticias, proyectos, galería, colaboración, contacto, plantillas de
detalle y página 404.

Los listados y detalles consultan Supabase y sólo muestran contenido publicado
cuya fecha ya es vigente. Las plantillas conservan `noindex` hasta confirmar el
dominio y la estrategia canonical.

## Seguridad

- Nunca uses `SUPABASE_SERVICE_ROLE_KEY` en este repositorio.
- El frontend utilizará únicamente la URL y clave publicable de Supabase.
- La autorización real dependerá de Row Level Security.
- Los valores locales se guardarán en `.env`, que está ignorado por Git.

Consulta [la guía de administración](docs/administracion.md) para crear cuentas
y gestionar contenido. Para publicar, sigue
[la guía de despliegue](docs/despliegue.md).
