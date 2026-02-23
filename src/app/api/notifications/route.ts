/**
 * @fileoverview Notifications API — Sends transactional emails.
 * POST /api/notifications
 * Body: { type: 'booking_confirmation' | 'emission_complete' | ... , email: string, data: {...} }
 * Requires admin or service role auth.
 * @module app/api/notifications/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  notifyBookingConfirmation,
  notifyEmissionComplete,
  notifyPaymentReceipt,
  notifyBookingCancelled,
  notifyReviewRequest,
  notifyWelcome,
  notifyAgentApproved,
  notifyAgentRejected,
} from '@/lib/email/notifications';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// AQUÍ ESTÁ LA CORRECCIÓN: Se agregó 'agent_rejected' a la lista
type NotificationType =
  | 'booking_confirmation'
  | 'emission_complete'
  | 'payment_receipt'
  | 'booking_cancelled'
  | 'review_request'
  | 'welcome'
  | 'agent_approved'
  | 'agent_rejected';

export async function POST(request: NextRequest) {
  try {
    // Auth check: require Authorization header with valid token
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check if user is admin (for manual triggers) or allow service role
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { type, email, data } = body as { type: NotificationType; email: string; data: Record<string, unknown> };

    if (!type || !email) {
      return NextResponse.json({ error: 'Missing type or email' }, { status: 400 });
    }

    let result;

    switch (type) {
      case 'booking_confirmation':
        result = await notifyBookingConfirmation(email, data as never);
        break;
      case 'emission_complete':
        result = await notifyEmissionComplete(email, data as never);
        break;
      case 'payment_receipt':
        result = await notifyPaymentReceipt(email, data as never);
        break;
      case 'booking_cancelled':
        result = await notifyBookingCancelled(email, data as never);
        break;
      case 'review_request':
        result = await notifyReviewRequest(email, data as never);
        break;
      case 'welcome':
        result = await notifyWelcome(email, data as never);
        break;
      case 'agent_approved':
        result = await notifyAgentApproved(email, data as never);
        break;
      case 'agent_rejected':
        result = await notifyAgentRejected(email, data as never);
        break;
      default:
        return NextResponse.json({ error: `Unknown notification type: ${type}` }, { status: 400 });
    }

    if (result.success) {
      // Log notification
      await supabaseAdmin.from('audit_logs').insert({
        user_id: user.id,
        action: 'SEND_NOTIFICATION',
        table_name: 'notifications',
        record_id: result.id || null,
        new_value: { type, email, result: 'success' },
      }).match(() => {}); // Don't fail if audit log fails

      return NextResponse.json({ success: true, id: result.id });
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }
  } catch (err) {
    console.error('[Notifications API] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}