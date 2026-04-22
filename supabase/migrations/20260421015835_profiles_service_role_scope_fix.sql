-- Supabase migration: profiles_service_role_scope_fix
-- Version: 20260421015835

DROP POLICY IF EXISTS "Service role full access" ON public.profiles;
CREATE POLICY "profiles_service_role_full" ON public.profiles
AS PERMISSIVE FOR ALL TO service_role
USING (true) WITH CHECK (true);
