"use client";

import Card from "@/components/ui/Card";
import { Bell, Paperclip } from "lucide-react";
import { useAgentNews } from "@/hooks/useAgentNews";

function formatRelativeOrDate(iso: string) {
  // simple y estable (sin libs): muestra fecha corta
  const d = new Date(iso);
  return d.toLocaleDateString("es-VE", { year: "numeric", month: "short", day: "2-digit" });
}

export default function AgentNewsWall() {
  const { items, loading, error } = useAgentNews(10);

  return (
    <div className="md:col-span-2 space-y-6">
      <h2 className="text-lg font-bold text-gray-700 flex items-center gap-2">
        <Bell className="w-5 h-5 text-[#FF4757]" />
        Novedades
      </h2>

      {loading && (
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="p-5">
              <div className="h-4 w-1/3 bg-gray-200 rounded mb-3" />
              <div className="h-3 w-full bg-gray-200 rounded mb-2" />
              <div className="h-3 w-4/5 bg-gray-200 rounded" />
            </Card>
          ))}
        </div>
      )}

      {!loading && error && (
        <Card className="p-5 border-l-4 border-l-[#FF4757]">
          <h3 className="font-bold text-[#0F2545]">No se pudieron cargar las noticias</h3>
          <p className="text-sm text-gray-600 mt-2">{error}</p>
        </Card>
      )}

      {!loading && !error && items.length === 0 && (
        <Card className="p-5 border-l-4 border-l-[#0F2545]">
          <h3 className="font-bold text-[#0F2545]">Sin novedades por ahora</h3>
          <p className="text-sm text-gray-600 mt-2">
            Cuando el admin publique avisos en <code>agent_news</code>, aparecerán aquí.
          </p>
        </Card>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="grid gap-4">
          {items.map((item) => (
            <Card
              key={item.id}
              className={`p-5 border-l-4 ${item.is_pinned ? "border-l-[#FF4757]" : "border-l-[#0F2545]"}`}
            >
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h3 className="font-bold text-[#0F2545]">{item.title}</h3>
                  {item.category && (
                    <p className="text-xs text-gray-500 mt-1">Categoría: {item.category}</p>
                  )}
                </div>

                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded whitespace-nowrap">
                  {formatRelativeOrDate(item.created_at)}
                </span>
              </div>

              <p className="text-gray-600 mt-2 text-sm whitespace-pre-line">{item.content}</p>

              {item.attachment_url && (
                <a
                  href={item.attachment_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-2 text-sm text-[#0F2545] underline"
                >
                  <Paperclip className="w-4 h-4" />
                  Ver adjunto
                </a>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
