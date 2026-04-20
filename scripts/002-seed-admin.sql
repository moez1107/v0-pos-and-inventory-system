-- Seed Admin User
-- Username: moez rehman
-- Email: moezrehman@am.com
-- Password: Mezu@1105 (hashed with bcrypt)

INSERT INTO users (username, email, password_hash, role, is_active, created_at, updated_at)
VALUES (
  'moez rehman',
  'moezrehman@am.com',
  '$2b$10$8K1p/a0dL1LXMIgoEDFrOOemVGLqXXADg6h.Hh1d9CvJN7fVrJK1W', -- Mezu@1105
  'admin',
  TRUE,
  NOW(),
  NOW()
)
ON DUPLICATE KEY UPDATE 
  username = VALUES(username),
  password_hash = VALUES(password_hash),
  role = VALUES(role),
  is_active = VALUES(is_active),
  updated_at = NOW();

-- Add default business settings
INSERT INTO settings (setting_key, setting_value, created_at, updated_at)
VALUES 
  ('business_name', 'My Business', NOW(), NOW()),
  ('business_address', '', NOW(), NOW()),
  ('business_phone', '', NOW(), NOW()),
  ('business_email', 'moezrehman@am.com', NOW(), NOW()),
  ('currency', 'PKR', NOW(), NOW()),
  ('tax_rate', '0', NOW(), NOW()),
  ('receipt_header', 'Thank you for shopping with us!', NOW(), NOW()),
  ('receipt_footer', 'Please visit again!', NOW(), NOW()),
  ('default_printer', 'thermal', NOW(), NOW()),
  ('thermal_width', '80', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();
