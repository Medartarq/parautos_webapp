import type { PoolConnection } from "mariadb";

/** Fixed, code-owned field names; no request input is interpolated in SQL. */
export type SnapshotIdentityField = "client" | "documentType" | "documentNumber" | "phone" | "email" | "plate" | "brand" | "model" | "year" | "vin" | "color" | "colorType" | "bodyCode" | "bodyName" | "advisorName";

export function snapshotIdentityColumn(field: SnapshotIdentityField, fallback: string): string {
  // A captured null must stay null, even if the master record changes later.
  return `CASE WHEN rs.reception_id IS NULL THEN ${fallback} ELSE NULLIF(JSON_UNQUOTE(JSON_EXTRACT(rs.payload, '$.${field}')), 'null') END`;
}

export async function captureReceptionSnapshot(connection: PoolConnection, receptionId: number, orderId: number): Promise<void> {
  await connection.query(`INSERT INTO reception_snapshots (reception_id, order_id, source, payload)
    SELECT r.id, o.id, 'RECEPTION', JSON_OBJECT(
      'client', c.full_name, 'documentType', c.document_type, 'documentNumber', c.document_number,
      'phone', c.phone, 'email', c.email, 'plate', v.plate, 'brand', v.brand, 'model', v.model,
      'year', v.manufacture_year, 'vin', v.vin, 'color', v.color, 'colorType', v.color_type,
      'bodyCode', bt.code, 'bodyName', bt.name, 'modality', o.modality, 'claimNumber', o.claim_number,
      'advisorName', u.names, 'receivedAt', DATE_FORMAT(r.created_at, '%Y-%m-%dT%H:%i:%s.%fZ')
    ) FROM receptions r JOIN service_orders o ON o.id = r.order_id
    JOIN client_vehicles cv ON cv.id = o.client_vehicle_id
    JOIN clients c ON c.id = cv.client_id JOIN vehicles v ON v.id = cv.vehicle_id
    JOIN body_types bt ON bt.id = v.body_type_id LEFT JOIN users u ON u.id = r.advisor_user_id
    WHERE r.id = ? AND o.id = ?`, [receptionId, orderId]);
}
