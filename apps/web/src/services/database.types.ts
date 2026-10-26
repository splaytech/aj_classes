export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      assignment_answers: {
        Row: {
          assignment_id: string;
          awarded_marks: number | null;
          feedback: string;
          question_id: string;
          response: string;
          selected_option: number | null;
          student_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          assignment_id: string;
          awarded_marks?: number | null;
          feedback?: string;
          question_id: string;
          response?: string;
          selected_option?: number | null;
          student_id: string;
          updated_at?: string;
        };
        Update: {
          assignment_id?: string;
          awarded_marks?: number | null;
          feedback?: string;
          question_id?: string;
          response?: string;
          selected_option?: number | null;
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'assignment_answers_assignment_id_student_id_fkey';
            columns: ['assignment_id', 'student_id'];
            isOneToOne: false;
            referencedRelation: 'assignment_results';
            referencedColumns: ['assignment_id', 'student_id'];
          },
          {
            foreignKeyName: 'assignment_answers_question_id_assignment_id_fkey';
            columns: ['question_id', 'assignment_id'];
            isOneToOne: false;
            referencedRelation: 'assignment_questions';
            referencedColumns: ['id', 'assignment_id'];
          },
          {
            foreignKeyName: 'assignment_answers_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'students';
            referencedColumns: ['id'];
          },
        ];
      };
      assignment_questions: {
        Row: {
          assignment_id: string;
          correct_option: number | null;
          created_at: string;
          explanation: string;
          id: string;
          kind: string;
          marks: number;
          options: string[];
          position: number;
          prompt: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          assignment_id: string;
          correct_option?: number | null;
          created_at?: string;
          explanation?: string;
          id?: string;
          kind: string;
          marks?: number;
          options?: string[];
          position?: number;
          prompt: string;
          updated_at?: string;
        };
        Update: {
          assignment_id?: string;
          correct_option?: number | null;
          created_at?: string;
          explanation?: string;
          id?: string;
          kind?: string;
          marks?: number;
          options?: string[];
          position?: number;
          prompt?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'assignment_questions_assignment_id_fkey';
            columns: ['assignment_id'];
            isOneToOne: false;
            referencedRelation: 'assignments';
            referencedColumns: ['id'];
          },
        ];
      };
      assignment_results: {
        Row: {
          assignment_id: string;
          feedback: string;
          mark: number | null;
          marked_at: string | null;
          marked_by: string | null;
          returned_at: string | null;
          status: string;
          student_id: string;
          submitted_at: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          assignment_id: string;
          feedback?: string;
          mark?: number | null;
          marked_at?: string | null;
          marked_by?: string | null;
          returned_at?: string | null;
          status?: string;
          student_id: string;
          submitted_at?: string | null;
          updated_at?: string;
        };
        Update: {
          assignment_id?: string;
          feedback?: string;
          mark?: number | null;
          marked_at?: string | null;
          marked_by?: string | null;
          returned_at?: string | null;
          status?: string;
          student_id?: string;
          submitted_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'assignment_results_assignment_id_fkey';
            columns: ['assignment_id'];
            isOneToOne: false;
            referencedRelation: 'assignments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'assignment_results_marked_by_fkey';
            columns: ['marked_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'assignment_results_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'students';
            referencedColumns: ['id'];
          },
        ];
      };
      assignments: {
        Row: {
          class_id: string;
          created_at: string;
          created_by: string | null;
          due_on: string | null;
          hold_results: boolean;
          id: string;
          instructions: string;
          max_mark: number | null;
          published_at: string | null;
          status: string;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          class_id: string;
          created_at?: string;
          created_by?: string | null;
          due_on?: string | null;
          hold_results?: boolean;
          id?: string;
          instructions?: string;
          max_mark?: number | null;
          published_at?: string | null;
          status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          class_id?: string;
          created_at?: string;
          created_by?: string | null;
          due_on?: string | null;
          hold_results?: boolean;
          id?: string;
          instructions?: string;
          max_mark?: number | null;
          published_at?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'assignments_class_id_fkey';
            columns: ['class_id'];
            isOneToOne: false;
            referencedRelation: 'classes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'assignments_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          details: NonNullable<Json>;
          id: number;
          target_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          details?: NonNullable<Json>;
          id?: never;
          target_id?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          details?: NonNullable<Json>;
          id?: never;
          target_id?: string | null;
        };
        Relationships: [];
      };
      class_sessions: {
        Row: {
          class_id: string;
          created_at: string;
          day_of_week: number;
          end_time: string;
          id: string;
          start_time: string;
        };
        ComputedFields: never;
        Insert: {
          class_id: string;
          created_at?: string;
          day_of_week: number;
          end_time: string;
          id?: string;
          start_time: string;
        };
        Update: {
          class_id?: string;
          created_at?: string;
          day_of_week?: number;
          end_time?: string;
          id?: string;
          start_time?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'class_sessions_class_id_fkey';
            columns: ['class_id'];
            isOneToOne: false;
            referencedRelation: 'classes';
            referencedColumns: ['id'];
          },
        ];
      };
      classes: {
        Row: {
          created_at: string;
          delivery: string;
          ends_on: string | null;
          id: string;
          is_active: boolean;
          location: string;
          name: string;
          starts_on: string | null;
          subject: string;
          tutor_id: string | null;
          updated_at: string;
          year_level: number | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          delivery?: string;
          ends_on?: string | null;
          id?: string;
          is_active?: boolean;
          location?: string;
          name: string;
          starts_on?: string | null;
          subject: string;
          tutor_id?: string | null;
          updated_at?: string;
          year_level?: number | null;
        };
        Update: {
          created_at?: string;
          delivery?: string;
          ends_on?: string | null;
          id?: string;
          is_active?: boolean;
          location?: string;
          name?: string;
          starts_on?: string | null;
          subject?: string;
          tutor_id?: string | null;
          updated_at?: string;
          year_level?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'classes_tutor_id_fkey';
            columns: ['tutor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      email_outbox: {
        Row: {
          assignment_id: string;
          attempts: number;
          claimed_at: string | null;
          created_at: string;
          id: string;
          kind: string;
          reason: string | null;
          recipient_id: string;
          recipient_role: string;
          send_before: string | null;
          sent_at: string | null;
          status: string;
          student_id: string;
        };
        ComputedFields: never;
        Insert: {
          assignment_id: string;
          attempts?: number;
          claimed_at?: string | null;
          created_at?: string;
          id?: string;
          kind: string;
          reason?: string | null;
          recipient_id: string;
          recipient_role: string;
          send_before?: string | null;
          sent_at?: string | null;
          status?: string;
          student_id: string;
        };
        Update: {
          assignment_id?: string;
          attempts?: number;
          claimed_at?: string | null;
          created_at?: string;
          id?: string;
          kind?: string;
          reason?: string | null;
          recipient_id?: string;
          recipient_role?: string;
          send_before?: string | null;
          sent_at?: string | null;
          status?: string;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'email_outbox_assignment_id_fkey';
            columns: ['assignment_id'];
            isOneToOne: false;
            referencedRelation: 'assignments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'email_outbox_recipient_id_fkey';
            columns: ['recipient_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'email_outbox_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'students';
            referencedColumns: ['id'];
          },
        ];
      };
      enquiries: {
        Row: {
          created_at: string;
          crm_error: string | null;
          crm_lead_id: string | null;
          crm_status: string;
          crm_synced_at: string | null;
          email: string;
          id: string;
          message: string | null;
          name: string;
          phone: string | null;
          wants_updates: boolean;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          crm_error?: string | null;
          crm_lead_id?: string | null;
          crm_status?: string;
          crm_synced_at?: string | null;
          email: string;
          id?: string;
          message?: string | null;
          name: string;
          phone?: string | null;
          wants_updates?: boolean;
        };
        Update: {
          created_at?: string;
          crm_error?: string | null;
          crm_lead_id?: string | null;
          crm_status?: string;
          crm_synced_at?: string | null;
          email?: string;
          id?: string;
          message?: string | null;
          name?: string;
          phone?: string | null;
          wants_updates?: boolean;
        };
        Relationships: [];
      };
      enquiry_rate_limits: {
        Row: {
          created_at: string;
          ip_hash: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          ip_hash: string;
        };
        Update: {
          created_at?: string;
          ip_hash?: string;
        };
        Relationships: [];
      };
      enrolments: {
        Row: {
          class_id: string;
          enrolled_at: string;
          student_id: string;
        };
        ComputedFields: never;
        Insert: {
          class_id: string;
          enrolled_at?: string;
          student_id: string;
        };
        Update: {
          class_id?: string;
          enrolled_at?: string;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'enrolments_class_id_fkey';
            columns: ['class_id'];
            isOneToOne: false;
            referencedRelation: 'classes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'enrolments_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'students';
            referencedColumns: ['id'];
          },
        ];
      };
      notification_settings: {
        Row: {
          due_tomorrow: boolean;
          new_assignment: boolean;
          profile_id: string;
          updated_at: string;
          work_returned: boolean;
        };
        ComputedFields: never;
        Insert: {
          due_tomorrow?: boolean;
          new_assignment?: boolean;
          profile_id: string;
          updated_at?: string;
          work_returned?: boolean;
        };
        Update: {
          due_tomorrow?: boolean;
          new_assignment?: boolean;
          profile_id?: string;
          updated_at?: string;
          work_returned?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'notification_settings_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      posts: {
        Row: {
          author_id: string | null;
          body: string;
          created_at: string;
          id: string;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          author_id?: string | null;
          body: string;
          created_at?: string;
          id?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          author_id?: string | null;
          body?: string;
          created_at?: string;
          id?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_path: string | null;
          bio: string;
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          invited_at: string | null;
          is_active: boolean;
          joined_at: string | null;
          last_sign_in_at: string | null;
          marketing_consent_at: string | null;
          password_set_at: string | null;
          phone: string | null;
          qualifications: string[];
          results_publicity_consent_at: string | null;
          role: Database['public']['Enums']['app_role'];
          status: Database['public']['Enums']['account_status'];
          subjects: string[];
          terms_accepted_at: string | null;
          updated_at: string;
          video_publicity_consent_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          avatar_path?: string | null;
          bio?: string;
          created_at?: string;
          email: string;
          full_name?: string;
          id: string;
          invited_at?: string | null;
          is_active?: boolean;
          joined_at?: string | null;
          last_sign_in_at?: string | null;
          marketing_consent_at?: string | null;
          password_set_at?: string | null;
          phone?: string | null;
          qualifications?: string[];
          results_publicity_consent_at?: string | null;
          role?: Database['public']['Enums']['app_role'];
          status?: Database['public']['Enums']['account_status'];
          subjects?: string[];
          terms_accepted_at?: string | null;
          updated_at?: string;
          video_publicity_consent_at?: string | null;
        };
        Update: {
          avatar_path?: string | null;
          bio?: string;
          created_at?: string;
          email?: string;
          full_name?: string;
          id?: string;
          invited_at?: string | null;
          is_active?: boolean;
          joined_at?: string | null;
          last_sign_in_at?: string | null;
          marketing_consent_at?: string | null;
          password_set_at?: string | null;
          phone?: string | null;
          qualifications?: string[];
          results_publicity_consent_at?: string | null;
          role?: Database['public']['Enums']['app_role'];
          status?: Database['public']['Enums']['account_status'];
          subjects?: string[];
          terms_accepted_at?: string | null;
          updated_at?: string;
          video_publicity_consent_at?: string | null;
        };
        Relationships: [];
      };
      student_guardians: {
        Row: {
          created_at: string;
          parent_id: string;
          student_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          parent_id: string;
          student_id: string;
        };
        Update: {
          created_at?: string;
          parent_id?: string;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'student_guardians_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'student_guardians_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'students';
            referencedColumns: ['id'];
          },
        ];
      };
      students: {
        Row: {
          consent_recorded_at: string | null;
          consent_recorded_by: string | null;
          consent_source: string | null;
          created_at: string;
          full_name: string;
          id: string;
          is_active: boolean;
          profile_id: string | null;
          updated_at: string;
          year_level: number | null;
        };
        ComputedFields: never;
        Insert: {
          consent_recorded_at?: string | null;
          consent_recorded_by?: string | null;
          consent_source?: string | null;
          created_at?: string;
          full_name: string;
          id?: string;
          is_active?: boolean;
          profile_id?: string | null;
          updated_at?: string;
          year_level?: number | null;
        };
        Update: {
          consent_recorded_at?: string | null;
          consent_recorded_by?: string | null;
          consent_source?: string | null;
          created_at?: string;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          profile_id?: string | null;
          updated_at?: string;
          year_level?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'students_consent_recorded_by_fkey';
            columns: ['consent_recorded_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'students_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_email_problems: {
        Args: { max_rows?: number };
        Returns: {
          assignment_title: string;
          created_at: string;
          id: string;
          kind: string;
          reason: string;
          recipient_role: string;
          state: string;
        }[];
      };
      admin_list_activity: {
        Args: { max_rows?: number };
        Returns: {
          action: string;
          actor_name: string;
          created_at: string;
          details: Json;
          id: number;
          target_name: string;
        }[];
      };
      admin_list_staff: {
        Args: { target?: string };
        Returns: {
          avatar_path: string;
          bio: string;
          email: string;
          full_name: string;
          has_two_step: boolean;
          id: string;
          invited_at: string;
          is_active: boolean;
          joined_at: string;
          last_sign_in_at: string;
          phone: string;
          qualifications: string[];
          role: Database['public']['Enums']['app_role'];
          subjects: string[];
          terms_accepted_at: string;
        }[];
      };
      admin_log: {
        Args: { action: string; actor: string; details?: Json; target: string };
        Returns: undefined;
      };
      admin_record_consent: { Args: { target_student: string }; Returns: undefined };
      admin_set_active: { Args: { active: boolean; target: string }; Returns: undefined };
      admin_set_role: {
        Args: { new_role: Database['public']['Enums']['app_role']; target: string };
        Returns: undefined;
      };
      admin_unlink_parent: {
        Args: { target_parent: string; target_student: string };
        Returns: undefined;
      };
      am_i_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      complete_onboarding: {
        Args: {
          accepts_terms?: boolean;
          allows_results_publicity?: boolean;
          allows_video_publicity?: boolean;
          new_full_name: string;
          new_phone?: string;
          new_year_level?: string;
          wants_marketing?: boolean;
        };
        Returns: undefined;
      };
      move_question: { Args: { step: number; target: string }; Returns: undefined };
      my_onboarding: {
        Args: Record<PropertyKey, never>;
        Returns: {
          email: string;
          full_name: string;
          role: Database['public']['Enums']['app_role'];
          year_level: number;
        }[];
      };
      notify_claim_emails: {
        Args: { supported_kinds?: string[] };
        Returns: {
          assignment_id: string;
          assignment_title: string;
          child_first_name: string;
          class_name: string;
          due_on: string;
          email: string;
          id: string;
          kind: string;
          recipient_first_name: string;
          recipient_role: string;
          student_id: string;
        }[];
      };
      notify_flag_config_missing: { Args: Record<PropertyKey, never>; Returns: undefined };
      notify_record_result: {
        Args: { failure_reason?: string; outcome: string; target: string };
        Returns: undefined;
      };
      parent_child_assignment: {
        Args: { target_assignment: string; target_student: string };
        Returns: Json;
      };
      parent_child_assignments: {
        Args: { target_student: string };
        Returns: {
          answered_count: number;
          assignment_id: string;
          class_name: string;
          comment: string;
          due_on: string;
          is_late: boolean;
          is_past_class: boolean;
          mark: number;
          published_at: string;
          question_count: number;
          returned_at: string;
          status: string;
          subject: string;
          submitted_at: string;
          title: string;
          total_marks: number;
        }[];
      };
      parent_child_timetable: {
        Args: { target_student: string };
        Returns: {
          class_id: string;
          class_name: string;
          day_of_week: number;
          delivery: string;
          end_time: string;
          ends_on: string;
          location: string;
          session_id: string;
          start_time: string;
          starts_on: string;
          subject: string;
          tutor_name: string;
        }[];
      };
      parent_children: {
        Args: Record<PropertyKey, never>;
        Returns: {
          account_status: string;
          class_names: string[];
          consent_recorded_at: string;
          full_name: string;
          student_id: string;
          year_level: number;
        }[];
      };
      parent_give_consent: { Args: { target_student: string }; Returns: undefined };
      set_my_consents: {
        Args: {
          allows_results_publicity: boolean;
          allows_video_publicity: boolean;
          wants_marketing: boolean;
        };
        Returns: undefined;
      };
      student_assignment: { Args: { target: string }; Returns: Json };
      student_assignments: {
        Args: Record<PropertyKey, never>;
        Returns: {
          answered_count: number;
          assignment_id: string;
          class_name: string;
          comment: string;
          due_on: string;
          is_late: boolean;
          is_past_class: boolean;
          mark: number;
          published_at: string;
          question_count: number;
          returned_at: string;
          status: string;
          subject: string;
          submitted_at: string;
          title: string;
          total_marks: number;
        }[];
      };
      student_save_answer: {
        Args: {
          answer_text?: string;
          chosen_option?: number;
          target_assignment: string;
          target_question: string;
        };
        Returns: undefined;
      };
      student_submit: { Args: { target_assignment: string }; Returns: string };
      student_timetable: {
        Args: Record<PropertyKey, never>;
        Returns: {
          class_id: string;
          class_name: string;
          day_of_week: number;
          delivery: string;
          end_time: string;
          ends_on: string;
          location: string;
          session_id: string;
          start_time: string;
          starts_on: string;
          subject: string;
          tutor_name: string;
        }[];
      };
    };
    Enums: {
      account_status: 'invited' | 'active';
      app_role: 'tutor' | 'admin' | 'student' | 'parent';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      account_status: ['invited', 'active'],
      app_role: ['tutor', 'admin', 'student', 'parent'],
    },
  },
} as const;
