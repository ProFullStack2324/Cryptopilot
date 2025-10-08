// src/app/api/binance/exchange-info/route.ts
import { NextResponse } from 'next/server';
import ccxt from 'ccxt';
import { exchangeMainnet } from '@/lib/binance-client'; // Importar la instancia centralizada

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbolParam = searchParams.get('symbol');

  try {
    // Es público, pero requiere inicialización para cargar todos los mercados
    await exchangeMainnet.loadMarkets();

    let responseData = null;
    if (symbolParam) {
        const ccxtSymbol = symbolParam.includes('/') ? symbolParam : `${symbolParam.replace(/USDT$/i, '')}/USDT`;
        const marketInfo = exchangeMainnet.market(ccxtSymbol);

        if (marketInfo) {
             // CORRECCIÓN: Se extraen los datos de una manera más robusta y directa desde la estructura de ccxt.
             responseData = {
                id: marketInfo.id,
                symbol: marketInfo.symbol,
                baseAsset: marketInfo.base,
                quoteAsset: marketInfo.quote,
                active: marketInfo.active,
                // `minNotional` se obtiene de `market.limits.cost.min`
                minNotional: marketInfo.limits?.cost?.min,
                // `minQty` se obtiene de `market.limits.amount.min`
                minQty: marketInfo.limits?.amount?.min,
                amountPrecision: marketInfo.precision?.amount,
                pricePrecision: marketInfo.precision?.price,
                quotePrecision: marketInfo.precision?.quote,
                // Se mantiene la info original por si se necesita para depuración avanzada
                rawInfo: marketInfo.info 
             };
        } else {
             return NextResponse.json({
                  success: false,
                  message: `Información no encontrada para ${ccxtSymbol}.`
              }, { status: 404 });
        }
    } else {
        // Si no hay símbolo, se devuelve la lista completa de mercados (puede ser muy grande)
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
    let statusCode = 500;
    
    // Mejorar el manejo de errores para ser más específico
    if (error.message.includes('Service unavailable from a restricted location')) {
        userMessage = "Servicio no disponible: La API de Binance está restringiendo el acceso desde la ubicación del servidor.";
        statusCode = 403;
    } else if (error instanceof ccxt.AuthenticationError) {
         userMessage = "Error de autenticación. Causa probable: La IP pública de tu red no está en la lista blanca (whitelist) de tu clave API en Binance, o la clave no tiene los permisos necesarios.";
         statusCode = 401;
    } else if (error instanceof ccxt.NetworkError) {
        userMessage = "Error de conexión con la API de Binance.";
        statusCode = 503;
    } else if (error instanceof ccxt.ExchangeError) {
         userMessage = `Ocurrió un error en el exchange: ${error.message}`;
         statusCode = 502;
    }

    return NextResponse.json({
      success: false,
      message: userMessage,
      details: error.message,
    }, { status: statusCode });
  }
}
