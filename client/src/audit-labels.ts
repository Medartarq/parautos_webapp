const labels: Record<string, string> = {
  CREATED: "Orden creada", CLAIM_COMPLETED: "Número de siniestro registrado", DIAGNOSIS_UPLOADED: "Diagnóstico cargado", OPERATIONAL_DATA_CORRECTED: "Datos operativos corregidos",
  QUOTE_DRAFT_SAVED: "Borrador de cotización guardado", QUOTE_CREATED: "Cotización creada", QUOTE_UPDATED: "Cotización actualizada", QUOTE_DELETED: "Cotización eliminada", QUOTE_SENT: "Cotización enviada", QUOTE_APPROVED: "Cotización aprobada",
  PART_UPDATED: "Repuesto actualizado", PARTS_LOGISTICS_UPDATED: "Logística de repuestos actualizada", REPAIR_STARTED: "Reparación iniciada", REPAIR_STARTED_BY_OVERRIDE: "Reparación iniciada por excepción de superadministrador",
  LABOR_VERIFIED: "Partida de mano de obra verificada", LABOR_VERIFICATION_REMOVED: "Verificación de partida retirada", ALL_LABOR_VERIFIED: "Todas las partidas verificadas", ALL_LABOR_VERIFICATIONS_REMOVED: "Verificaciones de partidas retiradas",
  FINAL_CONTROL_COMPLETED: "Control final completado", FINAL_CONTROL_REOPENED: "Control final reabierto", READY_FOR_PICKUP_PUBLISHED: "Lista para entrega publicada", ORDER_DELIVERED: "Orden entregada",
  SUPERADMIN_ORDER_ARCHIVED: "Caso cancelado y archivado por superadministrador", SUPERADMIN_QUOTE_REVERTED: "Caso revertido a cotización pendiente", SUPERADMIN_ORDER_RESET: "Caso restablecido a recepción inicial",
  USER_CREATED: "Usuario creado", USER_UPDATED: "Usuario actualizado", USER_ACTIVATED: "Usuario activado", USER_DEACTIVATED: "Usuario desactivado", USER_ANONYMIZED: "Usuario anonimizado", USER_DELETED: "Usuario eliminado", PASSWORD_CHANGED: "Contraseña actualizada",
  PARTS_PROVIDER_CREATED: "Proveedor de repuestos creado", PARTS_PROVIDER_UPDATED: "Proveedor de repuestos actualizado", PARTS_REQUEST_CREATED: "Solicitud de repuestos creada",
  INDEPENDENT_QUOTE_CREATED: "Cotización independiente creada", INDEPENDENT_QUOTE_STATUS_CHANGED: "Estado de cotización independiente actualizado", INDEPENDENT_QUOTE_ORDER_LINKED: "Orden vinculada a cotización independiente", INDEPENDENT_QUOTE_ORDER_UNLINKED: "Orden desvinculada de cotización independiente", INDEPENDENT_QUOTE_PARTS_REQUEST_GENERATED: "Solicitud de repuestos generada desde cotización independiente", INDEPENDENT_QUOTE_ADMIN_OVERRIDE: "Excepción administrativa en cotización independiente", INDEPENDENT_QUOTE_ACTIVATED: "Orden activada desde cotización independiente",
};

export const auditActionLabel = (action: string) => labels[action] || action.replaceAll("_", " ");
