-- Supabase migration: enable_rls_all_tables
-- Version: 20260226191601

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access for postgres role" ON users FOR ALL TO postgres USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access for postgres role" ON courses FOR ALL TO postgres USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access for postgres role" ON modules FOR ALL TO postgres USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access for postgres role" ON chapters FOR ALL TO postgres USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access for postgres role" ON enrollments FOR ALL TO postgres USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access for postgres role" ON files FOR ALL TO postgres USING (true) WITH CHECK (true);
