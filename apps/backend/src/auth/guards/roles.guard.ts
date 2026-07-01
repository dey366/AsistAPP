import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si el endpoint no requiere roles específicos, se permite el acceso
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('Usuario no autenticado en el contexto de la solicitud');
    }

    // Verificar si el rol del usuario está dentro de los roles requeridos
    const hasRole = requiredRoles.includes(user.role_id);

    if (!hasRole) {
      throw new ForbiddenException(
        `Acceso denegado: Se requiere alguno de los siguientes roles: ${requiredRoles.join(', ')}`
      );
    }

    return true;
  }
}
