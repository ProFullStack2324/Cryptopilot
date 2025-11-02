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
             responseData = {
                id: marketInfo.id,
                symbol: marketInfo.symbol,
                baseAsset: marketInfo.base,
                quoteAsset: marketInfo.quote,
                active: marketInfo.active,
                minNotional: marketInfo.limits?.cost?.min,
                minQty: marketInfo.limits?.amount?.min,
                amountPrecision: marketInfo.precision?.amount,
                pricePrecision: marketInfo.precision?.price,
                quotePrecision: marketInfo.precision?.quote,
                filters: marketInfo.info?.filters 
             };
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
    let statusCode = 500;
    
    if (error.message.includes('Service unavailable from a restricted location')) {
        userMessage = "Servicio no disponible: La API de Binance está restringiendo el acceso desde la ubicación del servidor.";
        statusCode = 403;
    } else if (error instanceof ccxt.AuthenticationError) {
         userMessage = "Error de autenticación. Causa probable: La IP pública de tu red no está en la lista blanca (whitelist) de tu clave API en Binance, o la clave no tiene los permisos necesarios.";
         statusCode = 401;
    } else if (error instanceof ccxt.NetworkError || error instanceof ccxt.RequestTimeout) {
        userMessage = `Error de conexión o timeout con la API de Binance. Detalles: ${error.message}`;
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
