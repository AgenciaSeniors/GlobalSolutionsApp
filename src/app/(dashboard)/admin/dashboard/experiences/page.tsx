'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Sidebar, { ADMIN_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import { Plus, Edit, Trash2, Eye, EyeOff, Camera, X, ImageOff } from 'lucide-react';
import type { CustomerExperience } from '@/types/models';

const supabase = createClient();

async function uploadExperienceImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Solo se permiten imágenes');
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `experiences/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;
  const { error } = await supabase.storage
    .from('experience-images')
    .upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  return supabase.storage.from('experience-images').getPublicUrl(path).data.publicUrl;
}

export default function AdminExperiencesPage() {
  const [experiences, setExperiences] = useState<CustomerExperience[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [displayOrder, setDisplayOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function fetchExperiences() {
    setLoading(true);
    const { data, error: e } = await supabase
      .from('customer_experiences')
      .select('*')
      .order('display_order', { ascending: true });
    if (e) setError(e.message);
    setExperiences((data as CustomerExperience[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchExperiences(); }, []);

  function resetForm() {
    setEditingId(null);
    setComment('');
    setDisplayOrder(0);
    setIsActive(true);
    setImageFile(null);
    setImagePreview(null);
    setCurrentPhotoUrl(null);
    setError(null);
  }

  function openCreate() { resetForm(); setShowForm(true); }

  function openEdit(exp: CustomerExperience) {
    setEditingId(exp.id);
    setComment(exp.comment ?? '');
    setDisplayOrder(exp.display_order);
    setIsActive(exp.is_active);
    setImageFile(null);
    setImagePreview(null);
    setCurrentPhotoUrl(exp.photo_url);
    setError(null);
    setShowForm(true);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      let photoUrl = currentPhotoUrl ?? null;
      if (imageFile) photoUrl = await uploadExperienceImage(imageFile);

      const payload = {
        photo_url: photoUrl,
        comment: comment.trim() || null,
        display_order: displayOrder,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      };

      const { error: saveErr } = editingId
        ? await supabase.from('customer_experiences').update(payload).eq('id', editingId)
        : await supabase.from('customer_experiences').insert(payload);

      if (saveErr) throw saveErr;
      setShowForm(false);
      resetForm();
      await fetchExperiences();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('customer_experiences').update({ is_active: !current }).eq('id', id);
    fetchExperiences();
  }

  async function deleteExperience(id: string) {
    if (!confirm('¿Eliminar esta experiencia?')) return;
    await supabase.from('customer_experiences').delete().eq('id', id);
    fetchExperiences();
  }

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <Sidebar links={ADMIN_SIDEBAR_LINKS} />
      <div className="flex flex-1 flex-col">
        <Header />
        <main className="flex-1 p-6">

          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">Experiencia de Clientes</h1>
              <p className="mt-1 text-sm text-neutral-500">
                Fotos y comentarios que aparecen en el carrusel de la página principal.
              </p>
            </div>
            {!showForm && (
              <Button onClick={openCreate} className="gap-2">
                <Plus className="h-4 w-4" /> Nueva Experiencia
              </Button>
            )}
          </div>

          {/* Form */}
          {showForm && (
            <Card variant="bordered" className="mb-8 p-6">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-bold text-neutral-800">
                  {editingId ? 'Editar Experiencia' : 'Nueva Experiencia'}
                </h2>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); resetForm(); }}
                  className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="grid gap-5 sm:grid-cols-2">

                {/* Photo */}
                <div className="sm:col-span-2">
                  <p className="mb-2 text-sm font-medium text-neutral-700">
                    Foto <span className="font-normal text-neutral-400">(opcional)</span>
                  </p>
                  <div className="flex items-center gap-4">
                    {(imagePreview ?? currentPhotoUrl) ? (
                      <img
                        src={imagePreview ?? currentPhotoUrl!}
                        alt="Preview"
                        className="h-24 w-24 rounded-xl object-cover border border-neutral-200"
                      />
                    ) : (
                      <div className="flex h-24 w-24 items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50">
                        <Camera className="h-7 w-7 text-neutral-300" />
                      </div>
                    )}
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {imagePreview ?? currentPhotoUrl ? 'Cambiar foto' : 'Seleccionar foto'}
                      </Button>
                      {(imagePreview ?? currentPhotoUrl) && (
                        <button
                          type="button"
                          onClick={() => { setImageFile(null); setImagePreview(null); setCurrentPhotoUrl(null); }}
                          className="ml-2 text-xs text-red-500 hover:underline"
                        >
                          Quitar foto
                        </button>
                      )}
                      <p className="mt-1 text-xs text-neutral-400">JPG, PNG o WebP · máx 5 MB</p>
                    </div>
                  </div>
                </div>

                {/* Comment */}
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-neutral-700">
                    Comentario <span className="font-normal text-neutral-400">(opcional)</span>
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    placeholder="Escribe lo que desees mostrar junto a la foto..."
                    className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                  />
                </div>

                {/* Order + Active */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700">
                    Orden <span className="font-normal text-neutral-400">(menor número = primero)</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(Number(e.target.value))}
                    className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                  />
                </div>

                <div className="flex items-end pb-1">
                  <label className="flex cursor-pointer select-none items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-sm font-medium text-neutral-700">Visible en la home</span>
                  </label>
                </div>

                {error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}

                <div className="sm:col-span-2 flex gap-3">
                  <Button type="submit" disabled={saving} isLoading={saving}>
                    {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setShowForm(false); resetForm(); }}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* List */}
          {loading ? (
            <div className="py-20 text-center text-sm text-neutral-400">Cargando...</div>
          ) : experiences.length === 0 ? (
            <Card variant="bordered" className="py-16 text-center">
              <Camera className="mx-auto h-10 w-10 text-neutral-300" />
              <p className="mt-3 text-sm text-neutral-500">
                Aún no hay experiencias. Crea la primera con el botón de arriba.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {experiences.map((exp) => (
                <Card key={exp.id} variant="bordered" className="overflow-hidden p-0">
                  {/* Photo */}
                  <div className="relative h-44 bg-neutral-100">
                    {exp.photo_url ? (
                      <img
                        src={exp.photo_url}
                        alt="Experiencia"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <ImageOff className="h-10 w-10 text-neutral-300" />
                      </div>
                    )}
                    {!exp.is_active && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <span className="rounded-lg bg-white/90 px-3 py-1 text-xs font-semibold text-neutral-700">
                          Oculto
                        </span>
                      </div>
                    )}
                    <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2.5 py-0.5 text-xs font-bold text-white">
                      #{exp.display_order}
                    </span>
                  </div>

                  {/* Comment */}
                  <div className="p-4">
                    {exp.comment ? (
                      <p className="line-clamp-3 text-sm italic text-neutral-600">"{exp.comment}"</p>
                    ) : (
                      <p className="text-sm text-neutral-400 italic">Sin comentario</p>
                    )}

                    {/* Actions */}
                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(exp)}
                        className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                      >
                        <Edit className="h-3.5 w-3.5" /> Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleActive(exp.id, exp.is_active)}
                        className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                      >
                        {exp.is_active
                          ? <><EyeOff className="h-3.5 w-3.5" /> Ocultar</>
                          : <><Eye className="h-3.5 w-3.5" /> Mostrar</>}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteExperience(exp.id)}
                        className="ml-auto flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
