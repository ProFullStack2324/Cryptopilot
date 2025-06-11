
// src/app/api/binance/klines/route.ts
import { NextResponse } from 'next/server';
import ccxt from 'ccxt';
import { MarketPriceDataPoint } from '@/lib/types';

const BINANCE_API_KEY = process.env.BINANCE_API_KEY;
const BINANCE_SECRET_KEY = process.env.BINANCE_SECRET_KEY;

// Configura la instancia de Binance para la red principal ÚNICAMENTE
const exchangeMainnet = new ccxt.binance({
  apiKey: BINANCE_API_KEY,
  secret: BINANCE_SECRET_KEY,
  options: {
    'defaultType': 'spot', // O 'future' si es lo que usas principalmente
  },
  timeout: 10000,
  enableRateLimit: true,
});

export async function GET(request: Request) {
  console.log('[API Klines Mainnet] Solicitud GET entrante.');

  let symbol: string | null = null;
  let timeframe: string | null = null;
  let limitParam: string | null = null;
  let limit: number | undefined;

  try {
    const { searchParams } = new URL(request.url);
    symbol = searchParams.get('symbol'); // Ej: BTCUSDT
    timeframe = searchParams.get('timeframe'); // Ej: 1m, 5m, 1h, 1d
    limitParam = searchParams.get('limit');

    // La lógica de isTestnet y networkType se elimina
    console.log(`[API Klines Mainnet] Solicitud para Mainnet.`);

    if (!symbol || !timeframe) {
      console.warn(`[API Klines Mainnet] Error 400: Parámetros "symbol" y "timeframe" son requeridos.`);
      return NextResponse.json(
        { success: false, message: `Parámetros "symbol" y "timeframe" son requeridos para obtener klines en Mainnet.` },
        { status: 400 }
      );
    }

    if (exchangeMainnet.apiKey === undefined || exchangeMainnet.secret === undefined) {
      console.error(`[API Klines Mainnet] Error: Las credenciales de Mainnet no están configuradas.`);
      return NextResponse.json({
        success: false,
        message: `Las credenciales de Binance Mainnet no están configuradas en las variables de entorno (.env.local).`
      }, { status: 500 });
    }
    console.log(`[API Klines Mainnet] Credenciales de Mainnet cargadas correctamente.`);

    if (limitParam) {
      const parsedLimit = parseInt(limitParam);
      if (isNaN(parsedLimit) || parsedLimit <= 0) {
        console.warn(`[API Klines Mainnet] Advertencia: Límite inválido "${limitParam}". Usando predeterminado.`);
        limit = undefined;
      } else {
        limit = parsedLimit;
      }
    }

    // Normalizar el símbolo para ccxt (ej: BTCUSDT -> BTC/USDT)
    const ccxtSymbol = symbol.includes('/') ? symbol.toUpperCase() : `${symbol.toUpperCase().replace(/USDT$/, '')}/USDT`;
    console.log(`[API Klines Mainnet] Procesando solicitud para: ${ccxtSymbol}, timeframe: ${timeframe}, limit: ${limit || 'ccxt default'}.`);

    const klines = await exchangeMainnet.fetchOHLCV(
      ccxtSymbol,
      timeframe,
      undefined,
      limit
    );

    if (!klines || klines.length === 0) {
      console.warn(`[API Klines Mainnet] No se recibieron klines para ${ccxtSymbol} (${timeframe}).`);
      return NextResponse.json(
        { success: true, message: `No se encontraron datos de klines para ${ccxtSymbol} (${timeframe}) en Mainnet.`, klines: [] },
        { status: 200 }
      );
    }

    console.log(`[API Klines Mainnet] Klines recibidos de Binance Mainnet: ${klines.length} puntos.`);

    const transformedKlines: MarketPriceDataPoint[] = (klines as any[]).map(kline => {
      if (!Array.isArray(kline) || kline.length < 6) {
        console.warn(`[API Klines Mainnet] Dato kline incompleto o malformado, saltando:`, kline);
        return null;
      }
      const [timestampMs, openPrice, highPrice, lowPrice, closePrice, tradeVolume] = kline;
      if (
        typeof timestampMs !== 'number' ||
        typeof closePrice !== 'number' ||
        typeof tradeVolume !== 'number'
      ) {
        console.warn(`[API Klines Mainnet] Datos numéricos faltantes o inválidos en kline: ${kline}`);
        return null;
      }
      return {
        timestamp: Math.floor(timestampMs / 1000),
        price: closePrice,
        volume: tradeVolume,
      };
    }).filter((kline): kline is MarketPriceDataPoint => kline !== null);

    if (transformedKlines.length === 0) {
      console.warn(`[API Klines Mainnet] Todos los klines filtrados después de la transformación.`);
      return NextResponse.json(
        { success: false, message: `Los datos de klines recibidos para ${ccxtSymbol} (${timeframe}) en Mainnet no pudieron ser procesados.`, klines: [] },
        { status: 500 }
      );
    }

    console.log(`[API Klines Mainnet] Klines transformados y listos para enviar: ${transformedKlines.length} puntos.`);
    return NextResponse.json({
      success: true,
      message: `Klines para ${symbol} (${timeframe}) obtenidos con éxito de Mainnet.`,
      klines: transformedKlines,
    }, {
      status: 200,
      headers: {
        'Cache-Control': 's-maxage=60, stale-while-revalidate=120',
        'Content-Type': 'application/json',
      }
    });

  } catch (error: any) {
    let details: string | undefined = undefined;
    let errorMessage = `Error desconocido al obtener Klines de Binance Mainnet.`;
    let statusCode = 500;
    let binanceErrorCode = undefined;

    if (error instanceof ccxt.NetworkError) {
      errorMessage = `Error de red o conexión con Binance Mainnet: ${error.message}`;
      details = error.message;
      statusCode = 503;
    } else if (error instanceof ccxt.ExchangeError) {
      errorMessage = `Error de la API de Binance Mainnet: ${error.message}`;
      details = error.message;
      statusCode = 502;
      if (error.message.includes('code=')) {
          const codeMatch = error.message.match(/code=(-?\d+)/);
          if (codeMatch && codeMatch[1]) {
              binanceErrorCode = parseInt(codeMatch[1], 10);
              console.warn(`[API Klines Mainnet] Código de error de Binance extraído: ${binanceErrorCode}`);
          }
      }
    } else if (error instanceof Error) {
      errorMessage = `Error interno del servidor al procesar klines para ${symbol || 'símbolo desconocido'} en Mainnet: ${error.message}`;
      details = error.message;
      statusCode = 500;
    } else {
      console.error(`[API Klines Mainnet] Error inesperado para ${symbol || 'símbolo desconocido'}:`, error);
      errorMessage = `Ocurrió un error inesperado al obtener klines para ${symbol || 'símbolo desconocido'} en Mainnet.`;
      details = error.message || JSON.stringify(error);
      statusCode = 500;
    }
    console.error(`[API Klines Mainnet] Error al procesar solicitud: ${errorMessage}`, error);
    return NextResponse.json(
      { success: false, message: errorMessage, details: details, binanceErrorCode: binanceErrorCode },
      { status: statusCode }
    );
  }
}
