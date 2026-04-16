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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      availability_schedules: {
        Row: {
          created_at: string | null
          day_of_week: number
          end_time: string
          end_time_2: string | null
          id: string
          is_active: boolean | null
          start_time: string
          start_time_2: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          day_of_week: number
          end_time: string
          end_time_2?: string | null
          id?: string
          is_active?: boolean | null
          start_time: string
          start_time_2?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          end_time_2?: string | null
          id?: string
          is_active?: boolean | null
          start_time?: string
          start_time_2?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      billing_invoices: {
        Row: {
          amount: number
          boleto_url: string | null
          client_id: string | null
          contract_billing_id: string | null
          created_at: string | null
          due_date: string
          id: string
          one_time_sale_id: string | null
          pagarme_charge_id: string | null
          pagarme_order_id: string | null
          payment_link: string | null
          payment_method: string | null
          pix_copy_paste: string | null
          pix_qr_code_url: string | null
          status: string | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          amount: number
          boleto_url?: string | null
          client_id?: string | null
          contract_billing_id?: string | null
          created_at?: string | null
          due_date: string
          id?: string
          one_time_sale_id?: string | null
          pagarme_charge_id?: string | null
          pagarme_order_id?: string | null
          payment_link?: string | null
          payment_method?: string | null
          pix_copy_paste?: string | null
          pix_qr_code_url?: string | null
          status?: string | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          amount?: number
          boleto_url?: string | null
          client_id?: string | null
          contract_billing_id?: string | null
          created_at?: string | null
          due_date?: string
          id?: string
          one_time_sale_id?: string | null
          pagarme_charge_id?: string | null
          pagarme_order_id?: string | null
          payment_link?: string | null
          payment_method?: string | null
          pix_copy_paste?: string | null
          pix_qr_code_url?: string | null
          status?: string | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "analytics_sales_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "billing_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_invoices_contract_billing_id_fkey"
            columns: ["contract_billing_id"]
            isOneToOne: true
            referencedRelation: "contract_billings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_invoices_one_time_sale_id_fkey"
            columns: ["one_time_sale_id"]
            isOneToOne: true
            referencedRelation: "one_time_sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_invoices_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          closer_id: string | null
          created_at: string | null
          end_time: string
          google_event_id: string | null
          id: string
          meeting_link: string | null
          opportunity_id: string | null
          start_time: string
          updated_at: string | null
        }
        Insert: {
          closer_id?: string | null
          created_at?: string | null
          end_time: string
          google_event_id?: string | null
          id?: string
          meeting_link?: string | null
          opportunity_id?: string | null
          start_time: string
          updated_at?: string | null
        }
        Update: {
          closer_id?: string | null
          created_at?: string | null
          end_time?: string
          google_event_id?: string | null
          id?: string
          meeting_link?: string | null
          opportunity_id?: string | null
          start_time?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_closer_id_fkey"
            columns: ["closer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "analytics_sales_view"
            referencedColumns: ["opportunity_id"]
          },
          {
            foreignKeyName: "bookings_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      churns: {
        Row: {
          churn_date: string
          client_id: string
          contract_id: string
          created_at: string
          id: string
          mrr_lost: number
          penalty_amount: number | null
          penalty_paid: boolean | null
          reason_detail: string | null
          reason_type: string | null
          workspace_id: string
        }
        Insert: {
          churn_date: string
          client_id: string
          contract_id: string
          created_at?: string
          id?: string
          mrr_lost: number
          penalty_amount?: number | null
          penalty_paid?: boolean | null
          reason_detail?: string | null
          reason_type?: string | null
          workspace_id: string
        }
        Update: {
          churn_date?: string
          client_id?: string
          contract_id?: string
          created_at?: string
          id?: string
          mrr_lost?: number
          penalty_amount?: number | null
          penalty_paid?: boolean | null
          reason_detail?: string | null
          reason_type?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "churns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "analytics_sales_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "churns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "churns_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "churns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      client_activities: {
        Row: {
          action_type: string
          client_id: string
          contract_id: string | null
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          action_type: string
          client_id: string
          contract_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          user_id: string
          workspace_id: string
        }
        Update: {
          action_type?: string
          client_id?: string
          contract_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_activities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "analytics_sales_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_activities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_activities_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_activities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      client_assets: {
        Row: {
          client_id: string
          contract_id: string | null
          created_at: string
          created_by: string | null
          file_path: string
          file_type: string | null
          id: string
          name: string
          size: number | null
          workspace_id: string
        }
        Insert: {
          client_id: string
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          file_path: string
          file_type?: string | null
          id?: string
          name: string
          size?: number | null
          workspace_id: string
        }
        Update: {
          client_id?: string
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          file_path?: string
          file_type?: string | null
          id?: string
          name?: string
          size?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_assets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "analytics_sales_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_assets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_assets_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_assets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      client_comments: {
        Row: {
          client_id: string
          content: string
          contract_id: string | null
          created_at: string
          id: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          client_id: string
          content: string
          contract_id?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          client_id?: string
          content?: string
          contract_id?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_comments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "analytics_sales_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_comments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_comments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_comments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      client_performance_metrics: {
        Row: {
          clicks: number | null
          client_id: string
          cpl: number | null
          created_at: string
          ctr: number | null
          id: string
          impressions: number | null
          leads: number | null
          period_end: string
          period_start: string
          revenue: number | null
          roas: number | null
          spend: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          clicks?: number | null
          client_id: string
          cpl?: number | null
          created_at?: string
          ctr?: number | null
          id?: string
          impressions?: number | null
          leads?: number | null
          period_end: string
          period_start: string
          revenue?: number | null
          roas?: number | null
          spend?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          clicks?: number | null
          client_id?: string
          cpl?: number | null
          created_at?: string
          ctr?: number | null
          id?: string
          impressions?: number | null
          leads?: number | null
          period_end?: string
          period_start?: string
          revenue?: number | null
          roas?: number | null
          spend?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_performance_metrics_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "analytics_sales_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_performance_metrics_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_performance_metrics_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          account_manager_id: string | null
          activity_segment: string | null
          city: string | null
          complement: string | null
          created_at: string
          document: string | null
          email: string | null
          email_billing: string | null
          id: string
          mobile: string | null
          municipal_registration: string | null
          name: string
          neighborhood: string | null
          notes: string | null
          number: string | null
          opportunity_id: string | null
          phone: string | null
          portal_token: string | null
          profession: string | null
          registration_date: string | null
          revenue_bracket: string | null
          source: string | null
          squad_id: string | null
          state: string | null
          state_registration: string | null
          status: string | null
          street: string | null
          trade_name: string | null
          updated_at: string
          workspace_id: string
          zip_code: string | null
        }
        Insert: {
          account_manager_id?: string | null
          activity_segment?: string | null
          city?: string | null
          complement?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          email_billing?: string | null
          id?: string
          mobile?: string | null
          municipal_registration?: string | null
          name: string
          neighborhood?: string | null
          notes?: string | null
          number?: string | null
          opportunity_id?: string | null
          phone?: string | null
          portal_token?: string | null
          profession?: string | null
          registration_date?: string | null
          revenue_bracket?: string | null
          source?: string | null
          squad_id?: string | null
          state?: string | null
          state_registration?: string | null
          status?: string | null
          street?: string | null
          trade_name?: string | null
          updated_at?: string
          workspace_id: string
          zip_code?: string | null
        }
        Update: {
          account_manager_id?: string | null
          activity_segment?: string | null
          city?: string | null
          complement?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          email_billing?: string | null
          id?: string
          mobile?: string | null
          municipal_registration?: string | null
          name?: string
          neighborhood?: string | null
          notes?: string | null
          number?: string | null
          opportunity_id?: string | null
          phone?: string | null
          portal_token?: string | null
          profession?: string | null
          registration_date?: string | null
          revenue_bracket?: string | null
          source?: string | null
          squad_id?: string | null
          state?: string | null
          state_registration?: string | null
          status?: string | null
          street?: string | null
          trade_name?: string | null
          updated_at?: string
          workspace_id?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_account_manager_id_fkey"
            columns: ["account_manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "analytics_sales_view"
            referencedColumns: ["opportunity_id"]
          },
          {
            foreignKeyName: "clients_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_squad_id_fkey"
            columns: ["squad_id"]
            isOneToOne: false
            referencedRelation: "squads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_attachments: {
        Row: {
          contract_id: string
          created_at: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          uploaded_by: string | null
        }
        Insert: {
          contract_id: string
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          contract_id?: string
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_attachments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_billings: {
        Row: {
          amount: number
          contract_id: string
          created_at: string
          discount: number | null
          due_date: string
          final_amount: number
          id: string
          notes: string | null
          payment_date: string | null
          payment_method: string | null
          status: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount: number
          contract_id: string
          created_at?: string
          discount?: number | null
          due_date: string
          final_amount: number
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          status?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          contract_id?: string
          created_at?: string
          discount?: number | null
          due_date?: string
          final_amount?: number
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          status?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_billings_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_billings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          account_manager_id: string | null
          billing_day: number | null
          cancellation_date: string | null
          cancellation_penalty: number | null
          cancellation_reason: string | null
          client_id: string
          commission_percentage: number | null
          contract_period: string | null
          created_at: string
          cs_id: string | null
          custom_period_months: number | null
          d4sign_id: string | null
          d4sign_template_id: string | null
          end_date: string | null
          id: string
          implementation_fee: number | null
          name: string
          opportunity_id: string | null
          pagarme_plan_id: string | null
          pagarme_subscription_id: string | null
          performance_rating: string | null
          recurrence_status: string | null
          signature_status: string | null
          squad_id: string | null
          start_date: string
          status: string | null
          updated_at: string
          value: number
          workspace_id: string
        }
        Insert: {
          account_manager_id?: string | null
          billing_day?: number | null
          cancellation_date?: string | null
          cancellation_penalty?: number | null
          cancellation_reason?: string | null
          client_id: string
          commission_percentage?: number | null
          contract_period?: string | null
          created_at?: string
          cs_id?: string | null
          custom_period_months?: number | null
          d4sign_id?: string | null
          d4sign_template_id?: string | null
          end_date?: string | null
          id?: string
          implementation_fee?: number | null
          name: string
          opportunity_id?: string | null
          pagarme_plan_id?: string | null
          pagarme_subscription_id?: string | null
          performance_rating?: string | null
          recurrence_status?: string | null
          signature_status?: string | null
          squad_id?: string | null
          start_date: string
          status?: string | null
          updated_at?: string
          value: number
          workspace_id: string
        }
        Update: {
          account_manager_id?: string | null
          billing_day?: number | null
          cancellation_date?: string | null
          cancellation_penalty?: number | null
          cancellation_reason?: string | null
          client_id?: string
          commission_percentage?: number | null
          contract_period?: string | null
          created_at?: string
          cs_id?: string | null
          custom_period_months?: number | null
          d4sign_id?: string | null
          d4sign_template_id?: string | null
          end_date?: string | null
          id?: string
          implementation_fee?: number | null
          name?: string
          opportunity_id?: string | null
          pagarme_plan_id?: string | null
          pagarme_subscription_id?: string | null
          performance_rating?: string | null
          recurrence_status?: string | null
          signature_status?: string | null
          squad_id?: string | null
          start_date?: string
          status?: string | null
          updated_at?: string
          value?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_account_manager_id_fkey"
            columns: ["account_manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "analytics_sales_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_cs_id_fkey"
            columns: ["cs_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "analytics_sales_view"
            referencedColumns: ["opportunity_id"]
          },
          {
            foreignKeyName: "contracts_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_squad_id_fkey"
            columns: ["squad_id"]
            isOneToOne: false
            referencedRelation: "squads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_tags: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
          workspace_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          workspace_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_tags_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_quiz_elements: {
        Row: {
          content: Json
          created_at: string | null
          icon: string | null
          id: string
          name: string
          type: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          content: Json
          created_at?: string | null
          icon?: string | null
          id?: string
          name: string
          type: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          content?: Json
          created_at?: string | null
          icon?: string | null
          id?: string
          name?: string
          type?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_quiz_elements_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      element_templates: {
        Row: {
          ai_prompt: string | null
          content: Json
          created_at: string | null
          id: string
          is_ai_generated: boolean | null
          title: string
          type: string
          workspace_id: string | null
        }
        Insert: {
          ai_prompt?: string | null
          content?: Json
          created_at?: string | null
          id?: string
          is_ai_generated?: boolean | null
          title: string
          type: string
          workspace_id?: string | null
        }
        Update: {
          ai_prompt?: string | null
          content?: Json
          created_at?: string | null
          id?: string
          is_ai_generated?: boolean | null
          title?: string
          type?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "element_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          type: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          type?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          type?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          description: string
          expense_date: string
          id: string
          is_recurring: boolean | null
          notes: string | null
          payment_date: string | null
          payment_method: string | null
          recurrence_pattern: string | null
          status: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          description: string
          expense_date: string
          id?: string
          is_recurring?: boolean | null
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          recurrence_pattern?: string | null
          status?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          description?: string
          expense_date?: string
          id?: string
          is_recurring?: boolean | null
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          recurrence_pattern?: string | null
          status?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_allocations: {
        Row: {
          amount: number
          category_id: string
          cost_center_id: string | null
          created_at: string
          id: string
          payable_id: string | null
          percentage: number
          receivable_id: string | null
          workspace_id: string
        }
        Insert: {
          amount?: number
          category_id: string
          cost_center_id?: string | null
          created_at?: string
          id?: string
          payable_id?: string | null
          percentage?: number
          receivable_id?: string | null
          workspace_id: string
        }
        Update: {
          amount?: number
          category_id?: string
          cost_center_id?: string | null
          created_at?: string
          id?: string
          payable_id?: string | null
          percentage?: number
          receivable_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_allocations_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_allocations_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "financial_cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_allocations_payable_id_fkey"
            columns: ["payable_id"]
            isOneToOne: false
            referencedRelation: "financial_payables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_allocations_receivable_id_fkey"
            columns: ["receivable_id"]
            isOneToOne: false
            referencedRelation: "financial_receivables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_allocations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          payable_id: string | null
          receivable_id: string | null
          uploaded_by: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          payable_id?: string | null
          receivable_id?: string | null
          uploaded_by?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          payable_id?: string | null
          receivable_id?: string | null
          uploaded_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_attachments_payable_id_fkey"
            columns: ["payable_id"]
            isOneToOne: false
            referencedRelation: "financial_payables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_attachments_receivable_id_fkey"
            columns: ["receivable_id"]
            isOneToOne: false
            referencedRelation: "financial_receivables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_attachments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_bank_accounts: {
        Row: {
          account_number: string | null
          agency: string | null
          bank_code: string | null
          closing_day: number | null
          color: string | null
          created_at: string
          credit_limit: number | null
          current_balance: number | null
          due_day: number | null
          id: string
          initial_balance: number | null
          is_active: boolean | null
          is_principal: boolean | null
          name: string
          type: string | null
          workspace_id: string
        }
        Insert: {
          account_number?: string | null
          agency?: string | null
          bank_code?: string | null
          closing_day?: number | null
          color?: string | null
          created_at?: string
          credit_limit?: number | null
          current_balance?: number | null
          due_day?: number | null
          id?: string
          initial_balance?: number | null
          is_active?: boolean | null
          is_principal?: boolean | null
          name: string
          type?: string | null
          workspace_id: string
        }
        Update: {
          account_number?: string | null
          agency?: string | null
          bank_code?: string | null
          closing_day?: number | null
          color?: string | null
          created_at?: string
          credit_limit?: number | null
          current_balance?: number | null
          due_day?: number | null
          id?: string
          initial_balance?: number | null
          is_active?: boolean | null
          is_principal?: boolean | null
          name?: string
          type?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_bank_accounts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_bank_transactions: {
        Row: {
          amount: number
          bank_account_id: string
          created_at: string
          description: string
          fitid: string
          id: string
          matched_payable_id: string | null
          matched_receivable_id: string | null
          status: Database["public"]["Enums"]["reconciliation_status"] | null
          transaction_date: string
          workspace_id: string
        }
        Insert: {
          amount: number
          bank_account_id: string
          created_at?: string
          description: string
          fitid: string
          id?: string
          matched_payable_id?: string | null
          matched_receivable_id?: string | null
          status?: Database["public"]["Enums"]["reconciliation_status"] | null
          transaction_date: string
          workspace_id: string
        }
        Update: {
          amount?: number
          bank_account_id?: string
          created_at?: string
          description?: string
          fitid?: string
          id?: string
          matched_payable_id?: string | null
          matched_receivable_id?: string | null
          status?: Database["public"]["Enums"]["reconciliation_status"] | null
          transaction_date?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_bank_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "financial_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_bank_transactions_matched_payable_id_fkey"
            columns: ["matched_payable_id"]
            isOneToOne: false
            referencedRelation: "financial_payables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_bank_transactions_matched_receivable_id_fkey"
            columns: ["matched_receivable_id"]
            isOneToOne: false
            referencedRelation: "financial_receivables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_bank_transactions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_categories: {
        Row: {
          active: boolean | null
          code: string | null
          created_at: string
          id: string
          is_system: boolean | null
          name: string
          order: number | null
          parent_id: string | null
          type: Database["public"]["Enums"]["financial_movement_type"]
          workspace_id: string
        }
        Insert: {
          active?: boolean | null
          code?: string | null
          created_at?: string
          id?: string
          is_system?: boolean | null
          name: string
          order?: number | null
          parent_id?: string | null
          type: Database["public"]["Enums"]["financial_movement_type"]
          workspace_id: string
        }
        Update: {
          active?: boolean | null
          code?: string | null
          created_at?: string
          id?: string
          is_system?: boolean | null
          name?: string
          order?: number | null
          parent_id?: string | null
          type?: Database["public"]["Enums"]["financial_movement_type"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_categories_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_cost_centers: {
        Row: {
          active: boolean | null
          code: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          active?: boolean | null
          code?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          active?: boolean | null
          code?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_cost_centers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_payables: {
        Row: {
          amount: number
          bank_account_id: string | null
          category_id: string | null
          competence_date: string
          cost_center_id: string | null
          created_at: string
          description: string
          discount: number | null
          discount_amount: number | null
          due_date: string
          fine: number | null
          fine_amount: number | null
          id: string
          interest: number | null
          interest_amount: number | null
          is_recurring: boolean | null
          notes: string | null
          paid_amount: number | null
          payment_date: string | null
          payment_method: string | null
          recurrence_pattern: string | null
          reference_code: string | null
          status: Database["public"]["Enums"]["financial_status"] | null
          supplier_id: string | null
          supplier_name: string | null
          title: string
          total_amount: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          category_id?: string | null
          competence_date?: string
          cost_center_id?: string | null
          created_at?: string
          description: string
          discount?: number | null
          discount_amount?: number | null
          due_date: string
          fine?: number | null
          fine_amount?: number | null
          id?: string
          interest?: number | null
          interest_amount?: number | null
          is_recurring?: boolean | null
          notes?: string | null
          paid_amount?: number | null
          payment_date?: string | null
          payment_method?: string | null
          recurrence_pattern?: string | null
          reference_code?: string | null
          status?: Database["public"]["Enums"]["financial_status"] | null
          supplier_id?: string | null
          supplier_name?: string | null
          title: string
          total_amount: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          category_id?: string | null
          competence_date?: string
          cost_center_id?: string | null
          created_at?: string
          description?: string
          discount?: number | null
          discount_amount?: number | null
          due_date?: string
          fine?: number | null
          fine_amount?: number | null
          id?: string
          interest?: number | null
          interest_amount?: number | null
          is_recurring?: boolean | null
          notes?: string | null
          paid_amount?: number | null
          payment_date?: string | null
          payment_method?: string | null
          recurrence_pattern?: string | null
          reference_code?: string | null
          status?: Database["public"]["Enums"]["financial_status"] | null
          supplier_id?: string | null
          supplier_name?: string | null
          title?: string
          total_amount?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_payables_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "financial_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_payables_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_payables_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "financial_cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_payables_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_financial_payables_supplier"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "financial_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_receivables: {
        Row: {
          amount: number
          bank_account_id: string | null
          category_id: string | null
          client_id: string | null
          competence_date: string
          contract_billing_id: string | null
          contract_id: string | null
          cost_center_id: string | null
          created_at: string
          description: string
          discount: number | null
          discount_amount: number | null
          due_date: string
          fine: number | null
          fine_amount: number | null
          id: string
          interest: number | null
          interest_amount: number | null
          notes: string | null
          one_time_sale_id: string | null
          paid_amount: number | null
          payment_date: string | null
          payment_method: string | null
          reference_code: string | null
          status: Database["public"]["Enums"]["financial_status"] | null
          title: string
          total_amount: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          category_id?: string | null
          client_id?: string | null
          competence_date?: string
          contract_billing_id?: string | null
          contract_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          description: string
          discount?: number | null
          discount_amount?: number | null
          due_date: string
          fine?: number | null
          fine_amount?: number | null
          id?: string
          interest?: number | null
          interest_amount?: number | null
          notes?: string | null
          one_time_sale_id?: string | null
          paid_amount?: number | null
          payment_date?: string | null
          payment_method?: string | null
          reference_code?: string | null
          status?: Database["public"]["Enums"]["financial_status"] | null
          title: string
          total_amount: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          category_id?: string | null
          client_id?: string | null
          competence_date?: string
          contract_billing_id?: string | null
          contract_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          description?: string
          discount?: number | null
          discount_amount?: number | null
          due_date?: string
          fine?: number | null
          fine_amount?: number | null
          id?: string
          interest?: number | null
          interest_amount?: number | null
          notes?: string | null
          one_time_sale_id?: string | null
          paid_amount?: number | null
          payment_date?: string | null
          payment_method?: string | null
          reference_code?: string | null
          status?: Database["public"]["Enums"]["financial_status"] | null
          title?: string
          total_amount?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_receivables_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "financial_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_receivables_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_receivables_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "analytics_sales_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "financial_receivables_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_receivables_contract_billing_id_fkey"
            columns: ["contract_billing_id"]
            isOneToOne: false
            referencedRelation: "contract_billings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_receivables_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_receivables_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "financial_cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_receivables_one_time_sale_id_fkey"
            columns: ["one_time_sale_id"]
            isOneToOne: false
            referencedRelation: "one_time_sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_receivables_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_suppliers: {
        Row: {
          created_at: string | null
          document: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          document?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          document?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_suppliers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          access_token: string
          calendar_settings: Json | null
          created_at: string | null
          email: string | null
          expires_at: string
          id: string
          provider: string
          refresh_token: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          calendar_settings?: Json | null
          created_at?: string | null
          email?: string | null
          expires_at: string
          id?: string
          provider: string
          refresh_token?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          calendar_settings?: Json | null
          created_at?: string | null
          email?: string | null
          expires_at?: string
          id?: string
          provider?: string
          refresh_token?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          message: string
          title: string
          type: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message: string
          title: string
          type: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string
          title?: string
          type?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      one_time_sales: {
        Row: {
          amount: number
          client_id: string | null
          created_at: string
          description: string
          discount: number | null
          due_date: string | null
          final_amount: number | null
          id: string
          notes: string | null
          opportunity_id: string | null
          payment_date: string | null
          payment_method: string | null
          sale_date: string
          status: string | null
          type: string | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          amount: number
          client_id?: string | null
          created_at?: string
          description: string
          discount?: number | null
          due_date?: string | null
          final_amount?: number | null
          id?: string
          notes?: string | null
          opportunity_id?: string | null
          payment_date?: string | null
          payment_method?: string | null
          sale_date?: string
          status?: string | null
          type?: string | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          amount?: number
          client_id?: string | null
          created_at?: string
          description?: string
          discount?: number | null
          due_date?: string | null
          final_amount?: number | null
          id?: string
          notes?: string | null
          opportunity_id?: string | null
          payment_date?: string | null
          payment_method?: string | null
          sale_date?: string
          status?: string | null
          type?: string | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "one_time_sales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "analytics_sales_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "one_time_sales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "one_time_sales_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: true
            referencedRelation: "analytics_sales_view"
            referencedColumns: ["opportunity_id"]
          },
          {
            foreignKeyName: "one_time_sales_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: true
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "one_time_sales_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          assigned_closer: string | null
          assigned_sdr: string | null
          company_ads_budget: string | null
          company_instagram: string | null
          company_investment: string | null
          company_revenue: string | null
          company_segment: string | null
          company_size: string | null
          company_website: string | null
          contract_signature_status: string | null
          contract_url: string | null
          converted_client_id: string | null
          converted_contract_id: string | null
          converted_sale_id: string | null
          created_at: string | null
          created_by: string | null
          current_stage_id: string | null
          custom_fields: Json | null
          d4sign_document_uuid: string | null
          disqualified_at: string | null
          estimated_value: number | null
          expected_close_date: string | null
          follow_up_date: string | null
          id: string
          is_held: boolean | null
          is_new_lead: boolean | null
          is_signed: boolean | null
          lead_company: string | null
          lead_document: string | null
          lead_email: string | null
          lead_name: string
          lead_phone: string
          lead_position: string | null
          lead_score: string | null
          loss_notes: string | null
          loss_reason: Database["public"]["Enums"]["loss_reason"] | null
          lost_at: string | null
          negotiated_billing_day: number | null
          negotiated_cancellation_penalty: number | null
          negotiated_commission_percentage: number | null
          negotiated_custom_period_months: number | null
          negotiated_discount: number | null
          negotiated_implementation_fee: number | null
          negotiated_payment_method: string | null
          negotiated_period: string | null
          negotiated_value: number | null
          payment_link_id: string | null
          payment_link_url: string | null
          payment_status: string | null
          proposal_sent_at: string | null
          qualified_product: string | null
          session_meeting_link: string | null
          session_scheduled_at: string | null
          session_status: string | null
          signed_at: string | null
          source: Database["public"]["Enums"]["lead_source"] | null
          sql_at: string | null
          stage_changed_at: string | null
          updated_at: string | null
          webinar_date: string | null
          won_at: string | null
          workspace_id: string
        }
        Insert: {
          assigned_closer?: string | null
          assigned_sdr?: string | null
          company_ads_budget?: string | null
          company_instagram?: string | null
          company_investment?: string | null
          company_revenue?: string | null
          company_segment?: string | null
          company_size?: string | null
          company_website?: string | null
          contract_signature_status?: string | null
          contract_url?: string | null
          converted_client_id?: string | null
          converted_contract_id?: string | null
          converted_sale_id?: string | null
          created_at?: string | null
          created_by?: string | null
          current_stage_id?: string | null
          custom_fields?: Json | null
          d4sign_document_uuid?: string | null
          disqualified_at?: string | null
          estimated_value?: number | null
          expected_close_date?: string | null
          follow_up_date?: string | null
          id?: string
          is_held?: boolean | null
          is_new_lead?: boolean | null
          is_signed?: boolean | null
          lead_company?: string | null
          lead_document?: string | null
          lead_email?: string | null
          lead_name: string
          lead_phone: string
          lead_position?: string | null
          lead_score?: string | null
          loss_notes?: string | null
          loss_reason?: Database["public"]["Enums"]["loss_reason"] | null
          lost_at?: string | null
          negotiated_billing_day?: number | null
          negotiated_cancellation_penalty?: number | null
          negotiated_commission_percentage?: number | null
          negotiated_custom_period_months?: number | null
          negotiated_discount?: number | null
          negotiated_implementation_fee?: number | null
          negotiated_payment_method?: string | null
          negotiated_period?: string | null
          negotiated_value?: number | null
          payment_link_id?: string | null
          payment_link_url?: string | null
          payment_status?: string | null
          proposal_sent_at?: string | null
          qualified_product?: string | null
          session_meeting_link?: string | null
          session_scheduled_at?: string | null
          session_status?: string | null
          signed_at?: string | null
          source?: Database["public"]["Enums"]["lead_source"] | null
          sql_at?: string | null
          stage_changed_at?: string | null
          updated_at?: string | null
          webinar_date?: string | null
          won_at?: string | null
          workspace_id: string
        }
        Update: {
          assigned_closer?: string | null
          assigned_sdr?: string | null
          company_ads_budget?: string | null
          company_instagram?: string | null
          company_investment?: string | null
          company_revenue?: string | null
          company_segment?: string | null
          company_size?: string | null
          company_website?: string | null
          contract_signature_status?: string | null
          contract_url?: string | null
          converted_client_id?: string | null
          converted_contract_id?: string | null
          converted_sale_id?: string | null
          created_at?: string | null
          created_by?: string | null
          current_stage_id?: string | null
          custom_fields?: Json | null
          d4sign_document_uuid?: string | null
          disqualified_at?: string | null
          estimated_value?: number | null
          expected_close_date?: string | null
          follow_up_date?: string | null
          id?: string
          is_held?: boolean | null
          is_new_lead?: boolean | null
          is_signed?: boolean | null
          lead_company?: string | null
          lead_document?: string | null
          lead_email?: string | null
          lead_name?: string
          lead_phone?: string
          lead_position?: string | null
          lead_score?: string | null
          loss_notes?: string | null
          loss_reason?: Database["public"]["Enums"]["loss_reason"] | null
          lost_at?: string | null
          negotiated_billing_day?: number | null
          negotiated_cancellation_penalty?: number | null
          negotiated_commission_percentage?: number | null
          negotiated_custom_period_months?: number | null
          negotiated_discount?: number | null
          negotiated_implementation_fee?: number | null
          negotiated_payment_method?: string | null
          negotiated_period?: string | null
          negotiated_value?: number | null
          payment_link_id?: string | null
          payment_link_url?: string | null
          payment_status?: string | null
          proposal_sent_at?: string | null
          qualified_product?: string | null
          session_meeting_link?: string | null
          session_scheduled_at?: string | null
          session_status?: string | null
          signed_at?: string | null
          source?: Database["public"]["Enums"]["lead_source"] | null
          sql_at?: string | null
          stage_changed_at?: string | null
          updated_at?: string | null
          webinar_date?: string | null
          won_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_assigned_closer_fkey"
            columns: ["assigned_closer"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_assigned_sdr_fkey"
            columns: ["assigned_sdr"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_converted_client_id_fkey"
            columns: ["converted_client_id"]
            isOneToOne: false
            referencedRelation: "analytics_sales_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "opportunities_converted_client_id_fkey"
            columns: ["converted_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_converted_contract_id_fkey"
            columns: ["converted_contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_converted_sale_id_fkey"
            columns: ["converted_sale_id"]
            isOneToOne: false
            referencedRelation: "one_time_sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_current_stage_id_fkey"
            columns: ["current_stage_id"]
            isOneToOne: false
            referencedRelation: "opportunity_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_qualified_product_fkey"
            columns: ["qualified_product"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_attachments: {
        Row: {
          created_at: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          is_pinned: boolean | null
          opportunity_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          is_pinned?: boolean | null
          opportunity_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          is_pinned?: boolean | null
          opportunity_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_attachments_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "analytics_sales_view"
            referencedColumns: ["opportunity_id"]
          },
          {
            foreignKeyName: "opportunity_attachments_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_notes: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          content: string
          created_at: string | null
          created_by: string
          id: string
          is_pinned: boolean | null
          note_type: string | null
          opportunity_id: string
          scheduled_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          content: string
          created_at?: string | null
          created_by: string
          id?: string
          is_pinned?: boolean | null
          note_type?: string | null
          opportunity_id: string
          scheduled_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          content?: string
          created_at?: string | null
          created_by?: string
          id?: string
          is_pinned?: boolean | null
          note_type?: string | null
          opportunity_id?: string
          scheduled_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_notes_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_notes_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "analytics_sales_view"
            referencedColumns: ["opportunity_id"]
          },
          {
            foreignKeyName: "opportunity_notes_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_products: {
        Row: {
          billing_day: number | null
          commission_percentage: number | null
          contract_custom_duration: number | null
          contract_duration: string | null
          created_at: string | null
          id: string
          negotiated_discount: number | null
          negotiated_implementation_fee: number | null
          negotiated_period: string | null
          negotiated_price: number | null
          opportunity_id: string
          product_id: string
        }
        Insert: {
          billing_day?: number | null
          commission_percentage?: number | null
          contract_custom_duration?: number | null
          contract_duration?: string | null
          created_at?: string | null
          id?: string
          negotiated_discount?: number | null
          negotiated_implementation_fee?: number | null
          negotiated_period?: string | null
          negotiated_price?: number | null
          opportunity_id: string
          product_id: string
        }
        Update: {
          billing_day?: number | null
          commission_percentage?: number | null
          contract_custom_duration?: number | null
          contract_duration?: string | null
          created_at?: string | null
          id?: string
          negotiated_discount?: number | null
          negotiated_implementation_fee?: number | null
          negotiated_period?: string | null
          negotiated_price?: number | null
          opportunity_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_products_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "analytics_sales_view"
            referencedColumns: ["opportunity_id"]
          },
          {
            foreignKeyName: "opportunity_products_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_stages: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          is_disqualified: boolean | null
          is_final: boolean | null
          is_scheduling: boolean | null
          is_sql: boolean | null
          name: string
          order_position: number
          requires_lead_score_feedback: boolean | null
          workspace_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          is_disqualified?: boolean | null
          is_final?: boolean | null
          is_scheduling?: boolean | null
          is_sql?: boolean | null
          name: string
          order_position: number
          requires_lead_score_feedback?: boolean | null
          workspace_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          is_disqualified?: boolean | null
          is_final?: boolean | null
          is_scheduling?: boolean | null
          is_sql?: boolean | null
          name?: string
          order_position?: number
          requires_lead_score_feedback?: boolean | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_stages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_tag_assignments: {
        Row: {
          opportunity_id: string
          tag_id: string
        }
        Insert: {
          opportunity_id: string
          tag_id: string
        }
        Update: {
          opportunity_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_tag_assignments_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "analytics_sales_view"
            referencedColumns: ["opportunity_id"]
          },
          {
            foreignKeyName: "opportunity_tag_assignments_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "crm_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      pagarme_cards: {
        Row: {
          brand: string | null
          created_at: string | null
          exp_month: number | null
          exp_year: number | null
          holder_name: string | null
          id: string
          is_default: boolean | null
          last_four_digits: string | null
          pagarme_card_id: string
          pagarme_customer_id: string
        }
        Insert: {
          brand?: string | null
          created_at?: string | null
          exp_month?: number | null
          exp_year?: number | null
          holder_name?: string | null
          id?: string
          is_default?: boolean | null
          last_four_digits?: string | null
          pagarme_card_id: string
          pagarme_customer_id: string
        }
        Update: {
          brand?: string | null
          created_at?: string | null
          exp_month?: number | null
          exp_year?: number | null
          holder_name?: string | null
          id?: string
          is_default?: boolean | null
          last_four_digits?: string | null
          pagarme_card_id?: string
          pagarme_customer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagarme_cards_pagarme_customer_id_fkey"
            columns: ["pagarme_customer_id"]
            isOneToOne: false
            referencedRelation: "pagarme_customers"
            referencedColumns: ["pagarme_customer_id"]
          },
        ]
      }
      pagarme_customers: {
        Row: {
          client_id: string
          created_at: string | null
          id: string
          pagarme_customer_id: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          id?: string
          pagarme_customer_id: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          id?: string
          pagarme_customer_id?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagarme_customers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "analytics_sales_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "pagarme_customers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagarme_customers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          category: string
          description: string | null
          id: string
          slug: string
        }
        Insert: {
          category: string
          description?: string | null
          id?: string
          slug: string
        }
        Update: {
          category?: string
          description?: string | null
          id?: string
          slug?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          base_price: number | null
          created_at: string | null
          default_assigned_closer: string | null
          default_cancellation_penalty: number | null
          default_implementation_fee: number | null
          default_period: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          recurrence_type: string | null
          signature_required: boolean | null
          type: Database["public"]["Enums"]["product_type"]
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          base_price?: number | null
          created_at?: string | null
          default_assigned_closer?: string | null
          default_cancellation_penalty?: number | null
          default_implementation_fee?: number | null
          default_period?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          recurrence_type?: string | null
          signature_required?: boolean | null
          type?: Database["public"]["Enums"]["product_type"]
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          base_price?: number | null
          created_at?: string | null
          default_assigned_closer?: string | null
          default_cancellation_penalty?: number | null
          default_implementation_fee?: number | null
          default_period?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          recurrence_type?: string | null
          signature_required?: boolean | null
          type?: Database["public"]["Enums"]["product_type"]
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          has_google_calendar: boolean | null
          id: string
          is_super_admin: boolean | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          has_google_calendar?: boolean | null
          id: string
          is_super_admin?: boolean | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          has_google_calendar?: boolean | null
          id?: string
          is_super_admin?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      quiz_elements: {
        Row: {
          content: Json | null
          created_at: string | null
          id: string
          order_index: number
          question_id: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          content?: Json | null
          created_at?: string | null
          id?: string
          order_index?: number
          question_id?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          content?: Json | null
          created_at?: string | null
          id?: string
          order_index?: number
          question_id?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_elements_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_options: {
        Row: {
          created_at: string | null
          id: string
          order: number | null
          points: number | null
          question_id: string | null
          score_assessoria: number | null
          score_mentoria: number | null
          text: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          order?: number | null
          points?: number | null
          question_id?: string | null
          score_assessoria?: number | null
          score_mentoria?: number | null
          text: string
        }
        Update: {
          created_at?: string | null
          id?: string
          order?: number | null
          points?: number | null
          question_id?: string | null
          score_assessoria?: number | null
          score_mentoria?: number | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          created_at: string | null
          id: string
          order: number | null
          question_type: string | null
          quiz_id: string | null
          text: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          order?: number | null
          question_type?: string | null
          quiz_id?: string | null
          text: string
        }
        Update: {
          created_at?: string | null
          id?: string
          order?: number | null
          question_type?: string | null
          quiz_id?: string | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_sessions: {
        Row: {
          answers: Json | null
          created_at: string | null
          current_step_index: number | null
          has_contact_info: boolean | null
          id: string
          is_completed: boolean | null
          last_interaction_at: string | null
          metadata: Json | null
          quiz_id: string | null
          score: number | null
          session_token: string
        }
        Insert: {
          answers?: Json | null
          created_at?: string | null
          current_step_index?: number | null
          has_contact_info?: boolean | null
          id?: string
          is_completed?: boolean | null
          last_interaction_at?: string | null
          metadata?: Json | null
          quiz_id?: string | null
          score?: number | null
          session_token: string
        }
        Update: {
          answers?: Json | null
          created_at?: string | null
          current_step_index?: number | null
          has_contact_info?: boolean | null
          id?: string
          is_completed?: boolean | null
          last_interaction_at?: string | null
          metadata?: Json | null
          quiz_id?: string | null
          score?: number | null
          session_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_sessions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_submissions: {
        Row: {
          answers: Json | null
          created_at: string | null
          custom_fields: Json | null
          id: string
          lead_email: string | null
          lead_name: string
          lead_phone: string | null
          opportunity_id: string | null
          quiz_id: string | null
          result_product_id: string | null
          score_assessoria_total: number | null
          score_mentoria_total: number | null
          total_score: number | null
        }
        Insert: {
          answers?: Json | null
          created_at?: string | null
          custom_fields?: Json | null
          id?: string
          lead_email?: string | null
          lead_name: string
          lead_phone?: string | null
          opportunity_id?: string | null
          quiz_id?: string | null
          result_product_id?: string | null
          score_assessoria_total?: number | null
          score_mentoria_total?: number | null
          total_score?: number | null
        }
        Update: {
          answers?: Json | null
          created_at?: string | null
          custom_fields?: Json | null
          id?: string
          lead_email?: string | null
          lead_name?: string
          lead_phone?: string | null
          opportunity_id?: string | null
          quiz_id?: string | null
          result_product_id?: string | null
          score_assessoria_total?: number | null
          score_mentoria_total?: number | null
          total_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_submissions_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "analytics_sales_view"
            referencedColumns: ["opportunity_id"]
          },
          {
            foreignKeyName: "quiz_submissions_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_submissions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_submissions_result_product_id_fkey"
            columns: ["result_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          active: boolean | null
          created_at: string | null
          description: string | null
          id: string
          pixels: Json | null
          scoring_rules: Json | null
          seo: Json | null
          settings: Json | null
          slug: string
          title: string
          updated_at: string | null
          webhook: Json | null
          workspace_id: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          pixels?: Json | null
          scoring_rules?: Json | null
          seo?: Json | null
          settings?: Json | null
          slug: string
          title: string
          updated_at?: string | null
          webhook?: Json | null
          workspace_id?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          pixels?: Json | null
          scoring_rules?: Json | null
          seo?: Json | null
          settings?: Json | null
          slug?: string
          title?: string
          updated_at?: string | null
          webhook?: Json | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      squad_members: {
        Row: {
          created_at: string
          id: string
          role: string | null
          squad_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string | null
          squad_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string | null
          squad_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "squad_members_squad_id_fkey"
            columns: ["squad_id"]
            isOneToOne: false
            referencedRelation: "squads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "squad_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      squads: {
        Row: {
          color: string | null
          created_at: string
          id: string
          leader_id: string | null
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          leader_id?: string | null
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          leader_id?: string | null
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "squads_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "squads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      system_request_attachments: {
        Row: {
          created_at: string
          file_type: string
          file_url: string
          id: string
          request_id: string | null
        }
        Insert: {
          created_at?: string
          file_type: string
          file_url: string
          id?: string
          request_id?: string | null
        }
        Update: {
          created_at?: string
          file_type?: string
          file_url?: string
          id?: string
          request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_request_attachments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "system_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      system_request_messages: {
        Row: {
          attachment_type: string | null
          attachment_url: string | null
          content: string
          created_at: string
          id: string
          request_id: string
          user_id: string | null
        }
        Insert: {
          attachment_type?: string | null
          attachment_url?: string | null
          content: string
          created_at?: string
          id?: string
          request_id: string
          user_id?: string | null
        }
        Update: {
          attachment_type?: string | null
          attachment_url?: string | null
          content?: string
          created_at?: string
          id?: string
          request_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_request_messages_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "system_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      system_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          description: string
          error_metadata: Json | null
          id: string
          source: string | null
          status: Database["public"]["Enums"]["request_status"] | null
          title: string
          type: Database["public"]["Enums"]["request_type"]
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          description: string
          error_metadata?: Json | null
          id?: string
          source?: string | null
          status?: Database["public"]["Enums"]["request_status"] | null
          title: string
          type: Database["public"]["Enums"]["request_type"]
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          description?: string
          error_metadata?: Json | null
          id?: string
          source?: string | null
          status?: Database["public"]["Enums"]["request_status"] | null
          title?: string
          type?: Database["public"]["Enums"]["request_type"]
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_requests_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          client_id: string
          contract_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          parent_task_id: string | null
          priority: string
          reporter_id: string | null
          squad_id: string | null
          status: string
          title: string
          type: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assignee_id?: string | null
          client_id: string
          contract_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          parent_task_id?: string | null
          priority?: string
          reporter_id?: string | null
          squad_id?: string | null
          status?: string
          title: string
          type?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assignee_id?: string | null
          client_id?: string
          contract_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          parent_task_id?: string | null
          priority?: string
          reporter_id?: string | null
          squad_id?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "analytics_sales_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_squad_id_fkey"
            columns: ["squad_id"]
            isOneToOne: false
            referencedRelation: "squads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_integrations: {
        Row: {
          auto_hold: boolean | null
          created_at: string | null
          id: string
          is_active: boolean | null
          last_payload: Json | null
          mapping: Json | null
          name: string
          slug: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          auto_hold?: boolean | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_payload?: Json | null
          mapping?: Json | null
          name: string
          slug?: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          auto_hold?: boolean | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_payload?: Json | null
          mapping?: Json | null
          name?: string
          slug?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_integrations: {
        Row: {
          api_key: string
          config: Json | null
          created_at: string | null
          id: string
          is_active: boolean | null
          provider: string
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          api_key: string
          config?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          provider: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          api_key?: string
          config?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          provider?: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workspace_integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_invite_links: {
        Row: {
          active: boolean | null
          code: string
          created_at: string | null
          created_by: string
          current_uses: number | null
          expires_at: string | null
          id: string
          max_uses: number | null
          role_id: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          active?: boolean | null
          code: string
          created_at?: string | null
          created_by: string
          current_uses?: number | null
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          role_id: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          active?: boolean | null
          code?: string
          created_at?: string | null
          created_by?: string
          current_uses?: number | null
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          role_id?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invite_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_invite_links_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_invite_links_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["workspace_role"]
          role_id: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          role_id?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          role_id?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          created_by: string
          crm_meeting_duration: number | null
          crm_meeting_template: string | null
          id: string
          installment_interest_rate: number | null
          name: string
          pagarme_api_key_encrypted: string | null
          pagarme_webhook_token: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          crm_meeting_duration?: number | null
          crm_meeting_template?: string | null
          id?: string
          installment_interest_rate?: number | null
          name: string
          pagarme_api_key_encrypted?: string | null
          pagarme_webhook_token?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          crm_meeting_duration?: number | null
          crm_meeting_template?: string | null
          id?: string
          installment_interest_rate?: number | null
          name?: string
          pagarme_api_key_encrypted?: string | null
          pagarme_webhook_token?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      analytics_sales_view: {
        Row: {
          client_id: string | null
          client_name: string | null
          closer_name: string | null
          company_name: string | null
          contract_duration: string | null
          contract_signature_status: string | null
          is_signed: boolean | null
          opportunity_id: string | null
          payment_method: string | null
          payment_status: string | null
          products: Json | null
          sale_type: string | null
          sdr_name: string | null
          total_value: number | null
          won_at: string | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      check_perm_pl: {
        Args: {
          _permission_slug: string
          _user_id: string
          _workspace_id: string
        }
        Returns: boolean
      }
      check_user_permission: {
        Args: {
          _permission_slug: string
          _user_id: string
          _workspace_id: string
        }
        Returns: boolean
      }
      check_user_permission_v2: {
        Args: {
          _permission_slug: string
          _user_id: string
          _workspace_id: string
        }
        Returns: boolean
      }
      create_workspace: {
        Args: { _name: string; _user_id: string }
        Returns: Json
      }
      decrypt_pagarme_key: {
        Args: { encrypted_key: string; workspace_id: string }
        Returns: string
      }
      duplicate_quiz: { Args: { target_quiz_id: string }; Returns: string }
      perform_bank_transfer: {
        Args: {
          p_workspace_id: string
          p_from_account_id: string
          p_to_account_id: string
          p_amount: number
          p_date: string
          p_description?: string
        }
        Returns: Json
      }
      encrypt_pagarme_key: {
        Args: { api_key: string; workspace_id: string }
        Returns: string
      }
      exec_sql: { Args: { query: string }; Returns: Json }
      get_user_role: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: Database["public"]["Enums"]["workspace_role"]
      }
      get_workspace_pagarme_key: {
        Args: { p_workspace_id: string }
        Returns: string
      }
      has_workspace_pagarme_key: {
        Args: { p_workspace_id: string }
        Returns: boolean
      }
      is_member_pl: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      is_sales_role: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      is_workspace_member_bypass: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      is_workspace_member_v2: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      is_workspace_owner: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      join_workspace_via_link: { Args: { invite_code: string }; Returns: Json }
      save_workspace_pagarme_key: {
        Args: { p_api_key: string; p_workspace_id: string }
        Returns: boolean
      }
      seed_default_financial_categories: {
        Args: { target_workspace_id: string }
        Returns: undefined
      }
      seed_default_income_categories: {
        Args: { target_workspace_id: string }
        Returns: undefined
      }
    }
    Enums: {
      financial_movement_type: "income" | "expense"
      financial_status:
        | "pending"
        | "paid"
        | "overdue"
        | "cancelled"
        | "scheduled"
        | "partial"
      lead_source:
        | "website"
        | "referral"
        | "cold_call"
        | "social_media"
        | "inlead"
        | "other"
        | "webhook"
        | "manual"
        | "ads"
        | "prospection"
        | "influencer"
        | "instagram"
        | "youtube"
        | "social_selling"
      loss_reason:
        | "high_price"
        | "competitor"
        | "no_budget"
        | "bad_timing"
        | "no_authority"
        | "no_need"
        | "no_response"
        | "other"
      opportunity_status:
        | "new_lead"
        | "qualification"
        | "session_scheduled"
        | "in_negotiation"
        | "proposal_sent"
        | "closing"
        | "won"
        | "lost"
      product_type: "recurring" | "one_time"
      reconciliation_status: "pending" | "reconciled" | "ignored"
      request_status:
        | "pending"
        | "analyzing"
        | "waiting_response"
        | "done"
        | "rejected"
        | "approved"
        | "developed"
      request_type: "suggestion" | "doubt" | "bug" | "other" | "auto_bug"
      workspace_role:
        | "owner"
        | "admin"
        | "member"
        | "sdr"
        | "closer"
        | "sales_manager"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      financial_movement_type: ["income", "expense"],
      financial_status: [
        "pending",
        "paid",
        "overdue",
        "cancelled",
        "scheduled",
        "partial",
      ],
      lead_source: [
        "website",
        "referral",
        "cold_call",
        "social_media",
        "inlead",
        "other",
        "webhook",
        "manual",
        "ads",
        "prospection",
        "influencer",
        "instagram",
        "youtube",
        "social_selling",
      ],
      loss_reason: [
        "high_price",
        "competitor",
        "no_budget",
        "bad_timing",
        "no_authority",
        "no_need",
        "no_response",
        "other",
      ],
      opportunity_status: [
        "new_lead",
        "qualification",
        "session_scheduled",
        "in_negotiation",
        "proposal_sent",
        "closing",
        "won",
        "lost",
      ],
      product_type: ["recurring", "one_time"],
      reconciliation_status: ["pending", "reconciled", "ignored"],
      request_status: [
        "pending",
        "analyzing",
        "waiting_response",
        "done",
        "rejected",
        "approved",
        "developed",
      ],
      request_type: ["suggestion", "doubt", "bug", "other", "auto_bug"],
      workspace_role: [
        "owner",
        "admin",
        "member",
        "sdr",
        "closer",
        "sales_manager",
      ],
    },
  },
} as const
