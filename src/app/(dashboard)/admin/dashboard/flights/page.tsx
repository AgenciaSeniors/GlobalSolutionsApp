import { redirect } from 'next/navigation';

export default function AdminFlightsRedirect() {
  redirect('/admin/dashboard/markup');
}