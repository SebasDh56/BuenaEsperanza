# Decisiones funcionales confirmadas

## Contenido e identidad

- La información histórica actual fue confirmada mediante investigación.
- El logotipo entregado es la referencia de identidad.
- La primera versión será en español.
- El correo, teléfono, redes y dominio están pendientes de confirmación.
- Toda publicación deberá contener información real.

## Usuarios y permisos

- Sólo existen los roles `administrador` y `editor`.
- Las cuentas se crean manualmente; no habrá registro público.
- El desarrollador o administrador podrá crear usuarios adicionales.
- El editor puede crear y publicar sin aprobación previa.
- La eliminación permanente estará disponible con confirmación y permisos RLS.

La matriz de eliminación queda definida por menor privilegio:

- el editor elimina únicamente sus publicaciones;
- el administrador elimina cualquier publicación.

## Publicaciones

- Se admite publicación inmediata y publicación programada.
- Estructura editorial prevista:
  - título;
  - subtítulo o resumen;
  - contenido por párrafos y subtítulos;
  - imagen principal;
  - texto alternativo;
  - metadatos de estado, autoría y fechas.
- El contenido se renderizará mediante una estructura permitida y controlada,
  sin aceptar HTML arbitrario.

## Imágenes

Se propone aceptar JPG, PNG y WebP de hasta 20 MB como archivo de entrada. Antes
de subir:

- se corrige la orientación;
- se reduce el lado mayor a un máximo aproximado de 2400 px;
- se genera WebP con calidad equilibrada;
- se intenta mantener el resultado por debajo de 1.5 MB;
- se rechaza el archivo si el navegador no puede procesarlo con seguridad.

No se admitirá un tamaño ilimitado porque puede agotar la memoria del navegador
y facilitar abuso del Storage.

## Colaboración comunitaria

El sitio distinguirá:

1. **Propuestas externas:** pasantías, tesis, investigación y proyectos que
   estudiantes, universidades u organizaciones presentan a la comunidad.
2. **Proyectos comunitarios:** iniciativas impulsadas por la comunidad que
   buscan apoyo técnico, académico o institucional.

Las propuestas recibidas no serán públicas automáticamente. Su estructura,
moderación, privacidad y medidas antispam se definirán antes de crear la tabla y
el formulario.

## Pendientes funcionales

- Modelo definitivo de la galería.
- Datos de contacto.
- Campos exactos del formulario de propuestas.
- Dominio definitivo para canonical y Open Graph.
