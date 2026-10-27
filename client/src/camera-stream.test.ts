import { describe, expect, it, vi } from "vitest";
import { startCamera } from "./camera-stream";

describe("camera lifecycle", () => {
  it("plays the stream and releases it on close", async () => {
    const stop = vi.fn();
    const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
    const video = { srcObject: null, play: vi.fn().mockResolvedValue(undefined) } as unknown as HTMLVideoElement;
    const ready = vi.fn();
    const cleanup = startCamera(video, ready, vi.fn(), async () => stream);
    await vi.waitFor(() => expect(ready).toHaveBeenCalledOnce());
    expect(video.srcObject).toBe(stream);
    cleanup();
    expect(stop).toHaveBeenCalledOnce();
    expect(video.srcObject).toBeNull();
  });
  it("stops permission requests resolved after unmount", async () => {
    const stop = vi.fn();
    const video = { srcObject: null, play: vi.fn() } as unknown as HTMLVideoElement;
    let resolve!: (stream: MediaStream) => void;
    const pending = new Promise<MediaStream>((done) => { resolve = done; });
    const ready = vi.fn();
    const cleanup = startCamera(video, ready, vi.fn(), () => pending);
    cleanup();
    resolve({ getTracks: () => [{ stop }] } as unknown as MediaStream);
    await vi.waitFor(() => expect(stop).toHaveBeenCalledOnce());
    expect(video.play).not.toHaveBeenCalled();
    expect(ready).not.toHaveBeenCalled();
  });
  it("handles unavailable cameras without an unhandled rejection", async () => {
    const error = vi.fn();
    startCamera({ srcObject: null } as HTMLVideoElement, vi.fn(), error, () => { throw new Error("unavailable"); });
    await vi.waitFor(() => expect(error).toHaveBeenCalledOnce());
  });
});
