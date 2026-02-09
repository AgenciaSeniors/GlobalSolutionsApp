/**
 * @fileoverview User Settings — Profile management, password change, loyalty info.
 * @module app/(dashboard)/user/dashboard/settings/page
 */
'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Sidebar, { USER_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import { createClient } from '@/lib/supabase/client';
import { useAuthContext } from '@/components/providers/AuthProvider';
import {
  User, Mail, Phone, Shield, Key, Save, CheckCircle,
  AlertCircle, Calendar, Sparkles,
} from 'lucide-react';
import type { Profile } from '@/types/models';

export default function UserSettingsPage() {
  const supabase = createClient();
  const { user } = useAuthContext();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      if (!user) return;
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (data) {
        const p = data as Profile;
        setProfile(p);
        setFullName(p.full_name);
        setPhone(p.phone || '');
      }
      setLoading(false);
    }
    loadProfile();
  }, [user, supabase]); // CORRECCIÓN: Se añadió supabase como dependencia

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    if (!user || !fullName.trim()) return;
    setSaving(true);
    setMessage(null);

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), phone: phone.trim() || null, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (error) {
      setMessage({ type: 'error', text: 'Error al guardar: ' + error.message });
    } else {
      setMessage({ type: 'success', text: 'Perfil actualizado correctamente.' });
      setProfile(prev => prev ? { ...prev, full_name: fullName.trim(), phone: phone.trim() || null } : null);
    }
    setSaving(false);
    setTimeout(() => setMessage(null), 4000);
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (newPassword.length < 8) { setMessage({ type: 'error', text: 'La contraseña debe tener al menos 8 caracteres.' }); return; }
    if (newPassword !== confirmPassword) { setMessage({ type: 'error', text: 'Las contraseñas no coinciden.' }); return; }

    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setMessage({ type: 'error', text: 'Error: ' + error.message });
    } else {
      setMessage({ type: 'success', text: 'Contraseña actualizada correctamente.' });
      setShowPasswordForm(false);
      setNewPassword('');
      setConfirmPassword('');
    }
    setChangingPassword(false);
    setTimeout(() => setMessage(null), 4000);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar links={USER_SIDEBAR_LINKS} />
        <div className="flex-1">
          <Header title="Configuración" subtitle="Mi perfil y cuenta" />
          <div className="p-8"><p className="text-neutral-400">Cargando...</p></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar links={USER_SIDEBAR_LINKS} />
      <div className="flex-1">
        <Header title="Configuración" subtitle="Gestiona tu perfil y cuenta" />
        <div className="p-8 space-y-6 max-w-3xl">

          {message && (
            <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
              message.type === 'success' ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-red-300 bg-red-50 text-red-800'
            }`}>
              {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              {message.text}
            </div>
          )}

          {/* Account Info */}
          <Card variant="bordered">
            <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2 mb-4">
              <Shield className="h-5 w-5 text-brand-500" /> Información de Cuenta
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-neutral-50 p-4">
                <p className="text-xs text-neutral-500 flex items-center gap-1 mb-1"><Mail className="h-3 w-3" /> Correo electrónico</p>
                <p className="font-medium text-neutral-900">{profile?.email || '—'}</p>
              </div>
              <div className="rounded-xl bg-neutral-50 p-4">
                <p className="text-xs text-neutral-500 flex items-center gap-1 mb-1"><Shield className="h-3 w-3" /> Tipo de cuenta</p>
                <Badge variant="default">Cliente</Badge>
              </div>
              <div className="rounded-xl bg-amber-50 p-4 border border-amber-100">
                <p className="text-xs text-amber-600 flex items-center gap-1 mb-1"><Sparkles className="h-3 w-3" /> Puntos de lealtad</p>
                <p className="font-bold text-amber-700 text-xl">{profile?.loyalty_points?.toLocaleString() || 0} pts</p>
              </div>
              <div className="rounded-xl bg-neutral-50 p-4">
                <p className="text-xs text-neutral-500 flex items-center gap-1 mb-1"><Calendar className="h-3 w-3" /> Miembro desde</p>
                <p className="font-medium text-neutral-900">
                  {profile ? new Date(profile.created_at).toLocaleDateString('es', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                </p>
              </div>
            </div>
          </Card>

          {/* Editable Profile */}
          <Card variant="bordered">
            <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2 mb-4">
              <User className="h-5 w-5 text-brand-500" /> Datos Personales
            </h3>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* CORRECCIÓN: Renderizado manual de label e icono */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-neutral-700 flex items-center gap-2">
                  <User className="h-4 w-4 text-neutral-400" /> Nombre completo
                </label>
                <Input 
                  value={fullName} 
                  onChange={e => setFullName(e.target.value)} 
                  placeholder="Tu nombre completo" 
                  required 
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-neutral-700 flex items-center gap-2">
                  <Phone className="h-4 w-4 text-neutral-400" /> Teléfono
                </label>
                <Input 
                  value={phone} 
                  onChange={e => setPhone(e.target.value)} 
                  placeholder="+53 5555 5555" 
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" isLoading={saving} className="gap-2"><Save className="h-4 w-4" /> Guardar Cambios</Button>
              </div>
            </form>
          </Card>

          {/* Password Change */}
          <Card variant="bordered">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                <Key className="h-5 w-5 text-amber-500" /> Seguridad
              </h3>
              {!showPasswordForm && (
                <Button variant="outline" size="sm" onClick={() => setShowPasswordForm(true)}>Cambiar Contraseña</Button>
              )}
            </div>
            {showPasswordForm ? (
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-neutral-700 flex items-center gap-2">
                    <Key className="h-4 w-4 text-neutral-400" /> Nueva contraseña
                  </label>
                  <Input 
                    type={showPasswords ? 'text' : 'password'} 
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)} 
                    placeholder="Mínimo 8 caracteres" 
                    required 
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-neutral-700 flex items-center gap-2">
                    <Key className="h-4 w-4 text-neutral-400" /> Confirmar nueva contraseña
                  </label>
                  <Input 
                    type={showPasswords ? 'text' : 'password'} 
                    value={confirmPassword} 
                    onChange={e => setConfirmPassword(e.target.value)} 
                    placeholder="Repite la nueva contraseña" 
                    required 
                  />
                </div>

                <label className="flex items-center gap-2 text-sm text-neutral-600 cursor-pointer">
                  <input type="checkbox" checked={showPasswords} onChange={e => setShowPasswords(e.target.checked)} className="rounded border-neutral-300" />
                  Mostrar contraseñas
                </label>
                <div className="flex gap-3">
                  <Button type="submit" isLoading={changingPassword} className="gap-2"><Key className="h-4 w-4" /> Actualizar</Button>
                  <Button variant="outline" onClick={() => { setShowPasswordForm(false); setNewPassword(''); setConfirmPassword(''); }}>Cancelar</Button>
                </div>
              </form>
            ) : (
              <p className="text-sm text-neutral-500">Tu contraseña se puede cambiar en cualquier momento. Recomendamos usar al menos 8 caracteres con letras, números y símbolos.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}