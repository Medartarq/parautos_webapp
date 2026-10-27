import { getPool } from "../../db/pool.js";

export interface QuoteQueryRepository { listVersions(orderId: number): Promise<any[]>; listLines(quoteVersionId: number): Promise<any[]>; }
export const mariaDbQuoteQueryRepository: QuoteQueryRepository = {
  listVersions: (orderId) => getPool().query<any[]>("SELECT id, version_number AS versionNumber, status, currency, no_parts AS noParts, adjustment_reason AS adjustmentReason, created_at AS createdAt, sent_at AS sentAt, approved_at AS approvedAt FROM quote_versions WHERE order_id = ? ORDER BY version_number DESC", [orderId]),
  listLines: (quoteVersionId) => getPool().query<any[]>("SELECT line_type AS type, labor_category AS category, description, quantity, unit_price AS unitPrice FROM quote_lines WHERE quote_version_id = ? ORDER BY id", [quoteVersionId]),
};
