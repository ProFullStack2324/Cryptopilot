// src/app/api/binance/symbols/route.ts
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

export async function POST(req: Request) {
  const networkType = 'Mainnet';
  console.log(`[API/Binance/Symbols] Solicitud POST recibida. Usando ${networkType}.`);

  try {
    await exchangeMainnet.loadMarkets();
    const markets = exchangeMainnet.markets;
    console.log(`[API/Binance/Symbols] Lista de mercados obtenida. Cantidad: ${markets ? Object.keys(markets).length : 0}`);

    const filteredAndFormattedSymbols = Object.values(markets)
        .filter((market: any) =>
            market?.active === true &&
            market?.quote === 'USDT' &&
            market?.type === 'spot' // Asegurar que son mercados spot
        )
        .map((market: any) => {
             const lotSizeFilter = market.info?.filters?.find((f: any) => f.filterType === 'LOT_SIZE');
             const minNotionalFilter = market.info?.filters?.find((f: any) => f.filterType === 'MIN_NOTIONAL');
             const priceFilter = market.info?.filters?.find((f: any) => f.filterType === 'PRICE_FILTER');

             return {
                id: market?.id,
                symbol: market?.symbol,
                name: market?.symbol,
                baseAsset: market?.base,
                quoteAsset: market?.quote,
                latestPrice: null,
                minNotional: parseFloat(minNotionalFilter?.notional) || 0,
                minQty: parseFloat(lotSizeFilter?.minQty) || 0,
                amountPrecision: market?.precision?.amount,
                pricePrecision: market?.precision?.price,
                quotePrecision: market?.precision?.quote,
            };
        });

    console.log(`[API/Binance/Symbols] ${filteredAndFormattedSymbols.length} símbolos filtrados y formateados.`);

    return NextResponse.json({
      success: true,
      message: `Lista de símbolos obtenida con éxito de ${networkType}.`,
      symbols: filteredAndFormattedSymbols,
    });

  } catch (error: any) {
    console.error(`[API/Binance/Symbols] Error al obtener lista de mercados con CCXT en ${networkType}:`, error);
    let userMessage = `Error al obtener la lista de símbolos de ${networkType}.`;
    let details = error.message || 'Error desconocido';
    let statusCode = 500;

    if (error instanceof ccxt.NetworkError) {
        userMessage = "Error de conexión con la API de Binance.";
        statusCode = 503;
    } else if (error instanceof ccxt.AuthenticationError) {
         userMessage = "Error de autenticación. Verifica tus claves API.";
         statusCode = 401;
    } else if (error instanceof ccxt.ExchangeError) {
         userMessage = "Error en el exchange al obtener la lista de símbolos.";
         details = error.message;
    }

    return NextResponse.json({
      success: false,
      message: userMessage,
      details: details,
    }, { status: statusCode });
  }
}
