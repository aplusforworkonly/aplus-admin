-- 新增教室位置欄位至 classes 表
-- 格式規範：{樓層數字}{教室代號}，如 1A（一樓 A 教室）、2B（二樓 B 教室）
-- 前端已強制過濾為純英數大寫，可直接以 /^(\d+)([A-Za-z]*)$/ 解析

ALTER TABLE classes ADD COLUMN IF NOT EXISTS location TEXT;
