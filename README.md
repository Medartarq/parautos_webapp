# PARAUTOS - Aplicacion final

Monolito modular para la operacion de PARAUTOS. La interfaz React y la API Express
se despliegan bajo el mismo dominio; MariaDB conserva los datos y un almacenamiento
S3-compatible conserva archivos y evidencias.

## Requisitos

- Node.js 22 o superior.
- MariaDB 11.8.9 o compatible.

## Desarrollo local

1. Copie `.env.example` a `.env` y complete las credenciales locales.
2. Ejecute `npm install`.
3. Ejecute `npm run migrate`.
4. Ejecute `npm run dev`.
5. Abra `http://localhost:5173`.

La primera cuenta se crea una sola vez mediante `POST /api/v1/setup/initial`.
El token de bootstrap debe eliminarse del entorno despues de completar esa operacion.

En Hostinger, donde el panel ejecuta un solo comando de build, mantenga
`npm run build` y configure temporalmente `RUN_MIGRATIONS_ON_START=true`. La API
aplicará las migraciones antes de escuchar solicitudes; confirme el despliegue y
vuelva la variable a `false` en el siguiente redeploy. Tras crear el primer
Administrador, `BOOTSTRAP_ADMIN_TOKEN` puede eliminarse de forma segura.

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

## Estructura

- `client/`: React responsive.
- `server/`: API Express, reglas de negocio y acceso a MariaDB.
- `shared/`: contratos y validaciones compartidos.
- `database/migrations/`: esquema SQL versionado.

No se guardan contrasenas, archivos ni credenciales en el repositorio.
