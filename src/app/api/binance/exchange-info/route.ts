// src/app/api/binance/exchange-info/route.ts
import { NextResponse } from 'next/server';
import ccxt from 'ccxt';
import { exchangeMainnet } from '@/lib/binance-client'; // Importar la instancia centralizada

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbolParam = searchParams.get('symbol');

  try {
    await exchangeMainnet.loadMarkets();

    let responseData = null;
    if (symbolParam) {
        const ccxtSymbol = symbolParam.includes('/') ? symbolParam : `${symbolParam.replace(/USDT$/i, '')}/USDT`;
        const marketInfo = exchangeMainnet.market(ccxtSymbol);
        if (marketInfo) {
             responseData = marketInfo;
        } else {
             return NextResponse.json({
                  success: false,
                  message: `Información no encontrada para ${ccxtSymbol}.`
              }, { status: 404 });
        }
    } else {
        responseData = exchangeMainnet.markets;
    }

    return NextResponse.json({
      success: true,
      message: `Información del exchange de Mainnet obtenida con éxito.`,
      data: responseData,
    });

  } catch (error: any) {
    console.error(`[API/Binance/ExchangeInfo] Error al obtener info del exchange con CCXT en Mainnet:`, error);
    let userMessage = `Error al obtener la información del exchange de Mainnet.`;
    let details = error.message || 'Error desconocido';
    let statusCode = 500;

    if (error.message.includes('Service unavailable from a restricted location')) {
        userMessage = "Servicio no disponible: La API de Binance está restringiendo el acceso desde la ubicación del servidor.";
        details = "Bloqueo geográfico de Binance.";
        statusCode = 403;
    } else if (error instanceof ccxt.NetworkError) {
        userMessage = "Error de conexión con la API de Binance.";
        statusCode = 503;
    } else if (error instanceof ccxt.AuthenticationError) {
         userMessage = "Error de autenticación. Causa probable: La IP pública de tu red no está en la lista blanca (whitelist) de tu clave API en Binance, o la clave no tiene los permisos necesarios.";
         statusCode = 401;
    } else if (error instanceof ccxt.ExchangeError) {
         userMessage = `Ocurrió un error en el exchange: ${error.message}`;
    }

    return NextResponse.json({
      success: false,
      message: userMessage,
      details: details,
    }, { status: statusCode });
  }
}
