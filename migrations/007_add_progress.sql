-- 進行中ステータスの進捗率を管理するカラムを追加
ALTER TABLE letters ADD COLUMN progress INTEGER DEFAULT 0 CHECK(progress >= 0 AND progress <= 100);

-- 既存の進行中レコードは0%でスタート
UPDATE letters SET progress = 0 WHERE status = '進行中' AND progress IS NULL;
