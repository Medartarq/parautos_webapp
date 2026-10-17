INSERT INTO order_parts (order_id, quote_line_id, description, quantity)
SELECT q.order_id, l.id, l.description, l.quantity
FROM quote_versions q
JOIN quote_lines l ON l.quote_version_id = q.id
LEFT JOIN order_parts p ON p.quote_line_id = l.id
WHERE q.status = 'APROBADA' AND l.line_type = 'REPUESTO' AND p.id IS NULL;
