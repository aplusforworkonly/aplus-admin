CREATE TABLE task_routing_rules (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL = 全校適用
  campus       text,
  -- NULL = 全部任務來源適用
  task_source  task_source,
  -- NULL = 不限年級下界；0=大班升小一, 1=小一 … 6=小六
  grade_from   int,
  -- NULL = 不限年級上界
  grade_to     int,
  assigned_to  uuid         NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  -- 數字越大越優先，多條規則命中時取最高
  priority     int          NOT NULL DEFAULT 0,
  is_active    boolean      NOT NULL DEFAULT true,
  created_at   timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_routing_campus    ON task_routing_rules (campus);
CREATE INDEX idx_task_routing_source    ON task_routing_rules (task_source);
CREATE INDEX idx_task_routing_active    ON task_routing_rules (is_active);

ALTER TABLE task_routing_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_task_routing_rules"
  ON task_routing_rules FOR ALL USING (true) WITH CHECK (true);
