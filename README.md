# La Buena Esperanza de Guachalá

Sitio institucional estático de la Comunidad La Buena Esperanza de Guachalá.
La aplicación usa HTML5, CSS3 y JavaScript ES6 modular, sin frameworks.

## Estado

Las Fases 1, 2, 3, 4, 5 y 6 establecen:

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
- Galería pública conectada a fotografías reales con carga progresiva y detalle.
- CRUD de galería para administrador y editor, con orden manual y estados.
- Bucket privado, RLS y pruebas por rol específicas para fotografías.
- Contacto responsable sin publicar canales todavía no confirmados.

El esquema, RLS y Storage de Supabase están aplicados en ComunaPage. La
verificación remota terminó con 19 de 19 controles de estructura y 9 de 9
controles de acceso de galería aprobados. La base todavía no contiene
publicaciones ni fotografías públicas, por lo que se muestran estados vacíos
controlados.

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
- `src/pages/admin/`: acceso, dashboard y CRUD protegidos de publicaciones y galería.
- `src/partials/`: header y footer reutilizables.
- `css/`: tokens, base, layout, componentes y estilos de páginas.
- `js/`: módulos JavaScript.
- `scripts/`: generación y validación sin dependencias.
- `assets/`: imágenes, logotipo e iconos.
- `supabase/`: esquema, políticas, seed y pruebas de base de datos.
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

Consulta [la guía de Supabase](docs/supabase-configuracion.md) antes de conectar
el proyecto y [la guía de administración](docs/administracion.md) para crear
cuentas y gestionar publicaciones.
