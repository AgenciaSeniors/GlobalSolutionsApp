/**
 * @fileoverview Admin News Management — Publish to the agent intranet wall.
 * Per spec §2.2: Admin publishes updates to the private community.
 */
'use client';

// 1. Import useCallback
import { useEffect, useState, useCallback } from 'react';
import Sidebar, { ADMIN_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { createClient } from '@/lib/supabase/client';
import { Plus, Pin, Trash2, Megaphone, Pencil } from 'lucide-react';
import type { AgentNews } from '@/types/models';
import { toast } from 'sonner';

export default function AdminNewsPage() {
  const supabase = createClient();
  const [news, setNews] = useState<AgentNews[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<'update' | 'promo' | 'alert'>('update');
  const [isPinned, setIsPinned] = useState(false);
  

  // 2. Wrap fetchNews in useCallback to stabilize the function reference
  const fetchNews = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('agent_news')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });
    setNews((data as AgentNews[]) || []);
    setLoading(false);
  }, [supabase]);

  // 3. Add fetchNews to the dependency array
  useEffect(() => { 
    fetchNews(); 
  }, [fetchNews]);

 function resetForm() {
  setEditing(false);
  setEditingId(null);
  setTitle('');
  setContent('');
  setCategory('update');
  setIsPinned(false);
}

function startCreate() {
  setEditing(true);
  setEditingId(null);
  setTitle('');
  setContent('');
  setCategory('update');
  setIsPinned(false);
}

function startEdit(n: AgentNews) {
  setEditing(true);
  setEditingId(n.id);
  setTitle(n.title || '');
  setContent(n.content || '');
  setCategory(((n.category as any) || 'update') as typeof category);
  setIsPinned(!!n.is_pinned);
}

async function handleSave() {
  if (!title.trim() || !content.trim()) return;

  const payload = {
    title: title.trim(),
    content: content.trim(),
    category,
    is_pinned: isPinned,
  };

  const { error } = editingId
    ? await supabase.from('agent_news').update(payload).eq('id', editingId)
    : await supabase.from('agent_news').insert(payload);

  if (error) {
    console.error('agent_news save error:', error);
    toast.error(`No se pudo guardar: ${error.message}`);
    return;
  }

  toast.success(editingId ? 'Noticia actualizada' : 'Noticia publicada');
  resetForm();
  fetchNews();
}

  async function deleteNews(id: string) {
    if (confirm('¿Eliminar esta noticia?')) {
     const { error } = await supabase.from('agent_news').delete().eq('id', id);
if (error) {
  toast.error(`No se pudo eliminar: ${error.message}`);
  return;
}
toast.success('Noticia eliminada');
if (editingId === id) resetForm();
      fetchNews();
    }
  }

  async function togglePin(id: string, current: boolean) {
    const { error } = await supabase.from('agent_news').update({ is_pinned: !current }).eq('id', id);
if (error) {
  toast.error(`No se pudo fijar/desfijar: ${error.message}`);
  return;
}
    fetchNews();
  }

  const catColors: Record<string, string> = {
    update: 'bg-blue-100 text-blue-700',
    promo: 'bg-emerald-100 text-emerald-700',
    alert: 'bg-red-100 text-red-700',
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar links={ADMIN_SIDEBAR_LINKS} />
      <div className="flex-1">
        <Header title="Noticias para Gestores" subtitle="Publica actualizaciones en el muro de la comunidad" />
        <div className="p-8">
          <div className="mb-6 flex justify-end">
           <Button onClick={startCreate} className="gap-2">
  <Plus className="h-4 w-4" /> Nueva Noticia
</Button>
          </div>

          {editing && (
            <Card className="mb-8 border-2 border-blue-200 bg-blue-50/30">
              <h3 className="mb-4 flex items-center gap-2 font-bold">
                <Megaphone className="h-5 w-5 text-blue-600" /> {editingId ? 'Editar Noticia' : 'Publicar Noticia'}
              </h3>
              <div className="space-y-4">
                {/* 4. Removed 'label' prop and added manual label styling */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700">Título</label>
                  <Input 
                    value={title} 
                    onChange={e => setTitle(e.target.value)} 
                    placeholder="Ej: Nuevas tarifas Turkish Airlines" 
                  />
                </div>
                
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700">Contenido</label>
                  <textarea
                    value={content} onChange={e => setContent(e.target.value)}
                    className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none"
                    rows={4} placeholder="Escribe el contenido de la noticia..."
                  />
                </div>
                <div className="flex gap-4">
                  <select value={category} onChange={e => setCategory(e.target.value as typeof category)} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm">
                    <option value="update">Actualización</option>
                    <option value="promo">Promoción</option>
                    <option value="alert">Alerta</option>
                  </select>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={isPinned} onChange={e => setIsPinned(e.target.checked)} />
                    <Pin className="h-4 w-4" /> Fijar arriba
                  </label>
                </div>
                <div className="flex gap-3">
                 <Button onClick={handleSave}>{editingId ? 'Guardar cambios' : 'Publicar'}</Button>
<Button variant="outline" onClick={resetForm}>Cancelar</Button>
                </div>
              </div>
            </Card>
          )}

          {loading ? <p className="text-neutral-500">Cargando...</p> : (
            <div className="space-y-4">
              {news.map(n => (
                <Card key={n.id} variant="bordered" className={n.is_pinned ? 'border-l-4 border-l-amber-400' : ''}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        {n.is_pinned && <Pin className="h-4 w-4 text-amber-500" />}
                        <h4 className="font-bold">{n.title}</h4>
                        {n.category && (
                          <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${catColors[n.category] || ''}`}>
                            {n.category}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-neutral-600 whitespace-pre-wrap">{n.content}</p>
                      <p className="mt-2 text-xs text-neutral-400">{new Date(n.created_at).toLocaleDateString('es', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => startEdit(n)} className="rounded-lg p-2 hover:bg-neutral-100" title="Editar">
  <Pencil className="h-4 w-4 text-neutral-400" />
</button>
                      <button onClick={() => togglePin(n.id, n.is_pinned)} className="rounded-lg p-2 hover:bg-neutral-100">
                        <Pin className={`h-4 w-4 ${n.is_pinned ? 'text-amber-500' : 'text-neutral-300'}`} />
                      </button>
                      <button onClick={() => deleteNews(n.id)} className="rounded-lg p-2 hover:bg-red-50">
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}