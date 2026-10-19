# PARAUTOS - Aplicacion final

Monolito modular para la operacion de PARAUTOS. La interfaz React y la API Express
se despliegan bajo el mismo dominio; MariaDB conserva los datos y almacenamiento
privado configurable conserva archivos y evidencias.

## Requisitos

- Node.js 22.12 o superior.
- MariaDB 11.8.9 o compatible.

## Desarrollo local

1. Copie `.env.example` a `.env` y complete las credenciales locales.
2. Ejecute `npm install`.
3. Ejecute `npm run migrate`.
4. Ejecute `npm run dev`.
5. Abra `http://localhost:5173`.

La primera cuenta se crea una sola vez mediante `POST /api/v1/setup/initial` con
el rol `SUPERADMINISTRADOR`.
El token de bootstrap debe eliminarse del entorno despues de completar esa operacion.

En Hostinger mantenga el comando de build `npm run build` y agregue la variable
`DEPLOY_RUN_MIGRATIONS=true`. El build compila y aplica las migraciones **antes**
de publicar la nueva versión. Si una migración falla, Hostinger conserva la
aplicación previamente activa; la API no ejecuta migraciones al iniciar y, por
tanto, no queda bloqueada durante el arranque. En desarrollo local la variable
no debe definirse y `npm run build` sólo compilará. Tras crear el primer Superadministrador,
`BOOTSTRAP_ADMIN_TOKEN` puede eliminarse de forma segura.

## Roles y permisos

| Rol | Acceso |
| --- | --- |
| `SUPERADMINISTRADOR` | Todos los módulos y administración exclusiva de cuentas: listar, crear, activar y desactivar usuarios. |
| `ADMINISTRADOR` | Todo el flujo operativo, Reportes y Auditoría; no puede acceder a Usuarios. |
| `ASESOR` | Flujo operativo; no puede acceder a Reportes, Auditoría ni Usuarios. |

La API aplica estas reglas por ruta; ocultar una opción del menú no es el único
control de autorización.

## Archivos en producción

En desarrollo se utiliza `STORAGE_PROVIDER=local`. Para Hostinger configure un
bucket S3-compatible (por ejemplo, Cloudflare R2) y establezca
`STORAGE_PROVIDER=s3`, `S3_BUCKET`, `S3_ACCESS_KEY_ID` y
`S3_SECRET_ACCESS_KEY`; para R2 agregue `S3_ENDPOINT` y mantenga
`S3_REGION=auto`. `S3_PREFIX` separa los objetos de PARAUTOS dentro del bucket.
La aplicación conserva en MariaDB la clave, proveedor, hash y metadatos; las
lecturas y eliminaciones se resuelven con el proveedor registrado por adjunto.
La credencial debe disponer únicamente de `PutObject`, `GetObject` y
`DeleteObject` sobre el prefijo configurado.

Como alternativa sin almacenamiento externo, Hostinger confirmó una carpeta
privada fuera del despliegue. Configure `STORAGE_PROVIDER=local`,
`LOCAL_UPLOAD_BASE=home` y `LOCAL_UPLOAD_DIR=parautos-data/uploads`; la ruta se
construye desde `$HOME`, sin fijar el nombre del usuario. No use `public_html`,
`hbuilds`, `nodejs` ni el directorio del proyecto para adjuntos privados. Antes
de producción, cree un archivo marcador, reinicie y redepliegue para confirmar
persistencia, y mantenga copias de seguridad de la carpeta junto con MariaDB.

## Credenciales locales de desarrollo

> No use estas credenciales en producción. Cambie las contraseñas antes de
> desplegar la aplicación en un entorno compartido.

| Perfil | Usuario | Contraseña | Rol |
| --- | --- | --- | --- |
| Desarrollador | `admin.local` | Configuración local no versionada | `ADMINISTRADOR` |
| Gerente | `C.Amaya` | Configuración local no versionada | `ADMINISTRADOR` |
| Asesor 1 | `asesor01` | Configuración local no versionada | `ASESOR` |
| Asesor 2 | `asesor02` | Configuración local no versionada | `ASESOR` |

La cuenta Superadministrador se crea sólo mediante el bootstrap inicial o una
migración controlada; no se crea desde el directorio de usuarios.

## Estructura

- `client/`: React responsive.
- `server/`: API Express, reglas de negocio y acceso a MariaDB.
- `shared/`: contratos y validaciones compartidos.
- `database/migrations/`: esquema SQL versionado.

No se guardan contrasenas, archivos ni credenciales en el repositorio.
