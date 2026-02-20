"use client";
import { useEffect, useState } from "react";
import type { AgentNews } from "@/types/agentNews";
import { getAgentNews } from "@/services/agentNews.service";

export function useAgentNews(limit = 10) {
  const [items, setItems] = useState<AgentNews[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        // AQUI ES DONDE OCURRE LA MAGIA REAL
        const data = await getAgentNews({ limit });
        if (alive) setItems(data);
      } catch (e) {
  console.error(e);
  if (alive) {
    setItems([]);
    setError(null);
  }
}
    })();

    return () => {
      alive = false;
    };
  }, [limit]);

  return { items, loading, error };
}