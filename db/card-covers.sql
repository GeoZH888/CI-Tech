-- ============================================================
-- CI-Tech — card covers (optional AI-generated banner image per project)
-- Run AFTER db/schema.sql + db/ip-studio.sql. Idempotent.
--
-- What this adds:
--   ct_projects.cover_url   optional URL to a wide cover image used as the
--                           project card's banner (replaces the category-
--                           tinted gradient when set). Generated from
--                           /admin/ip-studio "Generate card cover" panel.
--
-- Storage: covers live in the existing 'project-logos' bucket under
-- candidates/covers/ — no new bucket required, no new RLS policies.
-- ============================================================

alter table ct_projects
  add column if not exists cover_url text;
