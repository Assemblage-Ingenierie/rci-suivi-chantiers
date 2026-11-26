// Types du schéma Supabase « refonte PATEB » (migrations supabase/migrations/2026112410*).
// Écrits à la main au format de `supabase gen types typescript` : le projet
// Supabase dédié n'est pas accessible à l'outil de génération. À régénérer
// (Dashboard → API Docs, ou CLI) si le schéma évolue.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

type Role = "cstc" | "moe_controleur" | "moe_chef" | "ug" | "admin"
type StatutCompte = "en_attente" | "actif" | "suspendu"
type TypeLatrines = "seches" | "a_eau"
type SourceFormulaire = "cstc" | "moe" | "ug"
// « ralenti » existe encore dans le type énuméré SQL mais est interdit (contrainte) : retiré ici.
type StatutChantier = "non_demarre" | "en_cours" | "arrete" | "termine" | "receptionne"

type VisiteRow = {
  id: string
  site_id: string
  source: SourceFormulaire
  date_visite: string
  auteur_id: string | null
  auteur_nom: string
  statut: StatutChantier
  postes: Json
  reponses: Json
  commentaire: string
  donnees_test: boolean
  created_at: string
  updated_at: string
  modifie_par: string | null
}

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      chantierci_lots_moe: {
        Row: { id: number; nom: string; regions: string[]; titulaire: string }
        Insert: { id: number; nom: string; regions?: string[]; titulaire?: string }
        Update: { id?: number; nom?: string; regions?: string[]; titulaire?: string }
        Relationships: []
      }
      chantierci_lots: {
        Row: { id: number; nom: string; entreprise_titulaire: string; poids: number }
        Insert: { id: number; nom: string; entreprise_titulaire?: string; poids?: number }
        Update: { id?: number; nom?: string; entreprise_titulaire?: string; poids?: number }
        Relationships: []
      }
      chantierci_sites: {
        Row: {
          id: string
          code: string
          lot_id: number
          lot_moe_id: number
          nom: string
          region: string
          departement: string
          localite: string
          zone: string
          electricite: boolean
          type_latrines: TypeLatrines
          latitude: number | null
          longitude: number | null
          a_verifier: string
          actif: boolean
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          lot_id: number
          lot_moe_id: number
          nom: string
          region: string
          departement?: string
          localite?: string
          zone?: string
          electricite?: boolean
          type_latrines: TypeLatrines
          latitude?: number | null
          longitude?: number | null
          a_verifier?: string
          actif?: boolean
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          lot_id?: number
          lot_moe_id?: number
          nom?: string
          region?: string
          departement?: string
          localite?: string
          zone?: string
          electricite?: boolean
          type_latrines?: TypeLatrines
          latitude?: number | null
          longitude?: number | null
          a_verifier?: string
          actif?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chantierci_sites_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "chantierci_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chantierci_sites_lot_moe_id_fkey"
            columns: ["lot_moe_id"]
            isOneToOne: false
            referencedRelation: "chantierci_lots_moe"
            referencedColumns: ["id"]
          },
        ]
      }
      chantierci_profiles: {
        Row: {
          id: string
          nom_complet: string
          email: string
          identifiant: string | null
          telephone: string
          role: Role
          lot_moe_id: number | null
          statut_compte: StatutCompte
          created_at: string
        }
        Insert: {
          id: string
          nom_complet?: string
          email?: string
          identifiant?: string | null
          telephone?: string
          role?: Role
          lot_moe_id?: number | null
          statut_compte?: StatutCompte
          created_at?: string
        }
        Update: {
          id?: string
          nom_complet?: string
          email?: string
          identifiant?: string | null
          telephone?: string
          role?: Role
          lot_moe_id?: number | null
          statut_compte?: StatutCompte
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chantierci_profiles_lot_moe_id_fkey"
            columns: ["lot_moe_id"]
            isOneToOne: false
            referencedRelation: "chantierci_lots_moe"
            referencedColumns: ["id"]
          },
        ]
      }
      chantierci_affectations: {
        Row: { profile_id: string; site_id: string; created_at: string }
        Insert: { profile_id: string; site_id: string; created_at?: string }
        Update: { profile_id?: string; site_id?: string; created_at?: string }
        Relationships: [
          {
            foreignKeyName: "chantierci_affectations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "chantierci_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chantierci_affectations_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "chantierci_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      chantierci_parametres: {
        Row: { cle: string; valeur: number; libelle: string }
        Insert: { cle: string; valeur: number; libelle?: string }
        Update: { cle?: string; valeur?: number; libelle?: string }
        Relationships: []
      }
      chantierci_postes: {
        Row: { ouvrage: string; code: string; libelle: string; poids: number; ordre: number }
        Insert: { ouvrage: string; code: string; libelle: string; poids: number; ordre: number }
        Update: { ouvrage?: string; code?: string; libelle?: string; poids?: number; ordre?: number }
        Relationships: []
      }
      chantierci_visites: {
        Row: VisiteRow
        Insert: {
          id?: string
          site_id: string
          source: SourceFormulaire
          date_visite?: string
          auteur_id?: string | null
          auteur_nom?: string
          statut: StatutChantier
          postes?: Json
          reponses?: Json
          commentaire?: string
          donnees_test?: boolean
          created_at?: string
          updated_at?: string
          modifie_par?: string | null
        }
        Update: Partial<VisiteRow>
        Relationships: [
          {
            foreignKeyName: "chantierci_visites_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "chantierci_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      chantierci_photos: {
        Row: {
          id: string
          visite_id: string
          chemin: string
          legende: string
          question: string
          latitude: number | null
          longitude: number | null
          prise_le: string | null
          created_at: string
        }
        Insert: {
          id?: string
          visite_id: string
          chemin: string
          legende?: string
          question?: string
          latitude?: number | null
          longitude?: number | null
          prise_le?: string | null
          created_at?: string
        }
        Update: {
          legende?: string
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "chantierci_photos_visite_id_fkey"
            columns: ["visite_id"]
            isOneToOne: false
            referencedRelation: "chantierci_visites"
            referencedColumns: ["id"]
          },
        ]
      }
      chantierci_departements: {
        Row: { nom: string; region: string; latitude: number; longitude: number }
        Insert: { nom: string; region: string; latitude: number; longitude: number }
        Update: { latitude?: number; longitude?: number }
        Relationships: []
      }
      chantierci_commentaires: {
        Row: {
          id: string
          site_id: string
          auteur_id: string | null
          auteur_nom: string
          texte: string
          donnees_test: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          site_id: string
          texte: string
        }
        Update: {
          texte?: string
        }
        Relationships: [
          {
            foreignKeyName: "chantierci_commentaires_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "chantierci_sites"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      chantierci_v_etat_sites: {
        Row: {
          id: string
          code: string
          nom: string
          lot_id: number
          lot_moe_id: number
          region: string
          departement: string
          localite: string
          electricite: boolean
          type_latrines: TypeLatrines
          latitude: number | null
          longitude: number | null
          origine_position: "site" | "photos" | "departement" | null
          moe_date: string | null
          moe_statut: StatutChantier | null
          moe_postes: Json | null
          moe_avancement: number | null
          moe_nb: number
          ug_date: string | null
          ug_statut: StatutChantier | null
          ug_avancement: number | null
          ug_date_moe_comparee: string | null
          ug_avancement_moe_compare: number | null
          ecart_ug_moe: number | null
          discordance: boolean
          cstc_date: string | null
          cstc_statut: StatutChantier | null
          moe_reponses: Json | null
          moe_commentaire: string | null
          moe_arrete_depuis: string | null
          ug_reponses: Json | null
          ug_commentaire: string | null
          cstc_reponses: Json | null
          cstc_commentaire: string | null
        }
        Relationships: []
      }
      chantierci_v_visites: {
        Row: VisiteRow & {
          site_code: string
          site_nom: string
          lot_id: number
          lot_moe_id: number
          avancement: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      chantierci_evolution_avancement: {
        Args: { p_lot_moe?: number | null }
        Returns: { date_ref: string; avancement: number | null }[]
      }
      chantierci_remplissage: {
        Args: { p_semaines?: number }
        Returns: {
          site_id: string
          date_ref: string
          moe: number[]
          cstc: number[]
          ug: number[]
          moe_dernier: string | null
          cstc_dernier: string | null
          ug_dernier: string | null
          moe_statuts: (string | null)[]
          cstc_statuts: (string | null)[]
          ug_statuts: (string | null)[]
          moe_dernier_statut: string | null
          cstc_dernier_statut: string | null
          ug_dernier_statut: string | null
        }[]
      }
    }
    Enums: {
      chantierci_role: Role
      chantierci_statut_compte: StatutCompte
      chantierci_type_latrines: TypeLatrines
      chantierci_source_formulaire: SourceFormulaire
      chantierci_statut_chantier: StatutChantier
    }
    CompositeTypes: { [_ in never]: never }
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
      chantierci_role: ["cstc", "moe_controleur", "moe_chef", "ug", "admin"],
      chantierci_statut_compte: ["en_attente", "actif", "suspendu"],
      chantierci_type_latrines: ["seches", "a_eau"],
      chantierci_source_formulaire: ["cstc", "moe", "ug"],
      chantierci_statut_chantier: ["non_demarre", "en_cours", "arrete", "termine", "receptionne"],
    },
  },
} as const
