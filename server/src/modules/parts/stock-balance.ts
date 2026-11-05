export type StockMovement = { movementType: string; quantity: number | string; technicianId?: number | null };

export function stockBalance(movements: StockMovement[], technicianId?: number | null) {
  const total = (types: string[], technician?: number | null) => movements
    .filter((movement) => types.includes(movement.movementType) && (technician === undefined || Number(movement.technicianId) === technician))
    .reduce((sum, movement) => sum + Math.round(Number(movement.quantity) * 1000), 0);
  const received = total(["RECEPCION_CONFORME"]);
  const returned = total(["DEVOLUCION_TECNICO"]);
  return {
    received: received / 1000,
    workshop: (received + returned - total(["ENTREGA_TECNICO", "DEVOLUCION_PROVEEDOR"])) / 1000,
    technician: (total(["ENTREGA_TECNICO"], technicianId) - total(["DEVOLUCION_TECNICO", "INSTALACION"], technicianId)) / 1000,
  };
}
