import { snapshotIdentityColumn } from "./reception-snapshot.js";
import { getPool } from "../../db/pool.js";
export interface OrdersNavigationRepository { pendingClaims(): Promise<{ pendingClaims: number }[]>; pendingNotifications(): Promise<[any[], any[]]>; }
export const mariaDbOrdersNavigationRepository: OrdersNavigationRepository = {
  pendingClaims: () => getPool().query<{ pendingClaims: number }[]>("SELECT COUNT(*) AS pendingClaims FROM service_orders WHERE claim_pending_reminder = 1 AND internal_status NOT IN ('ENTREGADA', 'CANCELADA')"),
  pendingNotifications: () => {
    const columns = `COUNT(*) OVER() AS groupTotal, o.id, o.order_number AS orderNumber, o.created_at AS createdAt, ${snapshotIdentityColumn("client", "c.full_name")} AS client, ${snapshotIdentityColumn("plate", "v.plate")} AS plate, ${snapshotIdentityColumn("brand", "v.brand")} AS brand, ${snapshotIdentityColumn("model", "v.model")} AS model`;
    const joins = "FROM service_orders o JOIN client_vehicles cv ON cv.id = o.client_vehicle_id JOIN clients c ON c.id = cv.client_id JOIN vehicles v ON v.id = cv.vehicle_id LEFT JOIN reception_snapshots rs ON rs.order_id = o.id";
    return Promise.all([
      getPool().query<any[]>(`SELECT ${columns} ${joins} WHERE o.diagnosis_pending_reminder = 1 AND o.internal_status NOT IN ('ENTREGADA', 'CANCELADA') ORDER BY o.created_at ASC, o.id ASC LIMIT 8`),
      getPool().query<any[]>(`SELECT ${columns} ${joins} WHERE o.diagnosis_pending_reminder = 0 AND o.internal_status = 'COTIZACION_PENDIENTE' AND NOT EXISTS (SELECT 1 FROM quote_versions q WHERE q.order_id = o.id) ORDER BY o.created_at ASC, o.id ASC LIMIT 8`),
    ]);
  },
};
