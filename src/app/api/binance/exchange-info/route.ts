// src/app/api/binance/exchange-info/route.ts
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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbolParam = searchParams.get('symbol');
  const networkType = 'Mainnet';

  console.log(`[API/Binance/ExchangeInfo] Recibida solicitud de info en ${networkType}${symbolParam ? ` para ${symbolParam}` : ''}.`);

  try {
    // No se necesitan credenciales para exchangeInfo, pero es buena práctica tener el cliente configurado
    
    await exchangeMainnet.loadMarkets();
    console.log(`[API/Binance/ExchangeInfo] Info del exchange obtenida.`);

    let responseData = null;
    if (symbolParam) {
        const ccxtSymbol = symbolParam.includes('/') ? symbolParam : `${symbolParam.replace(/USDT$/i, '')}/USDT`;
        const marketInfo = exchangeMainnet.market(ccxtSymbol);
        if (marketInfo) {
             responseData = marketInfo;
             console.log(`[API/Binance/ExchangeInfo] Encontrada información detallada para el símbolo ${ccxtSymbol}.`);
        } else {
             return NextResponse.json({
                  success: false,
                  message: `Información no encontrada para ${ccxtSymbol}.`
              }, { status: 404 });
        }
    } else {
        responseData = exchangeMainnet.markets;
        console.log(`[API/Binance/ExchangeInfo] Devolviendo información para ${Object.keys(responseData).length} mercados.`);
    }

    return NextResponse.json({
      success: true,
      message: `Información del exchange de ${networkType} obtenida con éxito.`,
      data: responseData,
    });

  } catch (error: any) {
    console.error(`[API/Binance/ExchangeInfo] Error al obtener info del exchange con CCXT en ${networkType}:`, error);
    let userMessage = `Error al obtener la información del exchange de ${networkType}.`;
    let details = error.message || 'Error desconocido';
    let statusCode = 500;

    if (error instanceof ccxt.NetworkError) {
        userMessage = "Error de conexión con la API de Binance.";
        statusCode = 503;
    } else if (error instanceof ccxt.AuthenticationError) {
         userMessage = "Error de autenticación. Verifica tus claves API.";
         statusCode = 401;
    } else if (error instanceof ccxt.ExchangeError) {
         userMessage = "Ocurrió un error en el exchange al obtener la información del mercado.";
         details = error.message;
    }

    return NextResponse.json({
      success: false,
      message: userMessage,
      details: details,
    }, { status: statusCode });
  }
}
