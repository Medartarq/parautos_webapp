ALTER TABLE receptions
  MODIFY COLUMN diagnosis_legibility ENUM('PENDIENTE', 'LEGIBLE', 'ILEGIBLE') NULL,
  ADD COLUMN IF NOT EXISTS diagnosis_review_state ENUM('PENDIENTE_REVISION', 'REVISADA') NULL AFTER diagnosis_legibility;
