export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type WeekStatus =
  | "draft"
  | "active"
  | "awaiting_approval"
  | "approved"
  | "changes_requested";

export type ApprovalResponseType = "approved" | "changes_requested";
export type PresentationType =
  | "semanal"
  | "quinzenal"
  | "mensal";

export type ResponsibleName = "Rafael" | "Matheus";

export type AppUser = {
  id: string;
  name: string;
  slug: string;
  role: "admin" | "user" | string | null;
  active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

export type Client = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color?: string | null;
  assigned_user_id?: string | null;
  assigned_user_name?: string | null;
  responsible_name?: ResponsibleName | string | null;
  sort_order?: number | null;
  archived_at?: string | null;
  deleted_at?: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type PlanningWeek = {
  id: string;
  client_id: string;
  title: string;
  public_slug: string;
  start_date: string | null;
  end_date: string | null;
  detail_color: string | null;
  status: WeekStatus | string | null;
  approved_at: string | null;
  correction_requested_at: string | null;
  archived_at: string | null;
  deleted_at: string | null;
  client_notes: string | null;
  is_public: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ContentItem = {
  id: string;
  planning_week_id: string;
  type: string | null;
  title: string | null;
  content_date: string | null;
  weekday: string | null;
  format: string | null;
  content_text: string | null;
  caption: string | null;
  notes: string | null;
  order_index: number | null;
  client_edited_at: string | null;
  is_visible: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

export type PresentationItem = {
  id: string;
  planning_week_id: string;
  content_item_id: string | null;
  image_url: string | null;
  format: string | null;
  label: string | null;
  content_date: string | null;
  weekday: string | null;
  order_index: number | null;
  is_visible: boolean | null;
  notes: string | null;
  created_at: string | null;
};

export type ApprovalResponse = {
  id: string;
  planning_week_id: string;
  response_type: ApprovalResponseType;
  message: string | null;
  created_at: string | null;
};

export type CopyPlanning = {
  id: string;
  client_id: string;
  title: string;
  public_slug: string;
  period_label: string | null;
  start_display_date?: string | null;
  end_display_date?: string | null;
  document_content: string | null;
  status: WeekStatus | string | null;
  is_public: boolean | null;
  approved_at: string | null;
  correction_requested_at: string | null;
  client_notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  archived_at: string | null;
  deleted_at: string | null;
};

export type VisualPresentation = {
  id: string;
  client_id: string;
  title: string;
  public_slug: string;
  period_label: string | null;
  start_display_date?: string | null;
  end_display_date?: string | null;
  presentation_type?: PresentationType | null;
  detail_color: string | null;
  status: WeekStatus | string | null;
  is_public: boolean | null;
  approved_at: string | null;
  correction_requested_at: string | null;
  client_notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  archived_at: string | null;
  deleted_at: string | null;
};

export type VisualItem = {
  id: string;
  visual_presentation_id: string;
  format: string | null;
  label: string | null;
  weekday: string | null;
  display_date: string | null;
  image_url: string | null;
  image_path: string | null;
  order_index: number | null;
  notes: string | null;
  is_visible: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

export type VisualItemImage = {
  id: string;
  visual_item_id: string;
  image_url: string | null;
  image_path: string | null;
  order_index: number | null;
  created_at: string | null;
};

export type CopyPlanningResponse = {
  id: string;
  copy_planning_id: string;
  response_type: ApprovalResponseType;
  message: string | null;
  created_at: string | null;
};

export type VisualPresentationResponse = {
  id: string;
  visual_presentation_id: string;
  response_type: ApprovalResponseType;
  message: string | null;
  created_at: string | null;
};

type TableDefinition<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: never[];
};

export type Database = {
  public: {
    Tables: {
      clients: TableDefinition<
        Client,
        {
          id?: string;
          name: string;
          slug: string;
          logo_url?: string | null;
          primary_color?: string | null;
          secondary_color?: string | null;
          assigned_user_id?: string | null;
          assigned_user_name?: string | null;
          responsible_name?: ResponsibleName | string | null;
          sort_order?: number | null;
          archived_at?: string | null;
          deleted_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        },
        Partial<Omit<Client, "id" | "created_at">>
      >;
      app_users: TableDefinition<
        AppUser,
        {
          id?: string;
          name: string;
          slug: string;
          role?: "admin" | "user" | string | null;
          active?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
        },
        Partial<Omit<AppUser, "id" | "created_at">>
      >;
      planning_weeks: TableDefinition<
        PlanningWeek,
        {
          id?: string;
          client_id: string;
          title: string;
          public_slug: string;
          start_date?: string | null;
          end_date?: string | null;
          detail_color?: string | null;
          status?: WeekStatus | string | null;
          approved_at?: string | null;
          correction_requested_at?: string | null;
          archived_at?: string | null;
          deleted_at?: string | null;
          client_notes?: string | null;
          is_public?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
        },
        Partial<Omit<PlanningWeek, "id" | "created_at">>
      >;
      content_items: TableDefinition<
        ContentItem,
        {
          id?: string;
          planning_week_id: string;
          type?: string | null;
          title?: string | null;
          content_date?: string | null;
          weekday?: string | null;
          format?: string | null;
          content_text?: string | null;
          caption?: string | null;
          notes?: string | null;
          order_index?: number | null;
          client_edited_at?: string | null;
          is_visible?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
        },
        Partial<Omit<ContentItem, "id" | "created_at">>
      >;
      presentation_items: TableDefinition<
        PresentationItem,
        {
          id?: string;
          planning_week_id: string;
          content_item_id?: string | null;
          image_url?: string | null;
          format?: string | null;
          label?: string | null;
          content_date?: string | null;
          weekday?: string | null;
          order_index?: number | null;
          is_visible?: boolean | null;
          notes?: string | null;
          created_at?: string | null;
        },
        Partial<Omit<PresentationItem, "id" | "created_at">>
      >;
      approval_responses: TableDefinition<
        ApprovalResponse,
        {
          id?: string;
          planning_week_id: string;
          response_type: ApprovalResponseType;
          message?: string | null;
          created_at?: string | null;
        },
        Partial<Omit<ApprovalResponse, "id" | "created_at">>
      >;
      copy_plannings: TableDefinition<
        CopyPlanning,
        {
          id?: string;
          client_id: string;
          title: string;
          public_slug: string;
          period_label?: string | null;
          start_display_date?: string | null;
          end_display_date?: string | null;
          document_content?: string | null;
          status?: WeekStatus | string | null;
          is_public?: boolean | null;
          approved_at?: string | null;
          correction_requested_at?: string | null;
          client_notes?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          archived_at?: string | null;
          deleted_at?: string | null;
        },
        Partial<Omit<CopyPlanning, "id" | "created_at">>
      >;
      visual_presentations: TableDefinition<
        VisualPresentation,
        {
          id?: string;
          client_id: string;
          title: string;
          public_slug: string;
          period_label?: string | null;
          start_display_date?: string | null;
          end_display_date?: string | null;
          presentation_type?: PresentationType | null;
          detail_color?: string | null;
          status?: WeekStatus | string | null;
          is_public?: boolean | null;
          approved_at?: string | null;
          correction_requested_at?: string | null;
          client_notes?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          archived_at?: string | null;
          deleted_at?: string | null;
        },
        Partial<Omit<VisualPresentation, "id" | "created_at">>
      >;
      visual_items: TableDefinition<
        VisualItem,
        {
          id?: string;
          visual_presentation_id: string;
          format?: string | null;
          label?: string | null;
          weekday?: string | null;
          display_date?: string | null;
          image_url?: string | null;
          image_path?: string | null;
          order_index?: number | null;
          notes?: string | null;
          is_visible?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
        },
        Partial<Omit<VisualItem, "id" | "created_at">>
      >;
      visual_item_images: TableDefinition<
        VisualItemImage,
        {
          id?: string;
          visual_item_id: string;
          image_url?: string | null;
          image_path?: string | null;
          order_index?: number | null;
          created_at?: string | null;
        },
        Partial<Omit<VisualItemImage, "id" | "created_at">>
      >;
      copy_planning_responses: TableDefinition<
        CopyPlanningResponse,
        {
          id?: string;
          copy_planning_id: string;
          response_type: ApprovalResponseType;
          message?: string | null;
          created_at?: string | null;
        },
        Partial<Omit<CopyPlanningResponse, "id" | "created_at">>
      >;
      visual_presentation_responses: TableDefinition<
        VisualPresentationResponse,
        {
          id?: string;
          visual_presentation_id: string;
          response_type: ApprovalResponseType;
          message?: string | null;
          created_at?: string | null;
        },
        Partial<Omit<VisualPresentationResponse, "id" | "created_at">>
      >;
    };
    Views: Record<string, never>;
    Functions: {
      get_storage_usage_summary: {
        Args: Record<string, never>;
        Returns: {
          used_bytes: number | null;
          file_count: number | null;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
