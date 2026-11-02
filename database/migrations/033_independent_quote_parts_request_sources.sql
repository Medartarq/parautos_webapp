CREATE TABLE parts_request_line_independent_quote_sources (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  request_line_id BIGINT UNSIGNED NOT NULL,
  independent_quote_line_id BIGINT UNSIGNED NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_parts_independent_quote_source (request_line_id, independent_quote_line_id),
  KEY idx_parts_independent_quote_line (independent_quote_line_id),
  CONSTRAINT fk_parts_independent_quote_source_line FOREIGN KEY (request_line_id) REFERENCES parts_request_lines(id),
  CONSTRAINT fk_parts_independent_quote_source_quote_line FOREIGN KEY (independent_quote_line_id) REFERENCES independent_quote_lines(id),
  CONSTRAINT chk_parts_independent_quote_source_quantity CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
