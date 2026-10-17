ALTER TABLE order_parts ADD COLUMN partial_received TINYINT(1) NOT NULL DEFAULT 0 AFTER received_quantity;
UPDATE order_parts SET partial_received = 1 WHERE received_quantity > 0 AND received_quantity < quantity;
