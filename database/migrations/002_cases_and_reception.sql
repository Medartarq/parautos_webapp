CREATE TABLE body_types (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(10) NOT NULL UNIQUE,
  name VARCHAR(80) NOT NULL UNIQUE,
  active TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT chk_body_types_active CHECK (active IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO body_types (code, name) VALUES
  ('V1', 'Camion furgon'), ('V2', 'Camioneta pickup'), ('V3', 'Automovil sedan'), ('V4', 'Camioneta SUV');

CREATE TABLE clients (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  document_type ENUM('DNI', 'RUC') NOT NULL,
  document_number VARCHAR(20) NOT NULL,
  full_name VARCHAR(160) NOT NULL,
  phone VARCHAR(20) NULL,
  email VARCHAR(150) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_clients_document (document_type, document_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE vehicles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  plate VARCHAR(12) NOT NULL,
  brand VARCHAR(80) NOT NULL,
  model VARCHAR(80) NOT NULL,
  manufacture_year SMALLINT NULL,
  vin VARCHAR(17) NULL,
  color VARCHAR(60) NOT NULL,
  color_type ENUM('CATALOGO', 'PERSONALIZADO') NOT NULL DEFAULT 'CATALOGO',
  body_type_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_vehicles_plate (plate),
  UNIQUE KEY uq_vehicles_vin (vin),
  CONSTRAINT fk_vehicles_body_type FOREIGN KEY (body_type_id) REFERENCES body_types(id),
  CONSTRAINT chk_vehicles_year CHECK (manufacture_year IS NULL OR manufacture_year BETWEEN 1900 AND 2099)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE client_vehicles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  client_id BIGINT UNSIGNED NOT NULL,
  vehicle_id BIGINT UNSIGNED NOT NULL,
  UNIQUE KEY uq_client_vehicles (client_id, vehicle_id),
  CONSTRAINT fk_client_vehicles_client FOREIGN KEY (client_id) REFERENCES clients(id),
  CONSTRAINT fk_client_vehicles_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE service_orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_number VARCHAR(30) NULL,
  public_code_hash CHAR(64) NOT NULL,
  client_vehicle_id BIGINT UNSIGNED NOT NULL,
  advisor_user_id BIGINT UNSIGNED NOT NULL,
  modality ENUM('PARTICULAR', 'PACIFICO', 'MAPFRE', 'LA_POSITIVA', 'RIMAC') NOT NULL,
  claim_number VARCHAR(60) NULL,
  claim_pending_reminder TINYINT(1) NOT NULL DEFAULT 0,
  internal_status ENUM('COTIZACION_PENDIENTE', 'ESPERA_APROBACION', 'ESPERA_REPUESTOS', 'EN_REPARACION', 'LISTA_PARA_ENTREGA', 'ENTREGADA', 'CANCELADA') NOT NULL DEFAULT 'COTIZACION_PENDIENTE',
  public_status ENUM('COTIZACION_PENDIENTE', 'ESPERA_APROBACION', 'ESPERA_REPUESTOS', 'EN_REPARACION', 'LISTA_PARA_ENTREGA', 'ENTREGADA', 'CANCELADA') NOT NULL DEFAULT 'COTIZACION_PENDIENTE',
  version INT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY idx_service_orders_status (internal_status, created_at),
  KEY idx_service_orders_advisor (advisor_user_id, created_at),
  CONSTRAINT fk_service_orders_client_vehicle FOREIGN KEY (client_vehicle_id) REFERENCES client_vehicles(id),
  CONSTRAINT fk_service_orders_advisor FOREIGN KEY (advisor_user_id) REFERENCES users(id),
  CONSTRAINT chk_service_orders_claim CHECK ((claim_pending_reminder = 0) OR claim_number IS NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE receptions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  advisor_user_id BIGINT UNSIGNED NOT NULL,
  mileage INT UNSIGNED NULL,
  fuel_level TINYINT UNSIGNED NULL,
  considerations JSON NULL,
  observations TEXT NULL,
  accepted_terms TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_receptions_order (order_id),
  CONSTRAINT fk_receptions_order FOREIGN KEY (order_id) REFERENCES service_orders(id),
  CONSTRAINT fk_receptions_advisor FOREIGN KEY (advisor_user_id) REFERENCES users(id),
  CONSTRAINT chk_receptions_fuel CHECK (fuel_level IS NULL OR fuel_level IN (0, 25, 50, 75, 100)),
  CONSTRAINT chk_receptions_terms CHECK (accepted_terms IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE checklist_categories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  display_order SMALLINT UNSIGNED NOT NULL UNIQUE,
  active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE checklist_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  category_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  display_order SMALLINT UNSIGNED NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_checklist_item (category_id, name),
  CONSTRAINT fk_checklist_items_category FOREIGN KEY (category_id) REFERENCES checklist_categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE checklist_answers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  reception_id BIGINT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  answer ENUM('SI', 'NO') NOT NULL,
  observation VARCHAR(300) NULL,
  UNIQUE KEY uq_checklist_answers (reception_id, item_id),
  CONSTRAINT fk_checklist_answers_reception FOREIGN KEY (reception_id) REFERENCES receptions(id),
  CONSTRAINT fk_checklist_answers_item FOREIGN KEY (item_id) REFERENCES checklist_items(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO checklist_categories (name, display_order) VALUES
  ('Exterior e iluminación', 1), ('Interior y equipamiento', 2), ('Accesorios, herramientas y seguridad', 3), ('Documentos y adicionales', 4);

INSERT INTO checklist_items (category_id, name, display_order) VALUES
  (1,'Emblema delantero',1),(1,'Emblema posterior',2),(1,'Antena de radio',3),(1,'Antena Motorola',4),(1,'Espejo interior',5),(1,'Espejos exteriores',6),(1,'Faros delanteros',7),(1,'Faros neblineros',8),(1,'Faros posteriores',9),(1,'Plumillas delanteras',10),(1,'Plumillas posteriores',11),
  (2,'Radio',1),(2,'Claxon',2),(2,'Lunas',3),(2,'Encendedor',4),(2,'Cenicero',5),(2,'Control de radio',6),(2,'Máscara de radio',7),(2,'Asientos',8),(2,'Alfombras/Pisos',9),(2,'Control de puerta',10),(2,'Alarma',11),
  (3,'Llavero/Llave',1),(3,'Tapas de combustible',2),(3,'Aros',3),(3,'Tapas de aros',4),(3,'Llave de ruedas',5),(3,'Rueda de repuesto',6),(3,'Herramientas',7),(3,'Gata/Palanca',8),(3,'Botiquín',9),(3,'Extintor',10),(3,'Bloqueador/Trabagas',11),
  (4,'Triángulo',1),(4,'Circulina',2),(4,'Escarpines',3),(4,'Tarjeta de propiedad',4),(4,'SOAT',5),(4,'Inspección técnica',6),(4,'Libreta de servicio',7),(4,'Manual del propietario',8),(4,'Permiso de lunas polarizadas',9),(4,'Seguro de ruedas',10),(4,'Seguro de vasos',11);
