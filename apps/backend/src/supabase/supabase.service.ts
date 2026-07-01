import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private supabaseClient: SupabaseClient;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseServiceKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      this.logger.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not defined in environment variables');
      throw new Error('Supabase environment variables are missing');
    }

    // Inicializar el cliente Supabase con la service role key para tener permisos de bypass de RLS (Admin actions)
    this.supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    this.logger.log('Supabase client successfully initialized with Service Role');
  }

  /**
   * Obtiene la instancia del cliente Supabase administrativo
   */
  getClient(): SupabaseClient {
    return this.supabaseClient;
  }
}
