export type AgentNews = {
  id: string; // uuid
  author_id: string | null;
  title: string;
  content: string;
  category: string | null;
  attachment_url: string | null;
  is_pinned: boolean;
  created_at: string; // timestamptz ISO
};
