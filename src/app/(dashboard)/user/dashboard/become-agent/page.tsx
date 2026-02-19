/**
 * @fileoverview Formulario para que un usuario normal solicite ser agente.
 * @module app/(dashboard)/user/dashboard/become-agent/page
 */
'use client';

import { useEffect, useState } from 'react';
import Sidebar, { USER_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { createClient } from '@/lib/supabase/client';
import { Briefcase, Send, CheckCircle2 } from 'lucide-react';

export default function BecomeAgentPage() {
  const supabase = createClient();
  
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [alreadyRequested, setAlreadyRequested] = useState<boolean>(false);
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: ''
  });
  
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    loadUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadUserData() {
    setLoading(true);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      setLoading(false);
      return;
    }
    
    setUserId(user.id);

    // Revisar si ya tiene solicitud pendiente
    const { data: existingRequest } = await supabase
      .from('agent_requests')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .limit(1)
      .maybeSingle();

    if (existingRequest) {
      setAlreadyRequested(true);
    }

    // Pre-rellenar formulario con sus datos de perfil
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single();

    if (profile) {
      setFormData({
        fullName: profile.full_name || '',
        email: profile.email || ''
      });
    }

    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;

    setSubmitting(true);
    setMessage(null);

    const { error } = await supabase
      .from('agent_requests')
      .insert({
        user_id: userId,
        contact_full_name: formData.fullName,
        contact_email: formData.email,
        status: 'pending'
      });

    if (error) {
      setMessage({ type: 'error', text: 'Hubo un error al enviar tu solicitud. Intenta más tarde.' });
    } else {
      setMessage({ type: 'success', text: '¡Solicitud enviada con éxito!' });
      setAlreadyRequested(true);
    }
    
    setSubmitting(false);
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar links={USER_SIDEBAR_LINKS} />
      
      <div className="flex-1">
        <Header
          title="Quiero ser Gestor"
          subtitle="Únete a nuestro equipo y comienza a gestionar vuelos y reservas"
        />

        <div className="p-8 max-w-2xl mx-auto">
          {loading ? (
            <p className="text-neutral-500">Cargando información...</p>
          ) : alreadyRequested ? (
            <Card variant="bordered" className="text-center p-12">
              <div className="flex justify-center mb-4">
                <CheckCircle2 className="h-16 w-16 text-emerald-500" />
              </div>
              <h2 className="text-2xl font-bold text-neutral-900 mb-2">¡Solicitud en revisión!</h2>
              <p className="text-neutral-500">
                Hemos recibido tu solicitud. Un administrador la evaluará y pronto tendrás respuesta.
              </p>
            </Card>
          ) : (
            <Card variant="bordered">
              <div className="flex items-center gap-3 mb-6">
                <Briefcase className="h-6 w-6 text-brand-500" />
                <h2 className="text-xl font-bold text-neutral-900">Formulario de Solicitud</h2>
              </div>
              
              <p className="text-sm text-neutral-500 mb-6">
                Confirma tus datos de contacto para enviar la solicitud de gestoría.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Nombre completo"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="Ej: Juan Pérez"
                  required
                />
                
                <Input
                  label="Correo electrónico"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Ej: juan@email.com"
                  required
                />

                {message && (
                  <div className={`p-3 rounded-lg text-sm ${
                    message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                  }`}>
                    {message.text}
                  </div>
                )}

                <div className="pt-4 flex justify-end">
                  <Button type="submit" isLoading={submitting} className="gap-2">
                    <Send className="h-4 w-4" /> Solicitar
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}