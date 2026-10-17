CREATE TABLE quote_versions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  version_number INT UNSIGNED NOT NULL,
  status ENUM('PENDIENTE', 'ENVIADA', 'REEMPLAZADA', 'APROBADA') NOT NULL DEFAULT 'PENDIENTE',
  currency ENUM('PEN', 'USD') NOT NULL DEFAULT 'PEN',
  no_parts TINYINT(1) NOT NULL DEFAULT 0,
  adjustment_reason VARCHAR(500) NULL,
  created_by_user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  sent_at DATETIME(6) NULL,
  sent_snapshot JSON NULL,
  approved_at DATETIME(6) NULL,
  approved_snapshot JSON NULL,
  UNIQUE KEY uq_quote_versions_order_version (order_id, version_number),
  KEY idx_quote_versions_order_status (order_id, status),
  CONSTRAINT fk_quote_versions_order FOREIGN KEY (order_id) REFERENCES service_orders(id),
  CONSTRAINT fk_quote_versions_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id),
  CONSTRAINT chk_quote_versions_no_parts CHECK (no_parts IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE quote_lines (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  quote_version_id BIGINT UNSIGNED NOT NULL,
  line_type ENUM('MANO_OBRA', 'REPUESTO') NOT NULL,
  labor_category ENUM('PLANCHADO', 'PINTURA', 'MECANICA') NULL,
  description VARCHAR(500) NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  unit_price DECIMAL(14,2) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY idx_quote_lines_version (quote_version_id),
  CONSTRAINT fk_quote_lines_version FOREIGN KEY (quote_version_id) REFERENCES quote_versions(id),
  CONSTRAINT chk_quote_lines_quantity CHECK (quantity > 0),
  CONSTRAINT chk_quote_lines_price CHECK (unit_price >= 0),
  CONSTRAINT chk_quote_lines_category CHECK (
    (line_type = 'MANO_OBRA' AND labor_category IS NOT NULL) OR
    (line_type = 'REPUESTO' AND labor_category IS NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
