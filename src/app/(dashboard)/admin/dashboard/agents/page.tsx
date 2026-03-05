/**
 * @fileoverview Admin Agent Management.
 * DEV C: CRUD de agentes: activar/desactivar + promover usuarios a agente + asignar agent_code.
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import Sidebar, { ADMIN_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { createClient } from '@/lib/supabase/client';
import { Users, UserCheck, UserX, Search, UserPlus, Save, ClipboardList, Check, X, History, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { Profile, UserRole, AgentRequest } from '@/types/models';

type ToastState = { ok: string | null; error: string | null };

type FundHistoryEntry = {
  id: string;
  old_value_cents: number;
  new_value_cents: number;
  changed_at: string;
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
  const [requests, setRequests] = useState<AgentRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const [showRequests, setShowRequests] = useState(false);
  const [search, setSearch] = useState('');

  const [promoteEmail, setPromoteEmail] = useState('');
  const [promoteCode, setPromoteCode] = useState('');
  const [promoteActive, setPromoteActive] = useState(true);
  const [promoteLoading, setPromoteLoading] = useState(false);

  const [toast, setToast] = useState<ToastState>({ ok: null, error: null });

  const [editCodeById, setEditCodeById] = useState<Record<string, string>>({});
  const [savingCodeById, setSavingCodeById] = useState<Record<string, boolean>>({});

  const [editFundById, setEditFundById] = useState<Record<string, string>>({});
  const [savingFundById, setSavingFundById] = useState<Record<string, boolean>>({});

  const [fundHistoryModal, setFundHistoryModal] = useState<{ agentName: string; entries: FundHistoryEntry[] } | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    fetchAgentsData();
    fetchRequestsData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchAgentsData() {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'agent')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('fetchAgentsData error:', error);
      setAgents([]);
    } else {
      const rows = (data ?? []) as Profile[];
      setAgents(rows);

      const initialCodes: Record<string, string> = {};
      const initialFunds: Record<string, string> = {};
      for (const a of rows) {
        initialCodes[a.id] = a.agent_code ?? '';
        initialFunds[a.id] = String(a.agent_fund_cents ?? 0);
      }
      setEditCodeById(initialCodes);
      setEditFundById(initialFunds);
    }

    setLoading(false);
  }

  async function fetchRequestsData() {
    const { data, error } = await supabase
      .from('agent_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (!error) {
      const pendingReqs = (data as unknown as AgentRequest[]) ?? [];
      setRequests(pendingReqs);
      if (pendingReqs.length === 0) setShowRequests(false);
    }
  }

  async function toggleAgentStatus(agent: Profile) {
    setToast({ ok: null, error: null });

    const nextActive = !agent.is_active;
    const { error } = await supabase.from('profiles').update({ is_active: nextActive }).eq('id', agent.id);

    if (error) {
      setToast({ ok: null, error: error.message });
      return;
    }

    setToast({
      ok: !nextActive
        ? `El gestor ${agent.full_name} fue desactivado. Puede reactivarse en cualquier momento.`
        : `Gestor activado correctamente: ${agent.full_name}`,
      error: null,
    });

    fetchAgentsData();
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

      const { error } = await supabase.from('profiles').update({ agent_code: code }).eq('id', agentId);
      if (error) {
        setToast({ ok: null, error: error.message });
        return;
      }

      setToast({ ok: `Código actualizado: ${code}`, error: null });
      fetchAgentsData();
    } finally {
      setSavingCodeById((p) => ({ ...p, [agentId]: false }));
    }
  }

  async function saveAgentFund(agentId: string) {
    setToast({ ok: null, error: null });

    const raw = (editFundById[agentId] ?? '').trim();
    const cents = Number(raw);

    if (!Number.isFinite(cents) || !Number.isInteger(cents)) {
      setToast({ ok: null, error: 'El fondo debe ser un número entero (puede ser negativo si el gestor tiene deuda).' });
      return;
    }

    setSavingFundById((p) => ({ ...p, [agentId]: true }));
    try {
      const oldCents = agents.find((a) => a.id === agentId)?.agent_fund_cents ?? 0;

      const { error } = await supabase.from('profiles').update({ agent_fund_cents: cents }).eq('id', agentId);
      if (error) {
        setToast({ ok: null, error: error.message });
        return;
      }

      // Registrar historial
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('agent_fund_history').insert({
        agent_id: agentId,
        old_value_cents: oldCents,
        new_value_cents: cents,
        changed_by: user?.id ?? null,
      });

      setToast({ ok: 'Fondo actualizado.', error: null });
      fetchAgentsData();
    } finally {
      setSavingFundById((p) => ({ ...p, [agentId]: false }));
    }
  }

  async function openFundHistory(agentId: string, agentName: string) {
    setLoadingHistory(true);
    setFundHistoryModal({ agentName, entries: [] });
    const { data } = await supabase
      .from('agent_fund_history')
      .select('id, old_value_cents, new_value_cents, changed_at')
      .eq('agent_id', agentId)
      .order('changed_at', { ascending: false })
      .limit(50);
    setFundHistoryModal({ agentName, entries: (data ?? []) as FundHistoryEntry[] });
    setLoadingHistory(false);
  }

  const handleToggleRequests = () => {
    if (requests.length === 0) return;
    setShowRequests(!showRequests);
  };

  async function handleApproveRequest(req: AgentRequest) {
    setToast({ ok: null, error: null });

    const { error: profileErr } = await supabase.from('profiles').update({ role: 'agent', is_active: true }).eq('id', req.user_id);
    if (profileErr) {
      setToast({ ok: null, error: 'Error al cambiar el rol del usuario.' });
      return;
    }

    const { error: reqErr } = await supabase.from('agent_requests').update({ status: 'approved' }).eq('id', req.id);
    if (reqErr) {
      setToast({ ok: null, error: 'Error al actualizar la solicitud.' });
      return;
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ type: 'agent_approved', email: req.contact_email, data: { name: req.contact_full_name } }),
      });
    } catch (error) {
      console.error('Error enviando email de notificación:', error);
    }

    setToast({ ok: `¡Usuario ${req.contact_full_name} aprobado como agente y notificado!`, error: null });

    setRequests((prev) => {
      const updated = prev.filter((r) => r.id !== req.id);
      if (updated.length === 0) setShowRequests(false);
      return updated;
    });

    fetchAgentsData();
  }

  async function handleDeclineRequest(req: AgentRequest) {
    setToast({ ok: null, error: null });

    const { error } = await supabase.from('agent_requests').update({ status: 'rejected' }).eq('id', req.id);
    if (error) {
      setToast({ ok: null, error: 'Error al declinar solicitud' });
      return;
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ type: 'agent_rejected', email: req.contact_email, data: { name: req.contact_full_name } }),
      });
    } catch (e) {
      console.error(e);
    }

    setToast({ ok: 'Solicitud declinada y usuario notificado.', error: null });

    setRequests((prev) => {
      const updated = prev.filter((r) => r.id !== req.id);
      if (updated.length === 0) setShowRequests(false);
      return updated;
    });
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
      const { data: found, error: findErr } = await supabase.from('profiles').select('*').eq('email', email).single();
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
        .update({ role: nextRole, agent_code: code, is_active: promoteActive })
        .eq('id', profile.id);

      if (upErr) {
        setToast({ ok: null, error: upErr.message });
        return;
      }

      setToast({ ok: `Agente aprobado exitosamente: ${profile.full_name}`, error: null });
      setPromoteEmail('');
      setPromoteCode('');
      setPromoteActive(true);
      fetchAgentsData();
    } finally {
      setPromoteLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter(
      (a) =>
        a.full_name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        (a.agent_code ?? '').toLowerCase().includes(q),
    );
  }, [agents, search]);

  const activeCount = agents.filter((a) => a.is_active).length;

  return (
    <>
    <div className="flex h-screen overflow-hidden bg-neutral-50/30 w-full">
      <Sidebar links={ADMIN_SIDEBAR_LINKS} />

      {/* ✅ min-w-0 PREVIENE que el contenido rompa el ancho del dispositivo móvil */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        <Header title="Gestión de Gestores" subtitle="Aprobar agentes, asignar código y activar/desactivar" />

        <div className="flex-1 overflow-y-auto p-3 md:p-6 flex flex-col gap-4 min-w-0">

          {/* Alertas */}
          {(toast.ok || toast.error) && (
            <div className="flex items-center gap-2 shrink-0">
              {toast.ok && (
                <span className="text-sm font-medium text-emerald-700 bg-emerald-100/60 border border-emerald-200 px-4 py-2 rounded-lg w-full transition-all">
                  {toast.ok}
                </span>
              )}
              {toast.error && (
                <span className="text-sm font-medium text-red-700 bg-red-100/60 border border-red-200 px-4 py-2 rounded-lg w-full transition-all">
                  {toast.error}
                </span>
              )}
            </div>
          )}

          {/* Stats: Cuadrícula en móviles, en línea en desktop */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 shrink-0">
            <div className="rounded-xl border border-neutral-200 bg-white p-3 md:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 shadow-sm">
              <div className="bg-brand-50 p-2 md:p-2.5 rounded-lg shrink-0">
                <Users className="h-5 w-5 text-brand-600" />
              </div>
              <div>
                <p className="text-[11px] md:text-xs text-neutral-500 font-medium mb-0.5 md:mb-1">Total</p>
                <p className="text-lg md:text-xl font-bold leading-none text-neutral-900">{agents.length}</p>
              </div>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-3 md:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 shadow-sm">
              <div className="bg-emerald-50 p-2 md:p-2.5 rounded-lg shrink-0">
                <UserCheck className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-[11px] md:text-xs text-neutral-500 font-medium mb-0.5 md:mb-1">Activos</p>
                <p className="text-lg md:text-xl font-bold leading-none text-emerald-700">{activeCount}</p>
              </div>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-3 md:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 shadow-sm">
              <div className="bg-red-50 p-2 md:p-2.5 rounded-lg shrink-0">
                <UserX className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-[11px] md:text-xs text-neutral-500 font-medium mb-0.5 md:mb-1">Inactivos</p>
                <p className="text-lg md:text-xl font-bold leading-none text-red-700">{agents.length - activeCount}</p>
              </div>
            </div>

            <div
              onClick={handleToggleRequests}
              className={`rounded-xl border bg-white p-3 md:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between transition select-none shadow-sm ${
                requests.length > 0
                  ? 'cursor-pointer hover:shadow-md border-red-200 ring-1 ring-red-50 hover:border-red-300'
                  : 'border-neutral-200 opacity-60 cursor-default'
              }`}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full">
                <div className={`${requests.length > 0 ? 'bg-red-50' : 'bg-neutral-100'} p-2 md:p-2.5 rounded-lg shrink-0`}>
                  <ClipboardList className={`h-5 w-5 ${requests.length > 0 ? 'text-red-600' : 'text-neutral-500'}`} />
                </div>
                <div className="flex-1">
                  <p className="text-[11px] md:text-xs text-neutral-500 font-medium mb-0.5 md:mb-1">Solicitudes</p>
                  <p className={`text-lg md:text-xl font-bold leading-none ${requests.length > 0 ? 'text-red-700' : 'text-neutral-500'}`}>
                    {requests.length}
                  </p>
                </div>
                {requests.length > 0 && (
                  <span className="text-[10px] md:text-xs text-neutral-500 font-medium mt-1 md:mt-0 bg-neutral-100 px-2 py-1 rounded-md">
                    {showRequests ? 'Ocultar' : 'Ver'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Lista solicitudes expandible */}
          {showRequests && requests.length > 0 && (
            <div className="rounded-xl border border-neutral-200 bg-white shadow-sm p-3 md:p-4 shrink-0 animate-in fade-in slide-in-from-top-2 duration-200">
              <h3 className="text-sm font-bold text-neutral-900 mb-3 flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-neutral-500" /> Solicitudes por Revisar
              </h3>
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                {requests.map((req) => (
                  <div key={req.id} className="p-3 flex flex-col md:flex-row justify-between md:items-center gap-3 rounded-lg border border-neutral-100 bg-neutral-50/50 hover:bg-neutral-50">
                    <div>
                      <p className="font-semibold text-sm text-neutral-900">{req.contact_full_name}</p>
                      <p className="text-xs text-neutral-500">{req.contact_email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:bg-red-50 hover:border-red-200 text-xs py-1.5"
                        onClick={() => handleDeclineRequest(req)}
                      >
                        <X className="h-3.5 w-3.5 mr-1" /> Declinar
                      </Button>
                      <Button size="sm" className="text-xs py-1.5" onClick={() => handleApproveRequest(req)}>
                        <Check className="h-3.5 w-3.5 mr-1" /> Aprobar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Formulario Promover */}
          <div className="rounded-xl border border-neutral-200 bg-white p-3 md:p-5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4 shrink-0">
            <div className="mb-1 lg:mb-0">
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-brand-500" /> Promover Usuario
              </h3>
              <p className="text-xs text-neutral-500 mt-1">Asigna agent_code a un usuario existente.</p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
              {/* ✅ text-[16px] en móviles PREVIENE el zoom automático de iOS/Safari */}
              <input
                type="email"
                value={promoteEmail}
                onChange={(e) => setPromoteEmail(e.target.value)}
                placeholder="Email del usuario..."
                className="w-full sm:w-48 lg:w-56 rounded-lg border border-neutral-300 px-3 py-2 text-[16px] md:text-sm outline-none focus:ring-2 focus:ring-brand-500 transition-all"
              />
              <input
                type="text"
                value={promoteCode}
                onChange={(e) => setPromoteCode(e.target.value)}
                placeholder="Código (ej. GST123)"
                className="w-full sm:w-32 lg:w-40 rounded-lg border border-neutral-300 px-3 py-2 text-[16px] md:text-sm outline-none focus:ring-2 focus:ring-brand-500 transition-all"
              />
              <select
                value={promoteActive ? 'active' : 'inactive'}
                onChange={(e) => setPromoteActive(e.target.value === 'active')}
                className="w-full sm:w-28 rounded-lg border border-neutral-300 px-3 py-2 text-[16px] md:text-sm bg-white outline-none focus:ring-2 focus:ring-brand-500 transition-all"
              >
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </select>
              <Button onClick={promoteToAgent} isLoading={promoteLoading} className="w-full sm:w-auto text-sm px-5 py-2">
                Guardar
              </Button>
            </div>
          </div>

          {/* Búsqueda */}
          <div className="relative shrink-0">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, email o código..."
              className="w-full rounded-lg border border-neutral-300 pl-9 pr-4 py-2 text-[16px] md:text-sm outline-none focus:ring-2 focus:ring-brand-500 transition-all shadow-sm"
            />
          </div>

          {/* LA TABLA: Scroll horizontal infinito en móviles dentro de su contenedor (min-w-0 evita que rompa el layout) */}
          {loading ? (
            <div className="flex justify-center py-8">
              <p className="text-neutral-500 text-sm">Cargando gestores...</p>
            </div>
          ) : (
            <div className="flex-1 min-h-[300px] rounded-xl border border-neutral-200 bg-white shadow-sm flex flex-col relative w-full overflow-hidden min-w-0">

              {/* ── Mobile: tarjetas (pantallas < md) ── */}
              <div className="md:hidden flex-1 overflow-y-auto p-3 space-y-3">
                {filtered.map((agent) => (
                  <div key={agent.id} className={`rounded-xl border p-4 ${!agent.is_active ? 'bg-red-50/20 border-red-100' : 'bg-white border-neutral-200'}`}>
                    {/* Encabezado: nombre + estado */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-neutral-900 text-sm truncate">{agent.full_name}</p>
                        <p className="text-xs text-neutral-400 truncate">{agent.email}</p>
                      </div>
                      <Badge variant={agent.is_active ? 'success' : 'default'} className="text-[10px] px-2 py-0.5 shrink-0">
                        {agent.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </div>

                    {/* Código y Fondo en grid 2 columnas */}
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <p className="text-[10px] text-neutral-400 font-medium mb-1">CÓDIGO</p>
                        <div className="flex items-center gap-1">
                          <input
                            className="w-full rounded-md border border-neutral-300 px-2 py-1.5 font-mono text-[16px] uppercase outline-none focus:ring-2 focus:ring-brand-500"
                            value={editCodeById[agent.id] ?? ''}
                            onChange={(e) => setEditCodeById((p) => ({ ...p, [agent.id]: e.target.value }))}
                            placeholder="GST..."
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => saveAgentCode(agent.id)}
                            isLoading={savingCodeById[agent.id] ?? false}
                            className="h-8 w-8 p-0 text-neutral-500 hover:text-brand-600 hover:bg-brand-50 rounded-md shrink-0"
                            title="Guardar código"
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] text-neutral-400 font-medium mb-1">FONDO</p>
                        <div className="flex items-center gap-1">
                          <input
                            className={`w-full rounded-md border px-2 py-1.5 font-mono text-[16px] outline-none focus:ring-2 focus:ring-brand-500 ${Number(editFundById[agent.id] ?? 0) < 0 ? 'border-red-300 text-red-600 bg-red-50' : 'border-neutral-300'}`}
                            value={editFundById[agent.id] ?? '0'}
                            onChange={(e) => setEditFundById((p) => ({ ...p, [agent.id]: e.target.value }))}
                            placeholder="0"
                            inputMode="text"
                            type="text"
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => saveAgentFund(agent.id)}
                            isLoading={savingFundById[agent.id] ?? false}
                            className="h-8 w-8 p-0 text-neutral-500 hover:text-brand-600 hover:bg-brand-50 rounded-md shrink-0"
                            title="Guardar fondo"
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <button
                            onClick={() => openFundHistory(agent.id, agent.full_name)}
                            className="h-8 w-8 flex items-center justify-center rounded-md text-neutral-400 hover:text-amber-600 hover:bg-amber-50 transition-colors shrink-0"
                            title="Ver historial"
                          >
                            <History className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Footer: puntos + botón activar/desactivar */}
                    <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
                      <span className="text-xs text-neutral-400">
                        Pts: <span className="font-medium text-neutral-700">{agent.loyalty_points}</span>
                      </span>
                      <Button
                        size="sm"
                        variant={agent.is_active ? 'outline' : 'primary'}
                        onClick={() => toggleAgentStatus(agent)}
                        className="text-xs px-3 py-2"
                      >
                        {agent.is_active ? 'Desactivar' : 'Activar'}
                      </Button>
                    </div>
                  </div>
                ))}

                {filtered.length === 0 && (
                  <div className="flex items-center justify-center py-8 text-neutral-400 text-sm">
                    No se encontraron gestores con esos criterios.
                  </div>
                )}
              </div>

              {/* ── Desktop: tabla (md+) ── */}
              <div className="hidden md:block overflow-x-auto overflow-y-auto flex-1 w-full">
                <table className="min-w-[850px] w-full text-xs">
                  <thead className="sticky top-0 z-10 bg-neutral-100 text-left text-[11px] uppercase tracking-wider text-neutral-500 shadow-sm">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Nombre</th>
                      <th className="px-4 py-3 font-semibold">Email</th>
                      <th className="px-4 py-3 font-semibold">Código</th>
                      <th className="px-4 py-3 font-semibold">Fondo</th>
                      <th className="px-4 py-3 font-semibold text-center">Pts</th>
                      <th className="px-4 py-3 font-semibold">Estado</th>
                      <th className="px-4 py-3 font-semibold hidden lg:table-cell">Registro</th>
                      <th className="px-4 py-3 font-semibold">Acciones</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-neutral-100">
                    {filtered.map((agent) => (
                      <tr key={agent.id} className={`transition-colors ${!agent.is_active ? 'bg-red-50/20' : 'hover:bg-neutral-50'}`}>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-neutral-900 truncate max-w-[150px]">{agent.full_name}</div>
                        </td>

                        <td className="px-4 py-3 text-neutral-600 truncate max-w-[180px]" title={agent.email}>
                          {agent.email}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <input
                              className="w-24 md:w-20 rounded-md border border-neutral-300 px-2 py-1.5 font-mono text-[16px] md:text-[11px] uppercase outline-none focus:ring-2 focus:ring-brand-500"
                              value={editCodeById[agent.id] ?? ''}
                              onChange={(e) => setEditCodeById((p) => ({ ...p, [agent.id]: e.target.value }))}
                              placeholder="GST..."
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => saveAgentCode(agent.id)}
                              isLoading={savingCodeById[agent.id] ?? false}
                              className="h-8 w-8 md:h-7 md:w-7 p-0 text-neutral-500 hover:text-brand-600 hover:bg-brand-50 rounded-md"
                              title="Guardar código"
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <input
                              className={`w-20 md:w-16 rounded-md border px-2 py-1.5 font-mono text-[16px] md:text-[11px] outline-none focus:ring-2 focus:ring-brand-500 ${Number(editFundById[agent.id] ?? 0) < 0 ? 'border-red-300 text-red-600 bg-red-50' : 'border-neutral-300'}`}
                              value={editFundById[agent.id] ?? '0'}
                              onChange={(e) => setEditFundById((p) => ({ ...p, [agent.id]: e.target.value }))}
                              placeholder="0"
                              inputMode="text"
                              type="text"
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => saveAgentFund(agent.id)}
                              isLoading={savingFundById[agent.id] ?? false}
                              className="h-8 w-8 md:h-7 md:w-7 p-0 text-neutral-500 hover:text-brand-600 hover:bg-brand-50 rounded-md"
                              title="Guardar fondo"
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                            <button
                              onClick={() => openFundHistory(agent.id, agent.full_name)}
                              className="h-8 w-8 md:h-7 md:w-7 flex items-center justify-center rounded-md text-neutral-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                              title="Ver historial de cambios"
                            >
                              <History className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>

                        <td className="px-4 py-3 font-medium text-center">{agent.loyalty_points}</td>

                        <td className="px-4 py-3">
                          <Badge variant={agent.is_active ? 'success' : 'default'} className="text-[10px] px-2 py-0.5">
                            {agent.is_active ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </td>

                        <td className="px-4 py-3 text-neutral-500 hidden lg:table-cell whitespace-nowrap text-[11px]">
                          {new Date(agent.created_at).toLocaleDateString('es')}
                        </td>

                        <td className="px-4 py-3">
                          <Button
                            size="sm"
                            variant={agent.is_active ? 'outline' : 'primary'}
                            onClick={() => toggleAgentStatus(agent)}
                            className="text-xs px-3 py-2 md:py-1.5"
                          >
                            {agent.is_active ? 'Desactivar' : 'Activar'}
                          </Button>
                        </td>
                      </tr>
                    ))}

                    {filtered.length === 0 && (
                      <tr>
                        <td className="px-4 py-8 text-center text-neutral-500 text-sm" colSpan={8}>
                          No se encontraron gestores con esos criterios.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* ── Modal Historial de Fondo ── */}
    {fundHistoryModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
            <div>
              <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                <History className="h-4 w-4 text-amber-500" /> Historial de Fondo
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">{fundHistoryModal.agentName}</p>
            </div>
            <button
              onClick={() => setFundHistoryModal(null)}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 px-5 py-3">
            {loadingHistory ? (
              <p className="text-sm text-neutral-400 text-center py-8">Cargando historial...</p>
            ) : fundHistoryModal.entries.length === 0 ? (
              <div className="text-center py-10">
                <History className="h-8 w-8 text-neutral-200 mx-auto mb-2" />
                <p className="text-sm text-neutral-400">Sin cambios registrados aún.</p>
                <p className="text-xs text-neutral-300 mt-1">Los cambios aparecerán aquí cuando guardes el fondo.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {fundHistoryModal.entries.map((entry, i) => {
                  const diff = entry.new_value_cents - entry.old_value_cents;
                  const isFirst = i === 0;
                  return (
                    <div
                      key={entry.id}
                      className={`flex items-center justify-between rounded-xl px-4 py-3 ${isFirst ? 'bg-amber-50 border border-amber-100' : 'bg-neutral-50 border border-neutral-100'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-lg ${diff > 0 ? 'bg-emerald-100' : diff < 0 ? 'bg-red-100' : 'bg-neutral-100'}`}>
                          {diff > 0
                            ? <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                            : diff < 0
                            ? <TrendingDown className="h-3.5 w-3.5 text-red-600" />
                            : <Minus className="h-3.5 w-3.5 text-neutral-500" />}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-neutral-800">
                            {entry.old_value_cents} → {entry.new_value_cents}
                            {diff !== 0 && (
                              <span className={`ml-1.5 font-bold ${diff > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                ({diff > 0 ? '+' : ''}{diff})
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-neutral-400">
                            {new Date(entry.changed_at).toLocaleString('es', {
                              day: '2-digit', month: 'short', year: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                      {isFirst && (
                        <span className="text-[10px] font-semibold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">Último</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-neutral-100">
            <button
              onClick={() => setFundHistoryModal(null)}
              className="w-full rounded-xl border border-neutral-200 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}