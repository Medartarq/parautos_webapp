// Round the decimal representation, rather than multiplying a binary float.
// This preserves half-cent values such as 1.005 and 10.075.
export function roundQuoteDecimal(value: number, places: 2 | 3): number {
  if (!Number.isFinite(value)) throw new RangeError("Ingrese un valor numérico finito.");
  const [coefficient, exponent = "0"] = Math.abs(value).toString().split("e");
  const [integer, fraction = ""] = coefficient.split(".");
  const digits = BigInt(integer + fraction);
  const shift = Number(exponent) - fraction.length + places;
  let scaled: bigint;
  if (shift >= 0) {
    scaled = digits * 10n ** BigInt(shift);
  } else {
    const divisor = 10n ** BigInt(-shift);
    scaled = digits / divisor;
    if ((digits % divisor) * 2n >= divisor) scaled += 1n;
  }
  return Math.sign(value) * Number(`${scaled}e-${places}`);
}

export function normalizeQuoteNumbers<T extends { quantity: number; unitPrice: number }>(line: T): T {
  const quantity = roundQuoteDecimal(line.quantity, 3);
  const unitPrice = roundQuoteDecimal(line.unitPrice, 2);
  if (quantity <= 0 || line.unitPrice < 0) {
    throw new RangeError("La cantidad debe ser al menos 0.001 y el precio no puede ser negativo.");
  }
  return { ...line, quantity, unitPrice };
}
