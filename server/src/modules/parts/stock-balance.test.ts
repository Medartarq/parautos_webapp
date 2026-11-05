import { expect, it } from "vitest";
import { stockBalance, type StockMovement } from "./stock-balance.js";

const move = (movementType: string, quantity: number, technicianId?: number): StockMovement => ({ movementType, quantity, technicianId });

it("returns a technician's unit to the workshop for reissue", () => {
  const history = [move("RECEPCION_CONFORME", 2), move("ENTREGA_TECNICO", 2, 1), move("DEVOLUCION_TECNICO", 1, 1)];
  expect(stockBalance(history, 1)).toEqual({ received: 2, workshop: 1, technician: 1 });
  history.push(move("ENTREGA_TECNICO", 1, 2));
  expect(stockBalance(history, 2)).toEqual({ received: 2, workshop: 0, technician: 1 });
  history.push(move("DEVOLUCION_TECNICO", 1, 2), move("DEVOLUCION_PROVEEDOR", 1));
  expect(stockBalance(history, 2)).toEqual({ received: 2, workshop: 0, technician: 0 });
});

it("keeps installation and returns within each technician's own balance", () => {
  const history = [move("RECEPCION_CONFORME", 3), move("ENTREGA_TECNICO", 2, 1), move("ENTREGA_TECNICO", 1, 2), move("INSTALACION", 1, 1)];
  expect(stockBalance(history, 1).technician).toBe(1);
  expect(stockBalance(history, 2).technician).toBe(1);
  expect(stockBalance(history, 3).technician).toBe(0);
});

it("does not introduce floating-point stock shortages for decimal quantities", () => {
  const history = [move("RECEPCION_CONFORME", .3), move("ENTREGA_TECNICO", .1, 1), move("ENTREGA_TECNICO", .2, 1)];
  expect(stockBalance(history, 1)).toEqual({ received: .3, workshop: 0, technician: .3 });
});
