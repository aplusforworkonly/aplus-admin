export type StudentStatus = '就讀中' | '已離校' | '重複建檔';
export type ProgramType = '全日班' | '單上英語' | '其他';
export type InvoiceStatus = '未繳' | '部分繳清' | '已結清';
export type LineItemType = '常規學費' | '附加費' | '單次折抵';
export type RelationshipType = '父' | '母' | '其他';
export type CampusType = '文府總校' | '龍華校' | '左新校';
export type EnrollmentStatus = '生效' | '候補' | '待審核' | '退班' | '已結業';
export type CourseType = 'main_course' | 'camp' | 'trip';
export type BillingCycle = 'monthly' | 'quarterly' | 'one_time';

export interface Student {
  id: string;
  name: string;
  english_name: string | null;
  birth_date: string | null;
  id_number: string | null;
  enrollment_date: string;
  status: StudentStatus;
  campus: CampusType | null;
  is_school_student: boolean;
  program_type: ProgramType | null;
  main_tutor_id: string | null;
  notes: string | null;
  leave_note: string | null;
  registration_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudentLeave {
  id: string;
  student_id: string;
  leave_date: string;
  note: string | null;
  created_at: string;
}

export interface Parent {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  line_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParentStudentMapping {
  id: string;
  parent_id: string;
  student_id: string;
  relationship: RelationshipType;
}

export interface Course {
  id: string;
  name: string;
  course_type: CourseType;
  billing_cycle: BillingCycle;
  base_price: number;
  max_capacity: number | null;
  is_overnight: boolean;
  created_at: string;
  updated_at: string;
}

export interface Enrollment {
  id: string;
  contract_no: string;
  student_id: string;
  course_id: string;
  campus: CampusType;
  class_assignment: string | null;
  start_date: string;
  end_date: string | null;
  status: EnrollmentStatus;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  invoice_no: string;
  student_id: string;
  billing_month: string;
  total_amount: number;
  paid_amount: number;
  status: InvoiceStatus;
  due_date: string;
  enrollment_ids: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  item_name: string;
  item_type: LineItemType;
  amount: number;
  remark: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudentWithParents extends Student {
  parent_student_mapping: Array<{
    id: string;
    relationship: RelationshipType;
    parents: Pick<Parent, 'id' | 'name' | 'phone' | 'email' | 'line_id'> | null;
  }>;
}

export type ClassCategory = 'homeroom' | 'english_core' | 'elective';

export interface Class {
  id: string;
  name: string;
  campus: string;
  teacher_id: string | null;
  category: ClassCategory;
  program_track: string | null;
  course_id: string | null;
  academic_year: string | null;
  term: string | null;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface StudentCharge {
  id: string;
  student_id: string;
  amount: number;
  item_details: any;
  status: 'pending_billing' | 'billed' | 'paid';
  reference_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RequestAuditLog {
  id: string;
  request_table: 'leave_requests' | 'student_requests';
  request_id: string;
  from_status: string;
  to_status: string;
  handled_by: string | null;
  created_at: string;
}
