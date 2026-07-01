import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '../../modules/audit/audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest();
    const response = httpContext.getResponse();

    const method = request.method;
    const url = request.url;

    // Solo interceptar y auditar peticiones HTTP de mutación de estado
    const isModification = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method);
    if (!isModification) {
      return next.handle();
    }

    // Evitar registrar llamadas dirigidas al propio módulo de auditoría por seguridad
    if (url.includes('/audit')) {
      return next.handle();
    }

    // Extraer metadatos del cliente
    const ipAddress =
      (request.headers['x-forwarded-for'] as string) ||
      request.socket.remoteAddress ||
      null;
    const userAgent = request.headers['user-agent'] || null;

    return next.handle().pipe(
      tap({
        next: (data) => {
          const statusCode = response.statusCode;
          // Solo persistir la traza de auditoría si la operación HTTP fue exitosa (200-299)
          if (statusCode >= 200 && statusCode < 300) {
            const user = request.user;
            const userId = user ? user.id : null;

            const action = this.deduceAction(method, url);
            const entityName = this.deduceEntityName(url);

            // Registrar de forma asíncrona la acción de auditoría
            this.auditService
              .writeLog(
                userId,
                action,
                entityName,
                data?.id || data?.scheduleId || null,
                null, // Los valores previos requieren consulta de base de datos previa (se delega a los servicios específicos)
                request.body || null, // Persistir body de entrada como nuevos valores
                ipAddress,
                userAgent,
              )
              .catch((err) =>
                this.logger.error(`Error al registrar auditoría en interceptor: ${err.message}`),
              );
          }
        },
      }),
    );
  }

  private deduceAction(method: string, url: string): string {
    if (url.includes('/read-all')) return 'READ_ALL_NOTIFICATIONS';
    if (url.includes('/read')) return 'READ_NOTIFICATION';
    if (url.includes('/bulk')) return 'BULK_CREATE_ATTENDANCE';

    switch (method) {
      case 'POST':
        return 'CREATE';
      case 'PATCH':
      case 'PUT':
        return 'UPDATE';
      case 'DELETE':
        return 'DELETE';
      default:
        return 'UNKNOWN_ACTION';
    }
  }

  private deduceEntityName(url: string): string {
    const parts = url.split('?')[0].split('/'); // Ignorar queries params
    const apiIndex = parts.indexOf('api');
    
    if (apiIndex !== -1 && parts[apiIndex + 1]) {
      return parts[apiIndex + 1];
    }
    
    return parts[1] || 'system';
  }
}
