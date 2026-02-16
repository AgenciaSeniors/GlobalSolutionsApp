import { createClient } from '@supabase/supabase-js';

export type AuditAction = 
  | 'LOGIN' 
  | 'LOGOUT' 
  | 'SEARCH_FLIGHTS' 
  | 'CREATE_BOOKING' 
  | 'VIEW_SENSITIVE_DATA' 
  | 'UPDATE_SETTINGS';

interface AuditLogParams {
  userId?: string;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  details?: Record<string, unknown>;
}

export const auditService = {
  /**
   * Registra una acción en la base de datos de auditoría.
   * Fuerza el uso de la Service Role Key para saltar el RLS.
   */
  async log(params: AuditLogParams) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // VALIDACIÓN CRÍTICA: Si esto falla, el log nunca se guardará
    if (!supabaseUrl || !serviceKey) {
      console.error('❌ ERROR DE CONFIGURACIÓN:');
      if (!supabaseUrl) console.error('- Falta NEXT_PUBLIC_SUPABASE_URL');
      if (!serviceKey) console.error('- Falta SUPABASE_SERVICE_ROLE_KEY en el servidor');
      return;
    }

    // Creamos un cliente de ADMIN puro para esta operación
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    try {
      const { error, status } = await supabaseAdmin
        .from('audit_logs')
        .insert({
          user_id: params.userId || null,
          action: params.action,
          entity_type: params.entityType || 'system',
          entity_id: params.entityId || null,
          details: params.details || {},
        });

      if (error) {
        console.error(`⚠️ Error Supabase (${error.code}):`, error.message);
      } else {
        console.log(`✅ Audit Log Guardado [${status}]: ${params.action}`);
      }
    } catch (err) {
      console.error('⚠️ Fallo inesperado en auditoría:', err);
    }
  }
};