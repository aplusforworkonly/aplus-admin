-- 新增上半日 / 下半日獨立欄位
ALTER TABLE students
  ADD COLUMN half_day_am_dates TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN half_day_pm_dates TEXT[] NOT NULL DEFAULT '{}';

-- 將現有資料全數遷移至 AM 欄位（歷史資料無法確認 AM/PM，預設視為上半日）
UPDATE students
  SET half_day_am_dates = half_day_dates
  WHERE half_day_dates <> '{}';

-- 移除舊欄位
ALTER TABLE students DROP COLUMN half_day_dates;
