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
      customers: {
        Row: {
          bookings_count: number
          business_id: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          last_name: string | null
          no_show_count: number
          notes: string | null
          phone: string | null
          phone_norm: string | null
          tags: string[]
          updated_at: string
        }
        Insert: {
          bookings_count?: number
          business_id: string
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          last_name?: string | null
          no_show_count?: number
          notes?: string | null
          phone?: string | null
          phone_norm?: string | null
          tags?: string[]
          updated_at?: string
        }
        Update: {
          bookings_count?: number
          business_id?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          last_name?: string | null
          no_show_count?: number
          notes?: string | null
          phone?: string | null
          phone_norm?: string | null
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
          calendar_id: string
          created_at: string
          google_email: string | null
          professional_id: string
          refresh_token: string | null
          sync_enabled: boolean
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          calendar_id?: string
          created_at?: string
          google_email?: string | null
          professional_id: string
          refresh_token?: string | null
          sync_enabled?: boolean
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          calendar_id?: string
          created_at?: string
          google_email?: string | null
          professional_id?: string
          refresh_token?: string | null
          sync_enabled?: boolean
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_google_accounts_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: true
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
          bookings_count: number
          business_id: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          last_name: string | null
          no_show_count: number
          notes: string | null
          phone: string | null
          phone_norm: string | null
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
      is_super_admin: { Args: never; Returns: boolean }
      normalize_phone: { Args: { p: string }; Returns: string }
      recount_customer: { Args: { cid: string }; Returns: undefined }
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
      business_type: "citas" | "restaurante"
      business_user_role: "owner" | "staff"
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
      business_type: ["citas", "restaurante"],
      business_user_role: ["owner", "staff"],
      waitlist_status: ["esperando", "avisado", "sentado", "cancelado"],
    },
  },
} as const
