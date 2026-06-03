-- ============================================================
-- STEP 1: ENUM 型別（必須放最前面，其他表建立時才能引用）
-- ============================================================

CREATE TYPE frequency_type  AS ENUM ('daily', 'weekly', 'monthly');
CREATE TYPE task_type       AS ENUM ('project', 'routine', 'adhoc');
CREATE TYPE task_source     AS ENUM ('manual', 'leave_request', 'student_request', 'student_review', 'routine');
CREATE TYPE task_priority   AS ENUM ('urgent', 'normal', 'low');
CREATE TYPE task_size       AS ENUM ('S', 'M', 'L');
CREATE TYPE task_status     AS ENUM ('pending', 'in_progress', 'completed', 'overdue');

-- ============================================================
-- STEP 2: updated_at 自動更新 trigger function
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- STEP 3: routine_definitions（例行性任務範本）
-- ============================================================

CREATE TABLE routine_definitions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  description     text,
  frequency_type  frequency_type NOT NULL,
  -- weekly: 1=一 2=二 3=三 4=四 5=五 6=六 7=日；monthly: 1–31；daily: NULL
  frequency_value int,
  -- 提前幾天產生任務實例（0 = 當天）
  advance_days    int NOT NULL DEFAULT 0,
  campus          text[],
  assigned_to     uuid REFERENCES teachers(id) ON DELETE SET NULL,
  size            task_size    DEFAULT 'S',
  priority        task_priority DEFAULT 'normal',
  is_active       boolean NOT NULL DEFAULT true,
  created_by      uuid REFERENCES teachers(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- STEP 4: admin_tasks（所有任務實例）
-- ============================================================

CREATE TABLE admin_tasks (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 text NOT NULL,
  description           text,
  task_type             task_type     NOT NULL DEFAULT 'adhoc',
  task_source           task_source   NOT NULL DEFAULT 'manual',
  -- 關聯的審核單 ID（leave_requests / student_requests / student_review_requests）
  source_id             uuid,
  -- 子任務關係：指向上層 admin_tasks.id
  parent_id             uuid REFERENCES admin_tasks(id) ON DELETE CASCADE,
  -- 例行任務來源範本
  routine_definition_id uuid REFERENCES routine_definitions(id) ON DELETE SET NULL,
  assigned_to           uuid REFERENCES teachers(id) ON DELETE SET NULL,
  campus                text[],
  priority              task_priority NOT NULL DEFAULT 'normal',
  size                  task_size     DEFAULT 'S',
  status                task_status   NOT NULL DEFAULT 'pending',
  due_date              date,
  completed_at          timestamptz,
  created_by            uuid REFERENCES teachers(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  -- 防止同一範本在同一天重複產生實例
  -- PostgreSQL: NULL 不互相衝突，所以 manual 任務的 routine_definition_id=NULL 不受此限制
  CONSTRAINT uq_routine_per_day UNIQUE (routine_definition_id, due_date)
);

-- updated_at 自動觸發
CREATE TRIGGER trg_admin_tasks_updated_at
  BEFORE UPDATE ON admin_tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- GIN 索引：加速 campus 陣列欄位的 RLS 檢查與篩選查詢
CREATE INDEX idx_admin_tasks_campus ON admin_tasks USING gin (campus);

-- 常用查詢加速
CREATE INDEX idx_admin_tasks_status       ON admin_tasks (status);
CREATE INDEX idx_admin_tasks_assigned_to  ON admin_tasks (assigned_to);
CREATE INDEX idx_admin_tasks_source_id    ON admin_tasks (source_id);
CREATE INDEX idx_admin_tasks_parent_id    ON admin_tasks (parent_id);

-- ============================================================
-- STEP 5: RLS（Row Level Security）
-- ============================================================

ALTER TABLE routine_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_tasks         ENABLE ROW LEVEL SECURITY;

-- service role（後台 admin actions）繞過 RLS，以下 policy 僅供 anon/auth role
-- 目前 admin-dashboard 全部使用 service role client，可先設全通行
CREATE POLICY "service_role_all_routine_definitions"
  ON routine_definitions FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_admin_tasks"
  ON admin_tasks FOR ALL
  USING (true) WITH CHECK (true);
