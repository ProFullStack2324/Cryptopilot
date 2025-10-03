// src/app/api/binance/exchange-info/route.ts
import { NextResponse } from 'next/server';
import { exchange } from '@/lib/binance-client'; // Importar cliente centralizado
import ccxt from 'ccxt';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbolParam = searchParams.get('symbol');
  const networkType = 'Futures Testnet';

  console.log(`[API/Binance/ExchangeInfo] Recibida solicitud de info en ${networkType}${symbolParam ? ` para ${symbolParam}` : ''}.`);

  try {
    if (!exchange.apiKey || !exchange.secret) {
        console.error(`[API/Binance/ExchangeInfo] Error: Las credenciales de ${networkType} no están configuradas.`);
        return NextResponse.json({
          success: false,
          message: `Las credenciales de Binance ${networkType} no están configuradas.`
        }, { status: 500 });
    }

    await exchange.loadMarkets();
    console.log(`[API/Binance/ExchangeInfo] Info del exchange obtenida.`);

    let responseData = null;
    if (symbolParam) {
        const marketInfo = exchange.market(symbolParam);
        if (marketInfo) {
             responseData = marketInfo;
             console.log(`[API/Binance/ExchangeInfo] Encontrada información detallada para el símbolo ${symbolParam}.`);
        } else {
             return NextResponse.json({
                  success: false,
                  message: `Información no encontrada para ${symbolParam}.`
              }, { status: 404 });
        }
    } else {
        responseData = exchange.markets;
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
