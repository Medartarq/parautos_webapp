import { getPool } from "../../db/pool.js";
import { AppError } from "../../errors/app-error.js";

type QuoteLineInput = { type: "MANO_OBRA" | "REPUESTO"; category?: "PLANCHADO" | "PINTURA" | "MECANICA"; description: string; quantity: number; unitPrice: number };

export async function listQuotes(orderId: number) {
  const pool = getPool();
  const versions = await pool.query<any[]>("SELECT id, version_number AS versionNumber, status, currency, no_parts AS noParts, adjustment_reason AS adjustmentReason, created_at AS createdAt, sent_at AS sentAt, approved_at AS approvedAt FROM quote_versions WHERE order_id = ? ORDER BY version_number DESC", [orderId]);
  return Promise.all(versions.map(async (version) => {
    const rows = await pool.query<any[]>("SELECT line_type AS type, labor_category AS category, description, quantity, unit_price AS unitPrice FROM quote_lines WHERE quote_version_id = ? ORDER BY id", [version.id]);
    // MariaDB entrega DECIMAL como texto. El contrato HTTP de cotizaciones usa
    // números para que un borrador recargado pueda volver a validarse y guardarse.
    const lines = rows.map((line) => ({ ...line, quantity: Number(line.quantity), unitPrice: Number(line.unitPrice) }));
    const total = lines.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unitPrice), 0);
    return { ...version, noParts: Boolean(version.noParts), lines, totalWithoutIgv: total, igv: 0 };
  }));
}

export async function getQuoteDraft(orderId: number) {
  const pool = getPool();
  const draft = (await pool.query<any[]>("SELECT id, currency, no_parts AS noParts, updated_at AS updatedAt FROM quote_drafts WHERE order_id = ?", [orderId]))[0];
  if (!draft) return undefined;
  const rows = await pool.query<any[]>("SELECT line_type AS type, labor_category AS category, description, quantity, unit_price AS unitPrice FROM quote_draft_lines WHERE quote_draft_id = ? ORDER BY id", [draft.id]);
  return { ...draft, noParts: Boolean(draft.noParts), lines: rows.map((line) => ({ ...line, quantity: Number(line.quantity), unitPrice: Number(line.unitPrice) })) };
}

export async function saveQuoteDraft(orderId: number, input: { currency: "PEN" | "USD"; noParts: boolean; lines: QuoteLineInput[] }, actorUserId: number, requestId: string, ipAddress?: string, userAgent?: string) {
  const connection = await getPool().getConnection(); let failed = true;
  try {
    await connection.beginTransaction();
    const order = (await connection.query<any[]>("SELECT id FROM service_orders WHERE id = ? FOR UPDATE", [orderId]))[0];
    if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "La orden no existe.");
    let draft = (await connection.query<any[]>("SELECT id FROM quote_drafts WHERE order_id = ? FOR UPDATE", [orderId]))[0];
    if (!draft) { const result = await connection.query<any>("INSERT INTO quote_drafts (order_id, currency, no_parts, updated_by_user_id) VALUES (?, ?, ?, ?)", [orderId, input.currency, input.noParts ? 1 : 0, actorUserId]); draft = { id: Number(result.insertId) }; }
    else await connection.query("UPDATE quote_drafts SET currency = ?, no_parts = ?, updated_by_user_id = ? WHERE id = ?", [input.currency, input.noParts ? 1 : 0, actorUserId, draft.id]);
    await connection.query("DELETE FROM quote_draft_lines WHERE quote_draft_id = ?", [draft.id]);
    for (const line of input.lines) await connection.query("INSERT INTO quote_draft_lines (quote_draft_id, line_type, labor_category, description, quantity, unit_price) VALUES (?, ?, ?, ?, ?, ?)", [draft.id, line.type, line.category || null, line.description, line.quantity, line.unitPrice]);
    await connection.query("INSERT INTO audit_events (actor_user_id, entity, record_id, action, new_data, request_id, ip_address, user_agent) VALUES (?, 'service_order', ?, 'QUOTE_DRAFT_SAVED', JSON_OBJECT('lineCount', ?, 'currency', ?), ?, ?, ?)", [actorUserId, String(orderId), input.lines.length, input.currency, requestId, ipAddress ?? null, userAgent ?? null]);
    await connection.commit(); failed = false;
    return getQuoteDraft(orderId);
  } finally { if (failed) await connection.rollback(); connection.release(); }
}

export async function createQuoteVersionFromDraft(orderId: number, adjustmentReason: string | undefined, actorUserId: number, requestId: string, ipAddress?: string, userAgent?: string) {
  const draft = await getQuoteDraft(orderId);
  if (!draft || !draft.lines.length) throw new AppError(409, "QUOTE_DRAFT_REQUIRED", "Guarde un borrador con al menos una partida antes de crear una versión.");
  return createQuote(orderId, { currency: draft.currency, noParts: draft.noParts, adjustmentReason, lines: draft.lines }, actorUserId, requestId, ipAddress, userAgent);
}

export async function createQuote(orderId: number, input: { currency: "PEN" | "USD"; noParts: boolean; adjustmentReason?: string; lines: QuoteLineInput[] }, actorUserId: number, requestId: string, ipAddress?: string, userAgent?: string) {
  const connection = await getPool().getConnection();
  let failed = true;
  try {
    await connection.beginTransaction();
    const orders = await connection.query<any[]>("SELECT id FROM service_orders WHERE id = ? FOR UPDATE", [orderId]);
    if (!orders[0]) throw new AppError(404, "ORDER_NOT_FOUND", "La orden no existe.");
    const current = await connection.query<any[]>("SELECT id, status, version_number AS versionNumber FROM quote_versions WHERE order_id = ? ORDER BY version_number DESC LIMIT 1 FOR UPDATE", [orderId]);
    const previous = current[0];
    const versionNumber = Number(previous?.versionNumber || 0) + 1;
    if (versionNumber > 1 && !input.adjustmentReason) throw new AppError(400, "ADJUSTMENT_REASON_REQUIRED", "Indique el motivo del ajuste.");
    if (previous?.status === "APROBADA") throw new AppError(409, "QUOTE_ALREADY_APPROVED", "No se puede ajustar una cotización aprobada.");
    if (previous) await connection.query("UPDATE quote_versions SET status = 'REEMPLAZADA' WHERE id = ?", [previous.id]);
    const result = await connection.query<any>("INSERT INTO quote_versions (order_id, version_number, currency, no_parts, adjustment_reason, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?)", [orderId, versionNumber, input.currency, input.noParts ? 1 : 0, input.adjustmentReason || null, actorUserId]);
    const quoteId = Number(result.insertId);
    for (const line of input.lines) await connection.query("INSERT INTO quote_lines (quote_version_id, line_type, labor_category, description, quantity, unit_price) VALUES (?, ?, ?, ?, ?, ?)", [quoteId, line.type, line.category || null, line.description, line.quantity, line.unitPrice]);
    const total = input.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
    await connection.query("INSERT INTO audit_events (actor_user_id, entity, record_id, action, new_data, request_id, ip_address, user_agent) VALUES (?, 'service_order', ?, 'QUOTE_CREATED', JSON_OBJECT('quoteVersion', ?, 'currency', ?, 'totalWithoutIgv', ?), ?, ?, ?)", [actorUserId, String(orderId), versionNumber, input.currency, total, requestId, ipAddress ?? null, userAgent ?? null]);
    await connection.commit(); failed = false;
    return { id: quoteId, versionNumber, totalWithoutIgv: total, igv: 0 };
  } finally { if (failed) await connection.rollback(); connection.release(); }
}

export async function updateQuote(orderId: number, quoteId: number, input: { currency: "PEN" | "USD"; noParts: boolean; lines: QuoteLineInput[] }, actorUserId: number, requestId: string, ipAddress?: string, userAgent?: string) {
  const connection = await getPool().getConnection(); let failed = true;
  try {
    await connection.beginTransaction();
    const quotes = await connection.query<any[]>("SELECT id, version_number AS versionNumber, status FROM quote_versions WHERE id = ? AND order_id = ? FOR UPDATE", [quoteId, orderId]);
    const quote = quotes[0];
    if (!quote) throw new AppError(404, "QUOTE_NOT_FOUND", "La cotización no existe.");
    if (quote.status !== "PENDIENTE") throw new AppError(409, "QUOTE_NOT_EDITABLE", "Solo puede editar una cotización pendiente.");
    await connection.query("UPDATE quote_versions SET currency = ?, no_parts = ? WHERE id = ?", [input.currency, input.noParts ? 1 : 0, quoteId]);
    await connection.query("DELETE FROM quote_lines WHERE quote_version_id = ?", [quoteId]);
    for (const line of input.lines) await connection.query("INSERT INTO quote_lines (quote_version_id, line_type, labor_category, description, quantity, unit_price) VALUES (?, ?, ?, ?, ?, ?)", [quoteId, line.type, line.category || null, line.description, line.quantity, line.unitPrice]);
    const total = input.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
    await connection.query("INSERT INTO audit_events (actor_user_id, entity, record_id, action, new_data, request_id, ip_address, user_agent) VALUES (?, 'service_order', ?, 'QUOTE_UPDATED', JSON_OBJECT('quoteId', ?, 'quoteVersion', ?, 'totalWithoutIgv', ?), ?, ?, ?)", [actorUserId, String(orderId), quoteId, quote.versionNumber, total, requestId, ipAddress ?? null, userAgent ?? null]);
    await connection.commit(); failed = false;
    return { id: quoteId, versionNumber: quote.versionNumber, totalWithoutIgv: total, igv: 0 };
  } finally { if (failed) await connection.rollback(); connection.release(); }
}

export async function deleteQuote(orderId: number, quoteId: number, actorUserId: number, requestId: string, ipAddress?: string, userAgent?: string) {
  const connection = await getPool().getConnection(); let failed = true;
  try {
    await connection.beginTransaction();
    const quotes = await connection.query<any[]>("SELECT id, version_number AS versionNumber, status, currency FROM quote_versions WHERE id = ? AND order_id = ? FOR UPDATE", [quoteId, orderId]);
    const quote = quotes[0];
    if (!quote) throw new AppError(404, "QUOTE_NOT_FOUND", "La cotización no existe.");
    if (quote.status !== "PENDIENTE") throw new AppError(409, "QUOTE_CANNOT_BE_DELETED", "Solo puede eliminar una cotización pendiente.");
    const lines = await connection.query<any[]>("SELECT id, line_type AS type, labor_category AS category, description, quantity, unit_price AS unitPrice FROM quote_lines WHERE quote_version_id = ?", [quoteId]);
    const previous = await connection.query<any[]>("SELECT id, sent_at AS sentAt FROM quote_versions WHERE order_id = ? AND version_number < ? ORDER BY version_number DESC LIMIT 1 FOR UPDATE", [orderId, quote.versionNumber]);
    await connection.query("DELETE FROM quote_lines WHERE quote_version_id = ?", [quoteId]);
    await connection.query("DELETE FROM quote_versions WHERE id = ?", [quoteId]);
    if (previous[0]) {
      const restoredStatus = previous[0].sentAt ? "ENVIADA" : "PENDIENTE";
      const restoredOrderStatus = previous[0].sentAt ? "ESPERA_APROBACION" : "COTIZACION_PENDIENTE";
      await connection.query("UPDATE quote_versions SET status = ? WHERE id = ?", [restoredStatus, previous[0].id]);
      await connection.query("UPDATE service_orders SET internal_status = ?, public_status = ? WHERE id = ?", [restoredOrderStatus, restoredOrderStatus, orderId]);
    } else await connection.query("UPDATE service_orders SET internal_status = 'COTIZACION_PENDIENTE', public_status = 'COTIZACION_PENDIENTE' WHERE id = ?", [orderId]);
    await connection.query("INSERT INTO audit_events (actor_user_id, entity, record_id, action, previous_data, request_id, ip_address, user_agent) VALUES (?, 'service_order', ?, 'QUOTE_DELETED', JSON_OBJECT('quoteId', ?, 'quoteVersion', ?, 'currency', ?, 'lines', ?), ?, ?, ?)", [actorUserId, String(orderId), quoteId, quote.versionNumber, quote.currency, JSON.stringify(lines), requestId, ipAddress ?? null, userAgent ?? null]);
    await connection.commit(); failed = false;
  } finally { if (failed) await connection.rollback(); connection.release(); }
}

export async function transitionQuote(orderId: number, quoteId: number, action: "SEND" | "APPROVE", actorUserId: number, requestId: string, ipAddress?: string, userAgent?: string) {
  const connection = await getPool().getConnection(); let failed = true;
  try {
    await connection.beginTransaction();
    const quotes = await connection.query<any[]>("SELECT id, status, currency, no_parts AS noParts, version_number AS versionNumber FROM quote_versions WHERE id = ? AND order_id = ? FOR UPDATE", [quoteId, orderId]);
    const quote = quotes[0];
    if (!quote) throw new AppError(404, "QUOTE_NOT_FOUND", "La cotización no existe.");
    if ((action === "SEND" && quote.status !== "PENDIENTE") || (action === "APPROVE" && quote.status !== "ENVIADA")) throw new AppError(409, "INVALID_QUOTE_TRANSITION", "La cotización no está en el estado requerido.");
    const lines = await connection.query<any[]>("SELECT id, line_type AS type, labor_category AS category, description, quantity, unit_price AS unitPrice FROM quote_lines WHERE quote_version_id = ?", [quoteId]);
    if (!lines.length) throw new AppError(400, "QUOTE_EMPTY", "La cotización debe tener al menos una línea.");
    const totalWithoutIgv = lines.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unitPrice), 0);
    const snapshot = JSON.stringify({ versionNumber: quote.versionNumber, currency: quote.currency, noParts: Boolean(quote.noParts), lines, totalWithoutIgv, igv: 0 });
    const hasParts = lines.some((line) => line.type === "REPUESTO");
    const nextStatus = action === "SEND" ? "ESPERA_APROBACION" : hasParts ? "ESPERA_REPUESTOS" : "EN_REPARACION";
    await connection.query(action === "SEND" ? "UPDATE quote_versions SET status = 'ENVIADA', sent_at = CURRENT_TIMESTAMP(6), sent_snapshot = ? WHERE id = ?" : "UPDATE quote_versions SET status = 'APROBADA', approved_at = CURRENT_TIMESTAMP(6), approved_snapshot = ? WHERE id = ?", [snapshot, quoteId]);
    if (action === "APPROVE") {
      for (const line of lines.filter((line) => line.type === "REPUESTO"))
        await connection.query("INSERT INTO order_parts (order_id, quote_line_id, description, quantity) VALUES (?, ?, ?, ?)", [orderId, line.id, line.description, line.quantity]);
    }
    await connection.query("UPDATE service_orders SET internal_status = ?, public_status = ? WHERE id = ?", [nextStatus, nextStatus, orderId]);
    const event = action === "SEND" ? "QUOTE_SENT" : "QUOTE_APPROVED";
    await connection.query("INSERT INTO audit_events (actor_user_id, entity, record_id, action, new_data, request_id, ip_address, user_agent) VALUES (?, 'service_order', ?, ?, JSON_OBJECT('quoteId', ?, 'nextStatus', ?), ?, ?, ?)", [actorUserId, String(orderId), event, quoteId, nextStatus, requestId, ipAddress ?? null, userAgent ?? null]);
    await connection.commit(); failed = false; return { status: nextStatus, totalWithoutIgv };
  } finally { if (failed) await connection.rollback(); connection.release(); }
}

