# Administración del sitio

## 1. Crear una cuenta autorizada

El registro público está desactivado. Las cuentas se crean únicamente desde el
proyecto **ComunaPage**:

1. Abre **Authentication > Users** en Supabase Dashboard.
2. Selecciona **Add user**.
3. Crea la cuenta con un correo real autorizado.
4. Define o envía una contraseña segura fuera del repositorio.
5. Confirma el correo desde Dashboard cuando corresponda.

El trigger `on_auth_user_created` crea automáticamente un registro en
`public.profiles` con el rol `editor`.

No se deben crear usuarios desde el navegador público ni agregar claves
elevadas al panel.

## 2. Asignar el primer administrador

Obtén el UUID desde **Authentication > Users** y ejecuta en SQL Editor:

```sql
update public.profiles
set rol = 'administrador'
where id = '<UUID-DE-LA-CUENTA>';
```

Comprueba el resultado:

```sql
select id, nombre, rol, created_at
from public.profiles
where id = '<UUID-DE-LA-CUENTA>';
```

Las cuentas siguientes permanecen como `editor` hasta que un administrador
decida cambiar su rol. Nunca se toma el rol desde `user_metadata`.

## 3. Acceder al panel

La entrada está disponible en:

```text
/admin/login.html
```

El usuario inicia sesión con correo y contraseña. El panel verifica el usuario
contra Supabase Auth y después consulta su perfil autorizado.

Las rutas protegidas son:

- `/admin/dashboard.html`;
- `/admin/publicaciones.html`;
- `/admin/editor.html`.

Sin una sesión válida se redirige al acceso. Esta redirección mejora la
experiencia, pero la seguridad real se aplica mediante RLS en PostgreSQL y
Storage.

El botón **Cerrar sesión** elimina únicamente la sesión del navegador actual.

## 4. Permisos

### Editor

- Ve publicaciones públicas y todas sus publicaciones propias.
- Crea noticias y proyectos.
- Edita, publica, programa, archiva y elimina únicamente sus publicaciones.
- Sube archivos solamente dentro de la carpeta asociada con su UUID.
- No cambia roles ni administra publicaciones privadas de otras cuentas.

### Administrador

- Ve y administra todas las publicaciones.
- Puede reemplazar la imagen de una publicación creada por otro autor.
- Puede cambiar roles desde la base de datos.
- No gestiona usuarios de Auth desde el frontend; las cuentas se crean
  manualmente en Dashboard.

## 5. Crear o editar una publicación

1. Abre **Nueva publicación** o selecciona **Editar**.
2. Elige noticia o proyecto.
3. Escribe título, slug, resumen y contenido confirmado.
4. Selecciona una imagen y completa su texto alternativo.
5. Elige uno de estos estados:
   - `borrador`: no se muestra públicamente;
   - `publicado`: puede publicarse ahora o programarse;
   - `archivado`: permanece en el panel y queda oculto.
6. Guarda y comprueba el mensaje de confirmación.

El contenido se almacena como texto. Para separar párrafos se usa una línea en
blanco; no se permite introducir HTML.

Una publicación programada mantiene el estado `publicado`, pero RLS la oculta
hasta que `fecha_publicacion` sea vigente.

## 6. Procesamiento de imágenes

El formulario acepta JPG, PNG o WebP de hasta 20 MB. Antes de subir:

- verifica el tipo declarado;
- rechaza dimensiones superiores a 50 millones de píxeles;
- corrige la orientación cuando el navegador lo permite;
- reduce el lado mayor a 2400 px;
- genera WebP con calidad progresiva;
- intenta mantener el resultado debajo de 1.5 MB;
- rechaza cualquier salida superior a 5 MB.

El bucket permanece privado. El panel y el sitio público solicitan URLs firmadas
temporales para mostrar las imágenes.

## 7. Archivar o eliminar

**Archivar** oculta el contenido sin borrar su registro ni su imagen.

La eliminación definitiva solicita confirmación y sigue este orden:

1. archiva la publicación para retirarla del sitio público;
2. elimina la imagen de Storage;
3. elimina la fila de `public.publicaciones`.

Si Storage falla, el registro permanece archivado y la acción puede
reintentarse. Este orden evita dejar visible una publicación con su imagen
eliminada.

## 8. Comprobaciones recomendadas

Antes de publicar contenido real:

```powershell
npm run check
npm run verify:publications
```

Después prueba con una cuenta editor y otra administrador:

- acceso y cierre de sesión;
- borrador propio;
- publicación inmediata;
- publicación futura;
- intento de editar contenido ajeno;
- reemplazo de imagen por administrador;
- archivado y eliminación confirmada.
