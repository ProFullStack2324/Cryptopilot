
// src/app/api/binance/trade-history/route.ts
import { NextResponse } from 'next/server';
import ccxt from 'ccxt';

interface TradeHistoryRequest {
  symbol?: string;
  since?: number;
  limit?: number;
  // isTestnet?: boolean; // ELIMINADO
}

// Configuración de CCXT para Mainnet ÚNICAMENTE
const exchangeMainnet = new ccxt.binance({
  apiKey: process.env.BINANCE_API_KEY,
  secret: process.env.BINANCE_SECRET_KEY,
  options: {
    'defaultType': 'spot', // O 'future' si es tu caso de uso principal
  },
});

export async function POST(req: Request) {
  let symbol: string | undefined = undefined;
  let since: number | undefined = undefined;
  let limit: number | undefined = undefined;

  console.log(`[API/Binance/TradeHistory Mainnet] Solicitud POST recibida.`);

  try {
    const requestBody: TradeHistoryRequest = await req.json();
    // Ya no se desestructura isTestnet
    ({ symbol = undefined, since = undefined, limit = undefined } = requestBody);
    console.log(`[API/Binance/TradeHistory Mainnet] Parámetros: Símbolo='${symbol || 'TODOS'}', Since=${since}, Limit=${limit}`);
  } catch (jsonError: any) {
    console.error("[API/Binance/TradeHistory Mainnet] Error al parsear JSON:", jsonError);
    return NextResponse.json({
      success: false, message: "Error al procesar la solicitud. Formato JSON inválido."
    }, { status: 400 });
  }

  console.log(`[API/Binance/TradeHistory Mainnet] Usando configuración para Mainnet.`);

  if (exchangeMainnet.apiKey === undefined || exchangeMainnet.secret === undefined) {
    console.error(`[API/Binance/TradeHistory Mainnet] Error: Credenciales de Mainnet no configuradas.`);
    return NextResponse.json({
      success: false, message: `Credenciales de Binance Mainnet no configuradas.`
    }, { status: 500 });
  }
  console.log(`[API/Binance/TradeHistory Mainnet] Credenciales de Mainnet cargadas.`);

  try {
    console.log(`[API/Binance/TradeHistory Mainnet] Solicitando historial de trades...`);
    const trades = await exchangeMainnet.fetchMyTrades(symbol, since, limit) as any[];
    console.log(`[API/Binance/TradeHistory Mainnet] Historial obtenido. Cantidad: ${trades ? trades.length : 0}`);

    const formattedTrades = trades.map((trade: any) => {
      const orderId = trade.order;
      const priceStr = (trade.price ?? '0').toString();
      const amountStr = (trade.amount ?? '0').toString();
      const costStr = (trade.cost ?? '0').toString();
      const feeCostStr = (trade.fee?.cost ?? '0').toString();
      const feeRate = trade.fee?.rate;
      const feeRateStr = (feeRate !== undefined && feeRate !== null) ? feeRate.toString() : undefined;

      return {
        id: trade.id as string,
        orderId: orderId as string | undefined,
        symbol: trade.symbol as string, // Símbolo CCXT: BTC/USDT
        timestamp: trade.timestamp as number,
        datetime: trade.datetime as string,
        side: trade.side as 'buy' | 'sell',
        type: trade.type as string | undefined, // market, limit
        price: parseFloat(priceStr),
        amount: parseFloat(amountStr),
        cost: parseFloat(costStr),
        fee: trade.fee ? {
          cost: parseFloat(feeCostStr),
          currency: trade.fee.currency as string | undefined,
          rate: feeRateStr ? parseFloat(feeRateStr) : undefined
        } : undefined,
        // El estado de la orden/trade podría venir en `trade.status` o necesitarías otra llamada para `fetchOrder`
        // Aquí lo simplificamos, asumiendo que todos los trades obtenidos son 'Completado'.
        // Si necesitas el estado real, deberás ajustar la lógica.
        status: trade.status || 'Completado', // O un mapeo más robusto de los estados de Binance
      };
    });
    console.log(`[API/Binance/TradeHistory Mainnet] ${formattedTrades.length} trades formateados.`);

    return NextResponse.json({
      success: true,
      message: `Historial de trades obtenido con éxito de Binance Mainnet.`,
      trades: formattedTrades,
    });
  } catch (error: any) {
    console.error(`[API/Binance/TradeHistory Mainnet] Error al obtener historial:`, error);
    let userMessage = `Error al obtener el historial de trades de Binance Mainnet.`;
    let details = error.message || 'Error desconocido';
    let statusCode = 500;
    let binanceErrorCode = undefined;

    if (error instanceof ccxt.NetworkError) {
      userMessage = "Error de conexión con la API de Binance.";
      statusCode = 503;
    } else if (error instanceof ccxt.AuthenticationError) {
      userMessage = "Error de autenticación con la API de Binance.";
      statusCode = 401;
    } else if (error instanceof ccxt.ArgumentsRequired) {
      userMessage = "Faltan argumentos necesarios (ej. símbolo).";
      statusCode = 400;
    } else if (error instanceof ccxt.ExchangeError) {
      userMessage = "Ocurrió un error en el exchange de Binance.";
      if (error.message.includes('code=')) {
        const codeMatch = error.message.match(/code=(-?\d+)/);
        if (codeMatch && codeMatch[1]) {
          binanceErrorCode = parseInt(codeMatch[1], 10);
        }
      }
    }
    return NextResponse.json({
      success: false, message: userMessage, details: details, binanceErrorCode: binanceErrorCode,
    }, { status: statusCode });
  }
}
