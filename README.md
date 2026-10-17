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

## Credenciales locales de desarrollo

> No use estas credenciales en producción. Cambie las contraseñas antes de
> desplegar la aplicación en un entorno compartido.

| Perfil | Usuario | Contraseña | Rol |
| --- | --- | --- | --- |
| Desarrollador | `admin.local` | `Parautos!Acceso2026` | `ADMINISTRADOR` |
| Gerente | `C.Amaya` | `Parautos!Acceso2026` | `ADMINISTRADOR` |
| Asesor 1 | `asesor01` | `Parautos!Acceso1` | `ASESOR` |
| Asesor 2 | `asesor02` | `Parautos!Acceso2` | `ASESOR` |

## Estructura

- `client/`: React responsive.
- `server/`: API Express, reglas de negocio y acceso a MariaDB.
- `shared/`: contratos y validaciones compartidos.
- `database/migrations/`: esquema SQL versionado.

No se guardan contrasenas, archivos ni credenciales en el repositorio.
