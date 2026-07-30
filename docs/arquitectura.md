# Arquitectura del sitio

## Decisión principal

El sitio se genera con un script pequeño basado únicamente en Node.js. Este
proceso inserta header y footer compartidos en documentos HTML completos y
copia los recursos necesarios a `dist/`.

Esta decisión mantiene:

- HTML semántico disponible antes de ejecutar JavaScript.
- Buen soporte SEO y accesibilidad.
- Componentes compartidos sin duplicación manual.
- Ausencia de frameworks y dependencias de compilación.
- Una salida estática compatible con Cloudflare Pages.

## Capas

1. **Contenido y estructura:** páginas y parciales en `src/`.
2. **Presentación:** variables, base, layout, componentes y páginas en `css/`.
3. **Interacción:** módulos pequeños en `js/`.
4. **Datos:** servicios de Supabase, a partir de la Fase 3.
5. **Persistencia:** PostgreSQL, RLS y Storage mediante scripts versionados.

## Patrones aplicados

- **Separación de responsabilidades:** estructura, presentación, interacción y
  datos permanecen desacoplados.
- **Módulos ES:** cada comportamiento exporta una API pequeña.
- **Estados iniciales semánticos:** cada vista conserva un título y un estado de
  carga comprensible antes de que JavaScript complete la consulta.
- **Fuente única:** header, footer y tokens visuales se mantienen en un solo
  lugar.
- **Validación automatizada:** el proceso comprueba recursos, fragmentos,
  encabezados, metadatos e imágenes.

Para Supabase se aplican desde la Fase 3:

- Esquema, políticas, seed y pruebas versionados por separado.
- Un modelo de permisos basado en RLS y funciones internas.
- Restricciones e índices como defensa de integridad.
- Triggers para perfiles, normalización y fechas de actualización.
- Estados explícitos para las publicaciones.
- Configuración pública generada en el build y servicios de acceso a datos
  separados de las páginas a partir de la Fase 4.

Desde la Fase 5, el panel añade:

- un cliente de autenticación separado del cliente público;
- protección común de rutas y controladores específicos por pantalla;
- servicios CRUD independientes de las vistas;
- validación compartida entre formulario y pruebas;
- procesamiento de imágenes antes de Storage;
- autorización definitiva en RLS, sin depender de controles visuales.

Desde la Fase 6, la galería aplica el mismo patrón vertical:

- vista pública, controlador y servicio de datos separados;
- CRUD administrativo y validación específica para fotografías;
- tabla `galeria_items` con restricciones, índices, trigger y RLS;
- bucket privado `galeria` con URLs firmadas y límite de 5 MB;
- carga progresiva, detalle accesible con `dialog` y estado vacío real;
- pruebas transaccionales de visitante, editor y administrador;
- contacto sin formulario ni canales inventados mientras falten confirmaciones.

## Identidad visual

Los colores principales se derivan del logotipo:

- Verde: confianza, territorio y agricultura.
- Maíz: identidad productiva y energía comunitaria.
- Crema y tonos tierra: cercanía, memoria y contexto andino.

Todos los valores editables se encuentran en `css/variables.css`.

## Salida y despliegue

Cloudflare Pages deberá ejecutar `npm run build` y publicar el directorio
`dist`. La configuración final se realizará en la Fase 8.

## SEO condicionado por entorno

El dominio oficial todavía no está confirmado. Para evitar canonical y sitemap
incorrectos, el generador consulta `SITE_URL`:

- si existe, genera canonical, Open Graph absoluto, robots y sitemap;
- si no existe, conserva únicamente los metadatos que no requieren URL.

Las plantillas dinámicas de noticia y proyecto actualizan título y descripción
al resolver un slug real, pero permanecen con `noindex` hasta definir el
dominio y una URL canonical definitiva.
