CREATE TABLE parts_providers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  contact_name VARCHAR(180) NULL,
  email VARCHAR(254) NULL,
  phone VARCHAR(50) NULL,
  brands JSON NOT NULL,
  qualities JSON NOT NULL,
  lead_time_days VARCHAR(40) NULL,
  freight_available TINYINT(1) NOT NULL DEFAULT 0,
  coverage VARCHAR(255) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_parts_providers_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE order_parts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  quote_line_id BIGINT UNSIGNED NOT NULL,
  description VARCHAR(500) NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  received_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
  management_status ENUM('POR_GESTIONAR', 'PEDIDO', 'EN_TALLER') NOT NULL DEFAULT 'POR_GESTIONAR',
  quality ENUM('ORIGINAL', 'ALTERNATIVO') NOT NULL DEFAULT 'ORIGINAL',
  part_code VARCHAR(120) NULL,
  expected_date DATE NULL,
  provider_id BIGINT UNSIGNED NULL,
  provider_name VARCHAR(180) NULL,
  provider_contact VARCHAR(180) NULL,
  provider_email VARCHAR(254) NULL,
  provider_phone VARCHAR(50) NULL,
  notes TEXT NULL,
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_order_parts_quote_line (quote_line_id),
  KEY idx_order_parts_order (order_id),
  KEY idx_order_parts_status (management_status, expected_date),
  CONSTRAINT fk_order_parts_order FOREIGN KEY (order_id) REFERENCES service_orders(id),
  CONSTRAINT fk_order_parts_quote_line FOREIGN KEY (quote_line_id) REFERENCES quote_lines(id),
  CONSTRAINT fk_order_parts_provider FOREIGN KEY (provider_id) REFERENCES parts_providers(id),
  CONSTRAINT chk_order_parts_quantity CHECK (quantity > 0),
  CONSTRAINT chk_order_parts_received CHECK (received_quantity >= 0 AND received_quantity <= quantity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE order_parts_logistics (
  order_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  freight_requested TINYINT(1) NOT NULL DEFAULT 0,
  freight_amount DECIMAL(14,2) NULL,
  freight_payment ENUM('PENDIENTE', 'PARCIAL', 'PAGADO') NOT NULL DEFAULT 'PENDIENTE',
  expansion_required TINYINT(1) NOT NULL DEFAULT 0,
  owner VARCHAR(180) NULL,
  notes TEXT NULL,
  CONSTRAINT fk_order_parts_logistics_order FOREIGN KEY (order_id) REFERENCES service_orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO parts_providers (name, contact_name, email, phone, brands, qualities, lead_time_days, freight_available, coverage) VALUES
('ALESE - Julio Núñez', 'Julio Núñez', 'jnunez@aleseperu.com', '986717676', JSON_ARRAY('KIA', 'MG', 'PEUGEOT'), JSON_ARRAY('ORIGINAL'), '3', 1, 'Todas'),
('ALT Import - Mijael', 'Mijael Berrocal', 'mberrocal@altimport.com.pe', '940330526', JSON_ARRAY('AUDI', 'CHANGAN', 'JAC', 'JEEP', 'MAZDA', 'MERCEDES BENZ'), JSON_ARRAY('ORIGINAL'), '4', 1, 'Nacional'),
('ALP Competición', 'Carlos Fernández Dávila', 'Alprepuestos@gmail.com', '94934392', JSON_ARRAY('AUDI', 'BMW', 'JEEP', 'MERCEDES BENZ'), JSON_ARRAY('ORIGINAL', 'ALTERNATIVO'), '2', 1, 'Arequipa'),
('Repuestos Multimarca Norte', 'Atención de repuestos', NULL, '944000001', JSON_ARRAY('TOYOTA', 'NISSAN', 'HYUNDAI', 'MAZDA', 'MITSUBISHI', 'SUBARU'), JSON_ARRAY('ORIGINAL', 'ALTERNATIVO'), '2 a 5', 1, 'Trujillo')
ON DUPLICATE KEY UPDATE name = VALUES(name);
