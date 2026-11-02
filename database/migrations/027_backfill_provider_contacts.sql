-- Preserve the contact details from the original supplier catalog in the
-- normalized contacts table introduced with independent parts requests.
INSERT INTO parts_provider_contacts (provider_id, name, email, phone)
SELECT id, COALESCE(NULLIF(contact_name, ''), name), NULLIF(email, ''), NULLIF(phone, '')
FROM parts_providers
WHERE contact_name IS NOT NULL OR email IS NOT NULL OR phone IS NOT NULL;
