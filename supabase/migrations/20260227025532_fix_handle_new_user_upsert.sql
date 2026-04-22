-- Supabase migration: fix_handle_new_user_upsert
-- Version: 20260227025532

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$ BEGIN INSERT INTO public.profiles (id, email, full_name, role) VALUES ( NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''), COALESCE(NEW.raw_user_meta_data->>'role', 'student') ) ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = CASE WHEN EXCLUDED.full_name <> '' THEN EXCLUDED.full_name ELSE public.profiles.full_name END; RETURN NEW; END; $$;
