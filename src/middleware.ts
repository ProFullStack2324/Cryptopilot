
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Solo protegemos las rutas de API
  if (request.nextUrl.pathname.startsWith('/api')) {
    // Rutas públicas que no requieren protección (opcional)
    const publicPaths = ['/api/public'];
    if (publicPaths.some(path => request.nextUrl.pathname.startsWith(path))) {
      return NextResponse.next();
    }

    const apiKey = request.headers.get('x-api-key') || request.headers.get('Authorization');
    const internalSecret = process.env.INTERNAL_BOT_SECRET;

    if (!apiKey || apiKey !== internalSecret) {
      return NextResponse.json(
        { success: false, message: 'No autorizado: API Key inválida o inexistente' },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

// Configurar en qué rutas se debe ejecutar el middleware
export const config = {
  matcher: '/api/:path*',
};
