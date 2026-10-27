import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ReceptionDetail } from "./reception-detail";

it("shows unrecorded mileage and fuel instead of database null values", () => {
  const order = { id: 1, orderNumber: "OS-TEST", modality: "PARTICULAR", documentType: "DNI", documentNumber: "70000001", plate: "AUD101", brand: "TOYOTA", client: "Cliente sintético", model: "COROLLA", color: "Blanco", bodyName: "Sedán", diagnosisPending: false, checklist: [], damages: [], attachments: [], reception: { mileage: null as unknown as number, fuelLevel: null as unknown as number, acceptedTerms: true } };
  const html = renderToStaticMarkup(<ReceptionDetail order={order} onRefresh={async () => undefined} />);
  expect(html).not.toContain("null km");
  expect(html).not.toContain("null%");
  expect(html.match(/No registrado/g)).toHaveLength(2);
});
