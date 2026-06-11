-- ============================================================
-- class_schedules — 班級排課時間表
-- ============================================================
-- day_of_week 嚴格對齊 JS/PostgreSQL 國際標準：
--   0 = 週日 (Sunday)
--   1 = 週一 (Monday)
--   2 = 週二 (Tuesday)
--   3 = 週三 (Wednesday)
--   4 = 週四 (Thursday)
--   5 = 週五 (Friday)
--   6 = 週六 (Saturday)
--
-- valid_from / valid_until：
--   NULL = 無日期限制（常規課程由前端用 enrollment 日期判斷）
--   有值 = 僅在此範圍內生效（如暑期主題營隊的特定週次）

CREATE TABLE IF NOT EXISTS class_schedules (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id     uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  day_of_week  int  NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time   time NOT NULL,
  end_time     time NOT NULL,
  valid_from   date,
  valid_until  date,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_class_schedules_class_id    ON class_schedules(class_id);
CREATE INDEX IF NOT EXISTS idx_class_schedules_day_of_week ON class_schedules(day_of_week);

-- ============================================================
-- RPC: get_admin_daily_schedule
-- 取得某日所有有排課的班級（行政總覽用）
-- 使用子查詢計算人數、(cs.valid_from IS NULL OR...) 過濾日期
-- 避免直接 JOIN enrollments 造成資料列倍增
-- ============================================================

CREATE OR REPLACE FUNCTION get_admin_daily_schedule(p_date date)
RETURNS TABLE (
  class_id        uuid,
  class_name      text,
  course_name     text,
  campus          text,
  start_time      time,
  end_time        time,
  enrolled_count  bigint
) LANGUAGE sql STABLE AS $$
  SELECT
    c.id,
    c.name,
    co.name,
    c.campus::text,
    cs.start_time,
    cs.end_time,
    (SELECT COUNT(*) FROM class_students cs2
     WHERE cs2.class_id = c.id) AS enrolled_count
  FROM class_schedules cs
  JOIN classes  c  ON c.id  = cs.class_id AND c.status = 'active'
  JOIN courses  co ON co.id = c.course_id
  WHERE
    cs.day_of_week = EXTRACT(DOW FROM p_date)::int
    AND (cs.valid_from  IS NULL OR cs.valid_from  <= p_date)
    AND (cs.valid_until IS NULL OR cs.valid_until >= p_date)
  ORDER BY cs.start_time, c.name;
$$;
