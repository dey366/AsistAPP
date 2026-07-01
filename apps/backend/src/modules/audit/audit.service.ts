import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Registra de manera consistente una traza de auditoría en la tabla audit_logs de Supabase Cloud.
   */
  async writeLog(
    userId: string | null,
    action: string,
    entityName: string,
    entityId: string | null,
    oldValues: any = null,
    newValues: any = null,
    ipAddress: string | null = null,
    userAgent: string | null = null,
  ): Promise<boolean> {
    try {
      const supabase = this.supabaseService.getClient();

      const { error } = await supabase.from('audit_logs').insert({
        user_id: userId,
        action,
        entity_name: entityName,
        entity_id: entityId,
        old_values: oldValues,
        new_values: newValues,
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      if (error) {
        this.logger.error(`Error de Supabase al escribir log de auditoría: ${error.message}`);
        return false;
      }

      this.logger.log(
        `[AuditLog] Acción registrada con éxito: ${action} sobre ${entityName} (${entityId || 'N/A'}) por el usuario ${userId || 'Sistema'}`,
      );
      return true;
    } catch (e: any) {
      this.logger.error(`Error crítico e inesperado al escribir log de auditoría: ${e.message}`);
      return false;
    }
  }
}
