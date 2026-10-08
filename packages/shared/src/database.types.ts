export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      adv_audit_log: {
        Row: {
          action: string
          business_id: string
          client_id: string | null
          created_at: string
          detail: Json
          document_id: string | null
          id: number
          user_id: string | null
        }
        Insert: {
          action: string
          business_id: string
          client_id?: string | null
          created_at?: string
          detail?: Json
          document_id?: string | null
          id?: never
          user_id?: string | null
        }
        Update: {
          action?: string
          business_id?: string
          client_id?: string | null
          created_at?: string
          detail?: Json
          document_id?: string | null
          id?: never
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adv_audit_log_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      adv_client_contacts: {
        Row: {
          business_id: string
          client_id: string
          created_at: string
          id: string
          kind: string
          label: string | null
          value: string
        }
        Insert: {
          business_id: string
          client_id: string
          created_at?: string
          id?: string
          kind: string
          label?: string | null
          value: string
        }
        Update: {
          business_id?: string
          client_id?: string
          created_at?: string
          id?: string
          kind?: string
          label?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "adv_client_contacts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adv_client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "adv_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      adv_clients: {
        Row: {
          business_id: string
          client_kind: string
          created_at: string
          id: string
          manager_id: string | null
          name: string
          nif: string | null
          notes: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          client_kind?: string
          created_at?: string
          id?: string
          manager_id?: string | null
          name: string
          nif?: string | null
          notes?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          client_kind?: string
          created_at?: string
          id?: string
          manager_id?: string | null
          name?: string
          nif?: string | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "adv_clients_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      adv_doc_types: {
        Row: {
          business_id: string
          code: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          position: number
        }
        Insert: {
          business_id: string
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          position?: number
        }
        Update: {
          business_id?: string
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "adv_doc_types_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      adv_documents: {
        Row: {
          assignment_reason: Json
          business_id: string
          client_id: string | null
          created_at: string
          doc_type_id: string | null
          duplicate_of: string | null
          file_hash: string
          id: string
          mime_type: string
          original_filename: string
          period_month: number | null
          period_year: number | null
          sender: string | null
          sender_meta: Json
          size_bytes: number
          source: string
          status: string
          storage_path: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          assignment_reason?: Json
          business_id: string
          client_id?: string | null
          created_at?: string
          doc_type_id?: string | null
          duplicate_of?: string | null
          file_hash: string
          id?: string
          mime_type: string
          original_filename: string
          period_month?: number | null
          period_year?: number | null
          sender?: string | null
          sender_meta?: Json
          size_bytes: number
          source: string
          status?: string
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          assignment_reason?: Json
          business_id?: string
          client_id?: string | null
          created_at?: string
          doc_type_id?: string | null
          duplicate_of?: string | null
          file_hash?: string
          id?: string
          mime_type?: string
          original_filename?: string
          period_month?: number | null
          period_year?: number | null
          sender?: string | null
          sender_meta?: Json
          size_bytes?: number
          source?: string
          status?: string
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adv_documents_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adv_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "adv_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adv_documents_doc_type_id_fkey"
            columns: ["doc_type_id"]
            isOneToOne: false
            referencedRelation: "adv_doc_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adv_documents_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "adv_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_chat_messages: {
        Row: {
          author_id: string | null
          body: string
          business_id: string
          created_at: string
          id: string
          team_id: string | null
        }
        Insert: {
          author_id?: string | null
          body: string
          business_id: string
          created_at?: string
          id?: string
          team_id?: string | null
        }
        Update: {
          author_id?: string | null
          body?: string
          business_id?: string
          created_at?: string
          id?: string
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agency_chat_messages_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_chat_messages_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "agency_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_chat_reads: {
        Row: {
          business_id: string
          last_read_at: string
          scope_id: string
          user_id: string
        }
        Insert: {
          business_id: string
          last_read_at?: string
          scope_id: string
          user_id: string
        }
        Update: {
          business_id?: string
          last_read_at?: string
          scope_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_chat_reads_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_documents: {
        Row: {
          business_id: string
          created_at: string
          id: string
          mime_type: string
          name: string
          size_bytes: number
          storage_path: string
          team_id: string
          uploaded_by: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          mime_type: string
          name: string
          size_bytes: number
          storage_path: string
          team_id: string
          uploaded_by?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          mime_type?: string
          name?: string
          size_bytes?: number
          storage_path?: string
          team_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agency_documents_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_documents_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "agency_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_events: {
        Row: {
          all_day: boolean
          business_id: string
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          id: string
          starts_at: string
          team_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          business_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          starts_at: string
          team_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          business_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          starts_at?: string
          team_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "agency_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_members: {
        Row: {
          access_level: string
          business_id: string
          cargo: string | null
          created_at: string
          directiva_role: string | null
          full_name: string
          is_active: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          access_level?: string
          business_id: string
          cargo?: string | null
          created_at?: string
          directiva_role?: string | null
          full_name: string
          is_active?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          access_level?: string
          business_id?: string
          cargo?: string | null
          created_at?: string
          directiva_role?: string | null
          full_name?: string
          is_active?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_notifications: {
        Row: {
          body: string | null
          business_id: string
          created_at: string
          dedupe_key: string | null
          id: string
          kind: string
          push_sent_at: string | null
          read_at: string | null
          task_id: string | null
          team_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          business_id: string
          created_at?: string
          dedupe_key?: string | null
          id?: string
          kind: string
          push_sent_at?: string | null
          read_at?: string | null
          task_id?: string | null
          team_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          business_id?: string
          created_at?: string
          dedupe_key?: string | null
          id?: string
          kind?: string
          push_sent_at?: string | null
          read_at?: string | null
          task_id?: string | null
          team_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_notifications_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_notifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "agency_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_notifications_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "agency_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      agency_task_assignees: {
        Row: {
          business_id: string
          created_at: string
          task_id: string
          team_id: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          task_id: string
          team_id: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          task_id?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_task_assignees_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_task_assignees_business_id_user_id_fkey"
            columns: ["business_id", "user_id"]
            isOneToOne: false
            referencedRelation: "agency_members"
            referencedColumns: ["business_id", "user_id"]
          },
          {
            foreignKeyName: "agency_task_assignees_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "agency_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_task_assignees_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "agency_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_task_comments: {
        Row: {
          author_id: string | null
          body: string
          business_id: string
          created_at: string
          id: string
          mentions: string[]
          task_id: string
          team_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          business_id: string
          created_at?: string
          id?: string
          mentions?: string[]
          task_id: string
          team_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          business_id?: string
          created_at?: string
          id?: string
          mentions?: string[]
          task_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_task_comments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "agency_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_task_comments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "agency_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_tasks: {
        Row: {
          business_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          sort_order: number
          status: string
          team_id: string
          title: string
          updated_at: string
        }
        Insert: {
          business_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          sort_order?: number
          status?: string
          team_id: string
          title: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          sort_order?: number
          status?: string
          team_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_tasks_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_tasks_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "agency_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_team_members: {
        Row: {
          business_id: string
          created_at: string
          team_id: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          team_id: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_team_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_team_members_business_id_user_id_fkey"
            columns: ["business_id", "user_id"]
            isOneToOne: false
            referencedRelation: "agency_members"
            referencedColumns: ["business_id", "user_id"]
          },
          {
            foreignKeyName: "agency_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "agency_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_teams: {
        Row: {
          business_id: string
          created_at: string
          id: string
          is_archived: boolean
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          is_archived?: boolean
          name: string
          position?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_teams_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      blocks: {
        Row: {
          business_id: string
          cancels_affected: boolean
          created_at: string
          ends_at: string
          id: string
          professional_id: string | null
          reason: string | null
          scope: Database["public"]["Enums"]["block_scope"]
          source: string
          starts_at: string
        }
        Insert: {
          business_id: string
          cancels_affected?: boolean
          created_at?: string
          ends_at: string
          id?: string
          professional_id?: string | null
          reason?: string | null
          scope?: Database["public"]["Enums"]["block_scope"]
          source?: string
          starts_at: string
        }
        Update: {
          business_id?: string
          cancels_affected?: boolean
          created_at?: string
          ends_at?: string
          id?: string
          professional_id?: string | null
          reason?: string | null
          scope?: Database["public"]["Enums"]["block_scope"]
          source?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          business_id: string
          channel: Database["public"]["Enums"]["booking_channel"]
          created_at: string
          customer_email: string | null
          customer_id: string | null
          customer_last_name: string | null
          customer_name: string
          customer_phone: string | null
          dining_shift_id: string | null
          dining_table_id: string | null
          ends_at: string
          google_event_id: string | null
          id: string
          locator: string
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          party_size: number | null
          professional_id: string | null
          service_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          table_combo_id: string | null
          type: Database["public"]["Enums"]["business_type"]
          updated_at: string
        }
        Insert: {
          business_id: string
          channel?: Database["public"]["Enums"]["booking_channel"]
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_last_name?: string | null
          customer_name: string
          customer_phone?: string | null
          dining_shift_id?: string | null
          dining_table_id?: string | null
          ends_at: string
          google_event_id?: string | null
          id?: string
          locator: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          party_size?: number | null
          professional_id?: string | null
          service_id?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          table_combo_id?: string | null
          type: Database["public"]["Enums"]["business_type"]
          updated_at?: string
        }
        Update: {
          business_id?: string
          channel?: Database["public"]["Enums"]["booking_channel"]
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_last_name?: string | null
          customer_name?: string
          customer_phone?: string | null
          dining_shift_id?: string | null
          dining_table_id?: string | null
          ends_at?: string
          google_event_id?: string | null
          id?: string
          locator?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          party_size?: number | null
          professional_id?: string | null
          service_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          table_combo_id?: string | null
          type?: Database["public"]["Enums"]["business_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_dining_shift_id_fkey"
            columns: ["dining_shift_id"]
            isOneToOne: false
            referencedRelation: "dining_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_dining_table_id_fkey"
            columns: ["dining_table_id"]
            isOneToOne: false
            referencedRelation: "dining_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_table_combo_id_fkey"
            columns: ["table_combo_id"]
            isOneToOne: false
            referencedRelation: "dining_table_combos"
            referencedColumns: ["id"]
          },
        ]
      }
      business_google_profile_accounts: {
        Row: {
          access_token: string | null
          business_id: string
          created_at: string
          gbp_account_name: string | null
          gbp_location_name: string | null
          gbp_location_title: string | null
          google_email: string | null
          last_sync_error: string | null
          last_sync_status: string
          last_synced_at: string | null
          refresh_token: string | null
          sync_enabled: boolean
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          business_id: string
          created_at?: string
          gbp_account_name?: string | null
          gbp_location_name?: string | null
          gbp_location_title?: string | null
          google_email?: string | null
          last_sync_error?: string | null
          last_sync_status?: string
          last_synced_at?: string | null
          refresh_token?: string | null
          sync_enabled?: boolean
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          business_id?: string
          created_at?: string
          gbp_account_name?: string | null
          gbp_location_name?: string | null
          gbp_location_title?: string | null
          google_email?: string | null
          last_sync_error?: string | null
          last_sync_status?: string
          last_synced_at?: string | null
          refresh_token?: string | null
          sync_enabled?: boolean
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_google_profile_accounts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_hours: {
        Row: {
          business_id: string
          close_time: string
          id: string
          open_time: string
          weekday: number
        }
        Insert: {
          business_id: string
          close_time: string
          id?: string
          open_time: string
          weekday: number
        }
        Update: {
          business_id?: string
          close_time?: string
          id?: string
          open_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "business_hours_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_integrations: {
        Row: {
          business_id: string
          created_at: string
          email_from: string | null
          gemini_api_key: string | null
          google_client_id: string | null
          google_client_secret: string | null
          resend_api_key: string | null
          updated_at: string
          whatsapp_phone_number_id: string | null
          whatsapp_token: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          email_from?: string | null
          gemini_api_key?: string | null
          google_client_id?: string | null
          google_client_secret?: string | null
          resend_api_key?: string | null
          updated_at?: string
          whatsapp_phone_number_id?: string | null
          whatsapp_token?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          email_from?: string | null
          gemini_api_key?: string | null
          google_client_id?: string | null
          google_client_secret?: string | null
          resend_api_key?: string | null
          updated_at?: string
          whatsapp_phone_number_id?: string | null
          whatsapp_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_integrations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_users: {
        Row: {
          business_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["business_user_role"]
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["business_user_role"]
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["business_user_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_users_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          confirmation_email_message: string | null
          created_at: string
          default_capacity: number
          google_review_url: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          max_advance_days: number | null
          name: string
          primary_color: string
          reminder_lang: string
          reminder_template_name: string | null
          review_email_message: string | null
          slot_interval_min: number
          slug: string
          timezone: string
          type: Database["public"]["Enums"]["business_type"]
          updated_at: string
          waitlist_template_name: string | null
          whatsapp_phone: string | null
          whatsapp_reminders_enabled: boolean
        }
        Insert: {
          confirmation_email_message?: string | null
          created_at?: string
          default_capacity?: number
          google_review_url?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          max_advance_days?: number | null
          name: string
          primary_color?: string
          reminder_lang?: string
          reminder_template_name?: string | null
          review_email_message?: string | null
          slot_interval_min?: number
          slug: string
          timezone?: string
          type: Database["public"]["Enums"]["business_type"]
          updated_at?: string
          waitlist_template_name?: string | null
          whatsapp_phone?: string | null
          whatsapp_reminders_enabled?: boolean
        }
        Update: {
          confirmation_email_message?: string | null
          created_at?: string
          default_capacity?: number
          google_review_url?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          max_advance_days?: number | null
          name?: string
          primary_color?: string
          reminder_lang?: string
          reminder_template_name?: string | null
          review_email_message?: string | null
          slot_interval_min?: number
          slug?: string
          timezone?: string
          type?: Database["public"]["Enums"]["business_type"]
          updated_at?: string
          waitlist_template_name?: string | null
          whatsapp_phone?: string | null
          whatsapp_reminders_enabled?: boolean
        }
        Relationships: []
      }
      client_ai_reports: {
        Row: {
          business_id: string
          content: string
          created_at: string
          customer_id: string
          generated_by_user_id: string | null
          id: string
          model: string
          sessions_count: number
        }
        Insert: {
          business_id: string
          content: string
          created_at?: string
          customer_id: string
          generated_by_user_id?: string | null
          id?: string
          model?: string
          sessions_count?: number
        }
        Update: {
          business_id?: string
          content?: string
          created_at?: string
          customer_id?: string
          generated_by_user_id?: string | null
          id?: string
          model?: string
          sessions_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_ai_reports_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_ai_reports_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      client_sessions: {
        Row: {
          author_user_id: string | null
          booking_id: string | null
          business_id: string
          created_at: string
          customer_id: string
          id: string
          notas: string | null
          objetivo: string | null
          seguimiento: string | null
          session_date: string
          tareas_pautas: string | null
          updated_at: string
        }
        Insert: {
          author_user_id?: string | null
          booking_id?: string | null
          business_id: string
          created_at?: string
          customer_id: string
          id?: string
          notas?: string | null
          objetivo?: string | null
          seguimiento?: string | null
          session_date?: string
          tareas_pautas?: string | null
          updated_at?: string
        }
        Update: {
          author_user_id?: string | null
          booking_id?: string | null
          business_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          notas?: string | null
          objetivo?: string | null
          seguimiento?: string | null
          session_date?: string
          tareas_pautas?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_sessions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_sessions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_sessions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_budget_concepts: {
        Row: {
          business_id: string
          created_at: string
          default_unit_price: number
          default_vat_rate: number
          id: string
          name: string
        }
        Insert: {
          business_id: string
          created_at?: string
          default_unit_price?: number
          default_vat_rate?: number
          id?: string
          name: string
        }
        Update: {
          business_id?: string
          created_at?: string
          default_unit_price?: number
          default_vat_rate?: number
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_budget_concepts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_budget_lines: {
        Row: {
          budget_id: string
          concept: string
          discount_pct: number
          id: string
          position: number
          quantity: number
          unit_price: number
          vat_rate: number
        }
        Insert: {
          budget_id: string
          concept: string
          discount_pct?: number
          id?: string
          position?: number
          quantity?: number
          unit_price?: number
          vat_rate?: number
        }
        Update: {
          budget_id?: string
          concept?: string
          discount_pct?: number
          id?: string
          position?: number
          quantity?: number
          unit_price?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_budget_lines_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "crm_budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_budgets: {
        Row: {
          business_id: string
          card_id: string | null
          created_at: string
          customer_id: string
          id: string
          issued_at: string
          notes: string | null
          number: string
          status: Database["public"]["Enums"]["crm_budget_status"]
          updated_at: string
          valid_until_days: number
        }
        Insert: {
          business_id: string
          card_id?: string | null
          created_at?: string
          customer_id: string
          id?: string
          issued_at?: string
          notes?: string | null
          number: string
          status?: Database["public"]["Enums"]["crm_budget_status"]
          updated_at?: string
          valid_until_days?: number
        }
        Update: {
          business_id?: string
          card_id?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          issued_at?: string
          notes?: string | null
          number?: string
          status?: Database["public"]["Enums"]["crm_budget_status"]
          updated_at?: string
          valid_until_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_budgets_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_budgets_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "crm_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_budgets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_card_notes: {
        Row: {
          body: string
          card_id: string
          created_at: string
          id: string
        }
        Insert: {
          body: string
          card_id: string
          created_at?: string
          id?: string
        }
        Update: {
          body?: string
          card_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_card_notes_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "crm_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_cards: {
        Row: {
          business_id: string
          created_at: string
          customer_id: string | null
          description: string | null
          estimated_amount: number | null
          id: string
          last_moved_at: string
          position: number
          stage_id: string
          title: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_id?: string | null
          description?: string | null
          estimated_amount?: number | null
          id?: string
          last_moved_at?: string
          position?: number
          stage_id: string
          title: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_id?: string | null
          description?: string | null
          estimated_amount?: number | null
          id?: string
          last_moved_at?: string
          position?: number
          stage_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_cards_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_cards_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_cards_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "crm_pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_document_counters: {
        Row: {
          business_id: string
          doc_type: Database["public"]["Enums"]["crm_document_type"]
          last_number: number
          year: number
        }
        Insert: {
          business_id: string
          doc_type: Database["public"]["Enums"]["crm_document_type"]
          last_number?: number
          year: number
        }
        Update: {
          business_id?: string
          doc_type?: Database["public"]["Enums"]["crm_document_type"]
          last_number?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_document_counters_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_events: {
        Row: {
          address: string | null
          business_id: string
          card_id: string | null
          created_at: string
          customer_id: string | null
          ends_at: string
          google_event_id: string | null
          id: string
          notes: string | null
          starts_at: string
          title: string
          type: Database["public"]["Enums"]["crm_event_type"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          business_id: string
          card_id?: string | null
          created_at?: string
          customer_id?: string | null
          ends_at: string
          google_event_id?: string | null
          id?: string
          notes?: string | null
          starts_at: string
          title: string
          type?: Database["public"]["Enums"]["crm_event_type"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          business_id?: string
          card_id?: string | null
          created_at?: string
          customer_id?: string | null
          ends_at?: string
          google_event_id?: string | null
          id?: string
          notes?: string | null
          starts_at?: string
          title?: string
          type?: Database["public"]["Enums"]["crm_event_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_events_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "crm_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_fiscal_profile: {
        Row: {
          address: string | null
          business_id: string
          default_irpf_rate: number
          default_vat_rate: number
          iban_note: string | null
          legal_name: string | null
          nif: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          business_id: string
          default_irpf_rate?: number
          default_vat_rate?: number
          iban_note?: string | null
          legal_name?: string | null
          nif?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          business_id?: string
          default_irpf_rate?: number
          default_vat_rate?: number
          iban_note?: string | null
          legal_name?: string | null
          nif?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_fiscal_profile_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_invoice_lines: {
        Row: {
          concept: string
          discount_pct: number
          id: string
          invoice_id: string
          position: number
          quantity: number
          unit_price: number
          vat_rate: number
        }
        Insert: {
          concept: string
          discount_pct?: number
          id?: string
          invoice_id: string
          position?: number
          quantity?: number
          unit_price?: number
          vat_rate?: number
        }
        Update: {
          concept?: string
          discount_pct?: number
          id?: string
          invoice_id?: string
          position?: number
          quantity?: number
          unit_price?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "crm_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_invoices: {
        Row: {
          budget_id: string | null
          business_id: string
          card_id: string | null
          created_at: string
          customer_id: string
          id: string
          irpf_rate: number
          issued_at: string
          notes: string | null
          number: string
          status: Database["public"]["Enums"]["crm_invoice_status"]
          updated_at: string
          year: number
        }
        Insert: {
          budget_id?: string | null
          business_id: string
          card_id?: string | null
          created_at?: string
          customer_id: string
          id?: string
          irpf_rate?: number
          issued_at?: string
          notes?: string | null
          number: string
          status?: Database["public"]["Enums"]["crm_invoice_status"]
          updated_at?: string
          year: number
        }
        Update: {
          budget_id?: string | null
          business_id?: string
          card_id?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          irpf_rate?: number
          issued_at?: string
          notes?: string | null
          number?: string
          status?: Database["public"]["Enums"]["crm_invoice_status"]
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_invoices_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "crm_budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_invoices_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_invoices_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "crm_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_pipeline_stages: {
        Row: {
          business_id: string
          color: string
          created_at: string
          id: string
          name: string
          position: number
        }
        Insert: {
          business_id: string
          color?: string
          created_at?: string
          id?: string
          name: string
          position?: number
        }
        Update: {
          business_id?: string
          color?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_pipeline_stages_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_stage_events: {
        Row: {
          business_id: string
          event_key: Database["public"]["Enums"]["crm_stage_event_key"]
          stage_id: string | null
        }
        Insert: {
          business_id: string
          event_key: Database["public"]["Enums"]["crm_stage_event_key"]
          stage_id?: string | null
        }
        Update: {
          business_id?: string
          event_key?: Database["public"]["Enums"]["crm_stage_event_key"]
          stage_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_stage_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_stage_events_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "crm_pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          birth_date: string | null
          bookings_count: number
          business_id: string
          city: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          last_name: string | null
          nif: string | null
          no_show_count: number
          notes: string | null
          phone: string | null
          phone_norm: string | null
          postal_code: string | null
          profession: string | null
          province: string | null
          tags: string[]
          updated_at: string
        }
        Insert: {
          address?: string | null
          birth_date?: string | null
          bookings_count?: number
          business_id: string
          city?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          last_name?: string | null
          nif?: string | null
          no_show_count?: number
          notes?: string | null
          phone?: string | null
          phone_norm?: string | null
          postal_code?: string | null
          profession?: string | null
          province?: string | null
          tags?: string[]
          updated_at?: string
        }
        Update: {
          address?: string | null
          birth_date?: string | null
          bookings_count?: number
          business_id?: string
          city?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          last_name?: string | null
          nif?: string | null
          no_show_count?: number
          notes?: string | null
          phone?: string | null
          phone_norm?: string | null
          postal_code?: string | null
          profession?: string | null
          province?: string | null
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      dining_duration_rules: {
        Row: {
          dining_shift_id: string
          duration_min: number
          id: string
          pax_max: number
          pax_min: number
        }
        Insert: {
          dining_shift_id: string
          duration_min: number
          id?: string
          pax_max: number
          pax_min: number
        }
        Update: {
          dining_shift_id?: string
          duration_min?: number
          id?: string
          pax_max?: number
          pax_min?: number
        }
        Relationships: [
          {
            foreignKeyName: "dining_duration_rules_dining_shift_id_fkey"
            columns: ["dining_shift_id"]
            isOneToOne: false
            referencedRelation: "dining_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      dining_settings: {
        Row: {
          business_id: string
          created_at: string
          max_advance_days: number
          max_party_online: number
          min_lead_minutes: number
          min_party_online: number
          require_manual_confirmation: boolean
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          max_advance_days?: number
          max_party_online?: number
          min_lead_minutes?: number
          min_party_online?: number
          require_manual_confirmation?: boolean
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          max_advance_days?: number
          max_party_online?: number
          min_lead_minutes?: number
          min_party_online?: number
          require_manual_confirmation?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dining_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      dining_shifts: {
        Row: {
          active_weekdays: number[]
          allow_double_turn: boolean
          booking_duration_min: number
          business_id: string
          cleanup_min: number
          created_at: string
          end_time: string
          id: string
          is_active: boolean
          last_call_time: string | null
          max_bookings_per_slot: number | null
          max_covers: number
          max_covers_per_slot: number | null
          name: string
          online_max_covers: number | null
          pacing_enabled: boolean
          slot_interval_min: number
          start_time: string
          updated_at: string
        }
        Insert: {
          active_weekdays?: number[]
          allow_double_turn?: boolean
          booking_duration_min?: number
          business_id: string
          cleanup_min?: number
          created_at?: string
          end_time: string
          id?: string
          is_active?: boolean
          last_call_time?: string | null
          max_bookings_per_slot?: number | null
          max_covers: number
          max_covers_per_slot?: number | null
          name: string
          online_max_covers?: number | null
          pacing_enabled?: boolean
          slot_interval_min?: number
          start_time: string
          updated_at?: string
        }
        Update: {
          active_weekdays?: number[]
          allow_double_turn?: boolean
          booking_duration_min?: number
          business_id?: string
          cleanup_min?: number
          created_at?: string
          end_time?: string
          id?: string
          is_active?: boolean
          last_call_time?: string | null
          max_bookings_per_slot?: number | null
          max_covers?: number
          max_covers_per_slot?: number | null
          name?: string
          online_max_covers?: number | null
          pacing_enabled?: boolean
          slot_interval_min?: number
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dining_shifts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      dining_table_combos: {
        Row: {
          business_id: string
          cap_max: number
          cap_min: number
          created_at: string
          id: string
          is_active: boolean
          name: string | null
          priority: number
          table_ids: string[]
        }
        Insert: {
          business_id: string
          cap_max: number
          cap_min: number
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string | null
          priority?: number
          table_ids: string[]
        }
        Update: {
          business_id?: string
          cap_max?: number
          cap_min?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string | null
          priority?: number
          table_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "dining_table_combos_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      dining_tables: {
        Row: {
          business_id: string
          cap_max: number
          cap_min: number
          created_at: string
          id: string
          is_active: boolean
          name: string
          pos_x: number | null
          pos_y: number | null
          priority: number
          shape: string
          updated_at: string
          zone_id: string | null
        }
        Insert: {
          business_id: string
          cap_max: number
          cap_min: number
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          pos_x?: number | null
          pos_y?: number | null
          priority?: number
          shape?: string
          updated_at?: string
          zone_id?: string | null
        }
        Update: {
          business_id?: string
          cap_max?: number
          cap_min?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          pos_x?: number | null
          pos_y?: number | null
          priority?: number
          shape?: string
          updated_at?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dining_tables_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dining_tables_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "dining_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      dining_zones: {
        Row: {
          business_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          reservable_online: boolean
          sort_order: number
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          reservable_online?: boolean
          sort_order?: number
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          reservable_online?: boolean
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "dining_zones_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_google_accounts: {
        Row: {
          access_token: string | null
          business_id: string | null
          calendar_id: string
          created_at: string
          google_email: string | null
          id: string
          professional_id: string | null
          refresh_token: string | null
          sync_enabled: boolean
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          business_id?: string | null
          calendar_id?: string
          created_at?: string
          google_email?: string | null
          id?: string
          professional_id?: string | null
          refresh_token?: string | null
          sync_enabled?: boolean
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          business_id?: string | null
          calendar_id?: string
          created_at?: string
          google_email?: string | null
          id?: string
          professional_id?: string | null
          refresh_token?: string | null
          sync_enabled?: boolean
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_google_accounts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_google_accounts_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_hours: {
        Row: {
          end_time: string
          id: string
          professional_id: string
          start_time: string
          weekday: number
        }
        Insert: {
          end_time: string
          id?: string
          professional_id: string
          start_time: string
          weekday: number
        }
        Update: {
          end_time?: string
          id?: string
          professional_id?: string
          start_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "professional_hours_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      professionals: {
        Row: {
          business_id: string
          color: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          business_id: string
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "professionals_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          is_super_admin: boolean
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          is_super_admin?: boolean
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          is_super_admin?: boolean
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          count: number
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          window_start: string
        }
        Update: {
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      review_requests_log: {
        Row: {
          booking_id: string
          business_id: string
          error: string | null
          id: string
          provider_message_id: string | null
          sent_at: string
          status: string
        }
        Insert: {
          booking_id: string
          business_id: string
          error?: string | null
          id?: string
          provider_message_id?: string | null
          sent_at?: string
          status?: string
        }
        Update: {
          booking_id?: string
          business_id?: string
          error?: string | null
          id?: string
          provider_message_id?: string | null
          sent_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_requests_log_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_requests_log_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      service_availability: {
        Row: {
          end_time: string
          id: string
          service_id: string
          start_time: string
          weekday: number
        }
        Insert: {
          end_time: string
          id?: string
          service_id: string
          start_time: string
          weekday: number
        }
        Update: {
          end_time?: string
          id?: string
          service_id?: string
          start_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_availability_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_professionals: {
        Row: {
          created_at: string
          professional_id: string
          service_id: string
        }
        Insert: {
          created_at?: string
          professional_id: string
          service_id: string
        }
        Update: {
          created_at?: string
          professional_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_professionals_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_professionals_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          buffer_min: number
          business_id: string
          created_at: string
          duration_min: number
          id: string
          is_active: boolean
          name: string
          price: number | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          buffer_min?: number
          business_id: string
          created_at?: string
          duration_min: number
          id?: string
          is_active?: boolean
          name: string
          price?: number | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          buffer_min?: number
          business_id?: string
          created_at?: string
          duration_min?: number
          id?: string
          is_active?: boolean
          name?: string
          price?: number | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist: {
        Row: {
          business_id: string
          created_at: string
          id: string
          name: string
          notes: string | null
          notified_at: string | null
          party_size: number
          phone: string | null
          seated_booking_id: string | null
          status: Database["public"]["Enums"]["waitlist_status"]
          zone_id: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          notified_at?: string | null
          party_size: number
          phone?: string | null
          seated_booking_id?: string | null
          status?: Database["public"]["Enums"]["waitlist_status"]
          zone_id?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          notified_at?: string | null
          party_size?: number
          phone?: string | null
          seated_booking_id?: string | null
          status?: Database["public"]["Enums"]["waitlist_status"]
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_seated_booking_id_fkey"
            columns: ["seated_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "dining_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_reminders_log: {
        Row: {
          booking_id: string
          business_id: string
          error: string | null
          id: string
          provider_message_id: string | null
          reminder_kind: string
          sent_at: string
          status: string
        }
        Insert: {
          booking_id: string
          business_id: string
          error?: string | null
          id?: string
          provider_message_id?: string | null
          reminder_kind?: string
          sent_at?: string
          status?: string
        }
        Update: {
          booking_id?: string
          business_id?: string
          error?: string | null
          id?: string
          provider_message_id?: string | null
          reminder_kind?: string
          sent_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_reminders_log_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_reminders_log_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adv_can_access_client: {
        Args: { b: string; c: string }
        Returns: boolean
      }
      adv_list_team: {
        Args: { p_business_id: string }
        Returns: {
          email: string
          full_name: string
          role: Database["public"]["Enums"]["business_user_role"]
          user_id: string
        }[]
      }
      adv_normalize_nif: { Args: { t: string }; Returns: string }
      adv_normalize_phone: { Args: { t: string }; Returns: string }
      adv_seed_doc_types: {
        Args: { p_business_id: string }
        Returns: undefined
      }
      agency_can_manage_members: { Args: { b: string }; Returns: boolean }
      agency_chat_unread: {
        Args: { p_business_id: string }
        Returns: {
          scope_id: string
          unread: number
        }[]
      }
      agency_generate_deadline_notifications: { Args: never; Returns: number }
      agency_in_team: { Args: { b: string; t: string }; Returns: boolean }
      agency_is_directiva: { Args: { b: string }; Returns: boolean }
      agency_is_member: { Args: { b: string }; Returns: boolean }
      agency_list_members_admin: {
        Args: { p_business_id: string }
        Returns: {
          email: string
          last_sign_in_at: string
          user_id: string
        }[]
      }
      agency_save_push_subscription: {
        Args: {
          p_auth: string
          p_endpoint: string
          p_p256dh: string
          p_user_agent: string
        }
        Returns: undefined
      }
      agency_seed_teams: { Args: { p_business_id: string }; Returns: undefined }
      agency_storage_access: { Args: { p_name: string }; Returns: boolean }
      cancel_booking_by_locator: {
        Args: { p_locator: string }
        Returns: boolean
      }
      create_public_booking: {
        Args: {
          p_business_id: string
          p_channel?: Database["public"]["Enums"]["booking_channel"]
          p_email: string
          p_last_name: string
          p_name: string
          p_notes?: string
          p_phone: string
          p_professional_id?: string
          p_service_id: string
          p_starts_at: string
        }
        Returns: {
          business_id: string
          channel: Database["public"]["Enums"]["booking_channel"]
          created_at: string
          customer_email: string | null
          customer_id: string | null
          customer_last_name: string | null
          customer_name: string
          customer_phone: string | null
          dining_shift_id: string | null
          dining_table_id: string | null
          ends_at: string
          google_event_id: string | null
          id: string
          locator: string
          notes: string | null
          party_size: number | null
          professional_id: string | null
          service_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          table_combo_id: string | null
          type: Database["public"]["Enums"]["business_type"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_public_dining_booking: {
        Args: {
          p_business_id: string
          p_channel?: Database["public"]["Enums"]["booking_channel"]
          p_email: string
          p_last_name: string
          p_name: string
          p_notes?: string
          p_party_size: number
          p_phone: string
          p_shift_id: string
          p_starts_at: string
          p_table_id?: string
        }
        Returns: {
          business_id: string
          channel: Database["public"]["Enums"]["booking_channel"]
          created_at: string
          customer_email: string | null
          customer_id: string | null
          customer_last_name: string | null
          customer_name: string
          customer_phone: string | null
          dining_shift_id: string | null
          dining_table_id: string | null
          ends_at: string
          google_event_id: string | null
          id: string
          locator: string
          notes: string | null
          party_size: number | null
          professional_id: string | null
          service_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          table_combo_id: string | null
          type: Database["public"]["Enums"]["business_type"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_walkin_booking: {
        Args: {
          p_business_id: string
          p_name: string
          p_notes?: string
          p_party_size: number
          p_phone?: string
          p_shift_id: string
          p_table_id?: string
        }
        Returns: {
          business_id: string
          channel: Database["public"]["Enums"]["booking_channel"]
          created_at: string
          customer_email: string | null
          customer_id: string | null
          customer_last_name: string | null
          customer_name: string
          customer_phone: string | null
          dining_shift_id: string | null
          dining_table_id: string | null
          ends_at: string
          google_event_id: string | null
          id: string
          locator: string
          notes: string | null
          party_size: number | null
          professional_id: string | null
          service_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          table_combo_id: string | null
          type: Database["public"]["Enums"]["business_type"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crm_accept_budget: {
        Args: { p_budget_id: string }
        Returns: {
          business_id: string
          card_id: string | null
          created_at: string
          customer_id: string
          id: string
          issued_at: string
          notes: string | null
          number: string
          status: Database["public"]["Enums"]["crm_budget_status"]
          updated_at: string
          valid_until_days: number
        }
        SetofOptions: {
          from: "*"
          to: "crm_budgets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crm_create_budget: {
        Args: {
          p_business_id: string
          p_card_id: string
          p_customer_id: string
          p_lines: Json
          p_notes: string
          p_valid_until_days: number
        }
        Returns: {
          business_id: string
          card_id: string | null
          created_at: string
          customer_id: string
          id: string
          issued_at: string
          notes: string | null
          number: string
          status: Database["public"]["Enums"]["crm_budget_status"]
          updated_at: string
          valid_until_days: number
        }
        SetofOptions: {
          from: "*"
          to: "crm_budgets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crm_create_invoice_from_budget: {
        Args: { p_budget_id: string }
        Returns: {
          budget_id: string | null
          business_id: string
          card_id: string | null
          created_at: string
          customer_id: string
          id: string
          irpf_rate: number
          issued_at: string
          notes: string | null
          number: string
          status: Database["public"]["Enums"]["crm_invoice_status"]
          updated_at: string
          year: number
        }
        SetofOptions: {
          from: "*"
          to: "crm_invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crm_create_invoice_manual: {
        Args: {
          p_business_id: string
          p_card_id: string
          p_customer_id: string
          p_irpf_rate: number
          p_lines: Json
          p_notes: string
        }
        Returns: {
          budget_id: string | null
          business_id: string
          card_id: string | null
          created_at: string
          customer_id: string
          id: string
          irpf_rate: number
          issued_at: string
          notes: string | null
          number: string
          status: Database["public"]["Enums"]["crm_invoice_status"]
          updated_at: string
          year: number
        }
        SetofOptions: {
          from: "*"
          to: "crm_invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crm_delete_budget: { Args: { p_budget_id: string }; Returns: undefined }
      crm_delete_pipeline_stage: {
        Args: { p_move_to_stage_id: string; p_stage_id: string }
        Returns: undefined
      }
      crm_duplicate_budget: {
        Args: { p_budget_id: string }
        Returns: {
          business_id: string
          card_id: string | null
          created_at: string
          customer_id: string
          id: string
          issued_at: string
          notes: string | null
          number: string
          status: Database["public"]["Enums"]["crm_budget_status"]
          updated_at: string
          valid_until_days: number
        }
        SetofOptions: {
          from: "*"
          to: "crm_budgets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crm_mark_invoice_paid: {
        Args: { p_invoice_id: string }
        Returns: {
          budget_id: string | null
          business_id: string
          card_id: string | null
          created_at: string
          customer_id: string
          id: string
          irpf_rate: number
          issued_at: string
          notes: string | null
          number: string
          status: Database["public"]["Enums"]["crm_invoice_status"]
          updated_at: string
          year: number
        }
        SetofOptions: {
          from: "*"
          to: "crm_invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crm_move_card_for_event: {
        Args: {
          p_business_id: string
          p_card_id: string
          p_event_key: Database["public"]["Enums"]["crm_stage_event_key"]
        }
        Returns: undefined
      }
      crm_next_document_number: {
        Args: {
          p_business_id: string
          p_doc_type: Database["public"]["Enums"]["crm_document_type"]
          p_year: number
        }
        Returns: string
      }
      crm_update_budget: {
        Args: {
          p_budget_id: string
          p_card_id: string
          p_customer_id: string
          p_lines: Json
          p_notes: string
          p_valid_until_days: number
        }
        Returns: {
          business_id: string
          card_id: string | null
          created_at: string
          customer_id: string
          id: string
          issued_at: string
          notes: string | null
          number: string
          status: Database["public"]["Enums"]["crm_budget_status"]
          updated_at: string
          valid_until_days: number
        }
        SetofOptions: {
          from: "*"
          to: "crm_budgets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crm_update_budget_status: {
        Args: {
          p_budget_id: string
          p_status: Database["public"]["Enums"]["crm_budget_status"]
        }
        Returns: {
          business_id: string
          card_id: string | null
          created_at: string
          customer_id: string
          id: string
          issued_at: string
          notes: string | null
          number: string
          status: Database["public"]["Enums"]["crm_budget_status"]
          updated_at: string
          valid_until_days: number
        }
        SetofOptions: {
          from: "*"
          to: "crm_budgets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crm_void_invoice: {
        Args: { p_invoice_id: string }
        Returns: {
          budget_id: string | null
          business_id: string
          card_id: string | null
          created_at: string
          customer_id: string
          id: string
          irpf_rate: number
          issued_at: string
          notes: string | null
          number: string
          status: Database["public"]["Enums"]["crm_invoice_status"]
          updated_at: string
          year: number
        }
        SetofOptions: {
          from: "*"
          to: "crm_invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      dining_assign_table: {
        Args: {
          p_allow_double_turn: boolean
          p_business_id: string
          p_channel: Database["public"]["Enums"]["booking_channel"]
          p_cleanup_min: number
          p_date: string
          p_ends_at: string
          p_party_size: number
          p_shift_id: string
          p_starts_at: string
          p_table_id?: string
          p_tz: string
        }
        Returns: {
          combo_id: string
          table_id: string
        }[]
      }
      dining_duration_for: {
        Args: { p_party_size: number; p_shift_id: string }
        Returns: number
      }
      dining_table_busy: {
        Args: {
          p_allow_double_turn: boolean
          p_cleanup_min: number
          p_date: string
          p_end: string
          p_exclude_booking_id?: string
          p_shift_id: string
          p_start: string
          p_table_id: string
          p_tz: string
        }
        Returns: boolean
      }
      disconnect_business_google: {
        Args: { p_business_id: string }
        Returns: undefined
      }
      disconnect_business_google_profile: {
        Args: { p_business_id: string }
        Returns: undefined
      }
      disconnect_professional_google: {
        Args: { p_professional_id: string }
        Returns: undefined
      }
      generate_locator: { Args: never; Returns: string }
      get_available_days: {
        Args: {
          p_business_id: string
          p_date_from: string
          p_date_to: string
          p_professional_id?: string
          p_service_id: string
        }
        Returns: {
          day: string
        }[]
      }
      get_available_dining_days: {
        Args: {
          p_business_id: string
          p_date_from: string
          p_date_to: string
          p_party_size: number
        }
        Returns: {
          day: string
        }[]
      }
      get_available_dining_slots: {
        Args: {
          p_business_id: string
          p_channel?: Database["public"]["Enums"]["booking_channel"]
          p_date: string
          p_party_size: number
        }
        Returns: {
          shift_id: string
          shift_name: string
          slot_end: string
          slot_start: string
        }[]
      }
      get_available_slots: {
        Args: {
          p_business_id: string
          p_channel?: Database["public"]["Enums"]["booking_channel"]
          p_date: string
          p_professional_id?: string
          p_service_id: string
        }
        Returns: {
          slot_end: string
          slot_start: string
        }[]
      }
      get_booking_by_locator: {
        Args: { p_locator: string }
        Returns: {
          business_name: string
          customer_name: string
          ends_at: string
          locator: string
          logo_url: string
          party_size: number
          primary_color: string
          service_name: string
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          timezone: string
          type: Database["public"]["Enums"]["business_type"]
        }[]
      }
      get_business_google_profile_status: {
        Args: { p_business_id: string }
        Returns: {
          connected: boolean
          google_email: string
          last_sync_error: string
          last_sync_status: string
          last_synced_at: string
          location_title: string
          sync_enabled: boolean
        }[]
      }
      get_business_google_status: {
        Args: { p_business_id: string }
        Returns: {
          connected: boolean
          google_email: string
          sync_enabled: boolean
        }[]
      }
      get_business_integration: {
        Args: { p_business_id: string }
        Returns: {
          email_from: string
          has_resend_key: boolean
          has_whatsapp_token: boolean
          whatsapp_phone_number_id: string
        }[]
      }
      get_dining_table_options: {
        Args: {
          p_business_id: string
          p_ends_at: string
          p_exclude_booking_id?: string
          p_party_size: number
          p_shift_id: string
          p_starts_at: string
        }
        Returns: {
          cap_max: number
          cap_min: number
          fits: boolean
          id: string
          is_free: boolean
          name: string
          zone_name: string
        }[]
      }
      get_gemini_status: {
        Args: { p_business_id: string }
        Returns: {
          has_gemini_key: boolean
        }[]
      }
      get_google_credentials_status: {
        Args: { p_business_id: string }
        Returns: {
          google_client_id: string
          has_google_client_secret: boolean
        }[]
      }
      get_professional_google_status: {
        Args: { p_professional_id: string }
        Returns: {
          connected: boolean
          google_email: string
          sync_enabled: boolean
        }[]
      }
      get_public_business: {
        Args: { p_slug: string }
        Returns: {
          id: string
          logo_url: string
          name: string
          primary_color: string
          slot_interval_min: number
          timezone: string
          type: Database["public"]["Enums"]["business_type"]
        }[]
      }
      get_public_dining_settings: {
        Args: { p_business_id: string }
        Returns: {
          max_party_online: number
          min_party_online: number
        }[]
      }
      get_public_services: {
        Args: { p_business_id: string }
        Returns: {
          duration_min: number
          id: string
          name: string
          price: number
          professionals: Json
        }[]
      }
      import_customer: {
        Args: {
          p_business_id: string
          p_email?: string
          p_full_name: string
          p_last_name?: string
          p_notes?: string
          p_phone?: string
        }
        Returns: {
          address: string | null
          birth_date: string | null
          bookings_count: number
          business_id: string
          city: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          last_name: string | null
          nif: string | null
          no_show_count: number
          notes: string | null
          phone: string | null
          phone_norm: string | null
          postal_code: string | null
          profession: string | null
          province: string | null
          tags: string[]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "customers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_business_member: { Args: { b: string }; Returns: boolean }
      is_business_owner: { Args: { b: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      normalize_phone: { Args: { p: string }; Returns: string }
      rate_limit_hit: {
        Args: { p_key: string; p_max: number; p_window_seconds: number }
        Returns: boolean
      }
      recount_customer: { Args: { cid: string }; Returns: undefined }
      replace_business_hours_from_sync: {
        Args: { p_business_id: string; p_rows: Json }
        Returns: undefined
      }
      set_business_google_profile_sync: {
        Args: { p_business_id: string; p_enabled: boolean }
        Returns: undefined
      }
      set_business_google_sync: {
        Args: { p_business_id: string; p_enabled: boolean }
        Returns: undefined
      }
      set_business_integration: {
        Args: {
          p_business_id: string
          p_email_from: string
          p_resend_api_key?: string
          p_whatsapp_phone_number_id: string
          p_whatsapp_token?: string
        }
        Returns: undefined
      }
      set_gemini_key: {
        Args: { p_api_key?: string; p_business_id: string }
        Returns: undefined
      }
      set_google_credentials: {
        Args: {
          p_business_id: string
          p_client_id: string
          p_client_secret?: string
        }
        Returns: undefined
      }
      set_professional_google_sync: {
        Args: { p_enabled: boolean; p_professional_id: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      block_scope: "business" | "professional"
      booking_channel: "web" | "manual" | "walkin"
      booking_status:
        | "confirmada"
        | "cancelada"
        | "completada"
        | "no_show"
        | "pendiente"
        | "sentada"
      business_type:
        | "citas"
        | "restaurante"
        | "psicologo"
        | "autonomo"
        | "asesoria"
        | "agencia"
      business_user_role: "owner" | "staff"
      crm_budget_status: "borrador" | "enviado" | "aceptado" | "rechazado"
      crm_document_type: "presupuesto" | "factura"
      crm_event_type: "visita" | "llamada" | "trabajo" | "otro"
      crm_invoice_status: "emitida" | "pagada" | "anulada"
      crm_stage_event_key:
        | "presupuesto_enviado"
        | "presupuesto_aceptado"
        | "factura_pagada"
      waitlist_status: "esperando" | "avisado" | "sentado" | "cancelado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      block_scope: ["business", "professional"],
      booking_channel: ["web", "manual", "walkin"],
      booking_status: [
        "confirmada",
        "cancelada",
        "completada",
        "no_show",
        "pendiente",
        "sentada",
      ],
      business_type: [
        "citas",
        "restaurante",
        "psicologo",
        "autonomo",
        "asesoria",
        "agencia",
      ],
      business_user_role: ["owner", "staff"],
      crm_budget_status: ["borrador", "enviado", "aceptado", "rechazado"],
      crm_document_type: ["presupuesto", "factura"],
      crm_event_type: ["visita", "llamada", "trabajo", "otro"],
      crm_invoice_status: ["emitida", "pagada", "anulada"],
      crm_stage_event_key: [
        "presupuesto_enviado",
        "presupuesto_aceptado",
        "factura_pagada",
      ],
      waitlist_status: ["esperando", "avisado", "sentado", "cancelado"],
    },
  },
} as const
