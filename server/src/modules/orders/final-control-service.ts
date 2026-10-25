import { AppError } from "../../errors/app-error.js";
import { mariaDbAuditWriter } from "../audit/audit-writer.js";
import { mariaDbFinalControlQueryRepository, type FinalControlQueryRepository } from "./final-control-query-repository.js";
import { mariaDbLaborVerificationRepository, type LaborVerificationRepository } from "./labor-verification-repository.js";
import { mariaDbFinalControlCompletionRepository, type FinalControlCompletionRepository } from "./final-control-completion-repository.js";
import { mariaDbFinalControlReopenRepository, type FinalControlReopenRepository } from "./final-control-reopen-repository.js";
import { mariaDbFinalControlDeliveryRepository, type FinalControlDeliveryRepository } from "./final-control-delivery-repository.js";

type FinalControlActionContext = { actorUserId: number; requestId: string; ipAddress?: string; userAgent?: string };

export async function getFinalControl(orderId: number, repository: FinalControlQueryRepository = mariaDbFinalControlQueryRepository) {
  const order = await repository.findOrder(orderId);
  if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "La orden no existe.");
  const [labor, parts, record] = await Promise.all([repository.listLabor(orderId), repository.listPendingParts(orderId), repository.findRecord(orderId)]);
  return { ...order, labor: labor.map((line) => ({ ...line, verified: Boolean(line.verified) })), pendingParts: parts, record: record || null };
}

export async function setLaborVerification(orderId: number, quoteLineId: number, verified: boolean, context: FinalControlActionContext, repository: LaborVerificationRepository = mariaDbLaborVerificationRepository) {
  return repository.setOne(orderId, quoteLineId, verified, context, mariaDbAuditWriter);
}

export async function setAllLaborVerifications(orderId: number, verified: boolean, context: FinalControlActionContext, repository: LaborVerificationRepository = mariaDbLaborVerificationRepository) {
  return repository.setAll(orderId, verified, context, mariaDbAuditWriter);
}

export async function completeFinalControl(orderId: number, context: FinalControlActionContext, repository: FinalControlCompletionRepository = mariaDbFinalControlCompletionRepository) {
  return repository.complete(orderId, context, mariaDbAuditWriter);
}

export async function reopenFinalControl(orderId: number, reason: string, context: FinalControlActionContext, repository: FinalControlReopenRepository = mariaDbFinalControlReopenRepository) {
  return repository.reopen(orderId, reason, context, mariaDbAuditWriter);
}

export async function publishReadyForPickup(orderId: number, input: { channel?: string; note?: string }, context: FinalControlActionContext, repository: FinalControlDeliveryRepository = mariaDbFinalControlDeliveryRepository) {
  return repository.publish(orderId, input, context, mariaDbAuditWriter);
}

export async function deliverOrder(orderId: number, context: FinalControlActionContext, repository: FinalControlDeliveryRepository = mariaDbFinalControlDeliveryRepository) {
  return repository.deliver(orderId, context, mariaDbAuditWriter);
}
