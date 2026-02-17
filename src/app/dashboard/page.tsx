/**
 * @fileoverview Catch-all redirect for /dashboard.
 * The actual dashboards live at /user/dashboard, /admin/dashboard, /agent/dashboard.
 * This page exists so that auth callbacks landing on /dashboard don't 404.
 * It also handles Supabase hash fragments (#access_token=...) from magic links.
 */
import { redirect } from 'next/navigation';

export default function DashboardRedirect() {
  redirect('/panel');
}
