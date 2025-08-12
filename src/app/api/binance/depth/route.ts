// src/app/api/binance/depth/route.ts
import { NextResponse } from 'next/server';
import ccxt from 'ccxt';

// Configuración de CCXT para Mainnet y Testnet
const exchangeMainnet = new ccxt.binance({
  apiKey: process.env.BINANCE_API_KEY,
  secret: process.env.BINANCE_SECRET_KEY,
});

const exchangeTestnet = new ccxt.binance({
    apiKey: process.env.BINANCE_TESTNET_API_KEY,
    secret: process.env.BINANCE_TESTNET_SECRET_KEY,
    urls: {
        api: {
           public: 'https://testnet.binance.vision/api/',
           private: 'https://testnet.binance.vision/api/',
         },
    },
});

export async function GET(request: Request) {
  let symbol: string | null = null;
  let isTestnet = false;
  let limitParam: string | null = null;
  let limit: number | undefined;

  try {
    const { searchParams } = new URL(request.url);
    symbol = searchParams.get('symbol');
    if (searchParams.has('isTestnet') && searchParams.get('isTestnet')?.toLowerCase() === 'true') {
        isTestnet = true;
    }
    limitParam = searchParams.get('limit');
    if (limitParam) {
        const parsedLimit = parseInt(limitParam);
        if (!isNaN(parsedLimit) && parsedLimit > 0) {
            limit = parsedLimit;
        }
    }

    const exchangeToUse = isTestnet ? exchangeTestnet : exchangeMainnet;
    const networkType = isTestnet ? 'Testnet' : 'Mainnet';

    if (!symbol) {
      return NextResponse.json(
        { success: false, message: `Parámetro \"symbol\" es requerido para obtener depth en ${networkType}.` },
        { status: 400 }
      );
    }

    if (exchangeToUse.apiKey === undefined || exchangeToUse.secret === undefined) {
      console.error(`[API/Binance/Depth] Error: Las credenciales de ${networkType} no están configuradas.`);
      return NextResponse.json({
        success: false,
        message: `Las credenciales de Binance ${networkType} no están configuradas en las variables de entorno (.env.local).`
      }, { status: 500 });
    }

    // Normalizar el símbolo para ccxt (ej: BTCUSDT -> BTC/USDT)
    const ccxtSymbol = symbol.includes('/') ? symbol.toUpperCase() : `${symbol.toUpperCase().replace('USDT', '')}/USDT`;

    const orderBook = await exchangeToUse.fetchOrderBook(ccxtSymbol, limit);

    if (!orderBook) {
        return NextResponse.json(
            { success: true, message: `No se encontraron datos de depth para ${ccxtSymbol} en ${networkType}.`, data: null },
            { status: 200 }
        );
    }

    // ccxt.fetchOrderBook() devuelve un objeto con bids (compras) y asks (ventas)
    // cada uno es un array de [price, amount]
    // Ejemplo: { bids: [[30000, 0.5], [29999, 1]], asks: [[30001, 0.3], [30002, 0.6]] }

    return NextResponse.json({
      success: true,
      message: `Datos de depth para ${symbol} obtenidos con éxito de ${networkType}.`,
      data: {
          bids: orderBook.bids, // Array de [precio, cantidad] para órdenes de compra
          asks: orderBook.asks, // Array de [precio, cantidad] para órdenes de venta
          timestamp: orderBook.timestamp, // Timestamp de la respuesta
          datetime: orderBook.datetime, // Fecha y hora legible
          nonce: orderBook.nonce, // Un número que incrementa con cada actualización (útil para websockets)
      },
    }, {
      status: 200,
      headers: {
        'Cache-Control': 's-maxage=5, stale-while-revalidate=10', // Cache de corta duración para datos en tiempo real
        'Content-Type': 'application/json',
      }
    });

  } catch (error: any) {
    console.error(`[API/Binance/Depth] Error al obtener depth para ${symbol || 'símbolo desconocido'} en ${isTestnet ? 'Testnet' : 'Mainnet'}:`, error);

    let userMessage = `Error al obtener los datos de depth de Binance ${isTestnet ? 'Testnet' : 'Mainnet'}.`;
    let details = error.message || 'Error desconocido';
    let statusCode = 500;

    if (error instanceof ccxt.NetworkError) {
        userMessage = "Error de conexión con la API de Binance. Intenta de nuevo más tarde.";
        statusCode = 503;
    } else if (error instanceof ccxt.ExchangeError) {
        userMessage = "Ocurrió un error en el exchange de Binance al obtener los datos de depth.";
        statusCode = 502;
         if (error.message.includes('code=')) {
             const codeMatch = error.message.match(/code=(-?\d+)/);
             if (codeMatch && codeMatch[1]) {
                 // binanceErrorCode = parseInt(codeMatch[1], 10); // Puedes capturarlo si es útil
             }
         }
    } else if (error instanceof Error) {
        userMessage = `Error interno del servidor al procesar depth: ${error.message}`;
        statusCode = 500;
    } else {
        userMessage = "Ocurrió un error inesperado al obtener los datos de depth.";
        statusCode = 500;
        details = JSON.stringify(error);
    }

    return NextResponse.json(
      {
        success: false,
        message: userMessage,
        details: details,
      },
      { status: statusCode }
    );
  }
}
