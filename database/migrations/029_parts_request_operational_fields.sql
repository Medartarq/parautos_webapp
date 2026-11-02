ALTER TABLE parts_requests
  ADD COLUMN insurer VARCHAR(120) NULL AFTER claim_number,
  ADD COLUMN client_document VARCHAR(30) NULL AFTER client_name,
  ADD COLUMN client_phone VARCHAR(80) NULL AFTER client_document,
  ADD COLUMN expansion_required TINYINT(1) NOT NULL DEFAULT 0 AFTER client_phone,
  ADD COLUMN additional_data TEXT NULL AFTER notes;

ALTER TABLE parts_request_lines
  ADD COLUMN provider_name VARCHAR(180) NULL AFTER provider_contact_id,
  ADD COLUMN provider_contact VARCHAR(180) NULL AFTER provider_name,
  ADD COLUMN provider_email VARCHAR(254) NULL AFTER provider_contact,
  ADD COLUMN provider_phone VARCHAR(80) NULL AFTER provider_email;

UPDATE parts_request_lines l
LEFT JOIN parts_providers p ON p.id = l.provider_id
LEFT JOIN parts_provider_contacts c ON c.id = l.provider_contact_id
SET l.provider_name = p.name,
    l.provider_contact = c.name,
    l.provider_email = c.email,
    l.provider_phone = c.phone
WHERE l.provider_id IS NOT NULL;
