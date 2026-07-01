import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const VALID_ROLES = ['admin', 'supervisor', 'docente', 'estudiante'];

export function proxy(request: NextRequest) {
  const token = request.cookies.get('asistapp-token')?.value;
  const role = request.cookies.get('asistapp-role')?.value;
  const { pathname } = request.nextUrl;

  // 1. Caso: No autenticado
  if (!token) {
    if (pathname.startsWith('/dashboard')) {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // 2. Caso: Autenticado
  if (token) {
    // Si intenta acceder al login estando autenticado, redirigir al dashboard dinámico
    if (pathname === '/login') {
      const targetRole = role && VALID_ROLES.includes(role) ? role : 'estudiante';
      const dashboardUrl = new URL(`/dashboard/${targetRole}`, request.url);
      return NextResponse.redirect(dashboardUrl);
    }

    // Si accede a la raíz de /dashboard, redirigir a su dashboard correspondiente
    if (pathname === '/dashboard' || pathname === '/dashboard/') {
      const targetRole = role && VALID_ROLES.includes(role) ? role : 'estudiante';
      const roleDashboardUrl = new URL(`/dashboard/${targetRole}`, request.url);
      return NextResponse.redirect(roleDashboardUrl);
    }

    // Validar acceso a sub-dashboards específicos de rol
    // Si intenta ingresar a un panel que no corresponde a su rol en la cookie
    for (const validRole of VALID_ROLES) {
      if (pathname.startsWith(`/dashboard/${validRole}`)) {
        if (role !== validRole) {
          const authorizedRole = role && VALID_ROLES.includes(role) ? role : 'estudiante';
          const targetUrl = new URL(`/dashboard/${authorizedRole}`, request.url);
          if (pathname !== targetUrl.pathname) {
            return NextResponse.redirect(targetUrl);
          }
        }
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
