-- 既存ユーザーの保持上限を5未満の場合は5に更新
UPDATE owners SET keep_limit = 5 WHERE keep_limit < 5;
