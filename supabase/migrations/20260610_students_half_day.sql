-- 新增學生半日班設定欄位（2026 暑假）
ALTER TABLE students
  ADD COLUMN july_half_day       TEXT NOT NULL DEFAULT 'none'
    CHECK (july_half_day IN ('none', 'full_month', 'full_month_meal')),
  ADD COLUMN august_half_day     TEXT NOT NULL DEFAULT 'none'
    CHECK (august_half_day IN ('none', 'full_month', 'full_month_meal')),
  ADD COLUMN half_day_dates      TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN half_day_meal_dates TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN students.july_half_day       IS '7月整月半日設定：none / full_month（不含餐）/ full_month_meal（含餐）';
COMMENT ON COLUMN students.august_half_day     IS '8月整月半日設定：none / full_month（不含餐）/ full_month_meal（含餐）';
COMMENT ON COLUMN students.half_day_dates      IS '特定半日日期（不含餐），含餐日期也必須包含在此陣列中';
COMMENT ON COLUMN students.half_day_meal_dates IS '特定半日含餐日期，必須是 half_day_dates 的子集';
