// src/app/panel/page.tsx
import { redirect } from 'next/navigation';
import { ROUTES } from '@/lib/constants/routes';
import { createClient } from '@/lib/supabase/server';

export default async function PanelPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`${ROUTES.LOGIN}?redirect=/panel`);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single();

  const role = profile?.role ?? 'client';

  if (role === 'admin') redirect(ROUTES.ADMIN_DASHBOARD);
  if (role === 'agent') redirect(ROUTES.AGENT_DASHBOARD);
  redirect(ROUTES.USER_DASHBOARD);
}
