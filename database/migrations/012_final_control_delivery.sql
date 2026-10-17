CREATE TABLE order_labor_verifications (
  order_id BIGINT UNSIGNED NOT NULL,
  quote_line_id BIGINT UNSIGNED NOT NULL,
  verified_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  verified_by_user_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (order_id, quote_line_id),
  CONSTRAINT fk_labor_verification_order FOREIGN KEY (order_id) REFERENCES service_orders(id),
  CONSTRAINT fk_labor_verification_line FOREIGN KEY (quote_line_id) REFERENCES quote_lines(id),
  CONSTRAINT fk_labor_verification_user FOREIGN KEY (verified_by_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE order_final_controls (
  order_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  completed_at DATETIME(6) NULL,
  completed_by_user_id BIGINT UNSIGNED NULL,
  published_at DATETIME(6) NULL,
  published_by_user_id BIGINT UNSIGNED NULL,
  publication_channel VARCHAR(80) NULL,
  publication_note VARCHAR(1000) NULL,
  delivered_at DATETIME(6) NULL,
  delivered_by_user_id BIGINT UNSIGNED NULL,
  conformity_acknowledged_at DATETIME(6) NULL,
  CONSTRAINT fk_final_control_order FOREIGN KEY (order_id) REFERENCES service_orders(id),
  CONSTRAINT fk_final_control_completed_by FOREIGN KEY (completed_by_user_id) REFERENCES users(id),
  CONSTRAINT fk_final_control_published_by FOREIGN KEY (published_by_user_id) REFERENCES users(id),
  CONSTRAINT fk_final_control_delivered_by FOREIGN KEY (delivered_by_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
