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
      assignment_results: {
        Row: {
          assignment_id: string;
          feedback: string;
          mark: number | null;
          marked_at: string | null;
          marked_by: string | null;
          status: string;
          student_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          assignment_id: string;
          feedback?: string;
          mark?: number | null;
          marked_at?: string | null;
          marked_by?: string | null;
          status?: string;
          student_id: string;
          updated_at?: string;
        };
        Update: {
          assignment_id?: string;
          feedback?: string;
          mark?: number | null;
          marked_at?: string | null;
          marked_by?: string | null;
          status?: string;
          student_id?: string;
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
          id: string;
          instructions: string;
          max_mark: number | null;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          class_id: string;
          created_at?: string;
          created_by?: string | null;
          due_on?: string | null;
          id?: string;
          instructions?: string;
          max_mark?: number | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          class_id?: string;
          created_at?: string;
          created_by?: string | null;
          due_on?: string | null;
          id?: string;
          instructions?: string;
          max_mark?: number | null;
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
          qualifications: string[];
          role: Database['public']['Enums']['app_role'];
          subjects: string[];
          updated_at: string;
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
          qualifications?: string[];
          role?: Database['public']['Enums']['app_role'];
          subjects?: string[];
          updated_at?: string;
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
          qualifications?: string[];
          role?: Database['public']['Enums']['app_role'];
          subjects?: string[];
          updated_at?: string;
        };
        Relationships: [];
      };
      students: {
        Row: {
          created_at: string;
          full_name: string;
          id: string;
          is_active: boolean;
          updated_at: string;
          year_level: number | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          full_name: string;
          id?: string;
          is_active?: boolean;
          updated_at?: string;
          year_level?: number | null;
        };
        Update: {
          created_at?: string;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          updated_at?: string;
          year_level?: number | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
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
          qualifications: string[];
          role: Database['public']['Enums']['app_role'];
          subjects: string[];
        }[];
      };
      admin_log: {
        Args: { action: string; actor: string; details?: Json; target: string };
        Returns: undefined;
      };
      admin_set_active: { Args: { active: boolean; target: string }; Returns: undefined };
      admin_set_role: {
        Args: { new_role: Database['public']['Enums']['app_role']; target: string };
        Returns: undefined;
      };
      am_i_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
    };
    Enums: {
      app_role: 'tutor' | 'admin';
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
      app_role: ['tutor', 'admin'],
    },
  },
} as const;
