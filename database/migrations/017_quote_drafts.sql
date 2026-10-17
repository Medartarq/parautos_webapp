CREATE TABLE quote_drafts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  currency ENUM('PEN', 'USD') NOT NULL DEFAULT 'PEN',
  no_parts TINYINT(1) NOT NULL DEFAULT 0,
  updated_by_user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_quote_drafts_order (order_id),
  CONSTRAINT fk_quote_drafts_order FOREIGN KEY (order_id) REFERENCES service_orders(id),
  CONSTRAINT fk_quote_drafts_user FOREIGN KEY (updated_by_user_id) REFERENCES users(id),
  CONSTRAINT chk_quote_drafts_no_parts CHECK (no_parts IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE quote_draft_lines (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  quote_draft_id BIGINT UNSIGNED NOT NULL,
  line_type ENUM('MANO_OBRA', 'REPUESTO') NOT NULL,
  labor_category ENUM('PLANCHADO', 'PINTURA', 'MECANICA') NULL,
  description VARCHAR(500) NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  unit_price DECIMAL(14,2) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY idx_quote_draft_lines_draft (quote_draft_id),
  CONSTRAINT fk_quote_draft_lines_draft FOREIGN KEY (quote_draft_id) REFERENCES quote_drafts(id) ON DELETE CASCADE,
  CONSTRAINT chk_quote_draft_lines_quantity CHECK (quantity > 0),
  CONSTRAINT chk_quote_draft_lines_price CHECK (unit_price >= 0),
  CONSTRAINT chk_quote_draft_lines_category CHECK (
    (line_type = 'MANO_OBRA' AND labor_category IS NOT NULL) OR
    (line_type = 'REPUESTO' AND labor_category IS NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO quote_drafts (order_id, currency, no_parts, updated_by_user_id)
SELECT q.order_id, q.currency, q.no_parts, q.created_by_user_id
FROM quote_versions q
JOIN (
  SELECT order_id, MAX(version_number) AS version_number
  FROM quote_versions
  WHERE status = 'PENDIENTE'
  GROUP BY order_id
) pending ON pending.order_id = q.order_id AND pending.version_number = q.version_number;

INSERT INTO quote_draft_lines (quote_draft_id, line_type, labor_category, description, quantity, unit_price)
SELECT d.id, l.line_type, l.labor_category, l.description, l.quantity, l.unit_price
FROM quote_drafts d
JOIN (
  SELECT order_id, MAX(version_number) AS version_number
  FROM quote_versions
  WHERE status = 'PENDIENTE'
  GROUP BY order_id
) pending ON pending.order_id = d.order_id
JOIN quote_versions q ON q.order_id = pending.order_id AND q.version_number = pending.version_number
JOIN quote_lines l ON l.quote_version_id = q.id;
