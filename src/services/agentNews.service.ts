import type { AgentNews } from "@/types/agentNews";
import { createClient } from "@/lib/supabase/client"; // ajusta a tu path real

type GetAgentNewsOptions = {
  limit?: number;
};

export async function getAgentNews(opts: GetAgentNewsOptions = {}): Promise<AgentNews[]> {
  const supabase = createClient();
  const limit = opts.limit ?? 10;

  // Orden: pinned primero, luego lo más reciente
  const { data, error } = await supabase
    .from("agent_news")
    .select("id, author_id, title, content, category, attachment_url, is_pinned, created_at")
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as AgentNews[];
}
