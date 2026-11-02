-- Independent parts workflow. Existing order_parts remains intact as historical
-- data while new requests can be created before a service order exists.
CREATE TABLE parts_provider_contacts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  provider_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(180) NOT NULL,
  email VARCHAR(254) NULL,
  phone VARCHAR(80) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  KEY idx_provider_contacts_provider (provider_id, active),
  CONSTRAINT fk_parts_provider_contacts_provider FOREIGN KEY (provider_id) REFERENCES parts_providers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE parts_vehicle_profiles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  plate VARCHAR(16) NOT NULL,
  brand VARCHAR(80) NULL,
  model VARCHAR(80) NULL,
  manufacture_year SMALLINT NULL,
  color VARCHAR(60) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_parts_vehicle_profiles_plate (plate)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE part_technicians (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  phone VARCHAR(80) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_part_technicians_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE parts_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  request_number VARCHAR(30) NOT NULL,
  vehicle_profile_id BIGINT UNSIGNED NOT NULL,
  vehicle_id BIGINT UNSIGNED NULL,
  order_id BIGINT UNSIGNED NULL,
  claim_number VARCHAR(60) NULL,
  client_name VARCHAR(180) NULL,
  status ENUM('BORRADOR','ABIERTA','CERRADA','CANCELADA') NOT NULL DEFAULT 'ABIERTA',
  owner_user_id BIGINT UNSIGNED NOT NULL,
  notes TEXT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_parts_requests_number (request_number),
  KEY idx_parts_requests_vehicle (vehicle_profile_id, status, created_at),
  KEY idx_parts_requests_order (order_id),
  CONSTRAINT fk_parts_requests_profile FOREIGN KEY (vehicle_profile_id) REFERENCES parts_vehicle_profiles(id),
  CONSTRAINT fk_parts_requests_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
  CONSTRAINT fk_parts_requests_order FOREIGN KEY (order_id) REFERENCES service_orders(id),
  CONSTRAINT fk_parts_requests_owner FOREIGN KEY (owner_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE parts_request_lines (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  request_id BIGINT UNSIGNED NOT NULL,
  description VARCHAR(500) NOT NULL,
  part_code VARCHAR(120) NULL,
  quantity DECIMAL(12,3) NOT NULL,
  quality ENUM('ORIGINAL','ALTERNATIVO') NOT NULL DEFAULT 'ORIGINAL',
  supply_type ENUM('LOCAL','IMPORTACION') NOT NULL DEFAULT 'LOCAL',
  management_status ENUM('POR_GESTIONAR','PEDIDO','CANCELADO') NOT NULL DEFAULT 'POR_GESTIONAR',
  expected_date DATE NULL,
  provider_id BIGINT UNSIGNED NULL,
  provider_contact_id BIGINT UNSIGNED NULL,
  notes TEXT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  KEY idx_parts_request_lines_request (request_id),
  KEY idx_parts_request_lines_provider (provider_id, expected_date),
  CONSTRAINT fk_parts_request_lines_request FOREIGN KEY (request_id) REFERENCES parts_requests(id),
  CONSTRAINT fk_parts_request_lines_provider FOREIGN KEY (provider_id) REFERENCES parts_providers(id),
  CONSTRAINT fk_parts_request_lines_contact FOREIGN KEY (provider_contact_id) REFERENCES parts_provider_contacts(id),
  CONSTRAINT chk_parts_request_lines_quantity CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE parts_line_movements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  line_id BIGINT UNSIGNED NOT NULL,
  movement_type ENUM('RECEPCION_CONFORME','RECEPCION_DANADO','RECEPCION_EQUIVOCADO','ENTREGA_TECNICO','INSTALACION','DEVOLUCION_TECNICO','DEVOLUCION_PROVEEDOR','REPOSICION','AJUSTE') NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  technician_id BIGINT UNSIGNED NULL,
  related_movement_id BIGINT UNSIGNED NULL,
  reason VARCHAR(1000) NULL,
  registered_by_user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY idx_parts_line_movements_line (line_id, created_at),
  CONSTRAINT fk_parts_line_movements_line FOREIGN KEY (line_id) REFERENCES parts_request_lines(id),
  CONSTRAINT fk_parts_line_movements_technician FOREIGN KEY (technician_id) REFERENCES part_technicians(id),
  CONSTRAINT fk_parts_line_movements_related FOREIGN KEY (related_movement_id) REFERENCES parts_line_movements(id),
  CONSTRAINT fk_parts_line_movements_user FOREIGN KEY (registered_by_user_id) REFERENCES users(id),
  CONSTRAINT chk_parts_line_movements_quantity CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE parts_request_freights (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  request_id BIGINT UNSIGNED NOT NULL,
  provider_id BIGINT UNSIGNED NULL,
  status ENUM('PREVISTO','SOLICITADO','INFORMADO','CANCELADO') NOT NULL DEFAULT 'PREVISTO',
  estimated_amount DECIMAL(14,2) NULL,
  informed_amount DECIMAL(14,2) NULL,
  currency ENUM('PEN','USD') NOT NULL DEFAULT 'PEN',
  reference VARCHAR(180) NULL,
  notes TEXT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY idx_parts_request_freights_request (request_id),
  CONSTRAINT fk_parts_request_freights_request FOREIGN KEY (request_id) REFERENCES parts_requests(id),
  CONSTRAINT fk_parts_request_freights_provider FOREIGN KEY (provider_id) REFERENCES parts_providers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
