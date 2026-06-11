-- ============================================================
-- seed-schedules.sql — 2026 暑期課表完整種子資料
-- ============================================================
-- 使用方式：直接在 Supabase SQL Editor 執行此檔案
--
-- 技術說明：
--   透過 course_id LIKE '前8碼%' 動態查找 class.id，
--   不需要預先知道完整 UUID，避免因手填錯誤導致 FK 失敗。
--
-- 設計說明：
--   營隊（化石/玩具/美學/自然）：週一–週四（day_of_week 1–4），14:00–16:00
--   下午基本課程：週一–週四（day_of_week 1–4），14:00–16:00
--   （週五為戶外教學，下午基本不排課）
--
-- day_of_week 對照（JS/PostgreSQL 標準）：
--   1=週一  2=週二  3=週三  4=週四  5=週五
-- ============================================================

INSERT INTO class_schedules (class_id, day_of_week, start_time, end_time, valid_from, valid_until)

-- ── Block 1：化石生態營 (7/6–7/16，週一–週四) ─────────────────
-- course_id 前綴：1d280794
SELECT c.id, d, '14:00:00'::time, '16:00:00'::time, '2026-07-06'::date, '2026-07-16'::date
FROM classes c, generate_series(1, 4) AS d
WHERE c.course_id::text LIKE '1d280794%' AND c.status = 'active'

UNION ALL

-- ── Block 1：7/6–7/16 下午基本 (7/6–7/16，週一–週四) ──────────
-- course_id 前綴：c81e36ea
SELECT c.id, d, '14:00:00'::time, '16:00:00'::time, '2026-07-06'::date, '2026-07-16'::date
FROM classes c, generate_series(1, 4) AS d
WHERE c.course_id::text LIKE 'c81e36ea%' AND c.status = 'active'

UNION ALL

-- ── Block 2：玩具製作營 (7/20–7/30，週一–週四) ───────────────
-- course_id 前綴：90cee8c0
SELECT c.id, d, '14:00:00'::time, '16:00:00'::time, '2026-07-20'::date, '2026-07-30'::date
FROM classes c, generate_series(1, 4) AS d
WHERE c.course_id::text LIKE '90cee8c0%' AND c.status = 'active'

UNION ALL

-- ── Block 2：7/20–7/30 下午基本 (7/20–7/30，週一–週四) ────────
-- course_id 前綴：1d37b359
SELECT c.id, d, '14:00:00'::time, '16:00:00'::time, '2026-07-20'::date, '2026-07-30'::date
FROM classes c, generate_series(1, 4) AS d
WHERE c.course_id::text LIKE '1d37b359%' AND c.status = 'active'

UNION ALL

-- ── Block 3：美學手作營 (8/3–8/13，週一–週四) ────────────────
-- course_id 前綴：28816edf
SELECT c.id, d, '14:00:00'::time, '16:00:00'::time, '2026-08-03'::date, '2026-08-13'::date
FROM classes c, generate_series(1, 4) AS d
WHERE c.course_id::text LIKE '28816edf%' AND c.status = 'active'

UNION ALL

-- ── Block 3：8/3–8/13 下午基本 (8/3–8/13，週一–週四) ─────────
-- course_id 前綴：d2397c23
SELECT c.id, d, '14:00:00'::time, '16:00:00'::time, '2026-08-03'::date, '2026-08-13'::date
FROM classes c, generate_series(1, 4) AS d
WHERE c.course_id::text LIKE 'd2397c23%' AND c.status = 'active'

UNION ALL

-- ── Block 4：自然電路營 (8/17–8/27，週一–週四) ───────────────
-- course_id 前綴：32c71c52
SELECT c.id, d, '14:00:00'::time, '16:00:00'::time, '2026-08-17'::date, '2026-08-27'::date
FROM classes c, generate_series(1, 4) AS d
WHERE c.course_id::text LIKE '32c71c52%' AND c.status = 'active'

UNION ALL

-- ── Block 4：8/17–8/27 下午基本 (8/17–8/27，週一–週四) ────────
-- course_id 前綴：bb7f9768
SELECT c.id, d, '14:00:00'::time, '16:00:00'::time, '2026-08-17'::date, '2026-08-27'::date
FROM classes c, generate_series(1, 4) AS d
WHERE c.course_id::text LIKE 'bb7f9768%' AND c.status = 'active';

-- ── 執行前預覽（確認能撈到資料再 INSERT）────────────────────
-- SELECT c.id, c.name, c.campus, c.course_id::text
-- FROM classes c
-- WHERE c.course_id::text LIKE '1d280794%' AND c.status = 'active';

-- ── 執行後驗證 ────────────────────────────────────────────────
-- SELECT COUNT(*) FROM class_schedules;
-- 預期：320 筆（營隊 40班×4天=160 + 下午基本 40班×4天=160）
--
-- 測試 RPC（取 7/7 週二的行政總覽）：
-- SELECT * FROM get_admin_daily_schedule('2026-07-07');
