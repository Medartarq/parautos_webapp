import { expect, it } from "vitest";
import { renderReceptionSvg } from "./reception-svg";

it("prints the recorded reception date and treats replacement characters literally", () => {
  const template = '<svg viewBox="0 0 21000 29700"><text>__FECHA__ __CLIENTE__</text></svg>';
  const svg = renderReceptionSvg(template, { receivedAt: "2020-01-02T12:00:00Z", client: "$& <Cliente>", checklist: [], damages: [] });
  expect(svg).toContain("2020");
  expect(svg).toContain("$&amp; &lt;Cliente&gt;");
  expect(svg).not.toContain("__CLIENTE__");
});
