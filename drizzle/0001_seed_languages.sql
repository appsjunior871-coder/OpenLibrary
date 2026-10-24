-- Initial reading languages. Administrators can enable/disable them from the admin area.
INSERT INTO "languages" ("code", "name", "native_name", "direction", "is_active", "supports_translation", "supports_summary", "sort_order")
VALUES
  ('fr', 'Français',  'Français',  'ltr', true, true, true, 1),
  ('en', 'Anglais',   'English',   'ltr', true, true, true, 2),
  ('es', 'Espagnol',  'Español',   'ltr', true, true, true, 3),
  ('ar', 'Arabe',     'العربية',   'rtl', true, true, true, 4),
  ('pt', 'Portugais', 'Português', 'ltr', true, true, true, 5)
ON CONFLICT ("code") DO NOTHING;
