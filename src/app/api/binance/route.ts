// src/app/api/binance/ticker/route.ts

import { NextResponse } from 'next/server';
import { exchangeMainnet } from '@/lib/binance-client';

/**
 * Manejador de la petición GET para obtener los precios de los tickers de Binance.
 *
 * Puedes acceder a esta API desde:
 * /api/binance/ticker
 *
 * O para un símbolo específico (por ejemplo, BTCUSDT):
 * /api/binance/ticker?symbol=BTCUSDT
 *
 * Puedes pasar múltiples símbolos separados por comas:
 * /api/binance/ticker?symbol=BTCUSDT,ETHUSDT
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    console.log(`[API/Binance/Ticker] Solicitando precios para el símbolo: ${symbol || 'TODOS'}`);

    // fetchTickers es más eficiente para múltiples símbolos
    const tickerData = await exchangeMainnet.fetchTickers(symbol?.split(','));

    console.log("[API/Binance/Ticker] Precios obtenidos con éxito.");

    // Mapear la respuesta para simplificarla a { SYMBOL: last_price }
    const formattedData: Record<string, number> = {};
    if (tickerData) {
        for (const key in tickerData) {
            formattedData[tickerData[key].symbol] = tickerData[key].last!;
        }
    }

    return NextResponse.json(
      {
        message: "Precios de tickers obtenidos con éxito de Binance.",
        data: formattedData,
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error("[API/Binance/Ticker] Error al obtener precios:", error);

    return NextResponse.json(
      {
        message: "Error al obtener precios de tickers de Binance.",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
