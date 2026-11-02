CREATE TABLE parts_request_line_sources (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  request_line_id BIGINT UNSIGNED NOT NULL,
  quote_line_id BIGINT UNSIGNED NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_parts_line_source (request_line_id, quote_line_id),
  KEY idx_parts_source_quote_line (quote_line_id),
  CONSTRAINT fk_parts_source_request_line FOREIGN KEY (request_line_id) REFERENCES parts_request_lines(id),
  CONSTRAINT fk_parts_source_quote_line FOREIGN KEY (quote_line_id) REFERENCES quote_lines(id),
  CONSTRAINT chk_parts_source_quantity CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
