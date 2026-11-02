ALTER TABLE parts_line_movements
  ADD COLUMN receipt_condition ENUM('CONFORME','DANADO','EQUIVOCADO') NULL AFTER movement_type,
  ADD COLUMN location VARCHAR(180) NULL AFTER reason;
