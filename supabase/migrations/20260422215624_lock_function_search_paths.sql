-- Supabase migration: lock_function_search_paths
-- Version: 20260422215624

ALTER FUNCTION public.update_updated_at() SET search_path = pg_catalog, public;
ALTER FUNCTION public.courses_search_vector_update() SET search_path = pg_catalog, public;
ALTER FUNCTION public.custom_access_token_hook(event jsonb) SET search_path = pg_catalog, public;
