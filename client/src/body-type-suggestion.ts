const hints: Record<string, string> = {
  "TOYOTA:COROLLA": "Automovil sedan", "TOYOTA:YARIS": "Automovil sedan", "TOYOTA:HILUX": "Camioneta pickup", "TOYOTA:RAV4": "Camioneta SUV", "TOYOTA:FORTUNER": "Camioneta SUV", "TOYOTA:LAND CRUISER": "Camioneta SUV",
  "SUBARU:FORESTER": "Camioneta SUV", "SUBARU:CROSSTREK": "Camioneta SUV", "MITSUBISHI:L200": "Camioneta pickup", "MITSUBISHI:OUTLANDER": "Camioneta SUV",
  "HYUNDAI:TUCSON": "Camioneta SUV", "HYUNDAI:SANTA FE": "Camioneta SUV", "HYUNDAI:ACCENT": "Automovil sedan", "HYUNDAI:PORTER": "Camion furgon",
  "KIA:SPORTAGE": "Camioneta SUV", "KIA:SORENTO": "Camioneta SUV", "KIA:SELTOS": "Camioneta SUV", "NISSAN:NAVARA": "Camioneta pickup", "NISSAN:QASHQAI": "Camioneta SUV", "NISSAN:X-TRAIL": "Camioneta SUV", "NISSAN:SENTRA": "Automovil sedan",
  "MAZDA:BT-50": "Camioneta pickup", "MAZDA:CX-5": "Camioneta SUV", "FORD:RANGER": "Camioneta pickup", "FORD:EVEREST": "Camioneta SUV", "VOLKSWAGEN:AMAROK": "Camioneta pickup", "VOLKSWAGEN:TIGUAN": "Camioneta SUV",
  "CHEVROLET:COLORADO": "Camioneta pickup", "CHEVROLET:TRACKER": "Camioneta SUV", "SUZUKI:JIMNY": "Camioneta SUV", "BMW:X3": "Camioneta SUV", "MERCEDES-BENZ:GLC": "Camioneta SUV",
  "HINO:300": "Camion furgon", "HINO:500": "Camion furgon", "HINO:DUTRO": "Camion furgon", "MERCEDES-BENZ:SPRINTER": "Camion furgon"
};

function control(label: string) {
  return [...document.querySelectorAll<HTMLLabelElement>("label.wizard-field")].find((field) => field.querySelector(":scope > span")?.textContent === label)?.querySelector<HTMLInputElement | HTMLSelectElement>("input, select");
}

function suggestBodyType() {
  const brand = control("Marca *")?.value;
  const model = control("Modelo *")?.value;
  const body = control("Carrocería *") as HTMLSelectElement | undefined;
  const suggestedName = brand && model ? hints[`${brand}:${model}`] : undefined;
  if (!body || body.value || !suggestedName) return;
  const option = [...body.options].find((item) => item.text === suggestedName);
  if (!option) return;
  const setValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  setValue?.call(body, option.value);
  body.dispatchEvent(new Event("change", { bubbles: true }));
}

if (typeof document !== "undefined") {
  document.addEventListener("input", (event) => {
    const field = (event.target as Element).closest("label.wizard-field");
    const label = field?.querySelector(":scope > span")?.textContent;
    if (label === "Marca *" || label === "Modelo *") queueMicrotask(suggestBodyType);
  });
}
