import { EventEmitter } from "node:events";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ listen: vi.fn(), started: vi.fn(), failure: vi.fn(), getEnvironment: vi.fn() }));
vi.mock("./app.js", () => ({ createApp: () => ({ listen: mocks.listen }) }));
vi.mock("./config/env.js", () => ({ getEnvironment: mocks.getEnvironment }));
vi.mock("./logging/technical-logger.js", () => ({ technicalLogger: { started: mocks.started, failure: mocks.failure } }));

let server: EventEmitter;
const originalExitCode = process.exitCode;
beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  server = new EventEmitter();
  mocks.getEnvironment.mockReturnValue({ PORT: 4180 });
  mocks.listen.mockReturnValue(server);
  process.exitCode = undefined;
});
afterEach(() => { process.exitCode = originalExitCode; });

it("announces startup only after the server is listening", async () => {
  await import("./server.js");
  expect(mocks.listen).toHaveBeenCalledWith(4180, "0.0.0.0");
  expect(mocks.started).not.toHaveBeenCalled();
  server.emit("listening");
  await vi.waitFor(() => expect(mocks.started).toHaveBeenCalledWith(4180));
  expect(mocks.failure).not.toHaveBeenCalled();
  expect(server.listenerCount("error")).toBe(0);
});

it("reports an asynchronous listen failure without announcing success", async () => {
  await import("./server.js");
  const error = Object.assign(new Error("occupied port"), { code: "EADDRINUSE" });
  server.emit("error", error);
  await vi.waitFor(() => expect(mocks.failure).toHaveBeenCalledWith("startup_failed", error));
  expect(process.exitCode).toBe(1);
  expect(mocks.started).not.toHaveBeenCalled();
});

it("reports configuration failures through the same startup error path", async () => {
  const error = new Error("invalid environment");
  mocks.getEnvironment.mockImplementation(() => { throw error; });
  await import("./server.js");
  await vi.waitFor(() => expect(mocks.failure).toHaveBeenCalledWith("startup_failed", error));
  expect(mocks.listen).not.toHaveBeenCalled();
  expect(process.exitCode).toBe(1);
});
