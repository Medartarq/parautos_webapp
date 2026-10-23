import { cloneElement, isValidElement, type ReactNode } from "react";
import { normalizePlate } from "@parautos/shared";

type DamageBody = "V1" | "V2" | "V3" | "V4";
type Catalog = {
  bodyTypes: Array<{ id: number; code: DamageBody; name: string }>
};

function DataStepTitle({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <div className="section-title">
      <span>{n}</span>
      <div>
        <h2>{title}</h2>
        <small>{text}</small>
      </div>
    </div>
  );
}

const colors = [
  "Blanco",
  "Negro",
  "Gris",
  "Plata",
  "Rojo",
  "Azul",
  "Verde",
  "Amarillo",
  "Beige",
  "Marrón",
  "Naranja",
];
const brands: Record<string, string[]> = {
  TOYOTA: [
    "COROLLA",
    "HILUX",
    "RAV4",
    "YARIS",
    "FORTUNER",
    "LAND CRUISER",
    "AVANZA",
    "ETIOS",
    "PRIUS",
  ],
  SUBARU: ["FORESTER", "XV", "CROSSTREK", "OUTBACK", "IMPREZA", "WRX"],
  MITSUBISHI: ["OUTLANDER", "L200", "ASX", "ECLIPSE CROSS", "MONTERO"],
  HINO: ["300", "500", "DUTRO", "RANGER"],
  HYUNDAI: ["TUCSON", "ACCENT", "SANTA FE", "ELANTRA", "CRETA", "H1", "PORTER"],
  KIA: ["SPORTAGE", "SORENTO", "RIO", "SELTOS", "PICANTO", "CARNIVAL"],
  NISSAN: ["SENTRA", "VERSA", "QASHQAI", "X-TRAIL", "NAVARA", "KICKS"],
  MAZDA: ["MAZDA 2", "MAZDA 3", "CX-3", "CX-5", "CX-9", "BT-50"],
  HONDA: ["CIVIC", "CR-V", "HR-V", "PILOT", "FIT"],
  VOLKSWAGEN: ["GOL", "POLO", "JETTA", "TIGUAN", "AMAROK"],
  FORD: ["RANGER", "EVEREST", "ESCAPE", "EXPLORER", "MUSTANG"],
  CHEVROLET: ["ONIX", "TRACKER", "CAPTIVA", "COLORADO", "SPARK"],
  SUZUKI: ["SWIFT", "VITARA", "S-CROSS", "JIMNY", "ERTIGA"],
  BMW: ["SERIE 1", "SERIE 3", "X1", "X3", "X5"],
  "MERCEDES-BENZ": ["CLASE A", "CLASE C", "GLA", "GLC", "SPRINTER"],
};
export function DataStep({
  d,
  set,
  updateNumeric,
  updateUpper,
  catalog,
}: {
  d: Record<string, string>;
  set: (key: string, value: string) => void;
  updateNumeric: (key: string, value: string, length: number) => void;
  updateUpper: (key: string, value: string, length: number) => void;
  catalog: Catalog;
}) {
  const models = brands[d.brand] || [];
  return (
    <div className="intake-sections">
      <DataStepTitle
        n="1"
        title="Registro de recepción"
        text="Los campos con * son obligatorios."
      />
      <section className="intake-section">
        <header>
          <h3>Datos del cliente</h3>
          <p>Información de contacto del propietario.</p>
        </header>
        <div className="form-grid">
          <Field label="DNI o RUC *">
            <input
              inputMode="numeric"
              maxLength={11}
              value={d.document || ""}
              onChange={(e) => updateNumeric("document", e.target.value, 11)}
            />
          </Field>
          <Field label="Cliente *">
            <input
              value={d.client || ""}
              onChange={(e) => set("client", e.target.value)}
            />
          </Field>
          <Field label="Celular">
            <input
              inputMode="numeric"
              maxLength={15}
              value={d.phone || ""}
              onChange={(e) => updateNumeric("phone", e.target.value, 15)}
            />
          </Field>
          <Field label="Correo">
            <input
              type="email"
              value={d.email || ""}
              onChange={(e) => set("email", e.target.value)}
            />
          </Field>
        </div>
      </section>
      <section className="intake-section">
        <header>
          <h3>Datos del vehículo</h3>
          <p>Identificación técnica que se mantiene durante la reparación.</p>
        </header>
        <div className="form-grid">
          <Field label="Placa *">
            <input
              maxLength={9}
              value={d.plate || ""}
              onChange={(e) =>
                set(
                  "plate",
                  e.target.value.replace(/[^A-Za-z0-9- ]/g, "").toUpperCase(),
                )
              }
              onBlur={(e) => set("plate", normalizePlate(e.target.value))}
            />
          </Field>
          <Field label="Marca *">
            <input
              list="brands"
              value={d.brand || ""}
              onChange={(e) => updateUpper("brand", e.target.value, 80)}
            />
            <datalist id="brands">
              {Object.keys(brands).map((brand) => (
                <option key={brand} value={brand} />
              ))}
            </datalist>
          </Field>
          <Field label="Modelo *">
            <input
              list="models"
              value={d.model || ""}
              onChange={(e) => updateUpper("model", e.target.value, 80)}
            />
            <datalist id="models">
              {models.map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>
          </Field>
          <Field label="Carrocería *">
            <select
              value={d.body || ""}
              onChange={(e) => set("body", e.target.value)}
            >
              <option value="">Selecciona</option>
              {catalog.bodyTypes.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Año">
            <input
              inputMode="numeric"
              maxLength={4}
              value={d.year || ""}
              onChange={(e) => updateNumeric("year", e.target.value, 4)}
            />
          </Field>
          <Field label="VIN">
            <input
              maxLength={17}
              value={d.vin || ""}
              onChange={(e) => updateUpper("vin", e.target.value, 17)}
            />
          </Field>
        </div>
      </section>
      <section className="intake-section">
        <header>
          <h3>Condiciones de ingreso</h3>
          <p>Datos registrados al momento de recibir el vehículo.</p>
        </header>
        <div className="form-grid">
          <Field label="Modalidad *">
            <select
              value={d.modality}
              onChange={(e) => set("modality", e.target.value)}
            >
              {["PARTICULAR", "MAPFRE", "LA_POSITIVA", "RIMAC", "PACIFICO", "QUALITAS"].map(
                (value) => (
                  <option key={value}>{value}</option>
                ),
              )}
            </select>
          </Field>
          <Field label="Color *">
            <select
              value={
                d.colorType === "PERSONALIZADO" ? "__CUSTOM__" : d.color || ""
              }
              onChange={(e) => {
                if (e.target.value === "__CUSTOM__") {
                  set("colorType", "PERSONALIZADO");
                  set("color", "");
                } else {
                  set("colorType", "CATALOGO");
                  set("color", e.target.value);
                }
              }}
            >
              <option value="">Selecciona</option>
              {colors.map((color) => (
                <option key={color}>{color}</option>
              ))}
              <option value="__CUSTOM__">Otro color (especificar)</option>
            </select>
          </Field>
          {d.colorType === "PERSONALIZADO" && (
            <Field label="Color personalizado">
              <input
                maxLength={40}
                value={d.color || ""}
                placeholder="Ej. Gris Nardo"
                onChange={(e) =>
                  set("color", e.target.value.replace(/[^A-Za-zÀ-ÿ ]/g, ""))
                }
              />
            </Field>
          )}
          <Field label="Kilometraje">
            <input
              inputMode="numeric"
              maxLength={7}
              value={d.mileage || ""}
              onChange={(e) => updateNumeric("mileage", e.target.value, 7)}
            />
          </Field>
          <Field label="Número de siniestro">
            <input
              disabled={d.claimPending === "true"}
              value={d.claim || ""}
              onChange={(e) => set("claim", e.target.value)}
            />
          </Field>
          <Field label="Combustible">
            <select
              value={d.fuel || ""}
              onChange={(e) => set("fuel", e.target.value)}
            >
              <option value="">No registrado</option>
              {[
                [0, "Vacío"],
                [25, "1/4"],
                [50, "1/2"],
                [75, "3/4"],
                [100, "Lleno"],
              ].map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <label className="claim-field">
            <input
              type="checkbox"
              checked={d.claimPending === "true"}
              onChange={(e) => set("claimPending", String(e.target.checked))}
            />
            Número de siniestro pendiente
          </label>
        </div>
      </section>
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  const control = isValidElement<{
    value?: string;
    onChange?: (event: { target: { value: string } }) => void;
    placeholder?: string;
  }>(children)
    ? children
    : null;
  const value = control?.props.value;
  const placeholders: Record<string, string> = {
    "DNI o RUC *": "DNI (8) o RUC (11)",
    "Cliente *": "Nombre o razón social",
    Celular: "999 999 999",
    Correo: "nombre@correo.com",
    "Placa *": "ABC-123 · NG-1234 · E ABC-789 · CD-0123",
    "Marca *": "Ej. TOYOTA",
    "Modelo *": "Ej. COROLLA",
    "Color personalizado": "Ej. Gris Nardo",
    Año: "Ej. 2024",
    VIN: "17 caracteres",
    Kilometraje: "Ej. 12500",
    "Número de siniestro": "Código de la aseguradora",
  };
  const input =
    control && control.type === "input"
      ? cloneElement(control, {
          placeholder: control.props.placeholder || placeholders[label],
        })
      : children;
  const palette: Record<string, string> = {
    Blanco: "#f8fafc",
    Negro: "#171717",
    Gris: "#7b8490",
    Plata: "#c5ccd3",
    Rojo: "#dc2626",
    Azul: "#2563eb",
    Verde: "#15803d",
    Amarillo: "#eab308",
    Beige: "#d6c19a",
    Marrón: "#7c4a2d",
    Naranja: "#ea580c",
  };
  const fuelValues = ["0", "25", "50", "75", "100"];
  const fuelLabels = ["Vacío", "1/4", "1/2", "3/4", "Lleno"];
  const fuelIndex = fuelValues.indexOf(value || "");
  const fuelLevel = Math.max(0, fuelIndex) * 25;
  const fuel =
    label === "Combustible" && control ? (
      <div className="fuel-control">
        <div className="fuel-control-header">
          <button
            type="button"
            className={fuelIndex === -1 ? "active" : ""}
            onClick={() => control.props.onChange?.({ target: { value: "" } })}
          >
            Sin registrar
          </button>
          <strong>
            {fuelIndex === -1 ? "No registrado" : fuelLabels[fuelIndex]}
          </strong>
        </div>
        <input
          type="range"
          min="0"
          max="4"
          step="1"
          value={Math.max(0, fuelIndex)}
          style={{
            background: `linear-gradient(to right, var(--dark) 0%, var(--dark) ${fuelLevel}%, #d5dce3 ${fuelLevel}%, #d5dce3 100%)`,
          }}
          onChange={(event) =>
            control.props.onChange?.({
              target: { value: fuelValues[Number(event.target.value)] },
            })
          }
        />
        <div className="fuel-marks">
          {fuelLabels.map((item, index) => (
            <span className={index === fuelIndex ? "active" : ""} key={item}>
              {item}
            </span>
          ))}
        </div>
      </div>
    ) : (
      input
    );
  return (
    <label
      className={`wizard-field ${label === "Color *" ? "color-field" : label === "Color personalizado" ? "custom-color-field" : label === "Combustible" ? "fuel-field" : ""}`}
    >
      <span>{label}</span>
      <div className="field-with-swatch">
        {fuel}
        {label === "Color *" && (
          <i
            className="color-swatch"
            style={{ background: palette[value || ""] || "#fff" }}
            aria-label={`Color ${value || "sin seleccionar"}`}
          />
        )}
      </div>
    </label>
  );
}
