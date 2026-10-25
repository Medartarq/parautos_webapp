import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const environment = vi.hoisted(() => ({ value: { LOCAL_UPLOAD_BASE: "project", LOCAL_UPLOAD_DIR: "data/uploads" } }));
vi.mock("../../config/env.js", () => ({ getEnvironment: () => environment.value }));

import { getLocalUploadRoot } from "./local-storage.js";

describe("local attachment storage root", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("uses HOME for the private Hostinger location without a fixed username", () => {
    vi.stubEnv("HOME", join(process.cwd(), "test-home"));
    environment.value = { LOCAL_UPLOAD_BASE: "home", LOCAL_UPLOAD_DIR: "parautos-data/uploads" };
    expect(getLocalUploadRoot()).toBe(join(process.env.HOME!, "parautos-data/uploads"));
  });

  it("rejects absolute directories and traversal in configuration", () => {
    environment.value = { LOCAL_UPLOAD_BASE: "project", LOCAL_UPLOAD_DIR: "../uploads" };
    expect(() => getLocalUploadRoot()).toThrow("LOCAL_UPLOAD_DIR");
  });

  it("normalizes every Windows separator and still rejects traversal", () => {
    environment.value = { LOCAL_UPLOAD_BASE: "project", LOCAL_UPLOAD_DIR: "data\\private\\uploads" };
    expect(getLocalUploadRoot()).toBe(join(process.cwd(), "data", "private", "uploads"));
    environment.value = { LOCAL_UPLOAD_BASE: "project", LOCAL_UPLOAD_DIR: "data\\..\\uploads" };
    expect(() => getLocalUploadRoot()).toThrow("LOCAL_UPLOAD_DIR");
  });
});
