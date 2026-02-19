/**
 * @fileoverview Admin Agent Management.
 * DEV C: CRUD de agentes: activar/desactivar + promover usuarios a agente + asignar agent_code.
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import Sidebar, { ADMIN_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import { createClient } from '@/lib/supabase/client';
import { Users, UserCheck, UserX, Search, UserPlus, Save, ClipboardList, Check, X } from 'lucide-react';
import type { Profile, UserRole, AgentRequest } from '@/types/models';

type ToastState = { ok: string | null; error: string | null };

// Tipo para la solicitud unida con el perfil
type RequestWithProfile = AgentRequest & {
  profiles: { full_name: string; email: string } | null;
};

function isNonEmpty(s: string): boolean {
  return s.trim().length > 0;
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

export default function AdminAgentsPage() {
  const supabase = createClient();

  const [agents, setAgents] = useState<Profile[]>([]);
  const [requests, setRequests] = useState<RequestWithProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // búsqueda en tabla
  const [search, setSearch] = useState('');

  // promover/crear agente desde email
  const [promoteEmail, setPromoteEmail] = useState('');
  const [promoteCode, setPromoteCode] = useState('');
  const [promoteActive, setPromoteActive] = useState(true);
  const [promoteLoading, setPromoteLoading] = useState(false);
  const [pendingRequestIdToApprove, setPendingRequestIdToApprove] = useState<string | null>(null);
  
  const [toast, setToast] = useState<ToastState>({ ok: null, error: null });

  // edición rápida de agent_code por fila
  const [editCodeById, setEditCodeById] = useState<Record<string, string>>({});
  const [savingCodeById, setSavingCodeById] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchAgents() {
    setLoading(true);
    
    // Peticiones en paralelo para agentes y solicitudes pendientes
    const [agentsRes, requestsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .eq('role', 'agent')
        .order('created_at', { ascending: false }),
      supabase
        .from('agent_requests')
        .select('*, profiles(full_name, email)')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
    ]);

    if (agentsRes.error) {
      console.error('fetchAgents error:', agentsRes.error);
      setAgents([]);
    } else {
      const rows = (agentsRes.data ?? []) as Profile[];
      setAgents(rows);

      // inicializa edit inputs
      const initial: Record<string, string> = {};
      for (const a of rows) {
        initial[a.id] = a.agent_code ?? '';
      }
      setEditCodeById(initial);
    }

    if (!requestsRes.error) {
      setRequests((requestsRes.data as unknown as RequestWithProfile[]) ?? []);
    }

    setLoading(false);
  }

  async function toggleAgentStatus(agent: Profile) {
    setToast({ ok: null, error: null });
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: !agent.is_active })
      .eq('id', agent.id);

    if (error) {
      setToast({ ok: null, error: error.message });
      return;
    }

    setToast({ ok: `Estado actualizado: ${agent.full_name}`, error: null });
    fetchAgents();
  }

  async function saveAgentCode(agentId: string) {
    setToast({ ok: null, error: null });
    const raw = editCodeById[agentId] ?? '';
    const code = normalizeCode(raw);

    setSavingCodeById((p) => ({ ...p, [agentId]: true }));
    try {
      // Evita codes vacíos
      if (!isNonEmpty(code)) {
        setToast({ ok: null, error: 'El código no puede estar vacío.' });
        return;
      }

      // evita duplicados: buscar si ya existe ese agent_code en otro perfil
      const { data: existing, error: existErr } = await supabase
        .from('profiles')
        .select('id, agent_code')
        .eq('agent_code', code)
        .neq('id', agentId)
        .limit(1);

      if (existErr) {
        setToast({ ok: null, error: existErr.message });
        return;
      }
      if ((existing ?? []).length > 0) {
        setToast({ ok: null, error: `Ese código ya existe: ${code}` });
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({ agent_code: code })
        .eq('id', agentId);

      if (error) {
        setToast({ ok: null, error: error.message });
        return;
      }

      setToast({ ok: `Código actualizado: ${code}`, error: null });
      fetchAgents();
    } finally {
      setSavingCodeById((p) => ({ ...p, [agentId]: false }));
    }
  }

  // Preparar aprobación desde la tabla de solicitudes
  function handlePrepareApproval(req: RequestWithProfile) {
    // Autocompletamos el form con su correo
    setPromoteEmail(req.profiles?.email || '');
    setPromoteCode('');
    setPendingRequestIdToApprove(req.id);
    
    // Hacemos scroll suave hacia el formulario
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setToast({ ok: 'Se requiere asignar un código de gestor para finalizar la aprobación.', error: null });
  }

  // Declinar la solicitud
  async function handleDeclineRequest(reqId: string) {
    setToast({ ok: null, error: null });
    const { error } = await supabase
      .from('agent_requests')
      .update({ status: 'rejected' })
      .eq('id', reqId);

    if (error) {
      setToast({ ok: null, error: 'Error al declinar solicitud' });
      return;
    }

    setToast({ ok: 'Solicitud declinada.', error: null });
    fetchAgents(); // Recargar tablas
  }

  async function promoteToAgent() {
    setToast({ ok: null, error: null });

    const email = promoteEmail.trim().toLowerCase();
    const code = normalizeCode(promoteCode);

    if (!isNonEmpty(email)) {
      setToast({ ok: null, error: 'Email requerido.' });
      return;
    }
    if (!isNonEmpty(code)) {
      setToast({ ok: null, error: 'Agent code requerido.' });
      return;
    }

    setPromoteLoading(true);
    try {
      // 1) encuentra el usuario por email
      const { data: found, error: findErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .single();

      if (findErr || !found) {
        setToast({ ok: null, error: 'No se encontró un perfil con ese email.' });
        return;
      }

      const profile = found as Profile;

      // 2) evitar duplicados de agent_code
      const { data: existing, error: existErr } = await supabase
        .from('profiles')
        .select('id, agent_code')
        .eq('agent_code', code)
        .neq('id', profile.id)
        .limit(1);

      if (existErr) {
        setToast({ ok: null, error: existErr.message });
        return;
      }
      if ((existing ?? []).length > 0) {
        setToast({ ok: null, error: `Ese código ya existe: ${code}` });
        return;
      }

      // 3) actualizar role + agent_code + is_active
      const nextRole: UserRole = 'agent';
      const { error: upErr } = await supabase
        .from('profiles')
        .update({
          role: nextRole,
          agent_code: code,
          is_active: promoteActive,
        })
        .eq('id', profile.id);

      if (upErr) {
        setToast({ ok: null, error: upErr.message });
        return;
      }

      // 4) Si venía de una solicitud pendiente, marcarla como aprobada
      if (pendingRequestIdToApprove) {
        await supabase
          .from('agent_requests')
          .update({ status: 'approved' })
          .eq('id', pendingRequestIdToApprove);
      }

      setToast({ ok: `Agente aprobado exitosamente: ${profile.full_name}`, error: null });
      setPromoteEmail('');
      setPromoteCode('');
      setPromoteActive(true);
      setPendingRequestIdToApprove(null);
      fetchAgents();
    } finally {
      setPromoteLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter((a) =>
      a.full_name.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      (a.agent_code ?? '').toLowerCase().includes(q),
    );
  }, [agents, search]);

  const activeCount = agents.filter((a) => a.is_active).length;

  return (
    <div className="flex min-h-screen">
      <Sidebar links={ADMIN_SIDEBAR_LINKS} />
      <div className="flex-1">
        <Header
          title="Gestión de Gestores"
          subtitle="Aprobar agentes, asignar código y activar/desactivar"
        />

        <div className="p-8 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card variant="bordered">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-brand-500" />
                <div>
                  <p className="text-sm text-neutral-500">Total Gestores</p>
                  <p className="text-2xl font-bold">{agents.length}</p>
                </div>
              </div>
            </Card>

            <Card variant="bordered">
              <div className="flex items-center gap-3">
                <UserCheck className="h-8 w-8 text-emerald-500" />
                <div>
                  <p className="text-sm text-neutral-500">Activos</p>
                  <p className="text-2xl font-bold text-emerald-600">{activeCount}</p>
                </div>
              </div>
            </Card>

            <Card variant="bordered">
              <div className="flex items-center gap-3">
                <UserX className="h-8 w-8 text-red-500" />
                <div>
                  <p className="text-sm text-neutral-500">Inactivos</p>
                  <p className="text-2xl font-bold text-red-600">{agents.length - activeCount}</p>
                </div>
              </div>
            </Card>

            {/* Tarjeta de Solicitudes Pendientes */}
            <Card variant="bordered">
              <div className="flex items-center gap-3">
                <ClipboardList className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-sm text-neutral-500">Nuevas Solicitudes</p>
                  <p className="text-2xl font-bold text-blue-600">{requests.length}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* LISTA DE SOLICITUDES PENDIENTES */}
          {requests.length > 0 && (
            <Card variant="bordered" className="border-blue-200 bg-blue-50/20">
              <h3 className="text-base font-bold text-neutral-900 mb-4 flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-blue-600" /> Solicitudes Pendientes de Aprobación
              </h3>
              <div className="divide-y divide-blue-100">
                {requests.map(req => (
                  <div key={req.id} className="py-3 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                      <p className="font-semibold text-sm text-neutral-900">
                        {req.profiles?.full_name || 'Sin nombre'}
                      </p>
                      <p className="text-xs text-neutral-600">{req.profiles?.email}</p>
                      {req.notes && (
                        <p className="text-xs text-neutral-500 mt-1 italic border-l-2 border-blue-200 pl-2">
                          "{req.notes}"
                        </p>
                      )}
                      <p className="text-[11px] text-neutral-400 mt-1">
                        Solicitado el: {new Date(req.created_at).toLocaleDateString('es')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50 hover:border-red-200" onClick={() => handleDeclineRequest(req.id)}>
                        <X className="h-3.5 w-3.5 mr-1" /> Declinar
                      </Button>
                      <Button size="sm" onClick={() => handlePrepareApproval(req)}>
                        <Check className="h-3.5 w-3.5 mr-1" /> Aprobar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Promote/Create Agent */}
          <Card variant="bordered">
            <div className="flex items-start justify-between gap-4 flex-col md:flex-row md:items-center">
              <div>
                <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                  <UserPlus className="h-4 w-4" /> Aprobar / Promover a Agente
                </h3>
                <p className="text-sm text-neutral-500">
                  Convierte un usuario existente en agente asignándole <span className="font-medium">agent_code</span>.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {toast.ok && <span className="text-sm text-emerald-600">{toast.ok}</span>}
                {toast.error && <span className="text-sm text-red-600">{toast.error}</span>}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Email del usuario"
                value={promoteEmail}
                onChange={(e) => setPromoteEmail(e.target.value)}
                placeholder="ej: user@email.com"
                className={pendingRequestIdToApprove ? "border-blue-400 ring-2 ring-blue-100" : ""}
              />
              <Input
                label="Agent Code"
                value={promoteCode}
                onChange={(e) => setPromoteCode(e.target.value)}
                placeholder="ej: GST123"
                className={pendingRequestIdToApprove ? "border-blue-400 ring-2 ring-blue-100" : ""}
              />

              <div className="space-y-1">
                <label className="block text-sm font-medium text-brand-700">Estado Inicial</label>
                <select
                  className="w-full rounded-xl border-2 px-4 py-3 text-[15px] font-medium border-brand-200 bg-white"
                  value={promoteActive ? 'active' : 'inactive'}
                  onChange={(e) => setPromoteActive(e.target.value === 'active')}
                >
                  <option value="active">Activo</option>
                  <option value="inactive">Inactivo</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Button onClick={promoteToAgent} isLoading={promoteLoading} className="gap-2">
                <UserPlus className="h-4 w-4" /> Finalizar Aprobación
              </Button>
            </div>
          </Card>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-neutral-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, email o código..."
              className="w-full rounded-xl border border-neutral-300 pl-10 pr-4 py-2.5 text-sm"
            />
          </div>

          {/* Agents Table */}
          {loading ? (
            <p className="text-neutral-500">Cargando gestores...</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-neutral-200">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
                  <tr>
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3">Puntos</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Registro</th>
                    <th className="px-4 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filtered.map((agent) => (
                    <tr key={agent.id} className={!agent.is_active ? 'bg-red-50/30' : 'hover:bg-neutral-50'}>
                      <td className="px-4 py-3 font-semibold">{agent.full_name}</td>
                      <td className="px-4 py-3 text-neutral-600">{agent.email}</td>

                      {/* Código editable */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <input
                            className="w-28 rounded-lg border border-neutral-300 px-2 py-1 font-mono text-xs"
                            value={editCodeById[agent.id] ?? ''}
                            onChange={(e) =>
                              setEditCodeById((p) => ({ ...p, [agent.id]: e.target.value }))
                            }
                            placeholder="GST123"
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => saveAgentCode(agent.id)}
                            isLoading={savingCodeById[agent.id] ?? false}
                            className="gap-1.5"
                          >
                            <Save className="h-3.5 w-3.5" /> Guardar
                          </Button>
                        </div>
                      </td>

                      <td className="px-4 py-3">{agent.loyalty_points}</td>
                      <td className="px-4 py-3">
                        <Badge variant={agent.is_active ? 'success' : 'default'}>
                          {agent.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-neutral-500">
                        {new Date(agent.created_at).toLocaleDateString('es')}
                      </td>

                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          variant={agent.is_active ? 'outline' : 'primary'}
                          onClick={() => toggleAgentStatus(agent)}
                        >
                          {agent.is_active ? 'Desactivar' : 'Activar'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-center text-neutral-500" colSpan={7}>
                        No hay resultados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}