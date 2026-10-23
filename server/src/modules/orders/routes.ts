import { Router } from "express";
import { createOrderSchema, operationalDataSchema } from "@parautos/shared";
import { requireAuthentication, requireRoles } from "../../middleware/auth.js";
import { AppError } from "../../errors/app-error.js";
import { z } from "zod";
import {
  createOrder,
  getNavigationSummary,
  getOrderDetail,
  completePendingClaim,
  correctOperationalData,
  createQuote,
  createQuoteVersionFromDraft,
  deleteQuote,
  deleteReceptionDraft,
  getQuoteDraft,
  updateQuote,
  saveQuoteDraft,
  listQuotes,
  transitionQuote,
  getReceptionCatalog,
  getReceptionDraft,
  listOrders,
  getOperationalPendingNotifications,
  listParts,
  listPartProviders,
  getPartsLogistics,
  startRepair,
  saveReceptionDraft,
  updatePart,
  updatePartsLogistics,
  getFinalControl,
  setLaborVerification,
  setAllLaborVerifications,
  completeFinalControl,
  reopenFinalControl,
  publishReadyForPickup,
  deliverOrder,
} from "./service.js";

export const ordersRouter = Router();
ordersRouter.use(requireAuthentication, requireRoles("SUPERADMINISTRADOR", "ADMINISTRADOR", "ASESOR"));
ordersRouter.get("/reception-catalog", async (_request, response) =>
  response.json(await getReceptionCatalog()),
);
ordersRouter.get("/navigation-summary", async (_request, response) =>
  response.json(await getNavigationSummary()),
);
ordersRouter.get("/pending-notifications", async (_request, response) =>
  response.json(await getOperationalPendingNotifications()),
);
const receptionDraftSchema = z.object({ revision: z.number().int().positive().optional(), currentStep: z.number().int().min(0).max(6), payload: z.record(z.string(), z.unknown()) });
ordersRouter.get("/reception-draft", async (request, response) => response.json({ draft: await getReceptionDraft(request.currentUser!.id) }));
ordersRouter.put("/reception-draft", async (request, response) => response.json({ draft: await saveReceptionDraft(request.currentUser!.id, receptionDraftSchema.parse(request.body)) }));
ordersRouter.delete("/reception-draft", async (request, response) => { await deleteReceptionDraft(request.currentUser!.id); response.status(204).end(); });
ordersRouter.get("/", async (_request, response) =>
  response.json({ orders: await listOrders() }),
);
ordersRouter.get("/:orderId", async (request, response) => {
  const orderId = Number(request.params.orderId);
  if (!Number.isSafeInteger(orderId) || orderId < 1)
    throw new AppError(400, "INVALID_ORDER", "La orden no es válida.");
  const order = await getOrderDetail(orderId);
  if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "La orden no existe.");
  response.json({ order });
});
ordersRouter.patch("/:orderId/claim", async (request, response) => {
  const orderId = Number(request.params.orderId);
  if (!Number.isSafeInteger(orderId) || orderId < 1)
    throw new AppError(400, "INVALID_ORDER", "La orden no es válida.");
  const claimNumber = z.string().trim().min(1).max(60).parse(request.body.claimNumber);
  await completePendingClaim(orderId, claimNumber, request.currentUser!.id, request.requestId, request.ip, request.get("user-agent"));
  response.status(204).end();
});
ordersRouter.patch("/:orderId/operational-data", async (request, response) => {
  const orderId = Number(request.params.orderId);
  if (!Number.isSafeInteger(orderId) || orderId < 1)
    throw new AppError(400, "INVALID_ORDER", "La orden no es válida.");
  await correctOperationalData(orderId, operationalDataSchema.parse(request.body), request.currentUser!.id, request.requestId, request.ip, request.get("user-agent"));
  response.status(204).end();
});
const quoteLineSchema = z.object({ type: z.enum(["MANO_OBRA", "REPUESTO"]), category: z.enum(["PLANCHADO", "PINTURA", "MECANICA"]).optional(), description: z.string().trim().min(1).max(500), quantity: z.number().positive(), unitPrice: z.number().min(0) }).superRefine((line, context) => { if ((line.type === "MANO_OBRA") !== Boolean(line.category)) context.addIssue({ code: z.ZodIssueCode.custom, message: "La categoría solo corresponde a mano de obra." }); });
const quoteSchema = z.object({ currency: z.enum(["PEN", "USD"]), noParts: z.boolean(), adjustmentReason: z.string().trim().max(500).optional(), lines: z.array(quoteLineSchema).min(1) }).superRefine((quote, context) => { if (quote.noParts && quote.lines.some((line) => line.type === "REPUESTO")) context.addIssue({ code: z.ZodIssueCode.custom, message: "No puede incluir repuestos si marcó sin repuestos." }); });
const quoteDraftSchema = z.object({ currency: z.enum(["PEN", "USD"]), noParts: z.boolean(), lines: z.array(quoteLineSchema).min(1) }).superRefine((quote, context) => { if (quote.noParts && quote.lines.some((line) => line.type === "REPUESTO")) context.addIssue({ code: z.ZodIssueCode.custom, message: "No puede incluir repuestos si marcó sin repuestos." }); });
ordersRouter.get("/:orderId/quote-draft", async (request, response) => {
  const orderId = Number(request.params.orderId); if (!Number.isSafeInteger(orderId) || orderId < 1) throw new AppError(400, "INVALID_ORDER", "La orden no es válida.");
  response.json({ draft: await getQuoteDraft(orderId) });
});
ordersRouter.put("/:orderId/quote-draft", async (request, response) => {
  const orderId = Number(request.params.orderId); if (!Number.isSafeInteger(orderId) || orderId < 1) throw new AppError(400, "INVALID_ORDER", "La orden no es válida.");
  const draft = quoteDraftSchema.parse(request.body);
  response.json({ draft: await saveQuoteDraft(orderId, draft, request.currentUser!.id, request.requestId, request.ip, request.get("user-agent")) });
});
ordersRouter.post("/:orderId/quotes/from-draft", async (request, response) => {
  const orderId = Number(request.params.orderId); if (!Number.isSafeInteger(orderId) || orderId < 1) throw new AppError(400, "INVALID_ORDER", "La orden no es válida.");
  const adjustmentReason = z.object({ adjustmentReason: z.string().trim().max(500).optional() }).parse(request.body).adjustmentReason;
  response.status(201).json({ quote: await createQuoteVersionFromDraft(orderId, adjustmentReason, request.currentUser!.id, request.requestId, request.ip, request.get("user-agent")) });
});
ordersRouter.get("/:orderId/quotes", async (request, response) => {
  const orderId = Number(request.params.orderId);
  if (!Number.isSafeInteger(orderId) || orderId < 1) throw new AppError(400, "INVALID_ORDER", "La orden no es válida.");
  response.json({ quotes: await listQuotes(orderId) });
});
ordersRouter.post("/:orderId/quotes", async (request, response) => {
  const orderId = Number(request.params.orderId);
  if (!Number.isSafeInteger(orderId) || orderId < 1) throw new AppError(400, "INVALID_ORDER", "La orden no es válida.");
  const quote = quoteSchema.parse(request.body);
  response.status(201).json({ quote: await createQuote(orderId, quote, request.currentUser!.id, request.requestId, request.ip, request.get("user-agent")) });
});
ordersRouter.put("/:orderId/quotes/:quoteId", async (request, response) => {
  const orderId = Number(request.params.orderId); const quoteId = Number(request.params.quoteId);
  if (!Number.isSafeInteger(orderId) || !Number.isSafeInteger(quoteId) || orderId < 1 || quoteId < 1) throw new AppError(400, "INVALID_QUOTE", "La cotización no es válida.");
  const quote = quoteSchema.parse(request.body);
  response.json({ quote: await updateQuote(orderId, quoteId, { currency: quote.currency, noParts: quote.noParts, lines: quote.lines }, request.currentUser!.id, request.requestId, request.ip, request.get("user-agent")) });
});
ordersRouter.delete("/:orderId/quotes/:quoteId", async (request, response) => {
  const orderId = Number(request.params.orderId); const quoteId = Number(request.params.quoteId);
  if (!Number.isSafeInteger(orderId) || !Number.isSafeInteger(quoteId) || orderId < 1 || quoteId < 1) throw new AppError(400, "INVALID_QUOTE", "La cotización no es válida.");
  await deleteQuote(orderId, quoteId, request.currentUser!.id, request.requestId, request.ip, request.get("user-agent"));
  response.status(204).end();
});
async function quoteTransition(request: import("express").Request, response: import("express").Response, action: "SEND" | "APPROVE") {
  const orderId = Number(request.params.orderId); const quoteId = Number(request.params.quoteId);
  if (!Number.isSafeInteger(orderId) || !Number.isSafeInteger(quoteId) || orderId < 1 || quoteId < 1) throw new AppError(400, "INVALID_QUOTE", "La cotización no es válida.");
  response.json({ quote: await transitionQuote(orderId, quoteId, action, request.currentUser!.id, request.requestId, request.ip, request.get("user-agent")) });
}
ordersRouter.post("/:orderId/quotes/:quoteId/send", (request, response) => quoteTransition(request, response, "SEND"));
ordersRouter.post("/:orderId/quotes/:quoteId/approve", (request, response) => quoteTransition(request, response, "APPROVE"));
const partUpdateSchema = z.object({ receivedQuantity: z.number().min(0), partialReceived: z.boolean().optional(), managementStatus: z.enum(["POR_GESTIONAR", "PEDIDO", "EN_TALLER"]), quality: z.enum(["ORIGINAL", "ALTERNATIVO"]), partCode: z.string().trim().max(120).optional(), expectedDate: z.string().date().optional().or(z.literal("")), providerId: z.number().int().positive().optional().nullable(), notes: z.string().trim().max(4000).optional() });
ordersRouter.get("/parts/workbench", async (request, response) => response.json({ parts: await listParts(), providers: await listPartProviders(typeof request.query.brand === "string" ? request.query.brand : undefined, typeof request.query.quality === "string" ? request.query.quality : undefined) }));
ordersRouter.get("/:orderId/parts", async (request, response) => {
  const orderId = Number(request.params.orderId); if (!Number.isSafeInteger(orderId) || orderId < 1) throw new AppError(400, "INVALID_ORDER", "La orden no es válida.");
  response.json({ parts: await listParts(orderId), logistics: await getPartsLogistics(orderId) });
});
ordersRouter.patch("/parts/:partId", async (request, response) => {
  const partId = Number(request.params.partId); if (!Number.isSafeInteger(partId) || partId < 1) throw new AppError(400, "INVALID_PART", "El repuesto no es válido.");
  response.json({ part: await updatePart(partId, partUpdateSchema.parse(request.body), request.currentUser!.id, request.requestId, request.ip, request.get("user-agent")) });
});
const logisticsSchema = z.object({ freightRequested: z.boolean(), freightAmount: z.number().min(0).optional().nullable(), freightPayment: z.enum(["PENDIENTE", "PARCIAL", "PAGADO"]), expansionRequired: z.boolean(), owner: z.string().trim().max(180).optional(), notes: z.string().trim().max(4000).optional() });
ordersRouter.put("/:orderId/parts/logistics", async (request, response) => {
  const orderId = Number(request.params.orderId); if (!Number.isSafeInteger(orderId) || orderId < 1) throw new AppError(400, "INVALID_ORDER", "La orden no es válida.");
  response.json({ logistics: await updatePartsLogistics(orderId, logisticsSchema.parse(request.body), request.currentUser!.id, request.requestId, request.ip, request.get("user-agent")) });
});
ordersRouter.post("/:orderId/start-repair", async (request, response) => {
  const orderId = Number(request.params.orderId); if (!Number.isSafeInteger(orderId) || orderId < 1) throw new AppError(400, "INVALID_ORDER", "La orden no es válida.");
  await startRepair(orderId, request.currentUser!.id, request.requestId, request.ip, request.get("user-agent")); response.status(204).end();
});
const finalControlContext = (request: import("express").Request) => ({ actorUserId: request.currentUser!.id, requestId: request.requestId, ipAddress: request.ip, userAgent: request.get("user-agent") });
const finalControlOrderId = (request: import("express").Request) => { const orderId = Number(request.params.orderId); if (!Number.isSafeInteger(orderId) || orderId < 1) throw new AppError(400, "INVALID_ORDER", "La orden no es válida."); return orderId; };
ordersRouter.get("/:orderId/final-control", async (request, response) => response.json({ control: await getFinalControl(finalControlOrderId(request)) }));
ordersRouter.put("/:orderId/final-control/labor/:quoteLineId", async (request, response) => { const quoteLineId = Number(request.params.quoteLineId); if (!Number.isSafeInteger(quoteLineId) || quoteLineId < 1) throw new AppError(400, "INVALID_LABOR_LINE", "La partida no es válida."); await setLaborVerification(finalControlOrderId(request), quoteLineId, z.object({ verified: z.boolean() }).parse(request.body).verified, finalControlContext(request)); response.status(204).end(); });
ordersRouter.put("/:orderId/final-control/labor", async (request, response) => { await setAllLaborVerifications(finalControlOrderId(request), z.object({ verified: z.boolean() }).parse(request.body).verified, finalControlContext(request)); response.status(204).end(); });
ordersRouter.post("/:orderId/final-control/complete", async (request, response) => { await completeFinalControl(finalControlOrderId(request), finalControlContext(request)); response.status(204).end(); });
ordersRouter.post("/:orderId/final-control/reopen", async (request, response) => { await reopenFinalControl(finalControlOrderId(request), z.object({ reason: z.string().trim().min(1).max(1000) }).parse(request.body).reason, finalControlContext(request)); response.status(204).end(); });
ordersRouter.post("/:orderId/final-control/publish", async (request, response) => { await publishReadyForPickup(finalControlOrderId(request), z.object({ channel: z.string().trim().max(80).optional(), note: z.string().trim().max(1000).optional() }).parse(request.body), finalControlContext(request)); response.status(204).end(); });
ordersRouter.post("/:orderId/final-control/deliver", async (request, response) => { z.object({ conformityAcknowledged: z.literal(true) }).parse(request.body); await deliverOrder(finalControlOrderId(request), finalControlContext(request)); response.status(204).end(); });
ordersRouter.post("/", async (request, response) => {
  const input = createOrderSchema.parse(request.body);
  const order = await createOrder(
    input,
    request.currentUser!.id,
    request.requestId,
    request.ip,
    request.get("user-agent"),
  );
  response.status(201).json({ order });
});
