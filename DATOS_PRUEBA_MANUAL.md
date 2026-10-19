# Datos reutilizables de prueba manual

Última actualización: 2026-10-19.

Este catálogo evita usar órdenes reales para las validaciones de paridad. Antes
de una ronda, ejecute `npm run seed:demo` y, para Dashboard/Reportes,
`npm run seed:reports`. Ambos procesos son idempotentes: no duplican los casos
identificados por sus documentos demo.

## Usuarios locales

| Rol | Usuario | Contraseña | Uso |
| --- | --- | --- | --- |
| Superadministrador | Cuenta creada por bootstrap | Configuración local no versionada | Todos los módulos y administración de cuentas. |
| Administrador | `admin.local` | Configuración local no versionada | Flujo total, Reportes y Auditoría; sin Usuarios. |
| Asesor | `asesor01` | Configuración local no versionada | Flujo operativo y comprobación de restricciones. |
| Asesor | `asesor02` | Configuración local no versionada | Carga/actividad alternativa en Reportes. |

## Casos semilla

| Placa | Caso | Estado útil | Validaciones principales |
| --- | --- | --- | --- |
| `DEM-101` | Lucía Medina Ramos | Cotización pendiente | R-05 detalle, creación/edición de borrador, navegación. |
| `DEM-202` | Carlos Paredes Vega | Cotización enviada | R-06 lectura de snapshot y espera de aprobación. |
| `DEM-303` | Andrea Salazar Núñez | Cotización aprobada con repuesto | R-07 proveedor/pedido/llegada y transición a reparación. |
| `DEM-404` | Marcos Villanueva Ortiz | Dos cotizaciones versionadas | R-06 historial, ajuste y PDF/XLSX multipágina. |

## Datos de recepción para una orden nueva

Usar desde **Nueva orden → Cargar datos demo**:

- Cliente: María Fernanda Torres, DNI `70894561`.
- Vehículo: Toyota Hilux, placa `ABC-123`, VIN `8AJHA8CD0R1234567`.
- Modalidad: MAPFRE; siniestro `SIN-2026-00421`.
- Incluye 44 respuestas de checklist, observación de demostración, diagnóstico,
  firma y confirmaciones.

## Recorrido R-05: detalle de orden

1. Iniciar sesión como Superadministrador, Administrador o Asesor y abrir una orden demo.
2. Revisar Resumen, Recepción, Cotización e Historial; abrir evidencia o
   diagnóstico si está disponible y reabrir el documento A4 de recepción.
3. Corregir un dato operativo permitido con razón; confirmar que el cambio se
   refleje en Resumen/Historial.
4. Recargar el navegador, cerrar sesión e iniciar de nuevo; confirmar que datos,
   historial y documentos persisten.
5. Repetir el acceso y visualización principal en móvil.

Registrar placa, rol, navegador, fecha y resultado en el Verification Log antes
de cerrar R-05.

## Recorrido R-06: cotizaciones y exportaciones

Usar Superadministrador o Administrador en escritorio y comprobar la lectura principal en móvil.

1. **`DEM-101` (borrador):** abrir Cotización, editar una partida y usar
   **Guardar borrador**; recargar y comprobar la recuperación. Después usar
   **Crear versión** para generar la instantánea auditable. El borrador queda
   editable para preparar la siguiente versión; desde V2 se solicita motivo de
   ajuste. Crear/eliminar una partida de prueba sin dejar líneas vacías; si se
   envía, usarlo sólo al final del recorrido.
2. **`DEM-202` (enviada):** comprobar el snapshot no editable y aprobar sólo
   después de revisar el historial de la transición.
3. **`DEM-404` (histórico):** elegir cada versión, revisar motivo de ajuste e
   historial, y descargar PDF y XLSX de una versión histórica y de la vigente.
4. Abrir los archivos descargados: verificar cabecera institucional, datos de
   orden, partidas agrupadas, total sin IGV y continuidad en PDF; en XLSX,
   edición, fórmulas de subtotal/total, moneda y encabezado congelado.
5. Validar el acceso desde Cotizaciones y que la pestaña Cotización se abre para
   el caso seleccionado; revisar en móvil la lista, historial y estados.

Registrar las transiciones efectuadas, archivos descargados y resultado por
placa antes de cerrar R-06.

## Recorrido R-09: seguimiento público

Usar una orden demo y copiar desde **Resumen** su placa y código público de seis
dígitos. La consulta no requiere iniciar sesión.

1. Abrir `/seguimiento` en una ventana privada, en escritorio y móvil.
2. Consultar con placa válida (con o sin guion) y el código correcto; confirmar
   orden, placa, marca/modelo y sólo el estado público.
3. Abrir `/seguimiento?plate=PLACA&code=123456` con los valores válidos y
   confirmar el autollenado antes de consultar.
4. Probar código incorrecto, placa incorrecta y código con menos de seis dígitos;
   confirmar mensaje uniforme, sin filtrar si la placa o el código existe.
5. Consultar una orden entregada o cancelada si está disponible y comprobar el
   mensaje terminal, sin exponer cliente, asesor, siniestro, cotización ni datos
   internos.
