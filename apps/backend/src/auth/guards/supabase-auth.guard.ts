import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader) {
      throw new UnauthorizedException('Token de autorización no provisto');
    }

    const [type, token] = authHeader.split(' ');

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Formato de token de autorización inválido');
    }

    try {
      const supabase = this.supabaseService.getClient();
      
      // 1. Validar el token con Supabase Auth
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error || !user) {
        throw new UnauthorizedException('Token de sesión inválido o expirado');
      }

      // 2. Buscar el perfil de usuario completo y su rol asignado en la base de datos PostgreSQL
      const { data: profile, error: dbError } = await supabase
        .from('users')
        .select('*, role:roles(*)')
        .eq('id', user.id)
        .single();

      if (dbError || !profile) {
        // Si el usuario acaba de ser registrado mediante SSO y el trigger está en proceso
        // o si es un usuario que aún no tiene su perfil completamente sincronizado.
        // Creamos un perfil básico fallback usando los metadatos del JWT
        request.user = {
          id: user.id,
          email: user.email,
          first_name: user.user_metadata?.first_name || 'Usuario',
          last_name: user.user_metadata?.last_name || 'Supabase',
          role_id: 'estudiante', // Rol por defecto
          is_active: true,
          tenant_id: user.user_metadata?.tenant_id || null,
        };
        return true;
      }

      // 3. Adjuntar el perfil de usuario completo a la request
      request.user = profile;
      return true;
    } catch (err) {
      throw new UnauthorizedException(
        err instanceof UnauthorizedException ? err.message : 'Error de autenticación'
      );
    }
  }
}
