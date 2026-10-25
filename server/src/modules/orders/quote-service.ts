import { AppError } from "../../errors/app-error.js";
import { mariaDbQuoteDraftRepository, type QuoteDraftInput, type QuoteDraftRepository } from "./quote-draft-repository.js";
import { mariaDbQuoteCreationRepository, type QuoteCreationInput, type QuoteCreationRepository } from "./quote-creation-repository.js";
import { mariaDbQuoteMutationRepository, type QuoteMutationRepository } from "./quote-mutation-repository.js";
import { mariaDbQuoteQueryRepository, type QuoteQueryRepository } from "./quote-query-repository.js";
import { mariaDbQuoteTransitionRepository, type QuoteTransitionRepository } from "./quote-transition-repository.js";

type QuoteLineInput = QuoteDraftInput["lines"][number];

export async function listQuotes(orderId: number, repository: QuoteQueryRepository = mariaDbQuoteQueryRepository) {
  const versions = await repository.listVersions(orderId);
  return Promise.all(versions.map(async (version) => {
    const rows = await repository.listLines(version.id);
    // MariaDB entrega DECIMAL como texto. El contrato HTTP de cotizaciones usa
    // números para que un borrador recargado pueda volver a validarse y guardarse.
    const lines = rows.map((line) => ({ ...line, quantity: Number(line.quantity), unitPrice: Number(line.unitPrice) }));
    const total = lines.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unitPrice), 0);
    return { ...version, noParts: Boolean(version.noParts), lines, totalWithoutIgv: total, igv: 0 };
  }));
}

export async function getQuoteDraft(orderId: number, repository: QuoteDraftRepository = mariaDbQuoteDraftRepository) {
  const draft = await repository.findDraft(orderId);
  if (!draft) return undefined;
  const rows = await repository.findLines(draft.id);
  return { ...draft, noParts: Boolean(draft.noParts), lines: rows.map((line) => ({ ...line, quantity: Number(line.quantity), unitPrice: Number(line.unitPrice) })) };
}

export async function saveQuoteDraft(orderId: number, input: QuoteDraftInput, actorUserId: number, requestId: string, ipAddress?: string, userAgent?: string, repository: QuoteDraftRepository = mariaDbQuoteDraftRepository) {
  if (!await repository.save(orderId, input, actorUserId, requestId, ipAddress, userAgent)) throw new AppError(404, "ORDER_NOT_FOUND", "La orden no existe.");
  return getQuoteDraft(orderId, repository);
}

export async function createQuoteVersionFromDraft(orderId: number, adjustmentReason: string | undefined, actorUserId: number, requestId: string, ipAddress?: string, userAgent?: string, repository: QuoteCreationRepository = mariaDbQuoteCreationRepository) {
  const draft = await getQuoteDraft(orderId);
  if (!draft || !draft.lines.length) throw new AppError(409, "QUOTE_DRAFT_REQUIRED", "Guarde un borrador con al menos una partida antes de crear una versión.");
  return createQuote(orderId, { currency: draft.currency, noParts: draft.noParts, adjustmentReason, lines: draft.lines }, actorUserId, requestId, ipAddress, userAgent, repository);
}

export async function createQuote(orderId: number, input: QuoteCreationInput, actorUserId: number, requestId: string, ipAddress?: string, userAgent?: string, repository: QuoteCreationRepository = mariaDbQuoteCreationRepository) {
  return repository.create(orderId, input, actorUserId, requestId, ipAddress, userAgent);
}

export async function updateQuote(orderId: number, quoteId: number, input: { currency: "PEN" | "USD"; noParts: boolean; lines: QuoteLineInput[] }, actorUserId: number, requestId: string, ipAddress?: string, userAgent?: string, repository: QuoteMutationRepository = mariaDbQuoteMutationRepository) {
  return repository.update(orderId, quoteId, input, actorUserId, requestId, ipAddress, userAgent);
}

export async function deleteQuote(orderId: number, quoteId: number, actorUserId: number, requestId: string, ipAddress?: string, userAgent?: string, repository: QuoteMutationRepository = mariaDbQuoteMutationRepository) {
  await repository.delete(orderId, quoteId, actorUserId, requestId, ipAddress, userAgent);
}

export async function transitionQuote(orderId: number, quoteId: number, action: "SEND" | "APPROVE", actorUserId: number, requestId: string, ipAddress?: string, userAgent?: string, repository: QuoteTransitionRepository = mariaDbQuoteTransitionRepository) {
  return repository.transition(orderId, quoteId, action, actorUserId, requestId, ipAddress, userAgent);
}

