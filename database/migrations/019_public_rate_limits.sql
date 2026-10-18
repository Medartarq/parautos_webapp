CREATE TABLE api_rate_limits (
  scope VARCHAR(80) NOT NULL,
  client_key_hash CHAR(64) NOT NULL,
  window_started_at DATETIME(6) NOT NULL,
  attempts SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (scope, client_key_hash),
  KEY idx_api_rate_limits_expiry (window_started_at)
) ENGINE=InnoDB;
