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

function isNonEmpty(s: string): boolean {
  return s.trim().length > 0;
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

export default function AdminAgentsPage() {
  const supabase = createClient();

  const [agents, setAgents] = useState<Profile[]>([]);
  const [requests, setRequests] = useState<AgentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Visto / No visto logic
  const [showRequests, setShowRequests] = useState(false);
  const [seenRequestIds, setSeenRequestIds] = useState<Set<string>>(new Set());

  // Búsqueda en tabla
  const [search, setSearch] = useState('');

  // Promover/crear agente desde email
  const [promoteEmail, setPromoteEmail] = useState('');
  const [promoteCode, setPromoteCode] = useState('');
  const [promoteActive, setPromoteActive] = useState(true);
  const [promoteLoading, setPromoteLoading] = useState(false);
  
  const [toast, setToast] = useState<ToastState>({ ok: null, error: null });

  // Edición rápida de agent_code por fila
  const [editCodeById, setEditCodeById] = useState<Record<string, string>>({});
  const [savingCodeById, setSavingCodeById] = useState<Record<string, boolean>>({});

  // Cargar IDs vistos desde el storage al iniciar
  useEffect(() => {
    const stored = localStorage.getItem('admin_seen_agent_requests');
    if (stored) {
      try {
        setSeenRequestIds(new Set(JSON.parse(stored)));
      } catch (e) {
        console.error('Error parsing seen requests', e);
      }
    }
    fetchAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchAgents() {
    setLoading(true);
    
    // Peticiones en paralelo
    const [agentsRes, requestsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .eq('role', 'agent')
        .order('created_at', { ascending: false }),
      supabase
        .from('agent_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
    ]);

    if (agentsRes.error) {
      console.error('fetchAgents error:', agentsRes.error);
      setAgents([]);
    } else {
      const rows = (agentsRes.data ?? []) as Profile[];
      setAgents(rows);

      // Inicializa edit inputs
      const initial: Record<string, string> = {};
      for (const a of rows) {
        initial[a.id] = a.agent_code ?? '';
      }
      setEditCodeById(initial);
    }

    if (!requestsRes.error) {
      const pendingReqs = (requestsRes.data as unknown as AgentRequest[]) ?? [];
      setRequests(pendingReqs);
      
      if (pendingReqs.length === 0) setShowRequests(false);
    }

    setLoading(false);
  }

  // Desactivar: Realmente cambia el rol a 'client' y lo saca de la tabla
  async function toggleAgentStatus(agent: Profile) {
    setToast({ ok: null, error: null });
    
    const isDeactivating = agent.is_active;
    const nextActive = !agent.is_active;
    const nextRole: UserRole = isDeactivating ? 'client' : 'agent';

    const { error } = await supabase
      .from('profiles')
      .update({ is_active: nextActive, role: nextRole })
      .eq('id', agent.id);

    if (error) {
      setToast({ ok: null, error: error.message });
      return;
    }

    if (isDeactivating) {
      setToast({ ok: `El gestor ${agent.full_name} fue desactivado y ahora es Cliente.`, error: null });
    } else {
      setToast({ ok: `Gestor activado correctamente: ${agent.full_name}`, error: null });
    }
    
    fetchAgents();
  }

  async function saveAgentCode(agentId: string) {
    setToast({ ok: null, error: null });
    const raw = editCodeById[agentId] ?? '';
    const code = normalizeCode(raw);

    setSavingCodeById((p) => ({ ...p, [agentId]: true }));
    try {
      if (!isNonEmpty(code)) {
        setToast({ ok: null, error: 'El código no puede estar vacío.' });
        return;
      }

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

  // --- LÓGICA DE SOLICITUDES PENDIENTES --- //
  
  const handleToggleRequests = () => {
    if (requests.length === 0) return;
    
    const isOpening = !showRequests;
    setShowRequests(isOpening);

    // Si abrimos la lista, guardamos localmente que ya vimos las actuales
    if (isOpening) {
      const newSeen = new Set(seenRequestIds);
      requests.forEach(r => newSeen.add(r.id));
      setSeenRequestIds(newSeen);
      localStorage.setItem('admin_seen_agent_requests', JSON.stringify(Array.from(newSeen)));
    }
  };

  // Aprobar solicitud
  async function handleApproveRequest(req: AgentRequest) {
    setToast({ ok: null, error: null });
    
    // 1. Convertir a agente y activarlo en perfiles
    const { error: profileErr } = await supabase
      .from('profiles')
      .update({ role: 'agent', is_active: true })
      .eq('id', req.user_id);
      
    if (profileErr) {
      setToast({ ok: null, error: 'Error al cambiar el rol del usuario.' });
      return;
    }
    
    // 2. Marcar solicitud como aprobada
    const { error: reqErr } = await supabase
      .from('agent_requests')
      .update({ status: 'approved' })
      .eq('id', req.id);
      
    if (reqErr) {
      setToast({ ok: null, error: 'Error al actualizar la solicitud.' });
      return;
    }

    setToast({ 
      ok: `¡Usuario ${req.contact_full_name} aprobado como agente!`, 
      error: null 
    });

    // Se elimina inmediatamente de la lista y se recarga la tabla
    setRequests(prev => {
      const updated = prev.filter(r => r.id !== req.id);
      if (updated.length === 0) setShowRequests(false);
      return updated;
    });
    fetchAgents();
  }

  // Declinar solicitud
  async function handleDeclineRequest(req: AgentRequest) {
    setToast({ ok: null, error: null });
    
    const { error } = await supabase
      .from('agent_requests')
      .update({ status: 'rejected' })
      .eq('id', req.id);

    if (error) {
      setToast({ ok: null, error: 'Error al declinar solicitud' });
      return;
    }

    setToast({ ok: 'Solicitud declinada.', error: null });
    
    // Se elimina inmediatamente de la lista
    setRequests(prev => {
      const updated = prev.filter(r => r.id !== req.id);
      if (updated.length === 0) setShowRequests(false);
      return updated;
    });
  }

  // --- PROMOCION MANUAL --- //
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

      setToast({ ok: `Agente aprobado exitosamente: ${profile.full_name}`, error: null });
      setPromoteEmail('');
      setPromoteCode('');
      setPromoteActive(true);
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
  
  // Cálculo de notificaciones NO vistas
  const unseenCount = requests.filter(r => !seenRequestIds.has(r.id)).length;
  
  // Ordenamos para que las NO vistas salgan siempre arriba
  const sortedRequests = [...requests].sort((a, b) => {
    const aSeen = seenRequestIds.has(a.id);
    const bSeen = seenRequestIds.has(b.id);
    if (aSeen === bSeen) {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }
    return aSeen ? 1 : -1;
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar links={ADMIN_SIDEBAR_LINKS} />
      <div className="flex-1">
        <Header
          title="Gestión de Gestores"
          subtitle="Aprobar agentes, asignar código y activar/desactivar"
        />

        <div className="p-8 space-y-6">
          {/* Alertas */}
          <div className="flex items-center gap-2 min-h-[32px]">
            {toast.ok && <span className="text-sm font-medium text-emerald-600 bg-emerald-50 px-3 py-1 rounded-md w-full transition-all">{toast.ok}</span>}
            {toast.error && <span className="text-sm font-medium text-red-600 bg-red-50 px-3 py-1 rounded-md w-full transition-all">{toast.error}</span>}
          </div>

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

            {/* Tarjeta de Solicitudes (Solo muestra número de no vistas) */}
            <div 
              onClick={handleToggleRequests}
              className={`rounded-2xl border bg-white p-6 transition select-none ${
                requests.length > 0 
                  ? 'cursor-pointer hover:shadow-md ' + (unseenCount > 0 ? 'border-red-300 ring-2 ring-red-50 hover:border-red-400' : 'border-neutral-200 hover:border-neutral-300')
                  : 'border-neutral-200 opacity-70'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ClipboardList className={`h-8 w-8 transition-colors ${unseenCount > 0 ? 'text-red-500' : (requests.length > 0 ? 'text-neutral-500' : 'text-neutral-300')}`} />
                  <div>
                    <p className="text-sm text-neutral-500">Nuevas Solicitudes</p>
                    {/* Si hay sin ver = Rojo Vivo. Si es 0 = Rojo Apagado/Neutro */}
                    <p className={`text-2xl font-bold transition-colors ${unseenCount > 0 ? 'text-red-600' : 'text-red-900/40'}`}>
                      {unseenCount > 0 ? unseenCount : 0}
                    </p>
                  </div>
                </div>
                {requests.length > 0 && (
                  <span className="text-xs text-neutral-500 font-medium">Ver {showRequests ? 'menos' : 'todas'}</span>
                )}
              </div>
            </div>
          </div>

          {/* LISTA DESPLEGABLE DE SOLICITUDES PENDIENTES */}
          {showRequests && requests.length > 0 && (
            <Card variant="bordered" className="border-neutral-200 bg-white shadow-md animate-in fade-in slide-in-from-top-4 duration-300">
              <h3 className="text-base font-bold text-neutral-900 mb-4 flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-neutral-600" /> Solicitudes por Revisar
              </h3>
              <div className="space-y-3">
                {sortedRequests.map(req => {
                  const isUnseen = !seenRequestIds.has(req.id);

                  return (
                    <div 
                      key={req.id} 
                      className={`p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4 rounded-xl transition-all duration-300 border ${
                        isUnseen 
                          ? 'bg-red-50/50 border-red-200 shadow-[0_0_12px_rgba(239,68,68,0.15)]' 
                          : 'bg-neutral-50/50 border-transparent hover:border-neutral-100'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-neutral-900">
                            {req.contact_full_name}
                          </p>
                          {isUnseen && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>}
                        </div>
                        <p className="text-xs text-neutral-600">{req.contact_email}</p>
                        <p className="text-[11px] text-neutral-400 mt-1">
                          Solicitado el: {new Date(req.created_at).toLocaleDateString('es')}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="text-red-600 hover:bg-red-50 hover:border-red-200" 
                          onClick={() => handleDeclineRequest(req)}
                        >
                          <X className="h-3.5 w-3.5 mr-1" /> Declinar
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={() => handleApproveRequest(req)}
                        >
                          <Check className="h-3.5 w-3.5 mr-1" /> Aprobar
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          {/* Promote/Create Agent Manual */}
          <Card variant="bordered">
            <div className="flex items-start justify-between gap-4 flex-col md:flex-row md:items-center">
              <div>
                <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                  <UserPlus className="h-4 w-4" /> Aprobar Manualmente / Promover a Agente
                </h3>
                <p className="text-sm text-neutral-500">
                  Convierte un usuario existente en agente asignándole <span className="font-medium">agent_code</span>.
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Email del usuario"
                value={promoteEmail}
                onChange={(e) => setPromoteEmail(e.target.value)}
                placeholder="ej: user@email.com"
              />
              <Input
                label="Agent Code"
                value={promoteCode}
                onChange={(e) => setPromoteCode(e.target.value)}
                placeholder="ej: GST123"
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
                <UserPlus className="h-4 w-4" /> Promover Agente
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

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <input
                            className="w-28 rounded-lg border border-neutral-300 px-2 py-1 font-mono text-xs focus:ring-2 focus:ring-brand-500"
                            value={editCodeById[agent.id] ?? ''}
                            onChange={(e) =>
                              setEditCodeById((p) => ({ ...p, [agent.id]: e.target.value }))
                            }
                            placeholder="Ej: GST123"
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