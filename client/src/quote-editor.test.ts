import { expect, it, vi } from "vitest";
import { handleQuoteLineKeyDown } from "./quote-editor";

function keyEvent(key: string, repeat = false, isComposing = false) {
  return { key, repeat, nativeEvent: { isComposing }, preventDefault: vi.fn() };
}

it("adds one line on Enter and prevents implicit form submission", () => {
  const event = keyEvent("Enter");
  const add = vi.fn(() => expect(event.preventDefault).toHaveBeenCalledOnce());
  handleQuoteLineKeyDown(event, add);
  expect(add).toHaveBeenCalledOnce();
});

it("does not duplicate lines when Enter is held down", () => {
  const add = vi.fn();
  handleQuoteLineKeyDown(keyEvent("Enter"), add);
  const repeated = keyEvent("Enter", true);
  handleQuoteLineKeyDown(repeated, add);
  expect(add).toHaveBeenCalledOnce();
  expect(repeated.preventDefault).toHaveBeenCalledOnce();
});

it("preserves numeric editing and navigation keys", () => {
  const add = vi.fn();
  for (const key of ["2", ".", "ArrowUp", "ArrowDown", "Tab", "Backspace"]) {
    const event = keyEvent(key);
    handleQuoteLineKeyDown(event, add);
    expect(event.preventDefault).not.toHaveBeenCalled();
  }
  expect(add).not.toHaveBeenCalled();
});

it("does not add a line while Enter confirms an IME composition", () => {
  const event = keyEvent("Enter", false, true);
  const add = vi.fn();
  handleQuoteLineKeyDown(event, add);
  expect(add).not.toHaveBeenCalled();
  expect(event.preventDefault).not.toHaveBeenCalled();
});
