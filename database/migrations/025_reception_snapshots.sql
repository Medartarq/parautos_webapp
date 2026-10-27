CREATE TABLE IF NOT EXISTS reception_snapshots (
  reception_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL UNIQUE,
  source ENUM('RECEPTION', 'LEGACY_BASELINE') NOT NULL,
  payload JSON NOT NULL,
  captured_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_reception_snapshot_reception FOREIGN KEY (reception_id) REFERENCES receptions(id),
  CONSTRAINT fk_reception_snapshot_order FOREIGN KEY (order_id) REFERENCES service_orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Existing values cannot reconstruct corrections made before this migration.
-- Keep them as an explicitly identified baseline; never replace a snapshot.
INSERT INTO reception_snapshots (reception_id, order_id, source, payload)
SELECT r.id, o.id, 'LEGACY_BASELINE', JSON_OBJECT(
  'client', c.full_name, 'documentType', c.document_type, 'documentNumber', c.document_number,
  'phone', c.phone, 'email', c.email, 'plate', v.plate, 'brand', v.brand, 'model', v.model,
  'year', v.manufacture_year, 'vin', v.vin, 'color', v.color, 'colorType', v.color_type,
  'bodyCode', bt.code, 'bodyName', bt.name, 'modality', o.modality, 'claimNumber', o.claim_number,
  'advisorName', u.names, 'receivedAt', DATE_FORMAT(r.created_at, '%Y-%m-%dT%H:%i:%s.%fZ')
)
FROM receptions r JOIN service_orders o ON o.id = r.order_id
JOIN client_vehicles cv ON cv.id = o.client_vehicle_id
JOIN clients c ON c.id = cv.client_id JOIN vehicles v ON v.id = cv.vehicle_id
JOIN body_types bt ON bt.id = v.body_type_id LEFT JOIN users u ON u.id = r.advisor_user_id
WHERE NOT EXISTS (SELECT 1 FROM reception_snapshots s WHERE s.reception_id = r.id);
