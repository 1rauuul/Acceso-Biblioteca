-- Enable Row Level Security on all public tables.
-- We do NOT create policies: the app uses Prisma with a privileged role
-- (BYPASSRLS), so this effectively blocks any access from the public
-- PostgREST / anon-key API surface that Supabase exposes automatically.

ALTER TABLE "public"."students" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."access_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."survey_responses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."admin_users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."_prisma_migrations" ENABLE ROW LEVEL SECURITY;
