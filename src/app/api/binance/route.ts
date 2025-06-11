// src/app/api/binance/route.ts

import { NextResponse } from 'next/server';
import Binance from 'node-binance-api';

// Inicializa el cliente de Binance sin claves API, ya que obtendremos datos públicos.
const binance = new Binance();

/**
 * Manejador de la petición GET para obtener los precios de los tickers de Binance.
 *
 * Puedes acceder a esta API desde:
 * http://localhost:9002/api/binance/ticker
 *
 * O para un símbolo específico (por ejemplo, BTCUSDT):
 * http://localhost:9002/api/binance/ticker?symbol=BTCUSDT
 *
 * Puedes pasar múltiples símbolos separados por comas:
 * http://localhost:9002/api/binance/ticker?symbol=BTCUSDT,ETHUSDT
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol'); // Obtiene el parámetro 'symbol' de la URL

    console.log(`[API/Binance/Ticker] Solicitando precios para el símbolo: ${symbol || 'TODOS'}`);

    let tickerData;
    if (symbol) {
      // Si se especifica un símbolo (o varios separados por coma)
      const symbolsArray = symbol.split(',').map(s => s.trim().toUpperCase());
      const promises = symbolsArray.map(s => binance.prices(s)); // Obtener precio para cada símbolo
      const results = await Promise.all(promises);

      // Combinar los resultados en un solo objeto para facilitar el uso
      tickerData = results.reduce((acc, current) => {
        return { ...acc, ...current };
      }, {});

    } else {
      // Si no se especifica ningún símbolo, obtiene todos los precios de los tickers
      tickerData = await binance.prices();
    }

    console.log("[API/Binance/Ticker] Precios obtenidos con éxito.");

    return NextResponse.json(
      {
        message: "Precios de tickers obtenidos con éxito de Binance.",
        data: tickerData,
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