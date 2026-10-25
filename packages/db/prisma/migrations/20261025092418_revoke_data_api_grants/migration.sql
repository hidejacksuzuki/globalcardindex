-- Supabase Data API（PostgREST / GraphQL）用ロールから public スキーマの権限を外す。
--
-- 背景（2026-10-25）:
--   Supabase は 2026-10-30 から、public に新規作成するテーブルを anon /
--   authenticated に自動 GRANT しない仕様に変わる。GCI のアプリは Prisma で
--   postgres ロール（全テーブルの所有者）として直結しており、Data API・
--   supabase-js・Supabase Auth はどれも使っていない。そのため anon /
--   authenticated の権限と anon 向け SELECT ポリシーは不要な露出でしかない。
--   所有者 postgres の権限・RLS（全テーブル有効）・service_role は変更しない。
--
-- 今後のテーブル作成ルール:
--   CREATE TABLE と同じ migration で ENABLE ROW LEVEL SECURITY を行い、
--   anon / authenticated には GRANT しない（Prisma 用の GRANT も不要）。
--
-- 冪等: 何度実行しても同じ結果になる。

-- 1) 既存テーブル: Data API 用ロールの権限を外す
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- 2) 使われていない anon 読み取りポリシーを削除
--    （本番とファイル 20260701000000_enable_rls で名前が異なるため両方の名前を対象）
DROP POLICY IF EXISTS "anon_read_cards"        ON "Card";
DROP POLICY IF EXISTS "anon_read_prices"       ON "Price";
DROP POLICY IF EXISTS "anon_read_index"        ON "IndexValue";
DROP POLICY IF EXISTS "anon_read_index_values" ON "IndexValue";
DROP POLICY IF EXISTS "anon_read_recap"        ON "DailyRecapSnapshot";
DROP POLICY IF EXISTS "anon_read_daily_recap"  ON "DailyRecapSnapshot";

-- 3) 今後 postgres が作るテーブル等にも自動で付与しない
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

-- ─── 元に戻す場合（ロールバック用・通常は実行しない） ───────────────────────
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
-- CREATE POLICY "anon_read_cards"  ON "Card"               FOR SELECT TO anon USING (true);
-- CREATE POLICY "anon_read_prices" ON "Price"              FOR SELECT TO anon USING (true);
-- CREATE POLICY "anon_read_index"  ON "IndexValue"         FOR SELECT TO anon USING (true);
-- CREATE POLICY "anon_read_recap"  ON "DailyRecapSnapshot" FOR SELECT TO anon USING (true);
-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES    TO anon, authenticated;
-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated;
