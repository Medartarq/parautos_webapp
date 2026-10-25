import { snapshotIdentityColumn } from "./reception-snapshot.js";
import { getPool } from "../../db/pool.js";

export interface OrdersListRepository { listBodyTypes(): Promise<{ id: number; code: string; name: string }[]>; listChecklist(): Promise<{ id: number; category: string; name: string }[]>; listOrders(): Promise<any[]>; }
export const mariaDbOrdersListRepository: OrdersListRepository = {
  listBodyTypes: () => getPool().query<{ id: number; code: string; name: string }[]>("SELECT id, code, name FROM body_types WHERE active = 1 ORDER BY code"),
  listChecklist: () => getPool().query<{ id: number; category: string; name: string }[]>(`SELECT i.id, c.name AS category, i.name FROM checklist_items i JOIN checklist_categories c ON c.id = i.category_id WHERE i.active = 1 AND c.active = 1 ORDER BY c.display_order, i.display_order`),
  listOrders: () => getPool().query(`SELECT o.id, o.order_number AS orderNumber, o.internal_status AS status, o.modality, o.claim_pending_reminder AS claimPending, o.created_at AS createdAt, ${snapshotIdentityColumn("client", "c.full_name")} AS client, ${snapshotIdentityColumn("plate", "v.plate")} AS plate, ${snapshotIdentityColumn("brand", "v.brand")} AS brand, ${snapshotIdentityColumn("model", "v.model")} AS model, ${snapshotIdentityColumn("color", "v.color")} AS color FROM service_orders o JOIN client_vehicles cv ON cv.id = o.client_vehicle_id JOIN clients c ON c.id = cv.client_id JOIN vehicles v ON v.id = cv.vehicle_id  LEFT JOIN reception_snapshots rs ON rs.order_id = o.id ORDER BY o.created_at DESC`),
};
