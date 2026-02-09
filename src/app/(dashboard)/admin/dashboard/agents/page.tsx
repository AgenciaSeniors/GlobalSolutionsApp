/**
 * @fileoverview Admin Agent Management.
 * Per spec §2.3: "Admin has total control — activate/deactivate agents."
 * @module app/(dashboard)/admin/dashboard/agents/page
 */
'use client';

import { useEffect, useState } from 'react';
import Sidebar, { ADMIN_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { createClient } from '@/lib/supabase/client';
import { Users, UserCheck, UserX, Search } from 'lucide-react';
import type { Profile } from '@/types/models';

export default function AdminAgentsPage() {
  const supabase = createClient();
  const [agents, setAgents] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { fetchAgents(); }, []);

  async function fetchAgents() {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'agent')
      .order('created_at', { ascending: false });
    setAgents((data as Profile[]) || []);
    setLoading(false);
  }

  async function toggleAgentStatus(agent: Profile) {
    await supabase
      .from('profiles')
      .update({ is_active: !agent.is_active })
      .eq('id', agent.id);
    fetchAgents();
  }

  const filtered = agents.filter(a =>
    a.full_name.toLowerCase().includes(search.toLowerCase()) ||
    a.email.toLowerCase().includes(search.toLowerCase()) ||
    (a.agent_code || '').toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = agents.filter(a => a.is_active).length;

  return (
    <div className="flex min-h-screen">
      <Sidebar links={ADMIN_SIDEBAR_LINKS} />
      <div className="flex-1">
        <Header
          title="Gestión de Gestores"
          subtitle="Activar, desactivar y administrar agentes de la comunidad"
        />
        <div className="p-8">
          {/* Stats */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
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
          </div>

          {/* Search */}
          <div className="mb-6 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-neutral-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
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
                  {filtered.map(agent => (
                    <tr key={agent.id} className={!agent.is_active ? 'bg-red-50/30' : 'hover:bg-neutral-50'}>
                      <td className="px-4 py-3 font-semibold">{agent.full_name}</td>
                      <td className="px-4 py-3 text-neutral-600">{agent.email}</td>
                      <td className="px-4 py-3 font-mono text-xs">{agent.agent_code || '—'}</td>
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
                          variant={agent.is_active ? 'outline' : 'default'}
                          onClick={() => toggleAgentStatus(agent)}
                        >
                          {agent.is_active ? 'Desactivar' : 'Activar'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
