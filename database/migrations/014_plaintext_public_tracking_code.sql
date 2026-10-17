ALTER TABLE service_orders
  ADD COLUMN public_code VARCHAR(6) NULL AFTER public_code_hash;

UPDATE service_orders
SET public_code = LPAD(FLOOR(RAND() * 1000000), 6, '0')
WHERE public_code IS NULL;

CREATE INDEX idx_service_orders_public_code ON service_orders (public_code);
