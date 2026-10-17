ALTER TABLE receptions
  ADD COLUMN diagnosis TEXT NULL,
  ADD COLUMN diagnosis_legibility ENUM('PENDIENTE', 'LEGIBLE', 'ILEGIBLE') NULL,
  ADD COLUMN diagnosis_review_state ENUM('PENDIENTE_REVISION', 'REVISADA') NULL,
  ADD COLUMN signature_object_key VARCHAR(500) NULL,
  ADD COLUMN checklist_reviewed_at DATETIME(6) NULL;

CREATE TABLE damage_marks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  reception_id BIGINT UNSIGNED NOT NULL,
  body_code ENUM('V1', 'V2', 'V3', 'V4') NOT NULL,
  body_view ENUM('01', '02', '03', '04', '05') NOT NULL,
  path_data JSON NOT NULL,
  description VARCHAR(300) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_damage_marks_reception FOREIGN KEY (reception_id) REFERENCES receptions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE attachments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  reception_id BIGINT UNSIGNED NULL,
  uploaded_by_user_id BIGINT UNSIGNED NOT NULL,
  category ENUM('RECEPCION', 'DANIO', 'EVALUACION_MANUSCRITA', 'COTIZACION', 'CONTROL_FINAL', 'CONFORMIDAD', 'OTRO') NOT NULL,
  storage_provider VARCHAR(30) NOT NULL,
  object_key VARCHAR(500) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  byte_size BIGINT UNSIGNED NOT NULL,
  sha256 CHAR(64) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY idx_attachments_order (order_id, created_at),
  KEY idx_attachments_reception (reception_id, created_at),
  CONSTRAINT fk_attachments_order FOREIGN KEY (order_id) REFERENCES service_orders(id),
  CONSTRAINT fk_attachments_reception FOREIGN KEY (reception_id) REFERENCES receptions(id),
  CONSTRAINT fk_attachments_user FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
