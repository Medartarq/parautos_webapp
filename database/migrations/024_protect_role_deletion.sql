-- Trigger: impedir eliminar un rol que tenga usuarios asignados
DROP TRIGGER IF EXISTS trg_roles_before_delete;

CREATE TRIGGER trg_roles_before_delete BEFORE DELETE ON roles FOR EACH ROW
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE role_id = OLD.id LIMIT 1) THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'No se puede eliminar el rol porque tiene usuarios asignados.';
  END IF;
END;
