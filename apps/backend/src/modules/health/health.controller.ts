import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly supabaseService: SupabaseService) {}

  @Get()
  @ApiOperation({ summary: 'Verifica el estado de salud de la aplicación' })
  @ApiResponse({ status: 200, description: 'Aplicación operativa y conectada a la base de datos' })
  @ApiResponse({ status: 503, description: 'Base de datos no accesible' })
  async getHealth() {
    try {
      const supabase = this.supabaseService.getClient();
      // Consultar roles para verificar conexión con la base de datos
      const { error } = await supabase.from('roles').select('id').limit(1);

      if (error) {
        throw new Error(`Conexión con Supabase fallida: ${error.message}`);
      }

      return {
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'disconnected',
        error: err instanceof Error ? err.message : 'Error desconocido',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
