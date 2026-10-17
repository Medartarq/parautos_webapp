ALTER TABLE service_orders
  ADD COLUMN diagnosis_pending_reminder TINYINT(1) NOT NULL DEFAULT 0
  AFTER claim_pending_reminder,
  ADD CONSTRAINT chk_service_orders_diagnosis_reminder CHECK (diagnosis_pending_reminder IN (0, 1));
