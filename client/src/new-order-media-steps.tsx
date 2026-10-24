import type { Dispatch, RefObject, SetStateAction } from "react";

type Evidence = { file: File; preview: string };
type EvidenceProps = {
  files: Evidence[];
  setFiles: Dispatch<SetStateAction<Evidence[]>>;
  openCamera: (target: "evidence" | "diagnosis") => void;
  evidenceDeviceInput: RefObject<HTMLInputElement | null>;
  addEvidence: (files: File[]) => Promise<void>;
  diagnosisFile?: File;
  setDiagnosisFile: Dispatch<SetStateAction<File | undefined>>;
  setDiagnosisPreview: Dispatch<SetStateAction<string>>;
  diagnosisPreview: string;
  openDiagnosisCamera: () => void;
  diagnosisDeviceInput: RefObject<HTMLInputElement | null>;
  selectDiagnosis: (file?: File) => Promise<void>;
  diagnosisLegibility: "PENDIENTE" | "LEGIBLE" | "ILEGIBLE";
  setDiagnosisLegibility: Dispatch<SetStateAction<"PENDIENTE" | "LEGIBLE" | "ILEGIBLE">>;
  diagnosisReviewState: "PENDIENTE_REVISION" | "REVISADA";
  setDiagnosisReviewState: Dispatch<SetStateAction<"PENDIENTE_REVISION" | "REVISADA">>;
  diagnosisPending: boolean;
  setDiagnosisPending: (value: boolean) => void;
};

function StepTitle({ n, title, text }: { n: string; title: string; text: string }) {
  return <div className="section-title"><span>{n}</span><div><h2>{title}</h2><small>{text}</small></div></div>;
}

export function EvidenceStep({ files, setFiles, openCamera, evidenceDeviceInput, addEvidence, ...evaluation }: EvidenceProps) {
  return (
    <> 
            <StepTitle
              n="▣"
              title="Evidencias"
              text={`${files.length} de 15 · orden cronológico.`}
            />
            <div
              className={`evidence-upload${files.length >= 15 ? " is-full" : ""}`}
            >
              <strong>
                {files.length >= 15
                  ? "✓ Evidencias completas"
                  : "＋ Tomar o elegir fotografías"}
              </strong>
              <small>
                {files.length >= 15
                  ? "Se alcanzó el máximo de 15 imágenes."
                  : "JPG, PNG o WebP · máximo 10 MB por imagen"}
              </small>
              <div className="evidence-upload-actions">
                <button type="button" className="btn small" disabled={files.length >= 15} onClick={() => openCamera("evidence")}>Tomar foto</button>
                <button type="button" className="btn small" disabled={files.length >= 15} onClick={() => evidenceDeviceInput.current?.click()}>Elegir del dispositivo</button>
                <input ref={evidenceDeviceInput} type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => { void addEvidence(Array.from(event.target.files || [])); event.currentTarget.value = ""; }} />
              </div>
            </div>
            <div className="evidence-grid">
              {files.length ? (
                files.map((evidence, index) => (
                  <div
                    className="evidence-photo"
                    key={`${evidence.file.name}-${evidence.file.lastModified}-${index}`}
                  >
                    <img
                      src={evidence.preview}
                      alt={`Evidencia ${index + 1}`}
                    />
                    <span>{index + 1}</span>
                    <button
                      type="button"
                      aria-label={`Eliminar evidencia ${index + 1}`}
                      onClick={() =>
                        setFiles((current) => {
                          URL.revokeObjectURL(evidence.preview);
                          return current.filter(
                            (_, itemIndex) => itemIndex !== index,
                          );
                        })
                      }
                    >
                      ×
                    </button>
                  </div>
                ))
              ) : (
                <div className="evidence-empty">
                  Aún no has adjuntado fotografías.
                  <br />
                  Usa el área de arriba para agregarlas.
                </div>
              )}
            </div>
            <div className="evidence-hint">
              <strong>Recomendación:</strong> documenta los daños principales.
              Puedes continuar sin completar las 15 fotografías.
            </div>
            <EvaluationUpload {...evaluation} />
          
    </>
  );
}

function EvaluationUpload({ diagnosisFile, setDiagnosisFile, setDiagnosisPreview, diagnosisPreview, openDiagnosisCamera, diagnosisDeviceInput, selectDiagnosis, diagnosisLegibility, setDiagnosisLegibility, diagnosisReviewState, setDiagnosisReviewState, diagnosisPending, setDiagnosisPending }: Omit<EvidenceProps, "files" | "setFiles" | "openCamera" | "evidenceDeviceInput" | "addEvidence">) {
  return (
    <section className="diagnosis-upload">
              <header>
                <div>
                  <strong>Fotografía de evaluación manuscrita</strong>
                  <small>
                    Opcional, pero recomendada. JPG, PNG o WebP hasta 10 MB.
                  </small>
                </div>
                {diagnosisFile ? (
                  <button
                    type="button"
                    className="btn small"
                    onClick={() => {
                      setDiagnosisFile(undefined);
                      setDiagnosisPreview("");
                    }}
                  >
                    Eliminar
                  </button>
                ) : (
                  <span className="diagnosis-upload-optional">Opcional</span>
                )}
              </header>
              {diagnosisPreview ? (
                <img
                  src={diagnosisPreview}
                  alt="Vista previa de evaluación manuscrita"
                />
              ) : (
                <div className="diagnosis-picker">
                  <span className="diagnosis-picker-icon">⌁</span>
                  <strong>Tomar o elegir fotografía</strong>
                  <small>Usa la cámara o selecciona un archivo desde este equipo.</small>
                  <div className="evidence-upload-actions">
                    <button type="button" className="btn small" onClick={openDiagnosisCamera}>Tomar foto</button>
                    <button type="button" className="btn small" onClick={() => diagnosisDeviceInput.current?.click()}>Elegir del dispositivo</button>
                    <input ref={diagnosisDeviceInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { void selectDiagnosis(event.target.files?.[0]); event.currentTarget.value = ""; }} />
                  </div>
                </div>
              )}
              {diagnosisFile && (
                <div className="diagnosis-status">
                  <span>{diagnosisFile.name}</span>
                  <label>
                    Legibilidad
                    <select
                      value={diagnosisLegibility}
                      onChange={(event) =>
                        setDiagnosisLegibility(
                          event.target.value as
                            "PENDIENTE" | "LEGIBLE" | "ILEGIBLE",
                        )
                      }
                    >
                      <option value="PENDIENTE">Pendiente</option>
                      <option value="LEGIBLE">Legible</option>
                      <option value="ILEGIBLE">Ilegible</option>
                    </select>
                  </label>
                  <label>
                    Revisión
                    <select
                      value={diagnosisReviewState}
                      onChange={(event) =>
                        setDiagnosisReviewState(
                          event.target.value as
                            "PENDIENTE_REVISION" | "REVISADA",
                        )
                      }
                    >
                      <option value="PENDIENTE_REVISION">Pendiente</option>
                      <option value="REVISADA">Revisada</option>
                    </select>
                  </label>
                </div>
              )}
              {!diagnosisFile && (
                <label className="diagnosis-reminder">
                  <input type="checkbox" checked={diagnosisPending} onChange={(event) => setDiagnosisPending(event.target.checked)} />
                  <span>Crear recordatorio: evaluación manuscrita pendiente de cargar.</span>
                </label>
              )}
    </section>
  );
}

