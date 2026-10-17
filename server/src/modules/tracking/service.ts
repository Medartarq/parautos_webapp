import { getPool } from "../../db/pool.js";

export type PublicTrackingLookup = {
  plate: string;
  code: string;
};

export async function getPublicTracking({ plate, code }: PublicTrackingLookup) {
  const rows = await getPool().query<
    Array<{
      orderNumber: string;
      plate: string;
      brand: string;
      model: string;
      publicStatus: string;
    }>
  >(
    `SELECT o.order_number AS orderNumber, v.plate, v.brand, v.model,
      o.public_status AS publicStatus
     FROM service_orders o
     JOIN client_vehicles cv ON cv.id = o.client_vehicle_id
     JOIN vehicles v ON v.id = cv.vehicle_id
     WHERE o.public_code = ? AND v.plate = ?
     LIMIT 1`,
    [code, plate],
  );
  return rows[0] ?? null;
}
