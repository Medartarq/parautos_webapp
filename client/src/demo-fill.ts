function addDemoButton() {
  const actions = document.querySelector<HTMLElement>(".full-wizard .wizard-actions");
  if (!actions || actions.querySelector("[data-demo-fill]")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn small demo-fill-button";
  button.dataset.demoFill = "true";
  button.textContent = "Cargar datos demo";
  button.title = "Completa un caso de prueba para revisar el flujo";
  button.addEventListener("click", () => window.dispatchEvent(new Event("parautos:fill-demo")));
  actions.prepend(button);
}

if (import.meta.env.DEV && typeof document !== "undefined") new MutationObserver(() => requestAnimationFrame(addDemoButton)).observe(document.body, { childList: true, subtree: true });
