INSERT INTO roles (code, name, description)
VALUES ('SUPERADMINISTRADOR', 'Superadministrador', 'Acceso total y administración exclusiva de cuentas.')
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), active = 1;

INSERT INTO audit_events (actor_user_id, entity, record_id, action, new_data)
SELECT NULL, 'user', CAST(u.id AS CHAR), 'ROLE_MIGRATED_TO_SUPERADMINISTRADOR', JSON_OBJECT('previousRole', 'ADMINISTRADOR', 'newRole', 'SUPERADMINISTRADOR')
FROM users u
JOIN roles existing_role ON existing_role.id = u.role_id AND existing_role.code = 'ADMINISTRADOR'
WHERE NOT EXISTS (
  SELECT 1 FROM audit_events ae
  WHERE ae.entity = 'user' AND ae.record_id = CAST(u.id AS CHAR) AND ae.action = 'ROLE_MIGRATED_TO_SUPERADMINISTRADOR'
);

UPDATE users u
JOIN roles existing_role ON existing_role.id = u.role_id AND existing_role.code = 'ADMINISTRADOR'
JOIN roles superadmin_role ON superadmin_role.code = 'SUPERADMINISTRADOR'
SET u.role_id = superadmin_role.id;
