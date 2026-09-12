export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
          starts_at?: string
        }
        Relationships: []
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
          ends_at: string
          id: string
          locator: string
          notes: string | null
          party_size: number | null
          professional_id: string | null
          service_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
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
          ends_at: string
          id?: string
          locator: string
          notes?: string | null
          party_size?: number | null
          professional_id?: string | null
          service_id?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["booking_status"]
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
          ends_at?: string
          id?: string
          locator?: string
          notes?: string | null
          party_size?: number | null
          professional_id?: string | null
          service_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          type?: Database["public"]["Enums"]["business_type"]
          updated_at?: string
        }
        Relationships: []
      }
      business_integrations: {
        Row: { business_id: string; email_from: string | null; resend_api_key: string | null; whatsapp_phone_number_id: string | null; whatsapp_token: string | null; created_at: string; updated_at: string }
        Insert: { business_id: string; email_from?: string | null; resend_api_key?: string | null; whatsapp_phone_number_id?: string | null; whatsapp_token?: string | null; created_at?: string; updated_at?: string }
        Update: { business_id?: string; email_from?: string | null; resend_api_key?: string | null; whatsapp_phone_number_id?: string | null; whatsapp_token?: string | null; created_at?: string; updated_at?: string }
        Relationships: []
      }
      business_hours: {
        Row: { business_id: string; close_time: string; id: string; open_time: string; weekday: number }
        Insert: { business_id: string; close_time: string; id?: string; open_time: string; weekday: number }
        Update: { business_id?: string; close_time?: string; id?: string; open_time?: string; weekday?: number }
        Relationships: []
      }
      business_users: {
        Row: { business_id: string; created_at: string; id: string; role: Database["public"]["Enums"]["business_user_role"]; user_id: string }
        Insert: { business_id: string; created_at?: string; id?: string; role?: Database["public"]["Enums"]["business_user_role"]; user_id: string }
        Update: { business_id?: string; created_at?: string; id?: string; role?: Database["public"]["Enums"]["business_user_role"]; user_id?: string }
        Relationships: []
      }
      businesses: {
        Row: {
          created_at: string
          default_capacity: number
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          primary_color: string
          reminder_lang: string
          reminder_template_name: string | null
          slot_interval_min: number
          slug: string
          timezone: string
          type: Database["public"]["Enums"]["business_type"]
          updated_at: string
          whatsapp_phone: string | null
          whatsapp_reminders_enabled: boolean
        }
        Insert: {
          created_at?: string
          default_capacity?: number
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          primary_color?: string
          reminder_lang?: string
          reminder_template_name?: string | null
          slot_interval_min?: number
          slug: string
          timezone?: string
          type: Database["public"]["Enums"]["business_type"]
          updated_at?: string
          whatsapp_phone?: string | null
          whatsapp_reminders_enabled?: boolean
        }
        Update: {
          created_at?: string
          default_capacity?: number
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          primary_color?: string
          reminder_lang?: string
          reminder_template_name?: string | null
          slot_interval_min?: number
          slug?: string
          timezone?: string
          type?: Database["public"]["Enums"]["business_type"]
          updated_at?: string
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
          phone: string | null
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
          phone?: string | null
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
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      dining_shifts: {
        Row: {
          active_weekdays: number[]
          booking_duration_min: number
          business_id: string
          created_at: string
          end_time: string
          id: string
          is_active: boolean
          max_covers: number
          name: string
          slot_interval_min: number
          start_time: string
          updated_at: string
        }
        Insert: {
          active_weekdays?: number[]
          booking_duration_min?: number
          business_id: string
          created_at?: string
          end_time: string
          id?: string
          is_active?: boolean
          max_covers: number
          name: string
          slot_interval_min?: number
          start_time: string
          updated_at?: string
        }
        Update: {
          active_weekdays?: number[]
          booking_duration_min?: number
          business_id?: string
          created_at?: string
          end_time?: string
          id?: string
          is_active?: boolean
          max_covers?: number
          name?: string
          slot_interval_min?: number
          start_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      professional_hours: {
        Row: { end_time: string; id: string; professional_id: string; start_time: string; weekday: number }
        Insert: { end_time: string; id?: string; professional_id: string; start_time: string; weekday: number }
        Update: { end_time?: string; id?: string; professional_id?: string; start_time?: string; weekday?: number }
        Relationships: []
      }
      professionals: {
        Row: { business_id: string; created_at: string; id: string; is_active: boolean; name: string; updated_at: string }
        Insert: { business_id: string; created_at?: string; id?: string; is_active?: boolean; name: string; updated_at?: string }
        Update: { business_id?: string; created_at?: string; id?: string; is_active?: boolean; name?: string; updated_at?: string }
        Relationships: []
      }
      profiles: {
        Row: { created_at: string; full_name: string | null; id: string; is_super_admin: boolean }
        Insert: { created_at?: string; full_name?: string | null; id: string; is_super_admin?: boolean }
        Update: { created_at?: string; full_name?: string | null; id?: string; is_super_admin?: boolean }
        Relationships: []
      }
      service_availability: {
        Row: { end_time: string; id: string; service_id: string; start_time: string; weekday: number }
        Insert: { end_time: string; id?: string; service_id: string; start_time: string; weekday: number }
        Update: { end_time?: string; id?: string; service_id?: string; start_time?: string; weekday?: number }
        Relationships: []
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
          professional_id: string | null
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
          professional_id?: string | null
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
          professional_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
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
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      cancel_booking_by_locator: { Args: { p_locator: string }; Returns: boolean }
      create_public_booking: {
        Args: {
          p_business_id: string
          p_channel?: Database["public"]["Enums"]["booking_channel"]
          p_email: string
          p_last_name: string
          p_name: string
          p_notes?: string
          p_phone: string
          p_service_id: string
          p_starts_at: string
        }
        Returns: Database["public"]["Tables"]["bookings"]["Row"]
      }
      generate_locator: { Args: Record<string, never>; Returns: string }
      get_available_slots: {
        Args: { p_business_id: string; p_date: string; p_service_id: string }
        Returns: { slot_end: string; slot_start: string }[]
      }
      get_available_dining_slots: {
        Args: { p_business_id: string; p_date: string; p_party_size: number }
        Returns: { slot_start: string; slot_end: string; shift_id: string; shift_name: string }[]
      }
      create_public_dining_booking: {
        Args: {
          p_business_id: string
          p_shift_id: string
          p_starts_at: string
          p_party_size: number
          p_name: string
          p_last_name: string
          p_phone: string
          p_email: string
          p_notes?: string
          p_channel?: Database["public"]["Enums"]["booking_channel"]
        }
        Returns: Database["public"]["Tables"]["bookings"]["Row"]
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
      get_public_services: {
        Args: { p_business_id: string }
        Returns: {
          duration_min: number
          id: string
          name: string
          price: number
          professional_id: string
          professional_name: string
        }[]
      }
      is_business_member: { Args: { b: string }; Returns: boolean }
      is_super_admin: { Args: Record<string, never>; Returns: boolean }
      get_business_integration: {
        Args: { p_business_id: string }
        Returns: { email_from: string; whatsapp_phone_number_id: string; has_resend_key: boolean; has_whatsapp_token: boolean }[]
      }
      set_business_integration: {
        Args: {
          p_business_id: string
          p_email_from: string
          p_whatsapp_phone_number_id: string
          p_resend_api_key?: string
          p_whatsapp_token?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      block_scope: "business" | "professional"
      booking_channel: "web" | "manual"
      booking_status: "confirmada" | "cancelada" | "completada" | "no_show"
      business_type: "citas" | "restaurante"
      business_user_role: "owner" | "staff"
    }
    CompositeTypes: { [_ in never]: never }
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]
