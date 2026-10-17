ALTER TABLE damage_marks
  ADD COLUMN IF NOT EXISTS body_code ENUM('V1', 'V2', 'V3', 'V4') NOT NULL DEFAULT 'V3' AFTER reception_id;
