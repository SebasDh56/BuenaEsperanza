# Fase 2: páginas públicas, accesibilidad y SEO inicial

## Rutas creadas

- `/index.html`
- `/comunidad.html`
- `/historia.html`
- `/cultura.html`
- `/territorio.html`
- `/produccion.html`
- `/deporte.html`
- `/noticias.html`
- `/noticia.html`
- `/proyectos.html`
- `/proyecto.html`
- `/galeria.html`
- `/colabora.html`
- `/contacto.html`
- `/404.html`

## Alcance

- Navegación real entre páginas.
- Breadcrumbs en páginas internas.
- Un título y una descripción únicos por ruta.
- Encabezados semánticos.
- Estados vacíos para noticias, proyectos y deporte.
- Estados pendientes para formularios, galería y contacto.
- Plantillas de detalle marcadas `noindex` hasta su conexión con Supabase.
- Página 404 accesible.
- Imágenes con dimensiones, textos alternativos y carga diferida cuando
  corresponde.
- Diseño responsive en los breakpoints principales.

## SEO dependiente del dominio

La variable `SITE_URL` activa durante la generación:

- canonical por página;
- `og:url`;
- `og:image`;
- `sitemap.xml`;
- referencia al sitemap dentro de `robots.txt`.

Sin un dominio confirmado, estos elementos se omiten para evitar publicar URLs
falsas. Los títulos, descripciones y Open Graph básicos sí permanecen activos.

## Contenido pendiente

No se inventaron:

- teléfono, correo, redes o dirección exacta;
- coordenadas, límites o superficie;
- disciplinas y calendarios deportivos;
- productos, productores, precios o contactos;
- fotografías y eventos específicos;
- noticias o proyectos.

Las secciones correspondientes identifican explícitamente el estado pendiente.

## Verificación

El comando `npm run check` genera y revisa el sitio. La validación comprueba:

- enlaces y fragmentos;
- archivos locales;
- títulos únicos;
- meta descriptions y Open Graph;
- un `h1` por página;
- breadcrumbs;
- IDs duplicados;
- dimensiones y textos alternativos de imágenes;
- ausencia de `innerHTML` en JavaScript.
