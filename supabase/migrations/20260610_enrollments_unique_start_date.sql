-- 將 enrollments unique constraint 從 (student_id, course_id)
-- 改為 (student_id, course_id, start_date)，
-- 讓同一學生可以報名同一課程的不同月份（如 YLE 跨月）。

ALTER TABLE enrollments
  DROP CONSTRAINT IF EXISTS enrollments_student_course_unique;

ALTER TABLE enrollments
  ADD CONSTRAINT enrollments_student_course_start_unique
  UNIQUE (student_id, course_id, start_date);
