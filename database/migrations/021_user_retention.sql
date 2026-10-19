ALTER TABLE users
  ADD COLUMN deactivated_at DATETIME(6) NULL AFTER active,
  ADD COLUMN anonymized_at DATETIME(6) NULL AFTER deactivated_at;
