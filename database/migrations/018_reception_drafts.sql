CREATE TABLE reception_drafts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  revision INT UNSIGNED NOT NULL DEFAULT 1,
  current_step TINYINT UNSIGNED NOT NULL DEFAULT 0,
  payload JSON NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_reception_drafts_user (user_id),
  KEY idx_reception_drafts_updated (updated_at),
  CONSTRAINT fk_reception_drafts_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT chk_reception_drafts_step CHECK (current_step BETWEEN 0 AND 6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
