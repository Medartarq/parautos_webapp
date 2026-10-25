import { expect, it } from "vitest";
import { isReceptionEmail, operationalDataSchema } from "@parautos/shared";

it.each([
  ["a@b.c", true], ["a+b@sub.domain.pe", true], ["a@b..", true], ["a@...", true],
  ["a@.b.c", true], ["a@b.", false], ["a@.b", false], ["@b.c", false],
  ["a@@b.c", false], ["a b@c.d", false], ["a@b.c\n", false], ["a@bc", false],
])("preserves reception email validation for %s", (value, expected) => {
  expect(isReceptionEmail(value)).toBe(expected);
});

it("retains schema length limits before validating operational email", () => {
  const input = { emailOverride: "a".repeat(150) + "@b.c", claimPendingReminder: false, reason: "Corrección" };
  expect(operationalDataSchema.safeParse(input).success).toBe(false);
  expect(operationalDataSchema.parse({ ...input, emailOverride: " a@b.c " }).emailOverride).toBe("a@b.c");
});
