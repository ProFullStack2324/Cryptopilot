// src/app/api/binance/klines/route.ts
import { NextResponse } from 'next/server';
import ccxt from 'ccxt';
import { MarketPriceDataPoint } from '@/lib/types';

const BINANCE_API_KEY = process.env.BINANCE_API_KEY;
const BINANCE_SECRET_KEY = process.env.BINANCE_SECRET_KEY;

// Configura la instancia de Binance (considerando el entorno de futuros USD-M como antes)
const exchange = new ccxt.binance({
  apiKey: BINANCE_API_KEY,
  secret: BINANCE_SECRET_KEY,
  options: {
    'defaultType': 'future', // Para operar en futuros USD-M
  },
  // Habilita el modo de prueba si es necesario (para testnet de Binance Futures)
  // Descomenta y configura si usas testnet
  // 'urls': {
  //   'api': {
  //     'fapiPublic': 'https://testnet.binancefuture.com/fapi/v1',
  //     'fapiPrivate': 'https://testnet.binancefuture.com/fapi/v1',
  //   },
  // },
  timeout: 10000, // Aumentar el timeout a 10 segundos para evitar errores de red
  enableRateLimit: true, // Habilita la limitación de tasa interna de ccxt
});

export async function GET(request: Request) {
  console.log('[API Klines] Solicitud entrante.');
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol'); // Ej: BTCUSDT
    const timeframe = searchParams.get('timeframe'); // Ej: 1m, 5m, 1h, 1d
    const limitParam = searchParams.get('limit'); // Cantidad de velas a obtener

    if (!symbol || !timeframe) {
      console.warn('[API Klines] Error 400: Parámetros "symbol" y "timeframe" son requeridos.');
      return NextResponse.json(
        { error: 'Parámetros "symbol" y "timeframe" son requeridos.' },
        { status: 400 }
      );
    }

    let limit: number | undefined;
    if (limitParam) {
      const parsedLimit = parseInt(limitParam);
      if (isNaN(parsedLimit) || parsedLimit <= 0) {
        console.warn(`[API Klines] Advertencia: Límite inválido "${limitParam}". Usando predeterminado.`);
        limit = undefined; // Dejar que ccxt use su límite predeterminado
      } else {
        limit = parsedLimit;
      }
    }

    // Normalizar el símbolo para ccxt (ej: BTCUSDT -> BTC/USDT)
    // Esto es robusto, ya que ccxt espera "BTC/USDT" para pares futuros.
    const ccxtSymbol = symbol.includes('/') ? symbol.toUpperCase() : `${symbol.toUpperCase().replace('USDT', '')}/USDT`;

    console.log(`[API Klines] Procesando solicitud para: ${ccxtSymbol}, timeframe: ${timeframe}, limit: ${limit || 'ccxt default'}.`);

    // Fetch the OHLCV (candlestick) data
    const klines = await exchange.fetchOHLCV(
      ccxtSymbol,
      timeframe,
      undefined, // since: No lo especificamos para obtener los más recientes
      limit // limit: Usar el valor del query param o el predeterminado de ccxt/Binance
    );

    if (!klines || klines.length === 0) {
      console.warn(`[API Klines] No se recibieron klines para ${ccxtSymbol} (${timeframe}).`);
      return NextResponse.json(
        { message: 'No se encontraron datos de klines para los parámetros especificados.', klines: [] },
        { status: 200 } // Podría ser 404 si la ausencia de datos es un error, pero 200 es aceptable si es una condición válida
      );
    }

    console.log(`[API Klines] Klines recibidos de Binance: ${klines.length} puntos.`);

    const transformedKlines: MarketPriceDataPoint[] = klines.map(kline => {
      if (!Array.isArray(kline) || kline.length < 6) {
        console.warn("[API Klines] Dato kline incompleto o malformado, saltando:", kline);
        return null; // Retornar null para filtrar más tarde
      }

      // Los elementos de kline son: [timestamp, open, high, low, close, volume]
      // Asegurarse de que los valores no sean null/undefined antes de usar
      const timestampMs = kline[0];
      const openPrice = kline[1];
      const highPrice = kline[2];
      const lowPrice = kline[3];
      const closePrice = kline[4];
      const tradeVolume = kline[5];

      // Verificación de tipos y valores válidos
      if (typeof timestampMs !== 'number' || typeof closePrice !== 'number' || typeof tradeVolume !== 'number') {
        console.warn(`[API Klines] Datos numéricos faltantes o inválidos en kline: ${kline}`);
        return null;
      }

      return {
        timestamp: Math.floor(timestampMs / 1000), // Convertir ms a segundos
        price: closePrice, // Usar el precio de cierre
        volume: tradeVolume,
        // Puedes añadir open, high, low aquí si tu MarketPriceDataPoint lo soporta y lo necesitas en el frontend
        // open: openPrice,
        // high: highPrice,
        // low: lowPrice,
      };
    }).filter((kline): kline is MarketPriceDataPoint => kline !== null); // Filtrar nulos y asegurar el tipo

    if (transformedKlines.length === 0) {
      console.warn('[API Klines] Todos los klines filtrados después de la transformación.');
      return NextResponse.json(
        { message: 'Los datos de klines recibidos no pudieron ser procesados.', klines: [] },
        { status: 500 } // Error interno si no se puede procesar nada
      );
    }

    console.log(`[API Klines] Klines transformados y listos para enviar: ${transformedKlines.length} puntos.`);

    return NextResponse.json({
      message: `Klines para ${symbol} (${timeframe}) obtenidos con éxito.`,
      klines: transformedKlines,
    }, {
      status: 200,
      headers: {
        'Cache-Control': 's-maxage=60, stale-while-revalidate=120', // Cache por 60 segundos, revalidar en 120
        'Content-Type': 'application/json',
      }
    });

  } catch (error: any) {
    let errorMessage = 'Error desconocido al obtener Klines de Binance.';
    let statusCode = 500;

    if (error instanceof ccxt.NetworkError) {
      errorMessage = `Error de red o conexión con Binance: ${error.message}`;
      statusCode = 503; // Service Unavailable
    } else if (error instanceof ccxt.ExchangeError) {
      errorMessage = `Error de la API de Binance: ${error.message}`;
      statusCode = 502; // Bad Gateway (error del upstream, Binance)
    } else if (error instanceof Error) {
      errorMessage = `Error interno del servidor: ${error.message}`;
      statusCode = 500;
    }

    console.error(`[API Klines] Error al procesar solicitud: ${errorMessage}`, error);

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}