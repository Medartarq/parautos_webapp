ALTER TABLE service_orders
  MODIFY COLUMN public_code_hash CHAR(64) NULL;

DROP INDEX idx_service_orders_public_code_hash ON service_orders;
