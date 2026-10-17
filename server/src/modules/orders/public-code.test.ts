import { describe, expect, it } from "vitest";
import { generatePublicCode } from "./service.js";

describe("public tracking code generation", () => {
  it("generates a six-digit numeric code", () => {
    expect(generatePublicCode()).toMatch(/^\d{6}$/);
  });
});
