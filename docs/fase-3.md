# Fase 3: Supabase

## 1. Implementado

- Esquema de `profiles` y `publicaciones`.
- Roles, tipos y estados mediante enumeraciones.
- Restricciones, relaciones, índices y triggers.
- Creación automática de perfiles desde Supabase Auth.
- Publicación inmediata y programada.
- RLS para visitantes, editores y administradores.
- Bucket privado y políticas de Storage.
- Seed inerte con dos borradores opcionales.
- Configuración pública generada desde `.env`.
- Pruebas pgTAP y verificación remota de sólo lectura.

## 2. Archivos

Se añadieron scripts en `supabase/migrations/`, `supabase/policies/`,
`supabase/seed/` y `supabase/tests/`. También se añadieron la validación local,
la generación de configuración pública y esta documentación.

## 3. Decisiones técnicas

- Los editores administran y eliminan únicamente sus publicaciones.
- Los administradores administran cualquier publicación y los roles.
- El rol nunca se toma de `user_metadata`.
- Una fecha futura restringe la lectura pública desde RLS.
- El contenido editorial se almacena como texto, no como HTML arbitrario.
- Storage es privado y sólo libera imágenes vinculadas a contenido vigente.
- El archivo subido a Supabase no supera 5 MB; el original se procesará en el
  navegador en la Fase 5.

## 4. Verificación

`npm run check` revisa el build, las páginas y la estructura de Supabase sin
instalar paquetes. La instalación remota se comprobó el 28 de julio de 2026:

- 12 verificaciones ejecutadas;
- 12 aprobadas;
- 0 fallidas;
- resultado global `true`;
- endpoint público de `publicaciones`: HTTP 200;
- lectura anónima inicial: 0 registros.

Las pruebas funcionales pgTAP quedan preparadas para un entorno local de
Supabase.

## 5. Incidencias

Supabase CLI y `psql` no están instalados. No fue necesario añadir dependencias:
el esquema se aplicó mediante SQL Editor y se verificó en el proyecto remoto.

## 6. Pendiente

- Crear las cuentas iniciales cuando se definan sus correos.
- Asignar el primer rol `administrador`.

## 7. Revisión manual

El registro público se desactivó el 28 de julio de 2026. La comprobación de
sólo lectura del endpoint Auth devolvió `disable_signup = true`. Se deben
conservar fuera del repositorio todas las contraseñas y claves elevadas.

## 8. Siguiente paso

La configuración de Authentication quedó cerrada y la Fase 4 conectó el cliente
público, los listados y los detalles de noticias y proyectos.
