-- Tabla de referencia: transiciones válidas de estado de orden
CREATE TABLE IF NOT EXISTS order_status_transitions (
  from_status VARCHAR(50) NOT NULL,
  to_status VARCHAR(50) NOT NULL,
  PRIMARY KEY (from_status, to_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO order_status_transitions (from_status, to_status) VALUES
  ('COTIZACION_PENDIENTE', 'ESPERA_APROBACION'),
  ('COTIZACION_PENDIENTE', 'ENTREGADA'),
  ('COTIZACION_PENDIENTE', 'CANCELADA'),
  ('ESPERA_APROBACION', 'ESPERA_REPUESTOS'),
  ('ESPERA_APROBACION', 'EN_REPARACION'),
  ('ESPERA_APROBACION', 'CANCELADA'),
  ('EN_REPARACION', 'LISTA_PARA_ENTREGA'),
  ('EN_REPARACION', 'CANCELADA'),
  ('ESPERA_REPUESTOS', 'EN_REPARACION'),
  ('ESPERA_REPUESTOS', 'CANCELADA'),
  ('LISTA_PARA_ENTREGA', 'ENTREGADA'),
  ('LISTA_PARA_ENTREGA', 'EN_REPARACION'),
  ('LISTA_PARA_ENTREGA', 'CANCELADA');

-- Trigger: impedir transiciones de internal_status no permitidas
DROP TRIGGER IF EXISTS trg_service_orders_internal_status_before_update;
CREATE TRIGGER trg_service_orders_internal_status_before_update BEFORE UPDATE ON service_orders FOR EACH ROW BEGIN IF NEW.internal_status IS NOT NULL AND NEW.internal_status <> OLD.internal_status THEN IF NOT EXISTS (SELECT 1 FROM order_status_transitions WHERE from_status = OLD.internal_status AND to_status = NEW.internal_status) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Transicion de estado de orden no permitida'; END IF; END IF; END;

-- Trigger: impedir transiciones de public_status no permitidas
DROP TRIGGER IF EXISTS trg_service_orders_public_status_before_update;
CREATE TRIGGER trg_service_orders_public_status_before_update BEFORE UPDATE ON service_orders FOR EACH ROW BEGIN IF NEW.public_status IS NOT NULL AND NEW.public_status <> OLD.public_status THEN IF NOT EXISTS (SELECT 1 FROM order_status_transitions WHERE from_status = OLD.public_status AND to_status = NEW.public_status) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Transicion de estado publico de orden no permitida'; END IF; END IF; END;
