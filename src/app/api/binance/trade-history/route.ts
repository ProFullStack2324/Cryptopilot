// src/app/api/binance/trade-history/route.ts
import { NextResponse } from 'next/server';
import ccxt from 'ccxt';

const exchangeMainnet = new ccxt.binance({
  apiKey: process.env.BINANCE_API_KEY,
  secret: process.env.BINANCE_SECRET_KEY,
  options: {
    'defaultType': 'spot',
    'adjustForTimeDifference': true,
  },
  enableRateLimit: true,
});

interface TradeHistoryRequest {
  symbol?: string;
  since?: number;
  limit?: number;
}

export async function POST(req: Request) {
  const networkType = 'Mainnet';
  console.log(`[API/Binance/TradeHistory] Solicitud POST recibida para ${networkType}.`);

  try {
      const { symbol, since, limit }: TradeHistoryRequest = await req.json();
      console.log(`[API/Binance/TradeHistory] Parámetros: Símbolo='${symbol || 'TODOS'}', Since=${since}, Limit=${limit}`);

      if (!exchangeMainnet.apiKey || !exchangeMainnet.secret) {
        console.error(`[API/Binance/TradeHistory] Error: Credenciales de ${networkType} no configuradas.`);
        return NextResponse.json({
          success: false,
          message: `Las credenciales de ${networkType} no están configuradas.`
        }, { status: 500 });
      }

    const trades = await exchangeMainnet.fetchMyTrades(symbol, since, limit);
    console.log(`[API/Binance/TradeHistory] Historial de trades obtenido. Cantidad: ${trades ? trades.length : 0}`);

    return NextResponse.json({
      success: true,
      message: `Historial de trades obtenido con éxito de ${networkType}.`,
      trades: trades,
    });

  } catch (error: any) {
    console.error(`[API/Binance/TradeHistory] Error al obtener historial de trades con CCXT en ${networkType}:`, error);
    let userMessage = `Error al obtener el historial de trades de ${networkType}.`;
    let details = error.message || 'Error desconocido';
    let statusCode = 500;

    if (error instanceof ccxt.ExchangeError && error.message.includes('Service unavailable from a restricted location')) {
        userMessage = "Servicio no disponible desde una ubicación restringida.";
        statusCode = 403;
    } else if (error instanceof ccxt.NetworkError) {
        userMessage = "Error de conexión con la API de Binance.";
        statusCode = 503;
    } else if (error instanceof ccxt.AuthenticationError) {
         userMessage = "Error de autenticación. Verifica tus claves API.";
         statusCode = 401;
    } else if (error instanceof ccxt.ExchangeError) {
         userMessage = "Error en el exchange al obtener el historial de trades.";
         details = error.message;
    }
    
    return NextResponse.json({
      success: false,
      message: userMessage,
      details: details,
    }, { status: statusCode });
  }
}
