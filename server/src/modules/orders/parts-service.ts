import { getPool } from "../../db/pool.js";
import { AppError } from "../../errors/app-error.js";

type PartUpdateInput = {
  receivedQuantity: number;
  partialReceived?: boolean;
  managementStatus: "POR_GESTIONAR" | "PEDIDO" | "EN_TALLER";
  quality: "ORIGINAL" | "ALTERNATIVO";
  partCode?: string;
  expectedDate?: string;
  providerId?: number | null;
  notes?: string;
};

const partSelect = `SELECT p.id, p.order_id AS orderId, p.description, p.quantity, p.received_quantity AS receivedQuantity, p.partial_received AS partialReceived,
  p.management_status AS managementStatus, p.quality, p.part_code AS partCode, p.expected_date AS expectedDate,
  p.provider_id AS providerId, p.provider_name AS providerName, p.provider_contact AS providerContact,
  p.provider_email AS providerEmail, p.provider_phone AS providerPhone, p.notes, p.updated_at AS updatedAt,
  o.order_number AS orderNumber, v.plate, v.brand, v.model, v.color, o.claim_number AS claimNumber,
  l.freight_requested AS freightRequested
  FROM order_parts p JOIN service_orders o ON o.id = p.order_id JOIN client_vehicles cv ON cv.id = o.client_vehicle_id JOIN vehicles v ON v.id = cv.vehicle_id LEFT JOIN order_parts_logistics l ON l.order_id = p.order_id`;

function mapPart(row: any) {
  const quantity = Number(row.quantity); const receivedQuantity = Number(row.receivedQuantity);
  // Cada fila representa ahora un repuesto operativo individual. Se conserva la
  // columna heredada para compatibilidad, pero la recepción parcial no participa
  // del flujo ni vuelve a exponerse a los clientes.
  return { ...row, quantity, receivedQuantity, partialReceived: false, freightRequested: Boolean(row.freightRequested), fullyReceived: receivedQuantity >= quantity, partiallyReceived: false };
}

export async function listParts(orderId?: number) {
  const rows = await getPool().query<any[]>(`${partSelect}${orderId ? " WHERE p.order_id = ?" : ""} ORDER BY p.expected_date IS NULL, p.expected_date, p.updated_at DESC`, orderId ? [orderId] : []);
  return rows.map(mapPart);
}

export async function listPartProviders(brand?: string, quality?: string) {
  const rows = await getPool().query<any[]>("SELECT id, name, contact_name AS contactName, email, phone, brands, qualities, lead_time_days AS leadTimeDays, freight_available AS freightAvailable, coverage FROM parts_providers WHERE active = 1 ORDER BY name");
  return rows.filter((provider) => {
    const brands = typeof provider.brands === "string" ? JSON.parse(provider.brands) : provider.brands;
    const qualities = typeof provider.qualities === "string" ? JSON.parse(provider.qualities) : provider.qualities;
    return (!brand || brands.includes(brand.toUpperCase())) && (!quality || qualities.includes(quality));
  }).map((provider) => ({ ...provider, brands: typeof provider.brands === "string" ? JSON.parse(provider.brands) : provider.brands, qualities: typeof provider.qualities === "string" ? JSON.parse(provider.qualities) : provider.qualities, freightAvailable: Boolean(provider.freightAvailable) }));
}

export async function updatePart(partId: number, input: PartUpdateInput, actorUserId: number, requestId: string, ipAddress?: string, userAgent?: string) {
  const connection = await getPool().getConnection(); let failed = true;
  try {
    await connection.beginTransaction();
    const parts = await connection.query<any[]>(`${partSelect} WHERE p.id = ? FOR UPDATE`, [partId]); const part = parts[0];
    if (!part) throw new AppError(404, "PART_NOT_FOUND", "El repuesto no existe.");
    if (input.receivedQuantity > Number(part.quantity)) throw new AppError(400, "INVALID_RECEIVED_QUANTITY", "La cantidad recibida no puede superar la solicitada.");
    let provider: any;
    if (input.providerId) { provider = (await connection.query<any[]>("SELECT id, name, contact_name AS contactName, email, phone FROM parts_providers WHERE id = ? AND active = 1", [input.providerId]))[0]; if (!provider) throw new AppError(400, "PROVIDER_NOT_FOUND", "El proveedor no existe."); }
    const managementStatus = input.receivedQuantity >= Number(part.quantity) ? "EN_TALLER" : input.managementStatus;
    await connection.query("UPDATE order_parts SET received_quantity = ?, partial_received = ?, management_status = ?, quality = ?, part_code = ?, expected_date = ?, provider_id = ?, provider_name = ?, provider_contact = ?, provider_email = ?, provider_phone = ?, notes = ? WHERE id = ?", [input.receivedQuantity, 0, managementStatus, input.quality, input.partCode || null, input.expectedDate || null, provider?.id || null, provider?.name || null, provider?.contactName || null, provider?.email || null, provider?.phone || null, input.notes || null, partId]);
    await connection.query("INSERT INTO audit_events (actor_user_id, entity, record_id, action, new_data, request_id, ip_address, user_agent) VALUES (?, 'order_part', ?, 'PART_UPDATED', JSON_OBJECT('receivedQuantity', ?, 'managementStatus', ?, 'providerId', ?), ?, ?, ?)", [actorUserId, String(partId), input.receivedQuantity, input.managementStatus, provider?.id || null, requestId, ipAddress ?? null, userAgent ?? null]);
    await connection.commit(); failed = false;
    return mapPart((await connection.query<any[]>(`${partSelect} WHERE p.id = ?`, [partId]))[0]);
  } finally { if (failed) await connection.rollback(); connection.release(); }
}

export async function getPartsLogistics(orderId: number) {
  const row = (await getPool().query<any[]>("SELECT freight_requested AS freightRequested, freight_amount AS freightAmount, freight_payment AS freightPayment, expansion_required AS expansionRequired, owner, notes FROM order_parts_logistics WHERE order_id = ?", [orderId]))[0];
  return row ? { ...row, freightRequested: Boolean(row.freightRequested), expansionRequired: Boolean(row.expansionRequired) } : { freightRequested: false, freightAmount: null, freightPayment: "PENDIENTE", expansionRequired: false, owner: "", notes: "" };
}

export async function updatePartsLogistics(orderId: number, input: { freightRequested: boolean; freightAmount?: number | null; freightPayment: "PENDIENTE" | "PARCIAL" | "PAGADO"; expansionRequired: boolean; owner?: string; notes?: string }, actorUserId: number, requestId: string, ipAddress?: string, userAgent?: string) {
  const connection = await getPool().getConnection(); let failed = true;
  try {
    await connection.beginTransaction();
    const order = (await connection.query<any[]>("SELECT id FROM service_orders WHERE id = ? FOR UPDATE", [orderId]))[0]; if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "La orden no existe.");
    await connection.query("INSERT INTO order_parts_logistics (order_id, freight_requested, freight_amount, freight_payment, expansion_required, owner, notes) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE freight_requested = VALUES(freight_requested), freight_amount = VALUES(freight_amount), freight_payment = VALUES(freight_payment), expansion_required = VALUES(expansion_required), owner = VALUES(owner), notes = VALUES(notes)", [orderId, input.freightRequested ? 1 : 0, input.freightAmount ?? null, input.freightPayment, input.expansionRequired ? 1 : 0, input.owner || null, input.notes || null]);
    await connection.query("INSERT INTO audit_events (actor_user_id, entity, record_id, action, new_data, request_id, ip_address, user_agent) VALUES (?, 'service_order', ?, 'PARTS_LOGISTICS_UPDATED', JSON_OBJECT('freightRequested', ?, 'expansionRequired', ?), ?, ?, ?)", [actorUserId, String(orderId), input.freightRequested, input.expansionRequired, requestId, ipAddress ?? null, userAgent ?? null]);
    await connection.commit(); failed = false; return getPartsLogistics(orderId);
  } finally { if (failed) await connection.rollback(); connection.release(); }
}

export async function startRepair(orderId: number, actorUserId: number, requestId: string, ipAddress?: string, userAgent?: string) {
  const connection = await getPool().getConnection(); let failed = true;
  try {
    await connection.beginTransaction();
    const quotes = await connection.query<any[]>("SELECT id FROM quote_versions WHERE order_id = ? AND status = 'APROBADA' FOR UPDATE", [orderId]);
    if (!quotes[0]) throw new AppError(409, "QUOTE_NOT_APPROVED", "Requiere una cotización aprobada.");
    const pending = await connection.query<any[]>("SELECT id FROM order_parts WHERE order_id = ? AND received_quantity < quantity FOR UPDATE", [orderId]);
    if (pending.length) throw new AppError(409, "PARTS_PENDING", "Aún existen repuestos por recibir.");
    await connection.query("UPDATE service_orders SET internal_status = 'EN_REPARACION', public_status = 'EN_REPARACION' WHERE id = ?", [orderId]);
    await connection.query("INSERT INTO audit_events (actor_user_id, entity, record_id, action, request_id, ip_address, user_agent) VALUES (?, 'service_order', ?, 'REPAIR_STARTED', ?, ?, ?)", [actorUserId, String(orderId), requestId, ipAddress ?? null, userAgent ?? null]);
    await connection.commit(); failed = false;
  } finally { if (failed) await connection.rollback(); connection.release(); }
}

