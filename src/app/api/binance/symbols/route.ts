
// src/app/api/binance/symbols/route.ts
import { NextResponse } from 'next/server';
import ccxt from 'ccxt';

// Configuración de CCXT para Mainnet ÚNICAMENTE
const exchangeMainnet = new ccxt.binance({
  apiKey: process.env.BINANCE_API_KEY,
  secret: process.env.BINANCE_SECRET_KEY,
});

export async function POST(req: Request) { // Mantenemos POST por consistencia si otros endpoints usan POST
  console.log(`[API/Binance/Symbols Mainnet] Solicitud POST recibida para Mainnet.`);

  // Ya no se espera 'isTestnet' en el cuerpo.
  // try {
  //   // const requestBody: { isTestnet?: boolean } = await req.json();
  // } catch (jsonError: any) {
  //   console.log("[API/Binance/Symbols Mainnet] Solicitud POST sin cuerpo JSON o con cuerpo inválido, procediendo...");
  // }
  console.log(`[API/Binance/Symbols Mainnet] Usando configuración para la red: Mainnet`);

  try {
    console.log(`[API/Binance/Symbols Mainnet] Solicitando lista de mercados a CCXT en Mainnet...`);
    const markets = await exchangeMainnet.fetchMarkets() as any[]; // Mantener aserción
    console.log(`[API/Binance/Symbols Mainnet] Lista de mercados obtenida. Cantidad: ${markets ? markets.length : 0}`);

    const filteredAndFormattedSymbols = markets
      .filter((market: any) => market?.active === true && market?.quote === 'USDT')
      .map((market: any) => {
        const minNotional = market?.limits?.cost?.min;
        const minQty = market?.limits?.amount?.min;
        const amountPrecision = market?.precision?.amount;
        const pricePrecision = market?.precision?.price;
        // Usar pricePrecision para quotePrecision es una aproximación común si quotePrecision no está explícito.
        const quotePrecision = market?.precision?.price; 
        const basePrecision = market?.precision?.base; // O amountPrecision si base no está

        return {
          id: market?.id, // Símbolo de Binance: BTCUSDT
          symbol: market?.symbol, // Símbolo CCXT: BTC/USDT
          name: `${market?.base}/${market?.quote}`,
          baseAsset: market?.base,
          quoteAsset: market?.quote,
          latestPrice: null,
          minNotional: minNotional,
          minQty: minQty,
          amountPrecision: amountPrecision,
          pricePrecision: pricePrecision,
          quotePrecision: quotePrecision,
          basePrecision: basePrecision || amountPrecision, // Fallback para basePrecision
        };
      });

    const cleanFilteredAndFormattedSymbols = filteredAndFormattedSymbols.filter(symbol => symbol !== undefined && symbol !== null);
    console.log(`[API/Binance/Symbols Mainnet] ${cleanFilteredAndFormattedSymbols.length} símbolos filtrados y formateados.`);

    return NextResponse.json({
      success: true,
      message: `Lista de símbolos obtenida con éxito de Binance Mainnet.`,
      symbols: cleanFilteredAndFormattedSymbols,
    });

  } catch (error: any) {
    console.error(`[API/Binance/Symbols Mainnet] Error al obtener lista de mercados con CCXT en Mainnet:`, error);
    let userMessage = `Error al obtener la lista de símbolos de Binance Mainnet.`;
    let details = error.message || 'Error desconocido';
    let statusCode = 500;
    let binanceErrorCode = undefined;

    if (error instanceof ccxt.NetworkError) {
      userMessage = "Error de conexión con la API de Binance. Intenta de nuevo más tarde.";
      statusCode = 503;
    } else if (error instanceof ccxt.AuthenticationError) {
      userMessage = "Error de autenticación con la API de Binance. Verifica tus claves API.";
      statusCode = 401;
    } else if (error instanceof ccxt.ExchangeError) {
      userMessage = "Ocurrió un error en el exchange de Binance al obtener la lista de símbolos.";
      if (error.message.includes('code=')) {
        const codeMatch = error.message.match(/code=(-?\d+)/);
        if (codeMatch && codeMatch[1]) {
          binanceErrorCode = parseInt(codeMatch[1], 10);
        }
      }
    }
    return NextResponse.json({
      success: false,
      message: userMessage,
      details: details,
      binanceErrorCode: binanceErrorCode,
    }, { status: statusCode });
  }
}
