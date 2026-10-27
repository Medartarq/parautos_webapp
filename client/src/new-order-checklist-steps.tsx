import type { Dispatch, SetStateAction } from "react";

type ChecklistItem = { id: number; category: string; name: string };
type ChecklistAnswers = Record<number, "SI" | "NO">;
type ChecklistProps = {
  catalog: { checklist: ChecklistItem[] };
  answers: ChecklistAnswers;
  setAnswers: Dispatch<SetStateAction<ChecklistAnswers>>;
  notes: Record<number, string>;
  setNotes: Dispatch<SetStateAction<Record<number, string>>>;
  openChecklistCategory?: string;
  setOpenChecklistCategory: Dispatch<SetStateAction<string | undefined>>;
  checklistUndo?: { category: string; answers: Record<number, "SI" | "NO" | undefined>; notes: Record<number, string | undefined> };
  undoChecklistCategory: () => void;
  categories: string[];
  markCategoryConforming: (category: string) => void;
  openChecklistNotes: Record<number, boolean>;
  setOpenChecklistNotes: Dispatch<SetStateAction<Record<number, boolean>>>;
};
type ConsiderationsProps = { flagsSelected: string[]; setFlagsSelected: Dispatch<SetStateAction<string[]>>; additionalConsideration: string; setAdditionalConsideration: (value: string) => void };

export const RECEPTION_CONSIDERATION_FLAGS = [
  "Vehículo presenta suciedad que impide la revisión eficaz",
  "Pertenencias personales del interior retiradas",
  "Ver evidencias fotográficas",
];
function StepTitle({ n, title, text }: { n: string; title: string; text: string }) {
  return <div className="section-title"><span>{n}</span><div><h2>{title}</h2><small>{text}</small></div></div>;
}

export function ChecklistStep({ catalog, answers, setAnswers, notes, setNotes, openChecklistCategory, setOpenChecklistCategory, checklistUndo, undoChecklistCategory, categories, markCategoryConforming, setOpenChecklistNotes }: ChecklistProps) {
  return (
    <> 
            <StepTitle
              n="✓"
              title="Checklist de recepción"
              text={`${Object.keys(answers).length} de 44 respondidos · todos obligatorios.`}
            />
            <div className="checklist-mobile-hint"><strong>Modo rápido</strong><span>Marca una categoría sin novedades o revisa sólo sus excepciones.</span></div>
            {checklistUndo && <div className="checklist-undo"><span>{checklistUndo.category} se marcó como conforme.</span><button type="button" onClick={undoChecklistCategory}>Deshacer</button></div>}
            {categories.map((category, categoryIndex) => {
              const items = catalog.checklist.filter((item) => item.category === category); const answered = items.filter((item) => answers[item.id]).length; const observations = items.filter((item) => answers[item.id] === "NO").length; const isOpen = openChecklistCategory === category || (!openChecklistCategory && categoryIndex === 0);
              return <section className={`check-category ${isOpen ? "open" : ""}`} key={category}><header><button type="button" className="check-category-toggle" onClick={() => setOpenChecklistCategory(isOpen ? undefined : category)}><span>{category}</span><small>{answered}/{items.length}{observations ? ` · ${observations} observación${observations === 1 ? "" : "es"}` : ""}</small><b aria-hidden="true">{isOpen ? "⌃" : "›"}</b></button>{isOpen && <button type="button" className="check-category-all-good" onClick={() => markCategoryConforming(category)}>Marcar sin novedades</button>}</header>{isOpen && <div className="check-category-items">{items.map((item) => { const showNote = answers[item.id] === "NO"; const quickNote = (value: string) => { setNotes((current) => ({ ...current, [item.id]: current[item.id] ? `${current[item.id]} · ${value}` : value })); setOpenChecklistNotes((current) => ({ ...current, [item.id]: true })); }; return <div className={`check-row ${answers[item.id] === "NO" ? "has-observation" : ""}`} key={item.id}><div className="check-item-main"><strong>{item.name}</strong>{showNote ? <><div className="check-note-templates">{["Rayado", "Golpe", "No opera", "Falta"].map((value) => <button type="button" key={value} onClick={() => quickNote(value)}>{value}</button>)}</div><input className="check-note" placeholder="Describe la observación" value={notes[item.id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} /></> : <button type="button" className="check-add-note" onClick={() => { setAnswers((current) => ({ ...current, [item.id]: "NO" })); setOpenChecklistNotes((current) => ({ ...current, [item.id]: true })); }}>+ Añadir observación</button>}</div><div className="segmented"><button type="button" className={answers[item.id] === "SI" ? "selected" : ""} onClick={() => setAnswers((current) => ({ ...current, [item.id]: "SI" }))}>OK</button><button type="button" className={answers[item.id] === "NO" ? "selected no" : ""} onClick={() => { setAnswers((current) => ({ ...current, [item.id]: "NO" })); setOpenChecklistNotes((current) => ({ ...current, [item.id]: true })); }}>OBS</button></div></div>; })}</div>}</section>;
            })}
          
    </>
  );
}

export function ConsiderationsStep({ flagsSelected, setFlagsSelected, additionalConsideration, setAdditionalConsideration }: ConsiderationsProps) {
  return (
    <> <div className="considerations-step">
            <StepTitle
              n="!"
              title="Consideraciones de recepción"
              text="Opcionales; se conservarán en la constancia."
            />
            <div className="considerations-hint"><strong>Registro de ingreso</strong><span>Marca las condiciones aplicables al recibir el vehículo.</span></div>
            <div className="flags">
              {RECEPTION_CONSIDERATION_FLAGS.map((flag) => (
                <label key={flag}>
                  <input
                    type="checkbox"
                    checked={flagsSelected.includes(flag)}
                    onChange={(event) =>
                      setFlagsSelected(
                        event.target.checked
                          ? [...new Set([...flagsSelected, flag])]
                          : flagsSelected.filter((value) => value !== flag),
                      )
                    }
                  />
                  {flag}
                </label>
              ))}
            </div>
            <label className="consideration-additional">
              <strong>Consideración adicional</strong>
              <textarea value={additionalConsideration} onChange={(event) => setAdditionalConsideration(event.target.value)} placeholder="Agrega una consideración manual, si corresponde." maxLength={500} />
            </label>
          </div>
    </>
  );
}

