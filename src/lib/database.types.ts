// Types générés depuis le schéma Supabase (MCP generate_typescript_types).
// Le projet EXTERNAL est partagé : les tables PEEB (buildings, app_params,
// profiles) appartiennent à l'autre application — ne pas les utiliser ici.
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
      app_params: {
        Row: {
          currency: string
          energy_cost: number
          exchange_rate: number
          id: number
          savings_by_typology: Json | null
          score_config: Json | null
          unit_costs: Json
          updated_at: string
        }
        Insert: {
          currency?: string
          energy_cost?: number
          exchange_rate?: number
          id?: number
          savings_by_typology?: Json | null
          score_config?: Json | null
          unit_costs?: Json
          updated_at?: string
        }
        Update: {
          currency?: string
          energy_cost?: number
          exchange_rate?: number
          id?: number
          savings_by_typology?: Json | null
          score_config?: Json | null
          unit_costs?: Json
          updated_at?: string
        }
        Relationships: []
      }
      buildings: {
        Row: {
          address: string
          afd_loan: number
          area: number | null
          audit_author: string | null
          audit_date: string | null
          audit_file_url: string | null
          baseline_eui: number | null
          created_at: string
          design_progress: string | null
          ee_capex_override: number | null
          existing_audit: boolean | null
          floors: number | null
          funding_source: string
          gain_override: number | null
          governorate: string
          id: string
          images: string[]
          is_draft: boolean
          lat: number | null
          lng: number | null
          manually_ineligible: boolean
          measures: Json
          name: string
          national_budget: number
          operating_hours: string
          others: number
          peeb_selected: boolean
          priority: string | null
          region: string
          site_observations: string
          source: string | null
          status: string
          total_baseline_kwh: number | null
          total_project_kwh: number | null
          typology: string
          updated_at: string
          works_progress: string | null
          year_built: number | null
        }
        Insert: {
          address?: string
          afd_loan?: number
          area?: number | null
          audit_author?: string | null
          audit_date?: string | null
          audit_file_url?: string | null
          baseline_eui?: number | null
          created_at?: string
          design_progress?: string | null
          ee_capex_override?: number | null
          existing_audit?: boolean | null
          floors?: number | null
          funding_source?: string
          gain_override?: number | null
          governorate?: string
          id: string
          images?: string[]
          is_draft?: boolean
          lat?: number | null
          lng?: number | null
          manually_ineligible?: boolean
          measures?: Json
          name: string
          national_budget?: number
          operating_hours?: string
          others?: number
          peeb_selected?: boolean
          priority?: string | null
          region?: string
          site_observations?: string
          source?: string | null
          status?: string
          total_baseline_kwh?: number | null
          total_project_kwh?: number | null
          typology: string
          updated_at?: string
          works_progress?: string | null
          year_built?: number | null
        }
        Update: {
          address?: string
          afd_loan?: number
          area?: number | null
          audit_author?: string | null
          audit_date?: string | null
          audit_file_url?: string | null
          baseline_eui?: number | null
          created_at?: string
          design_progress?: string | null
          ee_capex_override?: number | null
          existing_audit?: boolean | null
          floors?: number | null
          funding_source?: string
          gain_override?: number | null
          governorate?: string
          id?: string
          images?: string[]
          is_draft?: boolean
          lat?: number | null
          lng?: number | null
          manually_ineligible?: boolean
          measures?: Json
          name?: string
          national_budget?: number
          operating_hours?: string
          others?: number
          peeb_selected?: boolean
          priority?: string | null
          region?: string
          site_observations?: string
          source?: string | null
          status?: string
          total_baseline_kwh?: number | null
          total_project_kwh?: number | null
          typology?: string
          updated_at?: string
          works_progress?: string | null
          year_built?: number | null
        }
        Relationships: []
      }
      chantierci_commentaires: {
        Row: {
          auteur_nom: string
          contenu: string
          created_at: string
          etablissement_id: string
          id: string
          user_id: string | null
        }
        Insert: {
          auteur_nom?: string
          contenu: string
          created_at?: string
          etablissement_id: string
          id?: string
          user_id?: string | null
        }
        Update: {
          auteur_nom?: string
          contenu?: string
          created_at?: string
          etablissement_id?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chantierci_commentaires_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "chantierci_etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chantierci_commentaires_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "chantierci_v_etablissements_suivi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chantierci_commentaires_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "chantierci_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chantierci_etablissements: {
        Row: {
          created_at: string
          departement: string | null
          email: string | null
          id: string
          latitude: number | null
          longitude: number | null
          lot_id: string | null
          nom: string
          nom_directeur: string | null
          province: string | null
          statut: Database["public"]["Enums"]["chantierci_statut_chantier"]
          telephone: string | null
          village: string | null
        }
        Insert: {
          created_at?: string
          departement?: string | null
          email?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          lot_id?: string | null
          nom: string
          nom_directeur?: string | null
          province?: string | null
          statut?: Database["public"]["Enums"]["chantierci_statut_chantier"]
          telephone?: string | null
          village?: string | null
        }
        Update: {
          created_at?: string
          departement?: string | null
          email?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          lot_id?: string | null
          nom?: string
          nom_directeur?: string | null
          province?: string | null
          statut?: Database["public"]["Enums"]["chantierci_statut_chantier"]
          telephone?: string | null
          village?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chantierci_etablissements_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "chantierci_lots"
            referencedColumns: ["id"]
          },
        ]
      }
      chantierci_lots: {
        Row: {
          id: string
          nom: string
          region: string
        }
        Insert: {
          id?: string
          nom: string
          region: string
        }
        Update: {
          id?: string
          nom?: string
          region?: string
        }
        Relationships: []
      }
      chantierci_marches_travaux: {
        Row: {
          date_demarrage: string | null
          date_fin_estimative: string | null
          etablissement_id: string
          id: string
          montant_marche: number
          nom_entreprise: string
          numero_marche: string
        }
        Insert: {
          date_demarrage?: string | null
          date_fin_estimative?: string | null
          etablissement_id: string
          id?: string
          montant_marche: number
          nom_entreprise: string
          numero_marche: string
        }
        Update: {
          date_demarrage?: string | null
          date_fin_estimative?: string | null
          etablissement_id?: string
          id?: string
          montant_marche?: number
          nom_entreprise?: string
          numero_marche?: string
        }
        Relationships: [
          {
            foreignKeyName: "chantierci_marches_travaux_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "chantierci_etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chantierci_marches_travaux_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "chantierci_v_etablissements_suivi"
            referencedColumns: ["id"]
          },
        ]
      }
      chantierci_paiements: {
        Row: {
          created_at: string
          date_paiement: string
          id: string
          libelle: string
          marche_id: string
          montant: number
          saisi_par: string | null
        }
        Insert: {
          created_at?: string
          date_paiement: string
          id?: string
          libelle?: string
          marche_id: string
          montant: number
          saisi_par?: string | null
        }
        Update: {
          created_at?: string
          date_paiement?: string
          id?: string
          libelle?: string
          marche_id?: string
          montant?: number
          saisi_par?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chantierci_paiements_marche_id_fkey"
            columns: ["marche_id"]
            isOneToOne: false
            referencedRelation: "chantierci_marches_travaux"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chantierci_paiements_marche_id_fkey"
            columns: ["marche_id"]
            isOneToOne: false
            referencedRelation: "chantierci_v_etablissements_suivi"
            referencedColumns: ["marche_id"]
          },
          {
            foreignKeyName: "chantierci_paiements_marche_id_fkey"
            columns: ["marche_id"]
            isOneToOne: false
            referencedRelation: "chantierci_v_marches_financier"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chantierci_paiements_saisi_par_fkey"
            columns: ["saisi_par"]
            isOneToOne: false
            referencedRelation: "chantierci_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chantierci_photos_visites: {
        Row: {
          created_at: string
          id: string
          storage_path: string
          sync_status: Database["public"]["Enums"]["chantierci_sync_status"]
          taille_ko: number | null
          url_public: string | null
          visite_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          storage_path: string
          sync_status?: Database["public"]["Enums"]["chantierci_sync_status"]
          taille_ko?: number | null
          url_public?: string | null
          visite_id: string
        }
        Update: {
          created_at?: string
          id?: string
          storage_path?: string
          sync_status?: Database["public"]["Enums"]["chantierci_sync_status"]
          taille_ko?: number | null
          url_public?: string | null
          visite_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chantierci_photos_visites_visite_id_fkey"
            columns: ["visite_id"]
            isOneToOne: false
            referencedRelation: "chantierci_v_dernieres_visites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chantierci_photos_visites_visite_id_fkey"
            columns: ["visite_id"]
            isOneToOne: false
            referencedRelation: "chantierci_v_etablissements_suivi"
            referencedColumns: ["derniere_visite_id"]
          },
          {
            foreignKeyName: "chantierci_photos_visites_visite_id_fkey"
            columns: ["visite_id"]
            isOneToOne: false
            referencedRelation: "chantierci_visites"
            referencedColumns: ["id"]
          },
        ]
      }
      chantierci_profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          lot_ids: string[]
          nom_complet: string
          role: Database["public"]["Enums"]["chantierci_user_role"]
          statut_compte: Database["public"]["Enums"]["chantierci_statut_compte"]
          telephone: string
        }
        Insert: {
          created_at?: string
          email?: string
          id: string
          lot_ids?: string[]
          nom_complet?: string
          role?: Database["public"]["Enums"]["chantierci_user_role"]
          statut_compte?: Database["public"]["Enums"]["chantierci_statut_compte"]
          telephone?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          lot_ids?: string[]
          nom_complet?: string
          role?: Database["public"]["Enums"]["chantierci_user_role"]
          statut_compte?: Database["public"]["Enums"]["chantierci_statut_compte"]
          telephone?: string
        }
        Relationships: []
      }
      chantierci_visites: {
        Row: {
          avancement_reel_pct: number | null
          commentaire: string | null
          created_at: string
          date_visite: string
          etablissement_id: string
          id: string
          nom_visiteur: string
          pct_charpente: number | null
          pct_couverture: number | null
          pct_excavation: number | null
          pct_finition: number | null
          pct_fondation: number | null
          pct_verticaux: number | null
          raison_arret_autre: string | null
          raisons_arret: string[] | null
          statut_chantier: Database["public"]["Enums"]["chantierci_statut_chantier"]
          sync_status: Database["public"]["Enums"]["chantierci_sync_status"]
          user_id: string | null
        }
        Insert: {
          avancement_reel_pct?: number | null
          commentaire?: string | null
          created_at?: string
          date_visite: string
          etablissement_id: string
          id?: string
          nom_visiteur?: string
          pct_charpente?: number | null
          pct_couverture?: number | null
          pct_excavation?: number | null
          pct_finition?: number | null
          pct_fondation?: number | null
          pct_verticaux?: number | null
          raison_arret_autre?: string | null
          raisons_arret?: string[] | null
          statut_chantier: Database["public"]["Enums"]["chantierci_statut_chantier"]
          sync_status?: Database["public"]["Enums"]["chantierci_sync_status"]
          user_id?: string | null
        }
        Update: {
          avancement_reel_pct?: number | null
          commentaire?: string | null
          created_at?: string
          date_visite?: string
          etablissement_id?: string
          id?: string
          nom_visiteur?: string
          pct_charpente?: number | null
          pct_couverture?: number | null
          pct_excavation?: number | null
          pct_finition?: number | null
          pct_fondation?: number | null
          pct_verticaux?: number | null
          raison_arret_autre?: string | null
          raisons_arret?: string[] | null
          statut_chantier?: Database["public"]["Enums"]["chantierci_statut_chantier"]
          sync_status?: Database["public"]["Enums"]["chantierci_sync_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chantierci_visites_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "chantierci_etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chantierci_visites_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "chantierci_v_etablissements_suivi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chantierci_visites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "chantierci_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          is_approved: boolean
          job_title: string | null
          last_name: string | null
          requested_status: string | null
          status: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id: string
          is_approved?: boolean
          job_title?: string | null
          last_name?: string | null
          requested_status?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          is_approved?: boolean
          job_title?: string | null
          last_name?: string | null
          requested_status?: string | null
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      chantierci_v_dernieres_visites: {
        Row: {
          avancement_reel_pct: number | null
          commentaire: string | null
          created_at: string | null
          date_visite: string | null
          etablissement_id: string | null
          id: string | null
          nom_visiteur: string | null
          pct_charpente: number | null
          pct_couverture: number | null
          pct_excavation: number | null
          pct_finition: number | null
          pct_fondation: number | null
          pct_verticaux: number | null
          raison_arret_autre: string | null
          raisons_arret: string[] | null
          statut_chantier:
            | Database["public"]["Enums"]["chantierci_statut_chantier"]
            | null
          sync_status:
            | Database["public"]["Enums"]["chantierci_sync_status"]
            | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chantierci_visites_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "chantierci_etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chantierci_visites_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "chantierci_v_etablissements_suivi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chantierci_visites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "chantierci_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chantierci_v_etablissements_suivi: {
        Row: {
          avancement_financier_pct: number | null
          created_at: string | null
          date_demarrage: string | null
          date_fin_estimative: string | null
          departement: string | null
          dernier_avancement_reel_pct: number | null
          dernier_statut_chantier:
            | Database["public"]["Enums"]["chantierci_statut_chantier"]
            | null
          derniere_visite_date: string | null
          derniere_visite_id: string | null
          derniere_visite_visiteur: string | null
          email: string | null
          id: string | null
          latitude: number | null
          longitude: number | null
          lot_id: string | null
          lot_nom: string | null
          lot_region: string | null
          marche_id: string | null
          montant_marche: number | null
          montant_paye: number | null
          nb_visites: number | null
          nom: string | null
          nom_directeur: string | null
          nom_entreprise: string | null
          numero_marche: string | null
          province: string | null
          reste_a_payer: number | null
          statut:
            | Database["public"]["Enums"]["chantierci_statut_chantier"]
            | null
          telephone: string | null
          village: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chantierci_etablissements_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "chantierci_lots"
            referencedColumns: ["id"]
          },
        ]
      }
      chantierci_v_marches_financier: {
        Row: {
          avancement_financier_pct: number | null
          date_demarrage: string | null
          date_fin_estimative: string | null
          departement: string | null
          etablissement_id: string | null
          etablissement_nom: string | null
          id: string | null
          lot_id: string | null
          montant_marche: number | null
          montant_paye: number | null
          nb_paiements: number | null
          nom_entreprise: string | null
          numero_marche: string | null
          province: string | null
          reste_a_payer: number | null
          statut_etablissement:
            | Database["public"]["Enums"]["chantierci_statut_chantier"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "chantierci_etablissements_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "chantierci_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chantierci_marches_travaux_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "chantierci_etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chantierci_marches_travaux_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "chantierci_v_etablissements_suivi"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      peeb_can_edit: { Args: never; Returns: boolean }
      peeb_email_row: {
        Args: { p_label: string; p_value: string }
        Returns: string
      }
      peeb_email_shell: {
        Args: { p_body: string; p_title: string }
        Returns: string
      }
      peeb_html_escape: { Args: { t: string }; Returns: string }
      peeb_is_admin: { Args: never; Returns: boolean }
      peeb_is_approved: { Args: never; Returns: boolean }
      peeb_notify_admins: {
        Args: { p_html: string; p_subject: string }
        Returns: undefined
      }
    }
    Enums: {
      chantierci_statut_chantier:
        | "non_demarre"
        | "en_cours"
        | "arrete"
        | "receptionne"
      chantierci_statut_compte: "en_attente" | "actif" | "suspendu"
      chantierci_sync_status: "synced" | "pending_sync"
      chantierci_user_role: "coges" | "regional" | "national" | "admin"
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
      chantierci_statut_chantier: [
        "non_demarre",
        "en_cours",
        "arrete",
        "receptionne",
      ],
      chantierci_statut_compte: ["en_attente", "actif", "suspendu"],
      chantierci_sync_status: ["synced", "pending_sync"],
      chantierci_user_role: ["coges", "regional", "national", "admin"],
    },
  },
} as const
