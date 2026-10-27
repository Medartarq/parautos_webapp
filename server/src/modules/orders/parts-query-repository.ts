import { snapshotIdentityColumn } from "./reception-snapshot.js";
import { getPool } from "../../db/pool.js";

export const partSelect = `SELECT p.id, p.order_id AS orderId, p.description, p.quantity, p.received_quantity AS receivedQuantity, p.partial_received AS partialReceived,
  p.management_status AS managementStatus, p.quality, p.part_code AS partCode, p.expected_date AS expectedDate,
  p.provider_id AS providerId, p.provider_name AS providerName, p.provider_contact AS providerContact,
  p.provider_email AS providerEmail, p.provider_phone AS providerPhone, p.notes, p.updated_at AS updatedAt,
  o.order_number AS orderNumber, ${snapshotIdentityColumn("plate", "v.plate")} AS plate, ${snapshotIdentityColumn("brand", "v.brand")} AS brand, ${snapshotIdentityColumn("model", "v.model")} AS model, ${snapshotIdentityColumn("color", "v.color")} AS color, o.claim_number AS claimNumber,
  l.freight_requested AS freightRequested
  FROM order_parts p JOIN service_orders o ON o.id = p.order_id JOIN client_vehicles cv ON cv.id = o.client_vehicle_id JOIN vehicles v ON v.id = cv.vehicle_id LEFT JOIN order_parts_logistics l ON l.order_id = p.order_id LEFT JOIN reception_snapshots rs ON rs.order_id = o.id `;

export interface PartsQueryRepository { listParts(orderId?: number): Promise<any[]>; listProviders(): Promise<any[]>; findLogistics(orderId: number): Promise<any | undefined>; }
export const mariaDbPartsQueryRepository: PartsQueryRepository = {
  listParts: (orderId) => getPool().query<any[]>(`${partSelect}${orderId ? " WHERE p.order_id = ?" : ""} ORDER BY p.expected_date IS NULL, p.expected_date, p.updated_at DESC`, orderId ? [orderId] : []),
  listProviders: () => getPool().query<any[]>("SELECT id, name, contact_name AS contactName, email, phone, brands, qualities, lead_time_days AS leadTimeDays, freight_available AS freightAvailable, coverage FROM parts_providers WHERE active = 1 ORDER BY name"),
  async findLogistics(orderId) { return (await getPool().query<any[]>("SELECT freight_requested AS freightRequested, freight_amount AS freightAmount, freight_payment AS freightPayment, expansion_required AS expansionRequired, owner, notes FROM order_parts_logistics WHERE order_id = ?", [orderId]))[0]; },
};
