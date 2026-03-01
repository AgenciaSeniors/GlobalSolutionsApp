/**
 * @fileoverview Formulario para que un usuario normal solicite ser agente.
 * @module app/(dashboard)/user/dashboard/become-agent/page
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar, { USER_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { createClient } from '@/lib/supabase/client';
import { Briefcase, Send, CheckCircle2, Sparkles, ArrowRight, X } from 'lucide-react';

export default function BecomeAgentPage() {
  const supabase = createClient();
  const router = useRouter();
  
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [userId, setUserId] = useState<string | null>(null);
  
  // Estados de la solicitud
  const [alreadyRequested, setAlreadyRequested] = useState<boolean>(false);
  const [isApproved, setIsApproved] = useState<boolean>(false);
  const [isRejected, setIsRejected] = useState<boolean>(false);
  
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

    // Revisar su perfil para ver si ya es agente
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name, email')
      .eq('id', user.id)
      .single();

    if (profile) {
      setFormData({
        fullName: profile.full_name || '',
        email: profile.email || ''
      });

      // Si su rol ya es agente, significa que el admin lo aprobó
      if (profile.role === 'agent' || profile.role === 'admin') {
        setIsApproved(true);
        setLoading(false);
        return;
      }
    }

    // Si no es agente, revisar el estado de la última solicitud
    const { data: lastRequest } = await supabase
      .from('agent_requests')
      .select('status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastRequest?.status === 'pending') {
      setAlreadyRequested(true);
    } else if (lastRequest?.status === 'rejected') {
      setIsRejected(true);
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
      setIsRejected(false); // Reseteamos por si estaba rechazado y volvió a enviar (aunque tu app actual bloquea esto)
    }
    
    setSubmitting(false);
  }

  // Función para ir al panel de agente y limpiar la notificación
  const handleGoToAgentDashboard = () => {
    localStorage.setItem('has_seen_agent_welcome', 'true');
    // Despachamos evento para que el Navbar y Sidebar apaguen el puntito rojo al instante
    window.dispatchEvent(new Event('agent_welcome_seen'));
    router.push('/agent/dashboard');
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar links={USER_SIDEBAR_LINKS} />
      
      <div className="flex-1">
        <Header
          title="Gestión de Gestores"
          subtitle={isApproved ? "¡Bienvenido al equipo!" : "Únete a nuestro equipo y comienza a gestionar vuelos"}
        />

        <div className="p-8 max-w-2xl mx-auto">
          {loading ? (
            <p className="text-neutral-500">Cargando información...</p>
          ) : isApproved ? (
            <Card variant="bordered" className="text-center p-12 border-emerald-200 bg-emerald-50/50 shadow-lg shadow-emerald-100/50">
              <div className="flex justify-center mb-6 relative">
                <div className="absolute inset-0 bg-emerald-200 blur-2xl opacity-50 rounded-full"></div>
                <Sparkles className="h-20 w-20 text-emerald-500 relative z-10 animate-pulse" />
              </div>
              <h2 className="text-3xl font-bold text-emerald-900 mb-3">¡Felicidades!</h2>
              <p className="text-emerald-700 mb-8 text-lg">
                Tu solicitud ha sido aprobada exitosamente. Ya tienes acceso completo a todas las herramientas de Gestor.
              </p>
              <Button onClick={handleGoToAgentDashboard} size="lg" className="gap-2 w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600">
                Ir a Mi Perfil de Gestor <ArrowRight className="h-5 w-5" />
              </Button>
            </Card>
          ) : isRejected ? (
            <Card variant="bordered" className="text-center p-12 border-red-200 bg-red-50/30">
              <X className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-red-900 mb-2">Solicitud no aprobada</h2>
              <p className="text-red-700">
                Lo sentimos, tu solicitud para ser gestor no ha sido aceptada en este momento. 
                Puedes seguir usando la plataforma como cliente.
              </p>
            </Card>
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