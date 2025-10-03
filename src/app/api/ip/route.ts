// src/app/api/ip/route.ts
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

export async function GET(request: Request) {
  try {
    const headersList = headers();
    // 'x-forwarded-for' es el encabezado estándar para identificar la IP de origen
    // cuando las solicitudes pasan a través de proxies. Se toma el primer valor si hay una lista.
    const ip = headersList.get('x-forwarded-for')?.split(',')[0].trim();

    if (ip) {
      return NextResponse.json({ success: true, ip: ip });
    } else {
      // Fallback por si el encabezado no está presente
      return NextResponse.json({ success: false, message: 'No se pudo determinar la dirección IP del servidor.' }, { status: 500 });
    }
  } catch (error: any) {
    console.error('[API/IP] Error al obtener la dirección IP:', error);
    return NextResponse.json({ success: false, message: 'Error interno del servidor al obtener IP.', details: error.message }, { status: 500 });
  }
}
