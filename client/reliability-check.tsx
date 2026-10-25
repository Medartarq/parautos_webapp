import React from "react";
import { createRoot } from "react-dom/client";
import { QuoteEditor } from "./src/quote-editor";
import "./src/styles.css";
let saves = 0;
window.fetch = async (_input, init) => {
  if (init?.method === "PUT") saves++;
  document.getElementById("saves")!.textContent = String(saves);
  return new Response(JSON.stringify(init?.method === "PUT" ? { draft: { id: 1 } } : String(_input).endsWith("/quotes") ? { quotes: [] } : {}), { status: 200, headers: { "Content-Type": "application/json" } });
};
createRoot(document.getElementById("root")!).render(<><p>Prueba sintética; guardados: <output id="saves">0</output></p><QuoteEditor orderId={1} diagnoses={[]} onQuotesChanged={() => undefined} /></>);
