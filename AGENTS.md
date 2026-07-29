# Guía de trabajo del proyecto

## Stack obligatorio

- HTML5 semántico.
- CSS3 puro.
- JavaScript ES6 modular.
- Supabase Authentication, PostgreSQL y Storage.
- Cloudflare Pages.

No introducir frameworks de frontend, backend ni dependencias sin justificar y
obtener autorización.

## Flujo

1. Trabajar por fases pequeñas.
2. Ejecutar `npm run check` antes de cerrar una fase.
3. No editar archivos dentro de `dist/`; son generados.
4. Usar parciales para elementos compartidos.
5. Mantener contenido no confirmado claramente identificado.
6. No hacer commit ni push sin autorización expresa.

## Seguridad

- Nunca exponer ni versionar una clave `service_role`.
- No confiar en controles visuales para autorizar acciones.
- Toda tabla accesible desde el navegador debe tener RLS.
- Evitar `innerHTML` con contenido de usuarios.
- Validar tipo, tamaño y nombre de cada archivo antes de subirlo.
- Probar políticas con usuarios anónimos, editores y administradores.

## Base de datos

- Versionar esquema, datos de demostración y políticas por separado.
- Preferir restricciones e índices en la base de datos.
- Mantener los roles iniciales `administrador` y `editor`.
- Los editores pueden publicar directamente.
- Las publicaciones pueden ser inmediatas o programadas.
