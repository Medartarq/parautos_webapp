import { mariaDbPartsQueryRepository, type PartsQueryRepository } from "./parts-query-repository.js";
import { mariaDbPartsMutationRepository, type PartUpdateInput, type PartsLogisticsInput, type PartsMutationRepository } from "./parts-mutation-repository.js";


function mapPart(row: any) {
  const quantity = Number(row.quantity); const receivedQuantity = Number(row.receivedQuantity);
  // Cada fila representa ahora un repuesto operativo individual. Se conserva la
  // columna heredada para compatibilidad, pero la recepción parcial no participa
  // del flujo ni vuelve a exponerse a los clientes.
  return { ...row, quantity, receivedQuantity, partialReceived: false, freightRequested: Boolean(row.freightRequested), fullyReceived: receivedQuantity >= quantity, partiallyReceived: false };
}

export async function listParts(orderId?: number, repository: PartsQueryRepository = mariaDbPartsQueryRepository) {
  const rows = await repository.listParts(orderId);
  return rows.map(mapPart);
}

export async function listPartProviders(brand?: string, quality?: string, repository: PartsQueryRepository = mariaDbPartsQueryRepository) {
  const rows = await repository.listProviders();
  return rows.filter((provider) => {
    const brands = typeof provider.brands === "string" ? JSON.parse(provider.brands) : provider.brands;
    const qualities = typeof provider.qualities === "string" ? JSON.parse(provider.qualities) : provider.qualities;
    return (!brand || brands.includes(brand.toUpperCase())) && (!quality || qualities.includes(quality));
  }).map((provider) => ({ ...provider, brands: typeof provider.brands === "string" ? JSON.parse(provider.brands) : provider.brands, qualities: typeof provider.qualities === "string" ? JSON.parse(provider.qualities) : provider.qualities, freightAvailable: Boolean(provider.freightAvailable) }));
}

export async function updatePart(partId: number, input: PartUpdateInput, actorUserId: number, requestId: string, ipAddress?: string, userAgent?: string, repository: PartsMutationRepository = mariaDbPartsMutationRepository) {
  return mapPart(await repository.updatePart(partId, input, actorUserId, requestId, ipAddress, userAgent));
}

export async function getPartsLogistics(orderId: number, repository: PartsQueryRepository = mariaDbPartsQueryRepository) {
  const row = await repository.findLogistics(orderId);
  return row ? { ...row, freightRequested: Boolean(row.freightRequested), expansionRequired: Boolean(row.expansionRequired) } : { freightRequested: false, freightAmount: null, freightPayment: "PENDIENTE", expansionRequired: false, owner: "", notes: "" };
}

export async function updatePartsLogistics(orderId: number, input: PartsLogisticsInput, actorUserId: number, requestId: string, ipAddress?: string, userAgent?: string, repository: PartsMutationRepository = mariaDbPartsMutationRepository) {
  await repository.updateLogistics(orderId, input, actorUserId, requestId, ipAddress, userAgent); return getPartsLogistics(orderId);
}

export async function startRepair(orderId: number, actorUserId: number, requestId: string, ipAddress?: string, userAgent?: string, repository: PartsMutationRepository = mariaDbPartsMutationRepository) {
  return repository.startRepair(orderId, actorUserId, requestId, ipAddress, userAgent);
}

