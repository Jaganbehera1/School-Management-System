import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: 'admin' | 'teacher' | 'student';
          phone?: string;
          created_at: string;
          updated_at: string;
        };
      };
      teachers: {
        Row: {
          id: string;
          user_id: string;
          employee_id: string;
          subject: string;
          department?: string;
          hire_date: string;
          is_active: boolean;
          created_at: string;
        };
      };
      students: {
        Row: {
          id: string;
          user_id: string;
          roll_number: string;
          class_id?: string;
          admission_date: string;
          guardian_name?: string;
          guardian_phone?: string;
          is_active: boolean;
          created_at: string;
        };
      };
      classes: {
        Row: {
          id: string;
          name: string;
          section?: string;
          grade: number;
          academic_year: string;
          created_at: string;
        };
      };
      leave_applications: {
        Row: {
          id: string;
          applicant_id: string;
          leave_type: 'casual' | 'medical' | 'emergency' | 'personal';
          start_date: string;
          end_date: string;
          reason: string;
          status: 'pending' | 'approved' | 'rejected';
          approved_by?: string;
          admin_remarks?: string;
          applied_at: string;
          updated_at: string;
        };
      };
      student_attendance: {
        Row: {
          id: string;
          student_id: string;
          teacher_id?: string;
          attendance_date: string;
          status: 'present' | 'absent' | 'late';
          remarks?: string;
          marked_at: string;
        };
      };
      teacher_attendance: {
        Row: {
          id: string;
          teacher_id: string;
          attendance_date: string;
          check_in_time?: string;
          check_out_time?: string;
          check_in_location?: string;
          check_out_location?: string;
          check_in_address?: string;
          check_out_address?: string;
          total_hours?: number;
          created_at: string;
        };
      };
    };
  };
};